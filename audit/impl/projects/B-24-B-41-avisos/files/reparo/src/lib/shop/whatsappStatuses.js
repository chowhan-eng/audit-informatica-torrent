// Which statuses send the customer a WhatsApp (audit B-24, D-09: 💬 in the status menu).
// Mirrors classify() in WhatsApp Pro reparoBridge; keep both in sync.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function statusMessagesCustomer(status) {
  if (String(status?.whatsapp_template || '').trim().toLowerCase() === 'no') return false;
  const s = norm(status?.name);
  if (s.includes('entregado')) return false;
  if (s.includes('mensajeria')) return true; // B-45 mail-in statuses
  if (s.includes('enviado') && s.includes('cliente')) return true;
  if (s.includes('esperando') && s.includes('material')) return true;
  if (s.includes('pieza') && s.includes('recibid')) return true;
  if (s.includes('no') && s.includes('reparacion')) return true;
  if (s.includes('listo')) return s.includes('whatsapp') || s.includes('wsp');
  if (s.includes('contactar')) return true;
  if (s.includes('presupuesto') && s.includes('enviar')) return true;
  return s.includes('conversaci');
}
