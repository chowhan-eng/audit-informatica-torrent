// retentionSweep — conservación de datos (auditoría B-54, RGPD).
//   · Contraseñas de equipos (DeviceUnlockCode): se borran 30 días después de entregar la orden.
//   · Registro de consultas públicas (PublicLookupLog): se borra a los 7 días.
// Mientras el ajuste retention_live no sea 'true' solo cuenta lo que borraría (prueba).
// Workflow: domingos 04:10. Sin usuario, una vez cada 6 días como mucho.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const DAY = 86400000;
const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const user = await base44.auth.me().catch(() => null);
  if (user && user.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });
  const settings = rows(await sr.SystemSettings.filter({ setting_key: { $in: ['retention_live', 'retention_last_run'] } }));
  const live = settings.find((s) => s.setting_key === 'retention_live')?.setting_value === 'true';
  const lastRow = settings.find((s) => s.setting_key === 'retention_last_run');
  if (!user && lastRow && Date.now() - Date.parse(lastRow.setting_value || '') < 6 * DAY) return Response.json({ skipped: 'too_soon' });
  const now = new Date().toISOString();
  if (lastRow) await sr.SystemSettings.update(lastRow.id, { setting_value: now });
  else await sr.SystemSettings.create({ setting_key: 'retention_last_run', setting_value: now });

  const cutoff = new Date(Date.now() - 30 * DAY).toISOString();
  const closed = rows(await sr.RepairOrder.filter({ is_open: false, closed_at: { $lte: cutoff }, has_unlock_code: true }, 'closed_at', 500, 0, ['id', 'order_id']).catch(() => []));
  let codes = 0;
  for (const o of closed) {
    const list = rows(await sr.DeviceUnlockCode.filter({ order_id: o.order_id }).catch(() => []));
    codes += list.length;
    if (live) {
      for (const c of list) await sr.DeviceUnlockCode.delete(c.id).catch(() => {});
      await sr.RepairOrder.update(o.id, { has_unlock_code: false }).catch(() => {});
    }
  }
  const logs = rows(await sr.PublicLookupLog.filter({ at: { $lte: new Date(Date.now() - 7 * DAY).toISOString() } }, 'at', 1000).catch(() => []));
  if (live) for (const l of logs) await sr.PublicLookupLog.delete(l.id).catch(() => {});
  const detail = `${live ? 'Borrado' : 'Prueba'}: ${codes} contraseñas de ${closed.length} órdenes entregadas hace +30 días, ${logs.length} consultas públicas de +7 días`;
  await sr.ActionLog.create({ action: 'retention', detail, at: now, user_email: user?.email || 'programado' }).catch(() => {});
  return Response.json({ ok: true, live, detail });
});
