// «Cobrar en TPV» (auditoría B-40): abre la venta táctil del TPV con esta orden
// ya cargada (cliente, descripción y precio). Al cobrar, el TPV avisa a Reparo y
// la orden pasa a «Entregado» con el número de ticket en el historial.
import { Receipt } from 'lucide-react';

const TPV_VENTA = 'https://tpvtorrent.base44.app/venta';

export default function CobrarEnTpv({ order }) {
  if (order.tpv_sale_ref) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[13px] font-semibold text-emerald-800"
        title={order.tpv_paid_at ? `Cobrado el ${new Date(order.tpv_paid_at).toLocaleString('es-ES')}` : 'Cobrado en el TPV'}>
        <Receipt size={13} />Cobrado: {order.tpv_sale_ref}
      </span>
    );
  }
  if (order.status_group === 'failed') return null;
  return (
    <a href={`${TPV_VENTA}?orden=${encodeURIComponent(order.order_id)}`}
      className="flex items-center gap-1.5 rounded-md border border-hc-line bg-hc-card px-2.5 py-1 text-[14px] font-semibold text-hc-ink hover:bg-hc-hover"
      title="Abrir el TPV con esta reparación en el ticket">
      <Receipt size={15} />Cobrar en TPV
    </a>
  );
}
