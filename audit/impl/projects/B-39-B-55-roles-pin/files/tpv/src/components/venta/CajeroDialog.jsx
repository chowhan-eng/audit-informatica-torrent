import React, { useEffect, useState } from 'react';
import { cashierPin } from '@/functions/cashierPin';
import DialogShell from '@/components/venta/DialogShell';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound } from 'lucide-react';

/**
 * Cambiar de cajero con su PIN. El PIN se comprueba en el servidor (auditoría
 * B-55): el navegador ya no recibe ni compara el PIN de nadie.
 */
export default function CajeroDialog({ current, isAdmin, onClose, onSelect }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cashierPin({ action: 'list' })
      .then((res) => setUsers(res.data?.users || []))
      .catch((e) => setError(e.response?.data?.error || 'No se pudo cargar la lista de cajeros'));
  }, []);

  const confirm = async () => {
    setError('');
    if (pin.length !== 4) {
      setError('El PIN tiene 4 cifras');
      return;
    }
    setBusy(true);
    try {
      if (!selected.has_pin) {
        if (!isAdmin) {
          setError('Ese cajero todavía no tiene PIN, avisa al encargado');
          return;
        }
        const res = await cashierPin({ action: 'set', user_id: selected.id, pin });
        if (res.data?.error) throw new Error(res.data.error);
        onSelect(selected);
        return;
      }
      const res = await cashierPin({ action: 'verify', user_id: selected.id, pin });
      if (!res.data?.ok) {
        setError(res.data?.error || 'PIN incorrecto');
        setPin('');
        return;
      }
      onSelect(res.data.user);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="Cambiar de cajero"
      width="max-w-md"
      onClose={onClose}
      footer={
        selected ? (
          <>
            <Button className="flex-1 h-12 font-bold" disabled={busy} onClick={confirm}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : 'Entrar'}
            </Button>
            <Button variant="outline" className="h-12 font-bold" onClick={() => { setSelected(null); setPin(''); setError(''); }}>
              Atrás
            </Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1 h-12 font-bold" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {error && <div className="p-2.5 mb-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}

      {!selected ? (
        <div className="space-y-2">
          <div className="text-sm">
            Cajero actual: <strong>{current?.full_name || current?.email}</strong>
          </div>
          {!users && !error && (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Cargando cajeros…
            </div>
          )}
          {(users || []).map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => { setSelected(person); setPin(''); }}
              className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:bg-secondary flex items-center justify-between"
            >
              <span className="font-bold">{person.full_name || person.email}</span>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {person.role === 'admin' ? 'Encargado' : 'Cajero'}{person.has_pin ? '' : ' · sin PIN'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm flex items-center gap-2">
            <KeyRound size={16} /> PIN de <strong>{selected.full_name || selected.email}</strong>
            {!selected.has_pin && <span className="text-muted-foreground">(sin PIN: el encargado puede crearlo)</span>}
          </div>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(event) => { if (event.key === 'Enter') confirm(); }}
            inputMode="numeric"
            type="password"
            autoFocus
            className="w-full h-16 rounded-md border-2 border-input bg-card px-3 text-center text-3xl tracking-[0.6em] font-black"
          />
        </div>
      )}
    </DialogShell>
  );
}
