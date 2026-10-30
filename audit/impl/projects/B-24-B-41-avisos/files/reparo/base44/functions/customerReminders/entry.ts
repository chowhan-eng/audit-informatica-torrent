// =============================================================================
// customerReminders — recordatorios a clientes (auditoría B-41 y B-42).
// Lo llama el workflow «Recordatorios a clientes» a las 10:30, lunes a sábado.
//
//   · Sin recoger (B-41): órdenes abiertas en un estado «listo» con ready_at
//     → aviso a los 3, 7 y 15 días (textos T-04 / T-05). Solo el aviso más alto
//     que toque: si un día no se ejecuta, no se mandan dos de golpe.
//     Las órdenes listas antes de la puesta en marcha no tienen ready_at y nunca
//     reciben estos avisos (el histórico de 1.500–3.000 «Listo» queda fuera).
//   · Presupuesto sin respuesta (B-42): «Enviar un Presupuesto» desde hace más de
//     24 h y menos de 7 días, con importe → un recordatorio (T-03). WhatsApp Pro
//     no lo manda si el cliente ya ha escrito desde entonces.
//
// Cada envío se apunta en reminders_sent de la orden (tipo + fecha de referencia),
// así una segunda ejecución el mismo día no repite nada. WhatsApp Pro aplica la
// pausa global (B-10) y el modo prueba (reminders_live) antes de enviar.
// El aviso final de custodia (T-06) NO está aquí: espera el texto de la gestoría.
// =============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const BUDGET_STATUS = 'Enviar un Presupuesto';
const DAY = 86400000;
const FIELDS = ['id', 'order_id', 'customer_name', 'customer_phone', 'device_brand', 'device_model', 'estimated_cost',
  'status_name', 'status_group', 'is_open', 'ready_at', 'status_since', 'reminders_sent'];

const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));
const nowIso = () => new Date().toISOString();

function stageFor(days: number) {
  if (days >= 15) return 'uncollected_15';
  if (days >= 7) return 'uncollected_7';
  if (days >= 3) return 'uncollected_3';
  return '';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const user = await base44.auth.me().catch(() => null);
  const url = (Deno.env.get('REPARO_WA_URL') || '').trim();
  const key = (Deno.env.get('REPARO_WA_KEY') || '').trim();
  if (!url || !key) return Response.json({ ok: true, skipped: 'not_configured' });

  let cfg: any = {};
  try { cfg = JSON.parse(rows(await sr.SystemSettings.filter({ setting_key: 'shop_whatsapp' }))[0]?.setting_value || '{}') || {}; } catch { cfg = {}; }
  if (!cfg.enabled) return Response.json({ ok: true, skipped: 'whatsapp_disabled' });

  // Una ejecución al día (salvo un admin a mano): una llamada anónima no adelanta nada
  // porque todo lo enviado queda apuntado, pero tampoco gasta lecturas de más.
  const LAST = 'reminders_last_run';
  const lastRow = rows(await sr.SystemSettings.filter({ setting_key: LAST }))[0];
  if (user?.role !== 'admin' && lastRow && Date.now() - Date.parse(lastRow.setting_value || '') < 12 * 3600000) {
    return Response.json({ ok: true, skipped: 'already_ran_today' });
  }
  if (lastRow) await sr.SystemSettings.update(lastRow.id, { setting_value: nowIso() });
  else await sr.SystemSettings.create({ setting_key: LAST, setting_value: nowIso() });

  const call = async (payload: any) => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Reparo-Key': key },
        body: JSON.stringify({ action: 'reminder', ...payload }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, data };
    } catch (e) {
      return { ok: false, data: { error: String((e as any)?.message || e) } };
    }
  };

  const results: any[] = [];
  const remind = async (o: any, kind: string, since: string) => {
    const sent = Array.isArray(o.reminders_sent) ? o.reminders_sent : [];
    if (sent.some((s: any) => s.kind === kind && s.for === since)) return;
    const r = await call({
      kind, since, order_id: o.order_id, customer_name: o.customer_name, customer_phone: o.customer_phone,
      device: [o.device_brand, o.device_model].filter(Boolean).join(' '), estimated_cost: o.estimated_cost,
    });
    const result = !r.ok ? `error: ${r.data?.error || 'HTTP'}` : r.data?.shadow ? 'prueba (no enviado)' : r.data?.sent ? 'enviado' : `no enviado: ${r.data?.skipped || r.data?.detail || ''}`;
    results.push({ order_id: o.order_id, kind, result });
    // Un fallo de red, la pausa y el modo prueba no cuentan como enviado: se repite mañana.
    // Enviado o descartado (sin móvil, cliente ya respondió) queda apuntado.
    const counts = r.ok && !r.data?.shadow && r.data?.skipped !== 'automations_paused';
    if (!counts) {
      await sr.ActionLog.create({ action: 'whatsapp', order_id: o.order_id, detail: `Recordatorio ${kind} → ${result}`, at: nowIso(), user_email: 'recordatorios' }).catch(() => {});
      return;
    }
    await sr.RepairOrder.update(o.id, { reminders_sent: [...sent, { kind, for: since, at: nowIso(), result }].slice(-20) });
    await sr.ActionLog.create({ action: 'whatsapp', order_id: o.order_id, detail: `Recordatorio ${kind} → ${result}`, at: nowIso(), user_email: 'recordatorios' }).catch(() => {});
  };

  // --- B-41: equipos listos sin recoger
  const ready = rows(await sr.RepairOrder.filter({ is_open: true, status_group: 'ready', ready_at: { $gte: '2026-01-01' } }, 'ready_at', 300, 0, FIELDS).catch(() => []));
  for (const o of ready) {
    const stage = stageFor(Math.floor((Date.now() - Date.parse(o.ready_at)) / DAY));
    if (stage) await remind(o, stage, o.ready_at);
  }

  // --- B-42: presupuesto sin respuesta a las 24 h
  const from = new Date(Date.now() - 7 * DAY).toISOString();
  const to = new Date(Date.now() - DAY).toISOString();
  const budgets = rows(await sr.RepairOrder.filter({ is_open: true, status_name: BUDGET_STATUS, status_since: { $gte: from, $lte: to } }, 'status_since', 100, 0, FIELDS).catch(() => []));
  for (const o of budgets) {
    if (String(o.estimated_cost || '').trim()) await remind(o, 'budget_24h', o.status_since);
  }

  return Response.json({ ok: true, checked: { ready: ready.length, budgets: budgets.length }, results });
});
