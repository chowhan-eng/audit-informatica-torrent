import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/**
 * sendPendingDigest: WhatsApp diario (13:00, hora de Madrid, lunes a sábado) con
 * TODOS los Pendientes sin hacer, para la persona de Ajustes → Recordatorios
 * (pending_digest_phone). Los apuntados hoy van marcados como «nuevo».
 *   { modo: 'auto' }     → lo lanza la programación (13:00 y 13:30); sólo si está
 *                          activado, de lunes a sábado, entre 12:55 y 15:00 y como
 *                          mucho un envío correcto al día. La segunda pasada solo
 *                          reintenta si la primera falló (auditoría B-22).
 *   { modo: 'preview' }  → enseña el mensaje sin enviarlo (encargado).
 *   { modo: 'manual' }   → lo envía ya (encargado), aunque esté desactivado.
 * Auditoría B-06: una llamada anónima en modo 'auto' ya no puede mandar el
 * mensaje cuando quiera ni repetirlo.
 * Se manda con la plantilla de utilidad ya aprobada (actualizacion_taller2),
 * a través de WhatsApp Pro, igual que los tickets.
 */
const TZ = 'Europe/Madrid';
const DEFAULT_TEMPLATE = 'actualizacion_taller2';
const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_TEXT = 1000; // Meta corta los parámetros largos
const AUTO_FROM = 12 * 60 + 55;
const AUTO_TO = 15 * 60;

function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

function credentialsFor() {
  const token = readSecret('WHATSAPP_TOKEN');
  const phoneId = readSecret('WHATSAPP_PHONE_NUMBER_ID');
  if (token && phoneId) return { mode: 'direct', token, phoneId };
  const relayUrl = readSecret('REPARO_RELAY_URL');
  const relayKey = readSecret('REPARO_RELAY_KEY');
  if (relayUrl && relayKey) return { mode: 'relay', relayUrl, relayKey };
  return null;
}

async function callRelay(credentials, payload) {
  const response = await fetch(credentials.relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tpv-key': credentials.relayKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(raw); } catch { data = {}; }
  if (!response.ok || data?.ok === false) {
    // Se guarda el motivo real (de Meta o de WhatsApp Pro) para poder verlo en el registro.
    throw new Error(data?.error || `WhatsApp Pro ha respondido ${response.status}${raw ? `: ${raw.slice(0, 200)}` : ''}`);
  }
  return data;
}

async function templateLang(credentials, name) {
  if (credentials.mode !== 'relay') return 'es_ES';
  try {
    const data = await callRelay(credentials, { action: 'template', name });
    return data.lang || 'es_ES';
  } catch {
    return 'es_ES';
  }
}

async function sendWhatsapp(credentials, { to, text, templateName }) {
  const lang = await templateLang(credentials, templateName);
  const template = {
    name: templateName,
    language: { code: lang },
    components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
  };
  if (credentials.mode === 'relay') {
    const data = await callRelay(credentials, { action: 'send', to, template, text, sender_name: 'TPV · Pendientes' });
    return data?.message_id || '';
  }
  const response = await fetch(`${GRAPH}/${credentials.phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `WhatsApp ha respondido ${response.status}`);
  return data?.messages?.[0]?.id || '';
}

/** Teléfono español a formato internacional sin '+': 601110325 → 34601110325. */
function phoneDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && /^[6789]/.test(digits)) digits = `34${digits}`;
  return digits.length >= 10 ? digits : '';
}

const madridDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const madridLabel = (date) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric' }).format(date);
function madridClock(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date).map((part) => [part.type, part.value]));
  return { weekday: parts.weekday, minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}
const toMs = (value) => {
  const text = String(value || '');
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`);
};
const money = (value) => `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} €`;
// Meta no admite saltos de línea ni más de 4 espacios seguidos dentro de un parámetro.
const oneLine = (value) => String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
const KIND = { pedido: 'Pedido', senal: 'Señal', otro: 'Otro' };

function buildMessage(tasks, now, today) {
  const fresh = tasks.filter((task) => madridDay(new Date(toMs(task.created_date))) === today).length;
  const items = tasks.map((task, index) => {
    const who = [task.customer_name, task.customer_phone].filter(Boolean).join(' ');
    const parts = [`${index + 1}) ${KIND[task.kind] || 'Otro'}: ${task.title}`];
    if (who) parts.push(`(${who})`);
    if (Number(task.amount) > 0) parts.push(money(task.amount));
    if (madridDay(new Date(toMs(task.created_date))) === today) parts.push('[nuevo]');
    return parts.join(' ');
  });
  const head = `Pendientes sin hacer, ${madridLabel(now)}: ${tasks.length}${fresh ? ` (${fresh} nuevos hoy)` : ''}.`;
  const tail = 'Lista completa en el TPV, en Venta > Pendientes.';
  let body = items.join(' · ');
  const room = MAX_TEXT - head.length - tail.length - 4;
  if (body.length > room) body = `${body.slice(0, room - 20).replace(/ [^ ]*$/, '')} … y más`;
  return oneLine(`${head} ${body}. ${tail}`);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const modo = ['auto', 'preview', 'manual'].includes(body.modo) ? body.modo : 'auto';

    // Preview y envío manual: sólo el encargado. 'auto' lo lanza la programación.
    let actor = 'programado';
    if (modo !== 'auto') {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Sólo el encargado' }, { status: 403 });
      actor = user.email;
    }

    const service = base44.asServiceRole;
    const settingsPage = await service.entities.Settings.filter({}, { sort: 'created_date', limit: 1 });
    const settings = (settingsPage.items || settingsPage || [])[0] || {};
    const now = new Date();
    const today = madridDay(now);

    if (modo === 'auto') {
      if (settings.pending_digest_enabled !== true) return Response.json({ skipped: 'Desactivado en Ajustes → Recordatorios' });
      const clock = madridClock(now);
      if (clock.weekday === 'Sun') return Response.json({ skipped: 'Domingo' });
      if (clock.minutes < AUTO_FROM || clock.minutes > AUTO_TO) return Response.json({ skipped: 'Fuera de la hora del resumen' });
      const sentPage = await service.entities.MessageLog.filter({ doc_kind: 'pendientes', doc_id: today, status: 'sent' }, { limit: 1 });
      if ((sentPage.items || sentPage || []).length) return Response.json({ skipped: 'Ya enviado hoy' });
    }
    const to = phoneDigits(settings.pending_digest_phone);
    if (!to && modo !== 'preview') return Response.json({ error: 'Falta el teléfono en Ajustes → Recordatorios' }, { status: 400 });

    const openPage = await service.entities.PendingTask.filter({ status: 'open' }, { sort: 'created_date', limit: 500 });
    const open = (openPage.items || openPage || []).sort((a, b) => toMs(a.created_date) - toMs(b.created_date));

    if (!open.length) {
      return Response.json({ skipped: 'No hay pendientes sin hacer', to: to ? `+${to}` : '' });
    }

    const text = buildMessage(open, now, today);
    if (modo === 'preview') return Response.json({ preview: true, to: to ? `+${to}` : '', count: open.length, text });

    const credentials = credentialsFor();
    // Siempre la plantilla de texto de una variable: las de documento no sirven aquí.
    const templateName = DEFAULT_TEMPLATE;
    let status = 'sent';
    let providerId = '';
    let errorText = '';
    if (!credentials) {
      status = 'failed';
      errorText = 'WhatsApp no está configurado (falta la conexión con WhatsApp Pro)';
    } else {
      try {
        providerId = await sendWhatsapp(credentials, { to, text, templateName });
      } catch (error) {
        status = 'failed';
        errorText = error.message;
      }
    }

    await service.entities.MessageLog.create({
      channel: 'whatsapp',
      doc_kind: 'pendientes',
      doc_id: today,
      to: `+${to}`,
      template: templateName,
      status,
      provider_message_id: providerId,
      error: errorText,
      sent_by: actor,
      sent_at: now.toISOString(),
    }).catch(() => null);

    if (status !== 'sent') return Response.json({ sent: false, to: `+${to}`, error: errorText, text }, { status: 502 });
    return Response.json({ sent: true, to: `+${to}`, count: open.length, message_id: providerId, text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
