// wizardNotify — botón «Avisar desde hoy» del asistente de equipos listos.
// Envía al cliente el aviso de «listo para recoger» (T-04, sin fecha) y reinicia
// el ciclo de recordatorios 3/7/15 días contando desde hoy (ready_at = ahora).
// Lo pulsa una persona: no espera al modo prueba; la pausa global sí lo para.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const sr = base44.asServiceRole.entities;
  const body = await req.json().catch(() => ({}));
  const order = rows(await sr.RepairOrder.filter({ order_id: String(body.order_id || '') }))[0];
  if (!order) return Response.json({ error: 'not_found' }, { status: 404 });
  if (order.status_group !== 'ready' || order.is_open === false) return Response.json({ error: 'La orden no está lista para recoger' }, { status: 400 });
  const url = (Deno.env.get('REPARO_WA_URL') || '').trim();
  const key = (Deno.env.get('REPARO_WA_KEY') || '').trim();
  if (!url || !key) return Response.json({ error: 'WhatsApp no configurado' }, { status: 503 });

  const now = new Date().toISOString();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reparo-Key': key },
    body: JSON.stringify({
      action: 'reminder', kind: 'uncollected_3', manual: true, since: '',
      order_id: order.order_id, customer_name: order.customer_name, customer_phone: order.customer_phone,
      device: [order.device_brand, order.device_model].filter(Boolean).join(' '),
    }),
    signal: AbortSignal.timeout(30000),
  }).then((x) => x.json().catch(() => ({}))).catch((e) => ({ error: String(e?.message || e) }));
  const result = r?.sent ? 'enviado' : `no enviado: ${r?.skipped || r?.detail || r?.error || ''}`;
  await sr.RepairOrder.update(order.id, {
    ready_at: now,
    reminders_sent: r?.sent ? [{ kind: 'uncollected_3', for: now, at: now, result }] : [],
    events: [...(order.events || []), { type: 'COMMENT', text: `Asistente: aviso de recogida (${result}); recordatorios desde hoy`, author: user.full_name || user.email, at: now }],
    hc_updated_at: now,
  });
  await sr.ActionLog.create({ action: 'whatsapp', order_id: order.order_id, detail: `Asistente «Avisar desde hoy» → ${result}`, at: now, user_email: user.email }).catch(() => {});
  return Response.json({ ok: true, sent: !!r?.sent, result });
});
