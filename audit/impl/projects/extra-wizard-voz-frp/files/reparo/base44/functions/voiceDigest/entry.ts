// voiceDigest — alerta de voz 2 veces al día (11:05 y 18:05; sábado solo mañana).
// Dice cuántos equipos siguen sin recoger y cuántos presupuestos no tienen respuesta.
// Se reproduce en WhatsApp Inbox Pro (VoiceQueue). Sin usuario, como mucho una vez cada 4 h.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const DAY = 86400000;
const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));
const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const user = await base44.auth.me().catch(() => null);
  const url = (Deno.env.get('REPARO_WA_URL') || '').trim();
  const key = (Deno.env.get('REPARO_WA_KEY') || '').trim();
  if (!url || !key) return Response.json({ skipped: 'not_configured' });

  const KEY = 'voice_digest_last';
  const last = rows(await sr.SystemSettings.filter({ setting_key: KEY }))[0];
  if (!user && last && Date.now() - Date.parse(last.setting_value || '') < 4 * 3600000) return Response.json({ skipped: 'too_soon' });
  if (last) await sr.SystemSettings.update(last.id, { setting_value: nowIso() });
  else await sr.SystemSettings.create({ setting_key: KEY, setting_value: nowIso() });

  const [ready, budgets] = await Promise.all([
    sr.RepairOrder.filter({ is_open: true, status_group: 'ready' }, 'hc_updated_at', 2000, 0, ['ready_at', 'hc_updated_at']).catch(() => []),
    sr.RepairOrder.filter({ is_open: true, status_name: 'Enviar un Presupuesto' }, 'hc_updated_at', 500, 0, ['status_since', 'hc_updated_at']).catch(() => []),
  ]);
  const since = (o: any) => Date.parse(o.ready_at || o.status_since || o.hc_updated_at || '') || Date.now();
  const r = rows(ready); const b = rows(budgets);
  const old3 = r.filter((o) => Date.now() - since(o) >= 3 * DAY).length;
  const b24 = b.filter((o) => Date.now() - since(o) >= DAY).length;
  const text = `Aviso del taller. Hay ${r.length} equipos listos sin recoger, ${old3} de ellos con más de tres días. `
    + `Y ${b24} presupuestos sin respuesta desde hace más de un día. Puede repasarlos en el asistente de Reparo.`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Reparo-Key': key },
    body: JSON.stringify({ action: 'voice', text }), signal: AbortSignal.timeout(20000),
  }).then((x) => x.json().catch(() => ({}))).catch((e) => ({ error: String(e) }));
  return Response.json({ ok: !res?.error, text });
});
