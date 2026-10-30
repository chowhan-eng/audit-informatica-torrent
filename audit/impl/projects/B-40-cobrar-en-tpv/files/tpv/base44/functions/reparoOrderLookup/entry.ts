import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { callReparo, repairOrderId, reparoConfigured } from '../../shared/reparo.ts';

const REPAIR_SKU = 'REP-SERVICIO';

/** Artículo de servicio con el que se cobra una reparación (el mismo que usaba helloClientLookup). */
async function repairService(service) {
  const page = await service.entities.Product.filter({ sku: REPAIR_SKU }, { limit: 1 });
  const found = (page.items || [])[0];
  if (found) return found;
  return service.entities.Product.create({
    sku: REPAIR_SKU,
    name: 'Reparación',
    kind: 'service',
    family: 'SERVICIOS',
    sale_price: 0,
    cost_price: 0,
    vat_rate: 21,
    price_editable: true,
    track_stock: false,
    active: true,
  });
}

/**
 * reparoOrderLookup (auditoría B-40): con el número de orden devuelve el artículo
 * de servicio y, desde Reparo, el cliente, la descripción y el precio de la
 * reparación. Si Reparo no responde, la línea se teclea como antes.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const orden = repairOrderId(body.orden);
    if (!orden) return Response.json({ error: 'Escribe el número de orden de la reparación (solo cifras)' }, { status: 400 });

    const service = base44.asServiceRole;
    const product = await repairService(service);
    if (!reparoConfigured()) {
      return Response.json({ product, orden, found: false, source: 'manual', reason: 'sin_reparo' });
    }

    const res = await callReparo({ action: 'order', order_id: orden });
    if (!res.ok || !res.data?.found) {
      const error = res.ok ? `La orden ${orden} no existe en Reparo` : `Reparo no responde (${res.data?.error || res.status})`;
      return Response.json({ product, orden, found: false, source: 'manual', error });
    }

    const order = res.data.order;
    return Response.json({
      product,
      orden,
      found: true,
      source: 'reparo',
      description: order.description,
      price: Number(order.price) || 0,
      estado: order.status_name,
      is_open: order.is_open,
      already_paid: order.already_paid,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
        nif: order.customer_nif,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
