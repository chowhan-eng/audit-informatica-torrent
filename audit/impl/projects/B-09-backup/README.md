# B-09 — Daily data backup (prepared locally, NOT deployed)

**What it does.** Each app gets a `dailyBackup` function and a workflow at 14:15, Mon–Sat (Madrid time).
- Every entity is saved as gzip JSON in the app's **private** file storage, in parts of 5,000 rows.
- Each run writes one `BackupRun` row with every file's entity, part, row count, bytes, SHA-256 and `file_uri`.
- **Retention:** 30 daily + 12 monthly runs. The first successful run of each month is the monthly one. Older runs get `expired=true`. The platform has no API to delete private files from a function, so the files themselves stay in storage.
- **Admin actions:** `{action:'list'}` returns download links valid for 1 h. `{action:'verify', run_id}` downloads every file and checks its SHA-256 and row count. `{force:true}` runs a backup now; `{entities:[...]}` limits it to some entities.
- **Abuse guard:** without an admin session, at most one backup per 20 h. An anonymous POST cannot loop backups.

**Left out on purpose.**
- Reparo: `DeviceUnlockCode` (customer passcodes never leave the protected table).
- WhatsApp Pro: stale Reparo mirrors, embeddings and logs. `SystemSettings` rows whose key looks like a secret are dropped.
- TPV: `AdminPin`.

| App | New files |
|---|---|
| Reparo | `files/reparo/base44/functions/dailyBackup/{entry.ts,function.jsonc}`, `entities/BackupRun.jsonc`, `workflows/CopiaSeguridadDiaria.jsonc` |
| TPV | `files/tpv/base44/functions/dailyBackup/entry.ts`, `entities/BackupRun.jsonc`, `workflows/CopiaSeguridadDiaria.jsonc` |
| WhatsApp Pro | Local clone commit; same three files (see `../../week1/patches/`) |

**Tests done locally.** Mock run with 12,345 sales:
- 3 parts, 23 files;
- verify OK, and a tampered file is detected;
- anonymous `force` returns 403; a second run within 20 h is skipped;
- after 46 runs, 30 daily + 1 monthly are kept and 15 are expired.

**Apply checks.**
1. Run once with `force` as admin. Note the duration: Base44 function time limits are not documented. For WhatsApp Pro `Messages`, run `{entities:['Messages']}` alone first.
2. Run `verify`.
3. **Restore test** (AUDIT, quarterly): download one run via `list` and import a few entities into a copy app. Record the result in CHANGELOG.

**Secrets:** none.
