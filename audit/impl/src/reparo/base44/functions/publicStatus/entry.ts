// =============================================================================
// publicStatus — PUBLIC (no login). Powers /estado.html, the "Estado del ticket"
// widget (replaces HelloClient's /check.html):
//   POST { id: "<ticket_uuid>" }   → one order (QR code on the receipt)
//   POST { phone: "+34 6xx…", order: "1234" } → that one order, only if both match
//                                    (audit B-05: phone alone no longer lists orders)
// Only non-personal fields are returned: no names, phones, codes or prices.
// =============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Id' };
function normalizePhone(raw: any): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0034')) d = d.slice(2);
  if (d.length === 9) d = '34' + d;
  return d;
}
const NAMED: Record<string,string> = { rose:'#e11d48', red:'#dc2626', orange:'#ea580c', amber:'#d97706', yellow:'#ca8a04', lime:'#65a30d', green:'#16a34a', emerald:'#059669', teal:'#0d9488', cyan:'#0891b2', sky:'#0284c7', blue:'#2563eb', indigo:'#4f46e5', violet:'#7c3aed', purple:'#9333ea', pink:'#db2777', black:'#111827', gray:'#6b7280', slate:'#475569' };
const hex = (c: string) => (String(c || '').startsWith('#') ? c : NAMED[String(c || '').toLowerCase()] || '#2563eb');
const view = (o: any) => {
  const group = o.status_group || '';
  return {
    id: o.ticket_uuid, number: o.order_id, status: o.status_name || '', color: hex(o.status_color),
    stage: group, ready: group === 'ready', closed: !o.is_open || group === 'failed',
    device: [o.device_brand, o.device_model].filter(Boolean).join(' '),
    created_at: o.hc_created_at || o.created_date || null, estimated_at: o.estimated_at || null, closed_at: o.closed_at || null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const body = await req.json().catch(() => ({}));

  let shop = { name: 'Informática Torrent', phone: '', address: '' };
  try {
    const s = await sr.SystemSettings.filter({ setting_key: 'shop_company' });
    if (s[0]) { const c = JSON.parse(s[0].setting_value || '{}'); shop = { name: c.name || shop.name, phone: c.phone || '', address: c.address || '' }; }
  } catch { /* defaults */ }

  if (body.phone) {
    const p = normalizePhone(body.phone);
    if (p.length < 9) return Response.json({ error: 'bad_phone' }, { status: 400, headers: cors });
    const order = String(body.order || '').replace(/\D/g, '');
    if (!order) return Response.json({ error: 'bad_order' }, { status: 400, headers: cors });
    // Anti-abuso (B-05): sin IP no se responde; 10 consultas por IP y 200 en total cada 10 minutos.
    const ip = String(
      req.headers.get('x-forwarded-for')?.split(',')[0]
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || '',
    ).trim();
    if (!ip) return Response.json({ error: 'too_many' }, { status: 429, headers: cors });
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [usedByIp, usedTotal] = await Promise.all([
      sr.PublicLookupLog.count({ ip, at: { $gte: since } }).catch(() => 0),
      sr.PublicLookupLog.count({ at: { $gte: since } }).catch(() => 0),
    ]);
    if (usedByIp >= 10 || usedTotal >= 200) return Response.json({ error: 'too_many' }, { status: 429, headers: cors });
    await sr.PublicLookupLog.create({ ip, at: new Date().toISOString() }).catch(() => {});
    const rows = await sr.RepairOrder.filter({ customer_phone: p }, '-number', 50, 0,
      ['ticket_uuid', 'order_id', 'status_name', 'status_color', 'status_group', 'is_open', 'device_brand', 'device_model', 'hc_created_at', 'created_date', 'estimated_at', 'closed_at']).catch(() => []);
    // Same answer for "wrong phone" and "wrong number": nothing tells which one failed.
    const match = rows.find((o: any) => String(o.order_id || '').replace(/\D/g, '') === order);
    return Response.json({ orders: match ? [view(match)] : [], shop }, { headers: cors });
  }

  const id = String(body.id || '').trim();
  if (!UUID.test(id)) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
  const rows = await sr.RepairOrder.filter({ ticket_uuid: id }).catch(() => []);
  if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
  return Response.json({ ...view(rows[0]), shop }, { headers: cors });
});