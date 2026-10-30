import React, { useEffect, useState } from 'react';
import { reparoOrderLookup } from '@/functions/reparoOrderLookup';
import DialogShell from '@/components/venta/DialogShell';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { Loader2, Search, Wrench } from 'lucide-react';

/**
 * Cobrar reparación: se pide el número de orden y se añade una línea de
 * servicio con esa referencia. Con el enlace a Reparo (auditoría B-40) la
 * descripción, el precio y el cliente vienen de la orden; si Reparo no
 * responde, se teclean. Desde Reparo («Cobrar en TPV») llega ya con la orden.
 */
export default function ReparacionDialog({ initialOrden = '', onClose, onAdd }) {
  const [orden, setOrden] = useState(initialOrden);
  const [buscando, setBuscando] = useState(false);
  const [product, setProduct] = useState(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState(null);
  const [aviso, setAviso] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const buscar = async (value = orden.trim()) => {
    if (!value) {
      setError('Escribe el número de orden de la reparación');
      return;
    }
    setBuscando(true);
    setError('');
    setNote('');
    setAviso('');
    setCustomer(null);
    try {
      const response = await reparoOrderLookup({ orden: value });
      const data = response.data || {};
      if (!data.product) {
        setError(data.error || 'No se ha podido preparar el servicio de reparación');
        return;
      }
      setProduct(data.product);
      if (data.found) {
        setDescription(data.description || '');
        setPrice(data.price ? String(data.price) : '');
        setCustomer(data.customer?.name || data.customer?.phone ? data.customer : null);
        setNote(`Datos de Reparo (estado: ${data.estado || '—'}). Revísalos antes de añadir la línea.`);
        if (data.already_paid) setAviso(`Esta orden ya se cobró en el ticket ${data.already_paid}.`);
        else if (data.is_open === false) setAviso('Esta orden ya está cerrada en Reparo.');
      } else {
        setNote(data.error ? `${data.error}. Escribe la descripción y el precio.` : 'Reparo no está conectado: escribe la descripción y el precio.');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (initialOrden) buscar(initialOrden);
  }, [initialOrden]);

  const add = () => {
    const value = Number(String(price).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setError('El precio no es válido');
      return;
    }
    if (!description.trim()) {
      setError('Escribe la descripción de la reparación');
      return;
    }
    if (aviso && !window.confirm(`${aviso} ¿Añadirla al ticket igualmente?`)) return;
    onAdd({ product, orden: orden.trim(), description: description.trim(), price: value, customer });
  };

  return (
    <DialogShell
      title="Cobrar reparación"
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <Button className="flex-1 h-12 font-bold" disabled={!product || buscando} onClick={add}>
            <Wrench size={18} className="mr-2" /> Añadir al ticket
          </Button>
          <Button variant="outline" className="h-12 font-bold" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      {error && <div className="mb-3 rounded-md bg-destructive/10 p-2.5 text-sm font-medium text-destructive">{error}</div>}
      {aviso && <div className="mb-3 rounded-md bg-amber-100 p-2.5 text-sm font-medium text-amber-900">{aviso}</div>}

      <div className="flex gap-2">
        <input
          value={orden}
          onChange={(event) => setOrden(event.target.value.replace(/\D/g, ''))}
          onKeyDown={(event) => { if (event.key === 'Enter') buscar(); }}
          placeholder="Nº de orden de reparación"
          inputMode="numeric"
          autoFocus={!initialOrden}
          className="h-14 flex-1 rounded-md border-2 border-input bg-card px-3 text-lg font-bold"
        />
        <Button className="h-14 font-bold" disabled={buscando} onClick={() => buscar()}>
          {buscando ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} className="mr-1.5" />} Buscar
        </Button>
      </div>

      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}

      {customer && (
        <p className="mt-2 text-sm">
          Cliente: <strong>{customer.name || '—'}</strong>
          {customer.phone ? ` · ${customer.phone}` : ''}
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descripción</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Cambio de pantalla iPhone 11"
          className="mt-0.5 h-12 w-full rounded-md border border-input bg-card px-2"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Precio (€)</span>
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="mt-0.5 h-12 w-full rounded-md border border-input bg-card px-2 text-right text-lg font-bold tabular-nums"
        />
      </label>

      {product && price !== '' && (
        <p className="mt-3 text-sm text-muted-foreground">
          Se añadirá a <strong>{formatMoney(Number(String(price).replace(',', '.')) || 0)}</strong> con IVA del{' '}
          {product.vat_rate} % y la referencia del encargo en el ticket. Al cobrar, la orden pasa a «Entregado» en Reparo.
        </p>
      )}
    </DialogShell>
  );
}
