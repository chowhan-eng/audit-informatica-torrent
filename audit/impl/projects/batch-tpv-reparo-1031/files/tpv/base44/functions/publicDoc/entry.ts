import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fromB64url, sign } from '../../shared/docLink.ts';

/**
 * publicDoc (auditoría B-29): abre el PDF de un ticket o factura desde el enlace
 * del WhatsApp. Sin login, pero el enlace va firmado y caduca a los 7 días; al
 * abrirlo se redirige a un enlace temporal (1 h) del almacenamiento privado.
 */
function sameHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const page = (text, status) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documento</title><body style="font-family:system-ui;padding:24px"><p>${text}</p><p>Informática Torrent · 961 564 693</p></body>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

export default async function (req) {
  try {
    const url = new URL(req.url);
    const u = url.searchParams.get('u') || '';
    const e = url.searchParams.get('e') || '';
    const s = url.searchParams.get('s') || '';
    if (!u || !/^\d+$/.test(e) || !sameHex(s, await sign(`${u}.${e}`))) return page('Enlace no válido.', 403);
    if (Number(e) * 1000 < Date.now()) return page('Este enlace ha caducado. Pídanos el documento de nuevo por WhatsApp.', 410);
    const service = createClientFromRequest(req).asServiceRole;
    const signed = await service.integrations.Core.CreateFileSignedUrl({ file_uri: fromB64url(u), expires_in: 3600 });
    if (!signed?.signed_url) return page('No se ha podido abrir el documento.', 500);
    return Response.redirect(signed.signed_url, 302);
  } catch {
    return page('No se ha podido abrir el documento.', 500);
  }
}
