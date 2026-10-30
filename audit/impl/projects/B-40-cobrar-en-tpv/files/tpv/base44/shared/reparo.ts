import { secrets } from 'base44:runtime';

/**
 * Enlace con Reparo (auditoría B-40, «Cobrar en TPV»).
 * REPARO_TPV_URL apunta a la función tpvBridge de Reparo y REPARO_TPV_KEY es la
 * clave compartida (en Reparo se llama TPV_BRIDGE_KEY). Sin los dos secretos el
 * enlace está apagado y el TPV funciona como antes.
 */
function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

export function reparoConfigured() {
  return Boolean(readSecret('REPARO_TPV_URL') && readSecret('REPARO_TPV_KEY'));
}

export async function callReparo(payload, timeoutMs = 15000) {
  const url = readSecret('REPARO_TPV_URL');
  const key = readSecret('REPARO_TPV_KEY');
  if (!url || !key) return { ok: false, status: 0, data: { error: 'Enlace con Reparo sin configurar' } };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tpv-Key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message } };
  }
}

/** Número de orden de Reparo (solo cifras) o cadena vacía. */
export function repairOrderId(value) {
  const digits = String(value || '').replace(/^#/, '').trim();
  return /^\d{1,9}$/.test(digits) ? digits : '';
}

const RETRY_MINUTES = [2, 10, 30, 120, 480];

/**
 * Avisa a Reparo de que la orden se ha cobrado. Cada aviso queda en ReparoSync;
 * si Reparo no responde se reintenta desde reparoSyncSweep (workflow cada 10 min).
 * Nunca lanza: un fallo aquí no puede deshacer una venta ya cobrada.
 */
export async function notifyReparoPaid(service, sale, cashier) {
  const orderId = repairOrderId(sale.repair_order_id);
  if (!orderId || !reparoConfigured()) return { skipped: true };
  const row = await service.entities.ReparoSync.create({
    sale_id: sale.id,
    order_id: orderId,
    sale_ref: `${sale.series}/${sale.number}`,
    total: sale.total,
    cashier: cashier || '',
    state: 'pending',
    attempts: 0,
  });
  // Durante el cobro solo se espera 5 s: si Reparo tarda, lo reenvía el barrido.
  return sendReparoSync(service, row, 5000);
}

export async function sendReparoSync(service, row, timeoutMs = 15000) {
  const attempts = (Number(row.attempts) || 0) + 1;
  const res = await callReparo({
    action: 'paid',
    order_id: row.order_id,
    sale_id: row.sale_id,
    sale_ref: row.sale_ref,
    total: row.total,
    cashier: row.cashier,
  }, timeoutMs);
  if (res.ok && res.data?.ok) {
    await service.entities.ReparoSync.update(row.id, {
      state: 'done', attempts, delivered: !!res.data.delivered, done_at: new Date().toISOString(), last_error: '',
    });
    return { ok: true, delivered: !!res.data.delivered };
  }
  const error = String(res.data?.error || `HTTP ${res.status}`).slice(0, 300);
  const wait = RETRY_MINUTES[attempts - 1];
  await service.entities.ReparoSync.update(row.id, {
    state: wait ? 'pending' : 'failed',
    attempts,
    last_error: error,
    next_at: wait ? new Date(Date.now() + wait * 60000).toISOString() : null,
  });
  return { ok: false, error };
}
