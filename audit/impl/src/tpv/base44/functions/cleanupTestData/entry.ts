import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * cleanupTestData (uso único, 28 oct 2026): borra las pruebas hechas antes de
 * empezar a vender con el TPV y deja sólo las ventas reales desde el 28 oct.
 *   - Ventas (tickets T y devoluciones R) creadas antes del 28/10 00:00 (Madrid).
 *   - Sus movimientos de stock, devolviendo el stock que restaron.
 *   - Las cajas cerradas que sólo tenían esas ventas (Z1 y Z2) y sus entradas/salidas.
 *   - Las facturas hechas sobre esas ventas.
 *   - Contadores: devoluciones a 0 y facturas a la última de Doscar (2600430).
 * Los borrados van a la papelera de Base44 (se pueden recuperar).
 * { confirm: false } sólo enseña lo que haría.
 */
const CUTOFF_MS = Date.parse('2026-10-27T23:00:00Z'); // 28/10/2026 00:00 en Madrid
const DOSCAR_LAST_INVOICE = 2600430;

const toMs = (value) => {
  if (!value) return NaN;
  const text = String(value);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`);
};
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function all(entity, query = {}) {
  const out = [];
  let skip = 0;
  for (;;) {
    const page = await entity.filter(query, { sort: 'created_date', limit: 500, skip });
    const items = page.items || page || [];
    out.push(...items);
    if (items.length < 500) break;
    skip += 500;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Sólo el encargado' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const confirm = body.confirm === true;
    const service = base44.asServiceRole;

    const sales = await all(service.entities.Sale);
    const oldSales = sales.filter((sale) => toMs(sale.created_date) < CUTOFF_MS);
    const keptSales = sales.filter((sale) => toMs(sale.created_date) >= CUTOFF_MS);
    const oldIds = new Set(oldSales.map((sale) => sale.id));

    const sessions = await all(service.entities.CashSession);
    const keptSessionIds = new Set(keptSales.map((sale) => sale.cash_session_id).filter(Boolean));
    const oldSessions = sessions.filter((session) =>
      session.status === 'closed'
      && toMs(session.closed_at) < CUTOFF_MS
      && !keptSessionIds.has(session.id));
    const oldSessionIds = new Set(oldSessions.map((session) => session.id));

    const cashMovements = (await all(service.entities.CashMovement))
      .filter((movement) => oldSessionIds.has(movement.cash_session_id));

    const stockMovements = (await all(service.entities.StockMovement))
      .filter((movement) => oldIds.has(movement.ref_id));

    // Stock que hay que devolver por artículo (la venta restó, aquí se suma).
    const revert = new Map();
    for (const movement of stockMovements) {
      revert.set(movement.product_id, round2((revert.get(movement.product_id) || 0) - (Number(movement.qty) || 0)));
    }
    const productIds = [...revert.keys()].filter(Boolean);
    const products = productIds.length
      ? ((await service.entities.Product.filter({ id: { $in: productIds } }, { limit: 500 })).items || [])
      : [];
    const stockPlan = products.map((product) => ({
      id: product.id,
      name: product.name,
      tracks: product.track_stock !== false,
      from: round2(product.stock_qty),
      to: product.track_stock === false ? round2(product.stock_qty) : round2((Number(product.stock_qty) || 0) + revert.get(product.id)),
    }));

    const invoices = (await all(service.entities.Invoice))
      .filter((invoice) => (invoice.sale_ids || []).length && (invoice.sale_ids || []).every((id) => oldIds.has(id)));

    const counters = await all(service.entities.Counter);
    const keptRefunds = keptSales.filter((sale) => sale.doc_type === 'R').map((sale) => Number(sale.number) || 0);
    const counterPlan = [];
    for (const counter of counters) {
      if (counter.key === 'R-2026') counterPlan.push({ id: counter.id, key: counter.key, from: counter.last_number, to: Math.max(0, ...keptRefunds) });
      if (counter.key === 'F-2026') counterPlan.push({ id: counter.id, key: counter.key, from: counter.last_number, to: DOSCAR_LAST_INVOICE });
    }

    const plan = {
      delete_sales: oldSales.map((sale) => `${sale.series}/${sale.number} ${sale.total}`),
      keep_sales: keptSales.map((sale) => `${sale.series}/${sale.number} ${sale.total}`),
      delete_sessions: oldSessions.map((session) => `Z${session.z_number || '?'}`),
      delete_cash_movements: cashMovements.length,
      delete_stock_movements: stockMovements.length,
      stock: stockPlan.filter((item) => item.from !== item.to).map((item) => `${item.name}: ${item.from} → ${item.to}`),
      delete_invoices: invoices.map((invoice) => `${invoice.series}/${invoice.number} ${invoice.total}`),
      counters: counterPlan.map((item) => `${item.key}: ${item.from} → ${item.to}`),
    };

    if (!confirm) return Response.json({ dry_run: true, plan });

    for (const item of stockPlan) {
      if (item.tracks && item.from !== item.to) await service.entities.Product.update(item.id, { stock_qty: item.to });
    }
    for (const movement of stockMovements) await service.entities.StockMovement.delete(movement.id);
    for (const movement of cashMovements) await service.entities.CashMovement.delete(movement.id);
    for (const invoice of invoices) await service.entities.Invoice.delete(invoice.id);
    for (const sale of oldSales) await service.entities.Sale.delete(sale.id);
    for (const session of oldSessions) await service.entities.CashSession.delete(session.id);
    for (const item of counterPlan) await service.entities.Counter.update(item.id, { last_number: item.to });

    await service.entities.AuditLog.create({
      actor_email: user.email,
      action: 'test_data_cleanup',
      entity: 'Sale',
      entity_id: '',
      before: plan,
      after: { kept: plan.keep_sales },
      summary: `Borradas las pruebas anteriores al 28/10/2026: ${oldSales.length} ventas, ${oldSessions.length} cajas, ${invoices.length} facturas, ${stockMovements.length} movimientos de stock`,
    });

    return Response.json({ done: true, plan });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}