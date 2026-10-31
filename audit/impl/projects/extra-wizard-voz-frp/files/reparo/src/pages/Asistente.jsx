// Asistente de equipos pendientes: repasa uno a uno las órdenes en «Listo» o
// «Pendiente» (también las antiguas) con tres botones: Ya entregado, Avisar desde
// hoy (WhatsApp + recordatorios 3/7/15 días desde hoy) y Saltar. Teclas: E, A, S.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, SkipForward, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useShopConfig, useMe } from '@/lib/shop/config';
import { changeStatus } from '@/lib/shop/orders';
import { StatusPill, money } from '@/components/shop/ui';

const FIELDS = ['id', 'order_id', 'customer_name', 'customer_phone', 'device_brand', 'device_model', 'averia', 'status_name', 'status_color',
  'status_group', 'is_open', 'ready_at', 'hc_updated_at', 'hc_created_at', 'offer_total', 'events', 'tpv_sale_ref'];
const days = (iso) => Math.max(0, Math.floor((Date.now() - Date.parse(iso || 0)) / 86400000));

export default function Asistente() {
  const { data: cfg } = useShopConfig();
  const me = useMe();
  const [queue, setQueue] = useState(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState({ entregados: 0, avisados: 0, saltados: 0 });

  useEffect(() => {
    const E = base44.entities.RepairOrder;
    Promise.all([
      E.filter({ is_open: true, status_group: 'ready' }, 'hc_updated_at', 3000, 0, FIELDS),
      E.filter({ is_open: true, status_name: 'Pendiente' }, 'hc_updated_at', 1000, 0, FIELDS),
    ]).then(([ready, pending]) => {
      const seen = new Set();
      setQueue([...(ready || []), ...(pending || [])].filter((o) => !seen.has(o.id) && seen.add(o.id))
        .sort((a, b) => String(a.ready_at || a.hc_updated_at || '').localeCompare(String(b.ready_at || b.hc_updated_at || ''))));
    }).catch((e) => { toast({ title: 'No se pudieron cargar las órdenes', description: e.message, variant: 'destructive' }); setQueue([]); });
  }, []);

  const delivered = useMemo(() => (cfg?.statuses || []).find((s) => s.name === 'Entregado'), [cfg]);
  const order = queue?.[index];
  const next = (key) => { setDone((d) => ({ ...d, [key]: d[key] + 1 })); setIndex((i) => i + 1); };

  const entregar = async () => {
    if (!order || !delivered) return;
    setBusy('e');
    try { await changeStatus(order, delivered, me); next('entregados'); }
    catch (e) { toast({ title: 'No se pudo marcar como entregado', description: e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };
  const avisar = async () => {
    if (!order || order.status_group !== 'ready') return;
    setBusy('a');
    try {
      const r = await base44.functions.invoke('wizardNotify', { order_id: order.order_id });
      const d = r?.data ?? r;
      if (d?.error) throw new Error(d.error);
      toast({ title: d.sent ? 'Aviso enviado' : 'Recordatorios reiniciados', description: d.result });
      next('avisados');
    } catch (e) { toast({ title: 'No se pudo avisar', description: e.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (busy || e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'e') entregar(); else if (k === 'a') avisar(); else if (k === 's') next('saltados');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!queue || !cfg) return <div className="flex flex-1 items-center justify-center p-10"><Loader2 className="animate-spin" /></div>;
  const total = queue.length;
  return (
    <div className="mx-auto w-full max-w-xl p-4 md:p-8">
      <h1 className="text-[20px] font-semibold text-hc-ink">Asistente de equipos pendientes</h1>
      <p className="mt-1 text-[14px] text-hc-muted">
        {Math.min(index + 1, total)} de {total} · entregados {done.entregados} · avisados {done.avisados} · saltados {done.saltados}
      </p>
      {!order ? (
        <div className="mt-6 rounded-xl border border-hc-line bg-hc-card p-6 text-center">
          <p className="text-[16px] font-semibold">¡Terminado!</p>
          <Link to="/tickets" className="mt-3 inline-block text-hc-accent">Volver a tickets</Link>
        </div>
      ) : (
        <article className="mt-5 rounded-xl border border-hc-line bg-hc-card p-5">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/tickets/${order.order_id}`} className="text-[18px] font-semibold text-hc-ink hover:underline">#{order.order_id}</Link>
            <StatusPill name={order.status_name} color={order.status_color} group={order.status_group} />
          </div>
          <p className="mt-2 text-[16px] font-medium">{order.customer_name || 'Sin nombre'} · {order.customer_phone || 'sin teléfono'}</p>
          <p className="text-[14px] text-hc-muted">{[order.device_brand, order.device_model].filter(Boolean).join(' ')}{order.averia ? ` — ${order.averia}` : ''}</p>
          <p className="mt-2 text-[14px] text-hc-muted">
            {order.ready_at ? `Listo desde hace ${days(order.ready_at)} días` : `Último cambio hace ${days(order.hc_updated_at || order.hc_created_at)} días`}
            {order.offer_total ? ` · ${money(order.offer_total)} €` : ''}{order.tpv_sale_ref ? ` · cobrado ${order.tpv_sale_ref}` : ''}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button className="h-14 gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={!!busy || !delivered} onClick={entregar}>
              {busy === 'e' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Ya entregado (E)
            </Button>
            <Button className="h-14 gap-2" disabled={!!busy || order.status_group !== 'ready'} onClick={avisar}
              title={order.status_group !== 'ready' ? 'Solo para equipos listos' : 'WhatsApp ahora y recordatorios a los 3, 7 y 15 días'}>
              {busy === 'a' ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={18} />} Avisar desde hoy (A)
            </Button>
            <Button variant="outline" className="h-14 gap-2" disabled={!!busy} onClick={() => next('saltados')}>
              <SkipForward size={18} /> Saltar (S)
            </Button>
          </div>
        </article>
      )}
    </div>
  );
}
