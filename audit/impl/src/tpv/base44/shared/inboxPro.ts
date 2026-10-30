import { secrets } from 'base44:runtime';

/** Endpoint del CRM, o cadena vacía si no está configurado. */
export function inboxProEndpoint() {
  try {
    return String(secrets.get('INBOX_PRO_ENDPOINT') || '').trim();
  } catch {
    return '';
  }
}

/** Secreto compartido con logOutboundMessage (mismo valor que OUTBOUND_LOG_SECRET en WhatsApp Pro). */
function outboundLogSecret() {
  try {
    return String(secrets.get('OUTBOUND_LOG_SECRET') || '').trim();
  } catch {
    return '';
  }
}

/**
 * WhatsApp Inbox Pro (Reparo): copia al CRM cada WhatsApp enviado para que la
 * conversación aparezca en la ficha del cliente. INBOX_PRO_ENDPOINT apunta a la
 * función logOutboundMessage del CRM, que espera { phone, body, meta_message_id,
 * sender_name }. Sin el secreto no hace nada.
 */
export async function copyWhatsappToInbox(entry) {
  const endpoint = inboxProEndpoint();
  if (!endpoint) return { skipped: 'sin_endpoint' };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      // logOutboundMessage rechaza (401) las llamadas sin este secreto (auditoría B-02).
      headers: { 'Content-Type': 'application/json', 'x-outbound-log-secret': outboundLogSecret() },
      body: JSON.stringify({
        // Formato de logOutboundMessage (Reparo)
        phone: String(entry.phone || '').replace(/\D/g, ''),
        body: entry.text || `${entry.label || 'Documento'} ${entry.code || ''}: ${entry.pdfUrl || ''}`.trim(),
        meta_message_id: entry.messageId || null,
        sender_name: `TPV${entry.sentBy ? ` · ${entry.sentBy}` : ''}`,
        // Datos extra del documento
        canal: 'whatsapp',
        telefono: entry.phone || '',
        documento: entry.label || '',
        tipo: entry.docKind || '',
        codigo: entry.code || '',
        pdf_url: entry.pdfUrl || '',
        mensaje_id: entry.messageId || '',
        estado: entry.status || '',
        enviado_por: entry.sentBy || '',
        fecha: entry.sentAt || new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}