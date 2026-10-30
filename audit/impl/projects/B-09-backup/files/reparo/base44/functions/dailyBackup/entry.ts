// =============================================================================
// dailyBackup — copia diaria de los datos de Reparo (auditoría B-09).
//
// Cada entidad se guarda como JSON comprimido (gzip) en el almacenamiento
// PRIVADO de la app, en partes de 5.000 filas. Cada ejecución deja una fila
// BackupRun con la lista de archivos, el número de filas y el SHA-256 de cada
// archivo, así se puede comprobar después que la copia está completa.
//
//   POST {}                         → copia programada (workflow 14:15 lun-sáb).
//                                     Sin usuario solo se hace una copia cada 20 h,
//                                     así una llamada anónima no puede repetirla.
//   POST { force: true }            → copia ahora (solo admin)
//   POST { action: 'list' }         → últimas copias con enlaces de descarga de 1 h (admin)
//   POST { action: 'verify', run_id } → descarga cada archivo, comprueba SHA-256 y
//                                     número de filas (admin)
//
// Retención: 30 copias diarias + 12 mensuales (la primera copia de cada mes).
// Las más antiguas se marcan expired=true. La plataforma no ofrece borrar
// archivos privados desde una función, así que siguen en el almacenamiento.
//
// Fuera de la copia: DeviceUnlockCode (contraseñas de los equipos de clientes:
// nunca salen de la tabla protegida), PublicLookupLog, ReportCache,
// UserListSettings (datos técnicos que se regeneran).
// =============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const APP = 'reparo';
const ENTITIES = [
  'RepairOrder', 'Client', 'ShopStatus', 'ShopField', 'Handbook', 'Employee', 'ShopRole',
  'OrderPreset', 'PrintTemplate', 'PrintTemplateVersion', 'ShopTask', 'TicketFile', 'Review',
  'Product', 'Sale', 'SystemSettings', 'ActionLog', 'WhatsAppQueue',
];
const PAGE = 500;
const PART_ROWS = 5000;
const MIN_GAP_MS = 20 * 60 * 60 * 1000;
const STALE_RUNNING_MS = 2 * 60 * 60 * 1000;
const KEEP_DAILY = 30;
const KEEP_MONTHLY = 12;
const SECRET_KEY = /token|secret|password|passwd|api_?key|private/i;

const rows = (x: any): any[] => (Array.isArray(x) ? x : (x?.items || []));
const nowIso = () => new Date().toISOString();
const madridDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzipText(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Rows that must never leave the app (secret-looking settings). */
function scrub(entity: string, list: any[]): any[] {
  if (entity !== 'SystemSettings') return list;
  return list.filter((r) => !SECRET_KEY.test(String(r.setting_key || '')));
}

async function backupEntity(sr: any, core: any, day: string, entity: string) {
  const files: any[] = [];
  let part = 1;
  let buffer: any[] = [];
  const flush = async () => {
    if (!buffer.length && files.length) return;
    const doc = { app: APP, entity, part, exported_at: nowIso(), count: buffer.length, rows: buffer };
    const bytes = await gzip(JSON.stringify(doc));
    const name = `backup-${APP}-${day}-${entity}-p${String(part).padStart(3, '0')}.json.gz`;
    const up = await core.UploadPrivateFile({ file: new File([bytes], name, { type: 'application/gzip' }) });
    if (!up?.file_uri) throw new Error(`${entity}: no se pudo guardar ${name}`);
    files.push({ entity, part, name, count: buffer.length, bytes: bytes.length, sha256: await sha256(bytes), file_uri: up.file_uri });
    part++;
    buffer = [];
  };
  for (let skip = 0; ; skip += PAGE) {
    const page = rows(await sr[entity].filter({}, 'created_date', PAGE, skip));
    buffer.push(...scrub(entity, page));
    if (buffer.length >= PART_ROWS) await flush();
    if (page.length < PAGE) break;
  }
  await flush();
  return files;
}

async function applyRetention(sr: any) {
  const ok = rows(await sr.BackupRun.filter({ status: 'ok', expired: { $ne: true } }, '-started_at', 200).catch(() => []));
  const daily = ok.filter((r: any) => r.kind !== 'monthly').slice(KEEP_DAILY);
  const monthly = ok.filter((r: any) => r.kind === 'monthly').slice(KEEP_MONTHLY);
  for (const r of [...daily, ...monthly]) await sr.BackupRun.update(r.id, { expired: true }).catch(() => {});
  return daily.length + monthly.length;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const core = base44.asServiceRole.integrations.Core;
  const user = await base44.auth.me().catch(() => null);
  const isAdmin = user?.role === 'admin';
  const body = await req.json().catch(() => ({}));

  if (body.action === 'list' || body.action === 'verify') {
    if (!isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  if (body.action === 'list') {
    const runs = rows(await sr.BackupRun.filter({}, '-started_at', Math.min(Number(body.limit) || 10, 40)));
    const out = [];
    for (const r of runs) {
      const files = [];
      for (const f of r.files || []) {
        const signed = r.expired ? null : await core.CreateFileSignedUrl({ file_uri: f.file_uri, expires_in: 3600 }).catch(() => null);
        files.push({ ...f, url: signed?.signed_url || '' });
      }
      out.push({ ...r, files });
    }
    return Response.json({ runs: out });
  }

  if (body.action === 'verify') {
    const run = await sr.BackupRun.get(String(body.run_id || '')).catch(() => null);
    if (!run) return Response.json({ error: 'not_found' }, { status: 404 });
    const problems: string[] = [];
    let records = 0;
    for (const f of run.files || []) {
      try {
        const signed = await core.CreateFileSignedUrl({ file_uri: f.file_uri, expires_in: 600 });
        const res = await fetch(signed.signed_url, { signal: AbortSignal.timeout(60000) });
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (await sha256(bytes) !== f.sha256) { problems.push(`${f.name}: SHA-256 distinto`); continue; }
        const doc = JSON.parse(await gunzipText(bytes));
        if (!Array.isArray(doc.rows) || doc.rows.length !== f.count) problems.push(`${f.name}: ${doc.rows?.length} filas, esperadas ${f.count}`);
        records += doc.rows?.length || 0;
      } catch (e) {
        problems.push(`${f.name}: ${(e as any)?.message || e}`);
      }
    }
    const verify_result = problems.length ? `FALLO: ${problems.join('; ')}`.slice(0, 2000) : `OK: ${(run.files || []).length} archivos, ${records} filas`;
    await sr.BackupRun.update(run.id, { verified_at: nowIso(), verify_result });
    return Response.json({ ok: !problems.length, verify_result });
  }

  // ---------------------------------------------------------------- backup
  if (body.force && !isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });
  const last = rows(await sr.BackupRun.filter({ status: { $in: ['ok', 'running'] } }, '-started_at', 1).catch(() => []))[0];
  if (last && !body.force) {
    const age = Date.now() - Date.parse(last.started_at || last.created_date || 0);
    const stuck = last.status === 'running' && age > STALE_RUNNING_MS;
    if (stuck) await sr.BackupRun.update(last.id, { status: 'failed', error: 'Interrumpida (más de 2 h en curso)' }).catch(() => {});
    else if (age < MIN_GAP_MS) return Response.json({ status: 'skipped_recent', last_run: last.id });
  }

  const day = madridDate();
  const month = day.slice(0, 7);
  const monthlyDone = rows(await sr.BackupRun.filter({ kind: 'monthly', status: 'ok', day: { $gte: `${month}-01` } }, '-started_at', 1).catch(() => [])).length > 0;
  const subset: string[] = Array.isArray(body.entities) && isAdmin ? body.entities.filter((e: string) => ENTITIES.includes(e)) : [];
  const only = subset.length ? subset : ENTITIES;
  const run = await sr.BackupRun.create({
    app: APP, day, kind: monthlyDone || subset.length ? 'daily' : 'monthly', status: 'running',
    trigger: user ? `manual:${user.email}` : 'schedule', started_at: nowIso(), files: [],
  });

  const t0 = Date.now();
  const files: any[] = [];
  try {
    for (const entity of only) files.push(...await backupEntity(sr, core, day, entity));
    const records = files.reduce((s, f) => s + f.count, 0);
    const bytes = files.reduce((s, f) => s + f.bytes, 0);
    await sr.BackupRun.update(run.id, {
      status: 'ok', finished_at: nowIso(), duration_ms: Date.now() - t0, files,
      totals: { entities: only.length, files: files.length, records, bytes },
    });
    const expired = await applyRetention(sr);
    return Response.json({ status: 'ok', run_id: run.id, files: files.length, records, bytes, expired });
  } catch (e) {
    const error = String((e as any)?.message || e).slice(0, 1000);
    await sr.BackupRun.update(run.id, { status: 'failed', finished_at: nowIso(), duration_ms: Date.now() - t0, files, error }).catch(() => {});
    return Response.json({ status: 'failed', run_id: run.id, error }, { status: 500 });
  }
});
