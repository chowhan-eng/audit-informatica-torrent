import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/**
 * mostradorData (auditoría B-47): buscador global y panel «Hoy» de Mostrador.
 *
 * Mostrador no guarda datos: pregunta a la función mostradorLookup de Reparo, TPV
 * y WhatsApp Pro (solo lectura) con la clave MOSTRADOR_KEY y junta las respuestas.
 * Solo responde a un empleado con sesión: administrador, o correo incluido en el
 * secreto MOSTRADOR_STAFF (lista separada por comas).
 *
 *   { action: 'search', q }   resultados de las tres apps
 *   { action: 'hoy' }         panel del día; una app que no responde sale como error
 *                             sin tumbar las demás
 */
function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

const SOURCES = [
  { app: 'reparo', secret: 'MOSTRADOR_REPARO_URL' },
  { app: 'tpv', secret: 'MOSTRADOR_TPV_URL' },
  { app: 'whatsapp', secret: 'MOSTRADOR_WA_URL' },
];

async function ask(source, payload, key) {
  const url = readSecret(source.secret);
  if (!url || !key) return { app: source.app, error: 'sin configurar' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mostrador-Key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { app: source.app, error: data.error || `HTTP ${response.status}` };
    return { app: source.app, data };
  } catch (error) {
    return { app: source.app, error: error.name === 'TimeoutError' ? 'no responde' : error.message };
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const staff = readSecret('MOSTRADOR_STAFF').toLowerCase().split(',').map((email) => email.trim()).filter(Boolean);
    if (user.role !== 'admin' && !staff.includes(String(user.email || '').toLowerCase())) {
      return Response.json({ error: 'Esta cuenta no tiene acceso al panel' }, { status: 403 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const key = readSecret('MOSTRADOR_KEY');

    if (body.action === 'search') {
      const q = String(body.q || '').trim().slice(0, 60);
      if (q.replace(/\s/g, '').length < 2) return Response.json({ results: [], errors: [] });
      const answers = await Promise.all(SOURCES.map((source) => ask(source, { action: 'search', q }, key)));
      return Response.json({
        results: answers.flatMap((answer) => answer.data?.results || []),
        errors: answers.filter((answer) => answer.error).map((answer) => ({ app: answer.app, error: answer.error })),
      });
    }

    if (body.action === 'hoy') {
      const answers = await Promise.all(SOURCES.map((source) => ask(source, { action: 'hoy' }, key)));
      const out = { at: new Date().toISOString() };
      for (const answer of answers) out[answer.app] = answer.error ? { error: answer.error } : answer.data;
      return Response.json(out);
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
