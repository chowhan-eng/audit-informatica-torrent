import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * dailyBackup (auditoría B-09): copia diaria de los datos del TPV.
 *
 * Cada entidad se guarda como JSON comprimido (gzip) en el almacenamiento
 * PRIVADO de la app, en partes de 5.000 filas. Cada ejecución deja una fila
 * BackupRun con los archivos, el número de filas y el SHA-256 de cada uno.
 * Ventas, facturas y registros fiscales tienen obligación legal de conservarse.
 *
 *   {}                          copia programada (workflow 14:15 lun-sáb). Sin
 *                               usuario solo hay una copia cada 20 h.
 *   { force: true }             copia ahora (solo el encargado)
 *   { action: 'list' }          últimas copias con enlaces de descarga de 1 h
 *   { action: 'verify', run_id } comprueba SHA-256 y número de filas de cada archivo
 *
 * Retención: 30 diarias + 12 mensuales; las antiguas se marcan expired=true (la
 * plataforma no permite borrar archivos privados desde una función).
 * Fuera de la copia: AdminPin (PIN cifrados), ImportJob (técnica).
 */
const APP = 'tpv';
const ENTITIES = [
  'Sale', 'Invoice', 'FiscalRecord', 'Customer', 'Product', 'Family', 'CashSession', 'CashMovement',
  'Counter', 'Deposit', 'Voucher', 'StockMovement', 'SerialUnit', 'Supplier', 'PurchaseOrder',
  'Document', 'Settings', 'PendingTask', 'MessageLog', 'AuditLog', 'HistoricSale',
];
const PAGE = 500;
const PART_ROWS = 5000;
const MIN_GAP_MS = 20 * 60 * 60 * 1000;
const STALE_RUNNING_MS = 2 * 60 * 60 * 1000;
const KEEP_DAILY = 30;
const KEEP_MONTHLY = 12;

const itemsOf = (page) => (Array.isArray(page) ? page : page?.items || []);
const nowIso = () => new Date().toISOString();
const madridDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipText(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function backupEntity(service, day, entity) {
  const files = [];
  let part = 1;
  let buffer = [];
  const flush = async () => {
    if (!buffer.length && files.length) return;
    const doc = { app: APP, entity, part, exported_at: nowIso(), count: buffer.length, rows: buffer };
    const bytes = await gzip(JSON.stringify(doc));
    const name = `backup-${APP}-${day}-${entity}-p${String(part).padStart(3, '0')}.json.gz`;
    const uploaded = await service.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: 'application/gzip' }) });
    if (!uploaded?.file_uri) throw new Error(`${entity}: no se ha podido guardar ${name}`);
    files.push({ entity, part, name, count: buffer.length, bytes: bytes.length, sha256: await sha256(bytes), file_uri: uploaded.file_uri });
    part += 1;
    buffer = [];
  };
  for (let skip = 0; ; skip += PAGE) {
    const page = itemsOf(await service.entities[entity].filter({}, { sort: 'created_date', limit: PAGE, skip }));
    buffer.push(...page);
    if (buffer.length >= PART_ROWS) await flush();
    if (page.length < PAGE) break;
  }
  await flush();
  return files;
}

async function applyRetention(service) {
  const ok = itemsOf(await service.entities.BackupRun.filter({ status: 'ok', expired: { $ne: true } }, { sort: '-started_at', limit: 200 }));
  const daily = ok.filter((run) => run.kind !== 'monthly').slice(KEEP_DAILY);
  const monthly = ok.filter((run) => run.kind === 'monthly').slice(KEEP_MONTHLY);
  for (const run of [...daily, ...monthly]) await service.entities.BackupRun.update(run.id, { expired: true });
  return daily.length + monthly.length;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const service = base44.asServiceRole;
  const user = await base44.auth.me().catch(() => null);
  const isAdmin = user?.role === 'admin';

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if ((body.action === 'list' || body.action === 'verify' || body.force) && !isAdmin) {
      return Response.json({ error: 'Sólo el encargado' }, { status: 403 });
    }

    if (body.action === 'list') {
      const runs = itemsOf(await service.entities.BackupRun.filter({}, { sort: '-started_at', limit: Math.min(Number(body.limit) || 10, 40) }));
      const out = [];
      for (const run of runs) {
        const files = [];
        for (const file of run.files || []) {
          const signed = run.expired ? null : await service.integrations.Core.CreateFileSignedUrl({ file_uri: file.file_uri, expires_in: 3600 }).catch(() => null);
          files.push({ ...file, url: signed?.signed_url || '' });
        }
        out.push({ ...run, files });
      }
      return Response.json({ runs: out });
    }

    if (body.action === 'verify') {
      const run = await service.entities.BackupRun.get(String(body.run_id || '')).catch(() => null);
      if (!run) return Response.json({ error: 'No existe esa copia' }, { status: 404 });
      const problems = [];
      let records = 0;
      for (const file of run.files || []) {
        try {
          const signed = await service.integrations.Core.CreateFileSignedUrl({ file_uri: file.file_uri, expires_in: 600 });
          const res = await fetch(signed.signed_url, { signal: AbortSignal.timeout(60000) });
          const bytes = new Uint8Array(await res.arrayBuffer());
          if ((await sha256(bytes)) !== file.sha256) {
            problems.push(`${file.name}: SHA-256 distinto`);
            continue;
          }
          const doc = JSON.parse(await gunzipText(bytes));
          if (!Array.isArray(doc.rows) || doc.rows.length !== file.count) problems.push(`${file.name}: ${doc.rows?.length} filas, esperadas ${file.count}`);
          records += doc.rows?.length || 0;
        } catch (error) {
          problems.push(`${file.name}: ${error.message}`);
        }
      }
      const verifyResult = problems.length
        ? `FALLO: ${problems.join('; ')}`.slice(0, 2000)
        : `OK: ${(run.files || []).length} archivos, ${records} filas`;
      await service.entities.BackupRun.update(run.id, { verified_at: nowIso(), verify_result: verifyResult });
      return Response.json({ ok: problems.length === 0, verify_result: verifyResult });
    }

    // --- Copia
    const last = itemsOf(await service.entities.BackupRun.filter({ status: { $in: ['ok', 'running'] } }, { sort: '-started_at', limit: 1 }))[0];
    if (last && !body.force) {
      const age = Date.now() - Date.parse(last.started_at || last.created_date || 0);
      if (last.status === 'running' && age > STALE_RUNNING_MS) {
        await service.entities.BackupRun.update(last.id, { status: 'failed', error: 'Interrumpida (más de 2 h en curso)' });
      } else if (age < MIN_GAP_MS) {
        return Response.json({ status: 'skipped_recent', last_run: last.id });
      }
    }

    const day = madridDate();
    const monthlyDone = itemsOf(await service.entities.BackupRun.filter(
      { kind: 'monthly', status: 'ok', day: { $gte: `${day.slice(0, 7)}-01` } },
      { sort: '-started_at', limit: 1 },
    )).length > 0;
    const subset = Array.isArray(body.entities) && isAdmin ? body.entities.filter((name) => ENTITIES.includes(name)) : null;
    const only = subset && subset.length ? subset : ENTITIES;

    const run = await service.entities.BackupRun.create({
      app: APP,
      day,
      kind: monthlyDone || subset ? 'daily' : 'monthly',
      status: 'running',
      trigger: user ? `manual:${user.email}` : 'schedule',
      started_at: nowIso(),
      files: [],
    });

    const started = Date.now();
    const files = [];
    try {
      for (const entity of only) files.push(...(await backupEntity(service, day, entity)));
      const records = files.reduce((sum, file) => sum + file.count, 0);
      const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
      await service.entities.BackupRun.update(run.id, {
        status: 'ok',
        finished_at: nowIso(),
        duration_ms: Date.now() - started,
        files,
        totals: { entities: only.length, files: files.length, records, bytes },
      });
      const expired = await applyRetention(service);
      return Response.json({ status: 'ok', run_id: run.id, files: files.length, records, bytes, expired });
    } catch (error) {
      const message = String(error?.message || error).slice(0, 1000);
      await service.entities.BackupRun.update(run.id, {
        status: 'failed', finished_at: nowIso(), duration_ms: Date.now() - started, files, error: message,
      }).catch(() => {});
      return Response.json({ status: 'failed', run_id: run.id, error: message }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
