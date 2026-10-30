// =============================================================================
// tpvBridge — enlace TPV ↔ Reparo para «Cobrar en TPV» (auditoría B-40).
// Server-to-server: cada llamada lleva la cabecera X-Tpv-Key = secreto
// TPV_BRIDGE_KEY (mismo valor que REPARO_TPV_KEY en el TPV).
//
//   POST { ping: true }                       → { ok }
//   POST { action: 'order', order_id }        → datos para la línea del ticket:
//        cliente, equipo, avería, descripción y precio (offer_total o presupuesto)
//   POST { action: 'paid', order_id, sale_id, sale_ref, total, cashier }
//        → guarda el ticket en la orden, añade «Cobrado en TPV» al historial y,
//          si la orden sigue abierta, la pasa a «Entregado». Idempotente por sale_id
//          (el TPV reintenta si no llega).
// El aviso de «Entregado» va por la cola WhatsAppQueue igual que un cambio hecho
// a mano (el barrido de 5 min lo envía).
// =============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const DELIVERED_STATUS = 'Entregado';
const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));
const nowIso = () => new Date().toISOString();
const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function lineFor(o: any) {
  const items = Array.isArray(o.offer_items) ? o.offer_items : [];
  const fromItems = items.reduce((s: number, it: any) => s + (num(it.price) - num(it.discount)) * (num(it.qty) || 1), 0);
  const price = Math.round((num(o.offer_total) || fromItems || num(o.estimated_cost)) * 100) / 100;
  const device = [o.device_brand, o.device_model].filter(Boolean).join(' ');
  const titles = items.map((it: any) => it.title).filter(Boolean).join(', ');
  const description = (titles || [o.averia, device].filter(Boolean).join(' · ') || 'Reparación').slice(0, 120);
  return { price, description, device };
}

Deno.serve(async (req) => {
  const expected = (Deno.env.get('TPV_BRIDGE_KEY') || '').trim();
  if (!expected || !safeEqual(req.headers.get('X-Tpv-Key') || '', expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const body = await req.json().catch(() => ({}));

  if (body.ping) return Response.json({ ok: true, app: 'Reparo' });

  const orderId = String(body.order_id || '').replace(/^#/, '').trim();
  if (!/^\d{1,9}$/.test(orderId)) return Response.json({ error: 'bad_order_id' }, { status: 400 });
  const order = rows(await sr.RepairOrder.filter({ order_id: orderId }))[0];
  if (!order) return Response.json({ found: false, order_id: orderId });

  if (body.action === 'order') {
    const { price, description, device } = lineFor(order);
    return Response.json({
      found: true,
      order: {
        order_id: order.order_id,
        status_name: order.status_name || '',
        status_group: order.status_group || '',
        is_open: order.is_open !== false && order.status_group !== 'failed',
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_email: order.client_email || '',
        customer_nif: order.client_dni || '',
        device,
        averia: order.averia || '',
        description,
        price,
        already_paid: order.tpv_sale_ref || '',
      },
    });
  }

  if (body.action === 'paid') {
    const saleId = String(body.sale_id || '').trim();
    const saleRef = String(body.sale_ref || '').slice(0, 40);
    if (!saleId) return Response.json({ error: 'missing_sale_id' }, { status: 400 });
    const paidIds: string[] = Array.isArray(order.tpv_sale_ids) ? order.tpv_sale_ids : [];
    if (paidIds.includes(saleId)) return Response.json({ ok: true, already: true });

    const at = nowIso();
    const total = Math.round(num(body.total) * 100) / 100;
    const author = `TPV${body.cashier ? ` · ${String(body.cashier).slice(0, 60)}` : ''}`;
    const events = [...(order.events || []), { type: 'PAID', text: `Cobrado en TPV: ticket ${saleRef} (${total.toFixed(2)} €)`, author, at }];
    const patch: any = {
      tpv_sale_id: saleId, tpv_sale_ids: [...paidIds, saleId], tpv_sale_ref: saleRef,
      tpv_paid_total: Math.round((num(order.tpv_paid_total) + total) * 100) / 100, tpv_paid_at: at,
      events, hc_updated_at: at,
    };

    let delivered = false;
    const isOpen = order.is_open !== false && order.status_group !== 'failed';
    if (isOpen && body.deliver !== false) {
      const status = rows(await sr.ShopStatus.filter({ name: DELIVERED_STATUS }))[0];
      if (status) {
        events.push({ type: 'STATUS_CHANGED', text: status.name, to_status: status.name, color: status.color || '', author, at });
        Object.assign(patch, {
          status_name: status.name, status_hc_id: status.hc_id || status.id, status_group: status.group || 'failed',
          status_color: status.color || '', is_open: false, closed_at: at, closed_by_name: author,
        });
        delivered = true;
      }
    }

    await sr.RepairOrder.update(order.id, patch);
    await sr.ActionLog.create({
      action: 'tpv_paid', order_id: order.order_id, at,
      detail: `#${order.order_id} cobrado en TPV (${saleRef}, ${total.toFixed(2)} €)${delivered ? ' → Entregado' : ''}`,
      user_email: 'tpv',
    }).catch(() => {});
    if (delivered) {
      await sr.WhatsAppQueue.create({
        order_id: order.order_id, event: 'status_changed', status: DELIVERED_STATUS,
        due_at: new Date(Date.now() + 60 * 1000).toISOString(), state: 'pending', attempts: 0, requested_by: 'tpv',
      }).catch(() => {});
    }
    return Response.json({ ok: true, delivered });
  }

  return Response.json({ error: 'bad_action' }, { status: 400 });
});
