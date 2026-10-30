import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendReparoSync } from '../../shared/reparo.ts';

/**
 * reparoSyncSweep (auditoría B-40): reenvía a Reparo los cobros que no llegaron
 * al momento. Lo llama el workflow cada 10 minutos. Solo reenvía filas ya
 * guardadas en ReparoSync, así que una llamada sin usuario no puede inventar
 * cobros: como mucho adelanta un reintento.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;
    const now = new Date().toISOString();
    const page = await service.entities.ReparoSync.filter(
      { state: 'pending', next_at: { $lte: now } },
      { sort: 'next_at', limit: 25 },
    );
    const results = [];
    for (const row of page.items || []) {
      results.push({ sale_ref: row.sale_ref, order_id: row.order_id, ...(await sendReparoSync(service, row)) });
    }
    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
