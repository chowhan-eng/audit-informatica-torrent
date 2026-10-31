import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { askAll, staffEmails } from '../../shared/sources.ts';

/**
 * morningBrief (auditoría B-43): resumen de la mañana por e-mail a las 09:20
 * (lunes a sábado). Sustituye al informe diario de caja, al de stock semanal y al
 * resumen de fin de día de WhatsApp Pro. Usa el mismo panel «Hoy» de Mostrador.
 * Sin usuario, como mucho un envío cada 12 h (guardado en HealthCheck).
 */
const money = (value) => `${(Number(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const lines = (items) => (items || []).slice(0, 8).map((item) => `  · ${item.title}${item.subtitle ? ` — ${item.subtitle}` : ''}`).join('\n');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Sólo el encargado' }, { status: 403 });
    if (!user) {
      const page = await service.entities.HealthCheck.filter({ problems: ['__brief__'] }, { sort: '-at', limit: 1 });
      const last = (page.items || [])[0];
      if (last && Date.now() - Date.parse(last.at) < 12 * 3600000) return Response.json({ skipped: 'ya enviado' });
    }
    const answers = Object.fromEntries((await askAll({ action: 'hoy' })).map((answer) => [answer.app, answer]));
    const r = answers.reparo?.data || {};
    const t = answers.tpv?.data || {};
    const w = answers.whatsapp?.data || {};
    const errors = Object.values(answers).filter((answer) => answer.error).map((answer) => `${answer.name}: ${answer.error}`);
    const date = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' });
    const body = [
      `Resumen de la mañana — ${date}`,
      '',
      `Listos para recoger: ${r.listos?.count ?? '—'} (abiertos en total: ${r.listos?.total_open ?? '—'})`,
      lines(r.listos?.items),
      `Presupuestos sin respuesta: ${r.presupuestos?.count ?? '—'}`,
      lines(r.presupuestos?.items),
      `Esperando material: ${r.material?.count ?? '—'}`,
      `Chats esperando respuesta: ${w.esperando?.count ?? '—'}`,
      lines(w.esperando?.items),
      `Envíos de WhatsApp fallidos (48 h): ${w.fallidos?.count ?? '—'}`,
      `Pendientes del TPV: ${t.pendientes?.count ?? '—'}`,
      lines(t.pendientes?.items),
      `Caja: ${t.caja ? (t.caja.open ? 'abierta' : 'cerrada') : '—'} · señales abiertas: ${t.senales?.count ?? '—'} (${money(t.senales?.total)})`,
      errors.length ? `\nNo respondieron: ${errors.join('; ')}` : '',
      '\nPanel completo: https://torrent.base44.app',
    ].filter((line) => line !== '').join('\n');
    await Promise.all(staffEmails().map((to) => service.integrations.Core.SendEmail({ to, subject: `Resumen de la mañana · ${date}`, body })));
    await service.entities.HealthCheck.create({ at: new Date().toISOString(), ok: !errors.length, problems: ['__brief__', ...errors], alerted: true });
    return Response.json({ ok: true, sent_to: staffEmails().length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
