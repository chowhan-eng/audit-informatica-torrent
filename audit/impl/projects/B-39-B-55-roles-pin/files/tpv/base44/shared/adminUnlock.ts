import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Pase del PIN del encargado (auditoría B-55). Antes el desbloqueo vivía solo en
 * el navegador; ahora adminPin entrega un pase de 30 min que el servidor guarda
 * con hash (AdminUnlock) y las funciones delicadas lo comprueban.
 */
export const UNLOCK_TTL_MINUTES = 30;

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export async function issueUnlock(service, email) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await service.entities.AdminUnlock.create({
    user_email: String(email || '').toLowerCase(),
    token_hash: await sha256(token),
    expires_at: new Date(Date.now() + UNLOCK_TTL_MINUTES * 60000).toISOString(),
  });
  return token;
}

/**
 * Devuelve una respuesta 423 si quien llama es encargado pero no trae un pase
 * válido; null si puede seguir (los no encargados los rechaza la propia función).
 */
export async function requireAdminUnlock(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const token = String(body._unlock || '');
  if (/^[0-9a-f]{64}$/.test(token)) {
    const page = await base44.asServiceRole.entities.AdminUnlock.filter(
      { token_hash: await sha256(token), user_email: String(user.email || '').toLowerCase() },
      { limit: 1 },
    );
    const pass = (page.items || [])[0];
    if (pass && Date.parse(pass.expires_at) > Date.now()) return null;
  }
  return Response.json({ error: 'Introduce el PIN del encargado', needs_pin: true }, { status: 423 });
}
