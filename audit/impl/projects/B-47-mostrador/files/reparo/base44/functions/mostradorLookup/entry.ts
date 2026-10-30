// =============================================================================
// mostradorLookup — búsqueda y panel «Hoy» de Mostrador (auditoría B-47).
// Solo lectura. Server-to-server: cabecera X-Mostrador-Key = secreto MOSTRADOR_KEY
// (mismo valor en Mostrador). Mostrador exige sesión de un empleado antes de llamar.
//
//   POST { action: 'search', q }  → órdenes y clientes (nº de orden, teléfono, nombre)
//   POST { action: 'hoy' }        → listos para recoger, presupuestos, esperando
//                                   material y nuevos de hoy
// =============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const BASE = 'https://reparo-812bcab8.base44.app';
const ORDER_FIELDS = ['order_id', 'customer_name', 'customer_phone', 'device_brand', 'device_model', 'status_name', 'status_group', 'is_open', 'hc_created_at', 'hc_updated_at', 'created_date'];
const BUDGET_STATUS = 'Enviar un Presupuesto';
const MATERIAL_STATUS = 'Esperando Material';
const RECENT_READY_DAYS = 90;

const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function phoneVariants(raw: string): string[] {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0034')) d = d.slice(2);
  const out = new Set<string>([d]);
  if (d.startsWith('34') && d.length === 11) out.add(d.slice(2));
  if (d.length === 9) out.add('34' + d);
  for (const v of [...out]) out.add('+' + v);
  return [...out];
}

/** 00:00 de hoy en Madrid, en ISO UTC. */
function madridMidnightIso() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const offsetH = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date(`${day}T12:00:00Z`))) - 12;
  return new Date(Date.parse(`${day}T00:00:00Z`) - offsetH * 3600000).toISOString();
}

const orderItem = (o: any) => ({
  app: 'reparo', type: 'orden', id: o.order_id,
  title: `#${o.order_id} · ${o.customer_name || 'Sin nombre'}`,
  subtitle: [[o.device_brand, o.device_model].filter(Boolean).join(' '), o.status_name].filter(Boolean).join(' · '),
  at: o.hc_updated_at || o.hc_created_at || o.created_date || null,
  url: `${BASE}/tickets/${encodeURIComponent(o.order_id)}`,
});

Deno.serve(async (req) => {
  const expected = (Deno.env.get('MOSTRADOR_KEY') || '').trim();
  if (!expected || !safeEqual(req.headers.get('X-Mostrador-Key') || '', expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'search') {
    const q = String(body.q || '').trim().slice(0, 60);
    const digits = q.replace(/\D/g, '');
    const results: any[] = [];
    if (/^#?\d{1,7}$/.test(q)) {
      results.push(...rows(await sr.RepairOrder.filter({ order_id: digits }, '-number', 3, 0, ORDER_FIELDS).catch(() => [])).map(orderItem));
    }
    if (digits.length >= 9 && digits.length <= 13) {
      const v = phoneVariants(digits);
      results.push(...rows(await sr.RepairOrder.filter({ $or: [{ customer_phone: { $in: v } }, { client_phones: { $in: v } }] }, '-number', 8, 0, ORDER_FIELDS).catch(() => [])).map(orderItem));
      for (const c of rows(await sr.Client.filter({ $or: [{ phone: { $in: v } }, { phones: { $in: v } }] }, '-created_date', 3).catch(() => []))) {
        results.push({ app: 'reparo', type: 'cliente', id: c.id, title: c.full_name || 'Cliente', subtitle: c.phone || '', url: `${BASE}/clientes/${c.id}` });
      }
    }
    if (!digits && q.length >= 3) {
      const re = { $regex: escapeRe(q), $options: 'i' };
      results.push(...rows(await sr.RepairOrder.filter({ customer_name: re }, '-number', 8, 0, ORDER_FIELDS).catch(() => [])).map(orderItem));
      for (const c of rows(await sr.Client.filter({ full_name: re }, '-created_date', 5).catch(() => []))) {
        results.push({ app: 'reparo', type: 'cliente', id: c.id, title: c.full_name || 'Cliente', subtitle: c.phone || '', url: `${BASE}/clientes/${c.id}` });
      }
    }
    const seen = new Set<string>();
    return Response.json({ results: results.filter((r) => !seen.has(r.type + r.id) && seen.add(r.type + r.id)).slice(0, 12) });
  }

  if (body.action === 'hoy') {
    const since = new Date(Date.now() - RECENT_READY_DAYS * 86400000).toISOString();
    const [readyAll, readyRecent, budgets, material, today] = await Promise.all([
      sr.RepairOrder.count({ is_open: true, status_group: 'ready' }).catch(() => null),
      sr.RepairOrder.filter({ is_open: true, status_group: 'ready', hc_updated_at: { $gte: since } }, 'hc_updated_at', 50, 0, ORDER_FIELDS).catch(() => []),
      sr.RepairOrder.filter({ is_open: true, status_name: BUDGET_STATUS }, 'hc_updated_at', 20, 0, ORDER_FIELDS).catch(() => []),
      sr.RepairOrder.filter({ is_open: true, status_name: MATERIAL_STATUS }, 'hc_updated_at', 20, 0, ORDER_FIELDS).catch(() => []),
      sr.RepairOrder.count({ hc_created_at: { $gte: madridMidnightIso() } }).catch(() => null),
    ]);
    const recent = rows(readyRecent);
    return Response.json({
      listos: { count: recent.length, total_open: readyAll, items: recent.slice(0, 8).map(orderItem), url: `${BASE}/tickets` },
      presupuestos: { count: rows(budgets).length, items: rows(budgets).slice(0, 8).map(orderItem) },
      material: { count: rows(material).length, items: rows(material).slice(0, 8).map(orderItem) },
      nuevos_hoy: today,
    });
  }

  return Response.json({ error: 'bad_action' }, { status: 400 });
});
