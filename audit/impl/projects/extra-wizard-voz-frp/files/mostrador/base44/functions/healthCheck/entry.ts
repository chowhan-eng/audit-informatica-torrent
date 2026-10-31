import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { askAll, staffEmails } from '../../shared/sources.ts';

/**
 * healthCheck (auditoría B-44): cada hora en horario de tienda comprueba que
 * Reparo, TPV y WhatsApp Pro responden (en < 8 s) y que no se acumulan envíos de
 * WhatsApp fallidos. Si algo falla manda un e-mail, como mucho uno cada 3 h.
 */
const SLOW_MS = 8000;
const FAILED_SENDS_ALERT = 5;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;
    const answers = await askAll({ action: 'hoy' }, 15000);
    const problems = [];
    for (const answer of answers) {
      if (answer.error) problems.push(`${answer.name} no responde (${answer.error})`);
      else if (answer.ms > SLOW_MS) problems.push(`${answer.name} va lento (${Math.round(answer.ms / 1000)} s)`);
    }
    const failed = answers.find((answer) => answer.app === 'whatsapp')?.data?.fallidos?.count || 0;
    if (failed >= FAILED_SENDS_ALERT) problems.push(`${failed} WhatsApp fallidos en 48 h`);

    const page = await service.entities.HealthCheck.filter({ alerted: true, ok: false }, { sort: '-at', limit: 5 });
    const lastAlert = (page.items || []).find((row) => !(row.problems || []).includes('__brief__'));
    const canAlert = !lastAlert || Date.now() - Date.parse(lastAlert.at) > 3 * 3600000;
    const alerted = problems.length > 0 && canAlert;
    if (alerted) {
      const body = `Control de salud de la tienda:\n\n${problems.map((problem) => `· ${problem}`).join('\n')}\n\nSi un aviso a clientes va mal, la pausa general está en WhatsApp Pro → Ajustes → Automatizaciones.`;
      await Promise.all(staffEmails().map((to) => service.integrations.Core.SendEmail({ to, subject: 'Aviso: algo no va bien en las apps', body })));
    }
    await service.entities.HealthCheck.create({ at: new Date().toISOString(), ok: !problems.length, problems, alerted });
    return Response.json({ ok: !problems.length, problems, alerted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
