// Panel «Hoy» y buscador global de Mostrador (auditoría B-47).
// Los datos vienen de la función mostradorData, que pregunta a Reparo, TPV y
// WhatsApp Pro. Sin sesión de empleado solo se ve el botón para entrar: los
// accesos directos de Mostrador siguen siendo públicos, los datos no.
import { useEffect, useRef, useState } from 'react';
import { Search, LogIn, RefreshCw, ArrowUpRight, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import './hoy.css';

const APP_NAME = { reparo: 'Reparo', tpv: 'TPV', whatsapp: 'WhatsApp Pro' };
const REFRESH_MS = 2 * 60 * 1000;

const call = async (payload) => {
  const res = await base44.functions.invoke('mostradorData', payload);
  return res?.data ?? res;
};

const money = (value) => `${(Number(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function since(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'hoy';
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

function Item({ item }) {
  return (
    <li>
      <a className="hoy-item" href={item.url}>
        <span className="hoy-dot" data-app={item.app} />
        <span className="hoy-item-txt">
          <b>{item.title}</b>
          <span>{[item.subtitle, item.at ? since(item.at) : ''].filter(Boolean).join(' · ')}</span>
        </span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </li>
  );
}

function Card({ title, value, note, items, error, href, tone }) {
  return (
    <article className="hoy-card" data-tone={tone || (value ? 'warn' : 'ok')}>
      <header>
        <h4>{title}</h4>
        {error ? <span className="hoy-err">{error}</span> : <span className="hoy-num">{value ?? '—'}</span>}
      </header>
      {note && <p className="hoy-note">{note}</p>}
      {!!items?.length && <ul>{items.map((item) => <Item key={`${item.app}${item.type}${item.id}`} item={item} />)}</ul>}
      {href && <a className="hoy-more" href={href}>Ver todo <ArrowUpRight size={13} aria-hidden="true" /></a>}
    </article>
  );
}

function SearchBox() {
  const [q, setQ] = useState('');
  const [state, setState] = useState({ loading: false, results: [], errors: [] });
  const input = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
      if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.replace(/\s/g, '').length < 2) { setState({ loading: false, results: [], errors: [] }); return undefined; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      try {
        const data = await call({ action: 'search', q: term });
        if (id === seq.current) setState({ loading: false, results: data?.results || [], errors: data?.errors || [] });
      } catch (e) {
        if (id === seq.current) setState({ loading: false, results: [], errors: [{ app: 'mostrador', error: e.message }] });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="hoy-search">
      <label className="hoy-input">
        <Search size={18} aria-hidden="true" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder="Buscar teléfono, nombre, nº de orden, ticket (T-2026/120) o IMEI" aria-label="Buscar en todas las apps" />
        {state.loading ? <Loader2 size={16} className="hoy-spin" aria-hidden="true" /> : <kbd>/</kbd>}
      </label>
      {q.trim().length >= 2 && !state.loading && (
        <div className="hoy-results">
          {state.results.length ? <ul>{state.results.map((item) => <Item key={`${item.app}${item.type}${item.id}`} item={item} />)}</ul>
            : <p className="hoy-note">Sin resultados.</p>}
          {state.errors.map((e) => <p key={e.app} className="hoy-err">{APP_NAME[e.app] || e.app}: {e.error}</p>)}
        </div>
      )}
    </div>
  );
}

export default function HoyPanel() {
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await call({ action: 'hoy' });
      if (d?.error) throw new Error(d.error);
      setData(d);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  if (isLoadingAuth) return null;
  if (!isAuthenticated) {
    return (
      <section className="mo-wrap hoy">
        <button type="button" className="hoy-login" onClick={navigateToLogin}>
          <LogIn size={16} aria-hidden="true" /> Entrar para ver el panel «Hoy» y el buscador
        </button>
      </section>
    );
  }

  const r = data?.reparo || {};
  const w = data?.whatsapp || {};
  const t = data?.tpv || {};
  return (
    <section className="mo-wrap hoy" aria-label="Hoy">
      <SearchBox />
      <div className="hoy-head">
        <h3 className="mo-label">Hoy</h3>
        <button type="button" className="hoy-refresh" onClick={load} disabled={loading} aria-label="Actualizar">
          <RefreshCw size={14} className={loading ? 'hoy-spin' : ''} aria-hidden="true" />
          {data?.at ? new Date(data.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
        </button>
      </div>
      {error && <p className="hoy-err">{error}</p>}
      <div className="hoy-grid">
        <Card title="Listos para recoger" value={r.listos?.count} error={r.error}
          note={r.listos?.total_open != null ? `${r.listos.count} de los últimos 90 días · ${r.listos.total_open} abiertos en total` : ''}
          items={r.listos?.items} href={r.listos?.url} />
        <Card title="Chats esperando respuesta" value={w.esperando?.count} error={w.error} items={w.esperando?.items} href={w.esperando?.url} />
        <Card title="Presupuestos sin respuesta" value={r.presupuestos?.count} error={r.error} items={r.presupuestos?.items} />
        <Card title="Esperando material" value={r.material?.count} error={r.error} items={r.material?.items} tone="info" />
        <Card title="Pendientes (TPV)" value={t.pendientes?.count} error={t.error} items={t.pendientes?.items} />
        <Card title="Envíos de WhatsApp fallidos (48 h)" value={w.fallidos?.count} error={w.error} items={w.fallidos?.items} />
        <Card title="Caja" value={t.caja ? (t.caja.open ? 'Abierta' : 'Cerrada') : undefined} error={t.error} tone="info"
          note={t.ventas_hoy ? `${t.ventas_hoy.count} tickets hoy · ${money(t.ventas_hoy.total)}${t.senales?.count ? ` · ${t.senales.count} señales abiertas (${money(t.senales.total)})` : ''}` : ''} />
        <Card title="Órdenes nuevas hoy" value={r.nuevos_hoy} error={r.error} tone="info" />
      </div>
    </section>
  );
}
