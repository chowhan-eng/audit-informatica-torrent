import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/**
 * mostradorLookup (auditoría B-47): búsqueda y panel «Hoy» de Mostrador. Solo
 * lectura. Lo llama la función mostradorData de Mostrador con la cabecera
 * X-Mostrador-Key = secreto MOSTRADOR_KEY; Mostrador exige antes la sesión de un
 * empleado.
 *
 *   { action: 'search', q }  tickets (T-2026/120 o número), clientes (móvil o
 *                            nombre) y unidades con IMEI/serie
 *   { action: 'hoy' }        caja abierta, ventas de hoy, Pendientes y señales abiertas
 */
const BASE = 'https://tpvtorrent.base44.app';

function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const itemsOf = (page) => (Array.isArray(page) ? page : page?.items || []);
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function phoneVariants(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0034')) digits = digits.slice(2);
  const out = new Set([digits]);
  if (digits.startsWith('34') && digits.length === 11) out.add(digits.slice(2));
  if (digits.length === 9) out.add(`34${digits}`);
  for (const value of [...out]) out.add(`+${value}`);
  return [...out];
}

function madridMidnightIso() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const offset = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date(`${day}T12:00:00Z`))) - 12;
  return new Date(Date.parse(`${day}T00:00:00Z`) - offset * 3600000).toISOString();
}

const saleItem = (sale) => ({
  app: 'tpv',
  type: 'ticket',
  id: sale.id,
  title: `${sale.series}/${sale.number} · ${round2(sale.total).toFixed(2)} €`,
  subtitle: [sale.customer_name, sale.repair_order_id ? `Reparación #${sale.repair_order_id}` : '', String(sale.created_date || '').slice(0, 10)].filter(Boolean).join(' · '),
  at: sale.created_date || null,
  url: `${BASE}/tickets`,
});

const customerItem = (customer) => ({
  app: 'tpv',
  type: 'cliente',
  id: customer.id,
  title: customer.name || 'Cliente',
  subtitle: [customer.phone, customer.nif].filter(Boolean).join(' · '),
  url: `${BASE}/clientes`,
});

export default async function (req) {
  const expected = readSecret('MOSTRADOR_KEY');
  if (!expected || !safeEqual(req.headers.get('X-Mostrador-Key') || '', expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const service = createClientFromRequest(req).asServiceRole;
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body.action === 'search') {
      const q = String(body.q || '').trim().slice(0, 60);
      const digits = q.replace(/\D/g, '');
      const results = [];
      const ticket = q.toUpperCase().match(/^([A-Z]{1,2}-\d{4})\s*\/\s*(\d+)$/);
      if (ticket) {
        const page = await service.entities.Sale.filter({ series: ticket[1], number: Number(ticket[2]) }, { limit: 3 });
        results.push(...itemsOf(page).map(saleItem));
      } else if (/^\d{1,6}$/.test(q)) {
        const page = await service.entities.Sale.filter({ number: Number(q), status: 'completed' }, { sort: '-created_date', limit: 3 });
        results.push(...itemsOf(page).map(saleItem));
      }
      if (digits.length >= 9 && digits.length <= 13) {
        const page = await service.entities.Customer.filter({ phone: { $in: phoneVariants(digits) } }, { limit: 5 });
        results.push(...itemsOf(page).map(customerItem));
      }
      if (digits.length >= 8 && digits.length <= 17) {
        const page = await service.entities.SerialUnit.filter({ $or: [{ imei: digits }, { serial: q }] }, { limit: 3 });
        results.push(...itemsOf(page).map((unit) => ({
          app: 'tpv',
          type: 'unidad',
          id: unit.id,
          title: `${unit.product_name || 'Unidad'} · ${unit.imei || unit.serial}`,
          subtitle: [unit.status === 'sold' ? 'Vendida' : 'En stock', unit.warranty_until ? `Garantía hasta ${unit.warranty_until}` : ''].filter(Boolean).join(' · '),
          url: `${BASE}/unidades`,
        })));
      }
      if (!digits && q.length >= 3) {
        const page = await service.entities.Customer.filter({ name: { $regex: escapeRe(q), $options: 'i' } }, { limit: 6 });
        results.push(...itemsOf(page).map(customerItem));
      }
      return Response.json({ results: results.slice(0, 12) });
    }

    if (body.action === 'hoy') {
      const since = madridMidnightIso();
      const [sessionPage, salesPage, tasksPage, depositsPage] = await Promise.all([
        service.entities.CashSession.filter({ status: 'open' }, { sort: '-created_date', limit: 1 }),
        service.entities.Sale.filter({ status: 'completed', created_date: { $gte: since } }, { limit: 500 }),
        service.entities.PendingTask.filter({ status: 'open' }, { sort: 'created_date', limit: 50 }),
        service.entities.Deposit.filter({ status: 'open' }, { limit: 200 }),
      ]);
      const session = itemsOf(sessionPage)[0] || null;
      const sales = itemsOf(salesPage);
      const tasks = itemsOf(tasksPage);
      const deposits = itemsOf(depositsPage);
      return Response.json({
        caja: session ? { open: true, opened_at: session.opened_at || session.created_date, opened_by: session.opened_by } : { open: false },
        ventas_hoy: {
          count: sales.filter((sale) => sale.doc_type !== 'R').length,
          total: round2(sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)),
        },
        pendientes: {
          count: tasks.length,
          items: tasks.slice(0, 8).map((task) => ({
            app: 'tpv',
            type: 'pendiente',
            id: task.id,
            title: task.title,
            subtitle: [task.customer_name, task.customer_phone, String(task.created_date || '').slice(0, 10)].filter(Boolean).join(' · '),
            url: `${BASE}/venta`,
          })),
        },
        senales: { count: deposits.length, total: round2(deposits.reduce((sum, deposit) => sum + (Number(deposit.amount) || 0), 0)) },
      });
    }

    return Response.json({ error: 'bad_action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
