import { secrets } from 'base44:runtime';

/** Las tres apps que consulta Mostrador (mostradorLookup en cada una, clave MOSTRADOR_KEY). */
export function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

export const SOURCES = [
  { app: 'reparo', name: 'Reparo', secret: 'MOSTRADOR_REPARO_URL' },
  { app: 'tpv', name: 'TPV', secret: 'MOSTRADOR_TPV_URL' },
  { app: 'whatsapp', name: 'WhatsApp Pro', secret: 'MOSTRADOR_WA_URL' },
];

export async function askAll(payload, timeoutMs = 10000) {
  const key = readSecret('MOSTRADOR_KEY');
  return Promise.all(SOURCES.map(async (source) => {
    const url = readSecret(source.secret);
    if (!url || !key) return { ...source, error: 'sin configurar' };
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mostrador-Key': key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ...source, ms: Date.now() - started, error: data.error || `HTTP ${response.status}` };
      return { ...source, ms: Date.now() - started, data };
    } catch (error) {
      return { ...source, ms: Date.now() - started, error: error.name === 'TimeoutError' ? 'no responde' : error.message };
    }
  }));
}

/** Destinatarios de los correos internos (D-15: resumen solo por e-mail). */
export function staffEmails() {
  return (readSecret('BRIEF_EMAILS') || 'chowhan@gmail.com').split(',').map((email) => email.trim()).filter(Boolean);
}
