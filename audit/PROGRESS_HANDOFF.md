# Progress handoff — continue from here (31 Oct 2026)

**Golden rule:** zero deploys, zero secret changes, zero restarts in Base44 until Joney says so (D-39). Everything is local.

## Where things are
- **Audit repo:** `audit-informatica-torrent`, branch `claude/fase-4-seguridad-datos-p25zc2`.
  - Docs: `audit/DECISIONS.md` (D-01…D-42), `audit/impl/DEPLOY.md` (order, secrets, data steps, tests), `audit/impl/BACKLOG_STATUS.md`, `audit/INFORME_FINAL_JONEY.md`.
  - Code for Reparo / TPV / Mostrador: `audit/impl/projects/*/files/` (new files) + `patch_existing_files.py` in each project. Each script has anchors checked against production; run with `--check` first.
  - Production snapshots and B-05: `audit/impl/src/`.
- **WhatsApp Pro:** patches `audit/impl/week1/patches/0001…0015` on production main 8d595b9 (`git am`). The local clone `/home/user/whatsapp-inbox-pro` (branch `local/week1-patches`, push disabled) exists only in this session; the patches are the source of truth.
- **Production heads (unchanged):** WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563.

## Status
- 2 LIVE, 51 READY, 8 WAITING (Joney / gestoría / platform), 2 TODO, 1 SKIPPED (B-63, D-06).
- 31 Oct extras done: D-40 FRP, D-41 tutorials (KB JSON), D-42 voice alert + Asistente page.
- **Not done** in the 31 Oct batch: loading the new KB entries into the production table. A data write takes effect immediately, so it is left for the deploy (file: `projects/extra-wizard-voz-frp/kb/`).

## TODO items (not programmed yet)
B-36, B-52

- **B-36 (money/numbering server-only in the TPV)** — large. Move these writes to functions and then lock the entities: `Voucher` create (VoucherDialog), `Deposit` create (NuevaSenalDialog, ideally inside completeSale), `Invoice`/`Counter` create, `Product` price/stock updates (via `updateProduct`/`stockAdjust` only), `AuditLog` create (OrderDialog, PendientesPanel).
- **B-52 (shared helpers)** — refactor with no behaviour change: one shop-hours helper, one LLM call and one phone normaliser per app (≥ 8 copies today). Do it after the deploy is stable, so that it is not mixed with real changes.

How to do each one: see `audit/BACKLOG.csv` (acceptance criteria). Read only the files you need with targeted greps; put the code in `audit/impl/projects/<item>/` (new files + anchored patch script); WhatsApp Pro changes as a new `00NN` patch.

## Next steps when Joney is ready
1. B-03 token (Joney) → test to +34 658 … 734.
2. `audit/impl/DEPLOY.md` step by step. Reparo/TPV extra projects, run last and in this order: extra-wizard-voz-frp, batch-tpv-reparo-1031, B-45-mensajeria, B-48-catalogo-cache, B-50-busqueda-reparo, B-51-B-53-B-31 (WhatsApp Pro patches 0001–0015; Reparo also gets `projects/extra-wizard-voz-frp`).
3. One week later: `reminders_live=true`, `library_autoreply_mode=live`, `retention_live=true`.

- New secret for batch-tpv-reparo-1031: `DOC_LINK_SECRET` (TPV). Add it to DEPLOY.md §2 at deploy time.

## DEPLOY STATUS — 31 Oct 2026, ~14:10 Madrid (mass deploy started with Joney's OK)

**Meta token:**
- New token tested OK: scheduled message to +34 658 … 734 sent 12:46 (wamid logged).
- Only WhatsApp Pro holds the Meta token; TPV and Reparo send through it. The old token can be revoked.

**Live:**
- **WhatsApp Pro:**
  - patches 0001–0015 applied (main d630b51) + `extractMemory` inert stub (4a4f1ad); deployed;
  - secrets OUTBOUND_LOG_SECRET and MOSTRADOR_KEY set;
  - checked: anonymous sendMessage, sendPush, logOutboundMessage and processAlerts → 401.
- **TPV:**
  - all project scripts applied (main 6540681); vite build OK; zz* and cleanupTestData deleted;
  - secrets OUTBOUND_LOG_SECRET, MOSTRADOR_KEY, REPARO_TPV_KEY and REPARO_TPV_URL set; deployed;
  - entities created by hand: SaleRequest, AdminUnlock, CashierPin, ReparoSync, BackupRun; Sale schema updated (repair_order_id, client_request_id);
  - new functions created by hand (redeploy-function API): reparoSyncSweep, cashierPin (with automatic migration of old PINs), reparoOrderLookup, publicDoc.
- **Reparo:**
  - all scripts applied (checkpoint 6ae5e1f4f75168cc957cfc73, main 5e664f8); build OK; deployed;
  - secrets TPV_BRIDGE_KEY and MOSTRADOR_KEY set;
  - RepairOrder schema updated with the new fields;
  - existing functions updated and live (publicStatus now asks for the order number; waLookup 401).

**NOT live yet (to finish):**
1. **Base44 does not create new functions, entities or workflows on deploy.**
   - Creating them needs either `coding/redeploy-function` (sending the code) and `create_entity_schema`, or `base44 deploy` from the sandbox. The CLI needs a device login by Joney.
2. **Reparo new functions:** tpvBridge, mostradorLookup, wizardNotify, customerReminders, allocateOrderNumber, voiceDigest, retentionSweep, dailyBackup.
   - Until then: Cobrar en TPV marks orders paid only when tpvBridge exists (TPV queues and retries; ReparoSync); Asistente "Avisar desde hoy" fails; numbering uses the old fallback.
3. **Reparo entities:** BackupRun (new); Client/RepairOrder admin-only delete (B-39) and ActionLog RLS (B-53) are not applied. `update_entity_schema` kept the old RLS and rewrote the repo file.
4. **TPV new functions:** mostradorLookup, dailyBackup. Entity updates: MessageLog enum 'pendientes', AuditLog RLS.
5. **WhatsApp Pro entities:** BackupRun (new); RLS changes from patches 0007/0011 (UserProfile admin-only, deletes admin-only, stale mirrors). Check that dailyBackup and duplicatesReport exist.
6. **Workflows in all apps** (new/changed jsonc): check in each app's Workflows screen: CopiaSeguridadDiaria, CobrosReparo, RecordatoriosClientes, AvisoVoz*, Conservacion, masterTick */10, Reparo 15-min sweep, TPV 13:00/13:30.
7. **Mostrador:** not started (B-47 panel, morningBrief, healthCheck, HealthCheck entity, secrets).
8. **Data:** status/fields for mail-in (B-45); KB entries D-40/D-41; settings `reminders_live`/`library_autoreply_mode` stay off (trial week).

## RESUME FROM CLAUDE DESKTOP — read this first (2 Nov 2026)

**Exact function names and source folders** (all under `audit/impl/projects/`). Each folder holds `entry.ts`; send it with `POST /api/apps/{app}/coding/redeploy-function/{name}` (Base44 connector `execute_api`) or `base44 deploy` after the CLI login.

| App | Function | Source |
|---|---|---|
| Reparo | `tpvBridge` (there is no "reparoTpvBridge") | `B-40-cobrar-en-tpv/files/reparo/base44/functions/tpvBridge` |
| Reparo | `mostradorLookup` | `B-47-mostrador/files/reparo/base44/functions/mostradorLookup` |
| Reparo | `wizardNotify` | `extra-wizard-voz-frp/files/reparo/base44/functions/wizardNotify` |
| Reparo | `customerReminders` | `B-24-B-41-avisos/files/reparo/base44/functions/customerReminders` |
| Reparo | `allocateOrderNumber` | `batch-tpv-reparo-1031/files/reparo/base44/functions/allocateOrderNumber` |
| Reparo | `voiceDigest` | `extra-wizard-voz-frp/files/reparo/base44/functions/voiceDigest` |
| Reparo | `retentionSweep` | `extra-wizard-voz-frp/files/reparo/base44/functions/retentionSweep` |
| Reparo | `dailyBackup` (needs entity BackupRun first) | `B-09-backup/files/reparo/base44/functions/dailyBackup` |
| TPV | `mostradorLookup` | `B-47-mostrador/files/tpv/base44/functions/mostradorLookup` |
| TPV | `dailyBackup` (BackupRun already exists) | `B-09-backup/files/tpv/base44/functions/dailyBackup` |
| Mostrador | panel + `morningBrief`, `healthCheck` | `B-47-mostrador/files/mostrador`, `extra-wizard-voz-frp/files/mostrador` |

Notes:
- Reparo is old runtime (`Deno.serve` + `Deno.env`); TPV and Mostrador are new runtime (`export default` + shared imports, which resolve with redeploy-function).
- After creating `tpvBridge`, test Order → Cobrar en TPV → pay → Reparo shows Cobrado/Entregado. Pending ReparoSync rows are retried by TPV `reparoSyncSweep`.

**MOSTRADOR_KEY must be regenerated.**
- The value set on 31 Oct (WhatsApp Pro, TPV, Reparo) was generated in the cloud container and is not saved anywhere else. Base44 secrets cannot be read back.
- So, when deploying Mostrador: generate a new random value (e.g. PowerShell `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`) and set the same `MOSTRADOR_KEY` in all 4 apps (WhatsApp Pro, TPV, Reparo, Mostrador). Setting a secret redeploys that app's existing functions.
- OUTBOUND_LOG_SECRET and TPV_BRIDGE_KEY/REPARO_TPV_KEY are already set in both apps that use them; nothing to do.

**Still to check after everything:** one real TPV sale after the deploy (none seen yet; last one 31 Oct 12:44).

**Security finding during deploy:** the GitHub repo `chowhan-eng/audit-informatica-torrent` is PUBLIC. It contains business details and this audit. Make it private.
