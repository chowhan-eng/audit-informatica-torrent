// allocateOrderNumber — número de orden atómico (auditoría B-30). Antes el navegador
// leía el número más alto y sumaba 1: dos mostradores a la vez podían sacar el mismo.
// Ahora el contador vive en SystemSettings (order_counter) y se incrementa con una
// escritura condicional: solo gana una petición; las demás vuelven a intentarlo.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const KEY = 'order_counter';
const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const sr = base44.asServiceRole.entities;
  for (let attempt = 0; attempt < 10; attempt++) {
    let row = rows(await sr.SystemSettings.filter({ setting_key: KEY }, 'created_date', 1))[0];
    if (!row) {
      const top = rows(await sr.RepairOrder.list('-number', 1))[0];
      const start = Number(top?.number) || parseInt(top?.order_id, 10) || 0;
      await sr.SystemSettings.create({ setting_key: KEY, setting_value: String(start) });
      continue;
    }
    const current = parseInt(row.setting_value, 10) || 0;
    const next = current + 1;
    const res = await sr.SystemSettings.updateMany({ id: row.id, setting_value: String(current) }, { $set: { setting_value: String(next) } });
    if (res && (res.updated === 1 || res.modified === 1 || res.count === 1)) return Response.json({ number: next });
  }
  return Response.json({ error: 'No se pudo asignar el número, vuelve a intentarlo' }, { status: 503 });
});
