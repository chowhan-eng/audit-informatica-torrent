import { secrets } from 'base44:runtime';

/**
 * Enlaces de documento que caducan (auditoría B-29, SEC-10). Antes cada PDF que se
 * mandaba por WhatsApp se copiaba como archivo PÚBLICO y para siempre (NIF y
 * dirección del cliente a la vista de cualquiera con el enlace). Ahora el PDF sigue
 * privado y el enlace apunta a publicDoc, firmado con DOC_LINK_SECRET y válido 7 días;
 * publicDoc pide en ese momento un enlace temporal de 1 hora a la plataforma.
 */
export const LINK_DAYS = 7;
const PUBLIC_DOC_URL = 'https://tpvtorrent.base44.app/api/apps/6acf624e6e89e6f32c43243f/functions/publicDoc';

function readSecret(name) {
  try {
    return String(secrets.get(name) || '').trim();
  } catch {
    return '';
  }
}

const b64url = (text) => btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromB64url = (text) => decodeURIComponent(escape(atob(String(text).replace(/-/g, '+').replace(/_/g, '/'))));

export async function sign(payload) {
  const secret = readSecret('DOC_LINK_SECRET');
  if (!secret) return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Enlace de 7 días para un PDF privado, o '' si falta el secreto. */
export async function expiringDocLink(fileUri, fileName) {
  if (!fileUri) return '';
  const u = b64url(fileUri);
  const e = String(Math.floor(Date.now() / 1000) + LINK_DAYS * 86400);
  const s = await sign(`${u}.${e}`);
  if (!s) return '';
  return `${PUBLIC_DOC_URL}?u=${u}&e=${e}&s=${s}&n=${encodeURIComponent(fileName || 'documento.pdf')}`;
}
