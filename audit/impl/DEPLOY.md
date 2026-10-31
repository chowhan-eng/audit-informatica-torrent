# Mass deployment package — Weeks 1–4 (prepared locally, NOTHING deployed)

**Status (30 Oct 2026).**
- All code below is prepared locally. Base44 production is unchanged since B-01: WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563, Mostrador unchanged.
- No secret has been created or changed. No app has been restarted.
- Rule: nothing here is applied without Joney's explicit OK (D-29, D-39).

## 0. Before anything: Meta token (B-03, Joney)

1. Joney creates the new permanent token in Meta Business Manager and pastes it into WhatsApp Pro → Secrets → `META_ACCESS_TOKEN`.
   - This redeploys WhatsApp Pro from its current main (8d595b9, already safe).
   - It does **not** include any patch below, because the patches are not in main.
2. Test send to +34 658 … 734. Then Joney revokes the old token.
3. Only after that, start step 1. Doing it in this order means a token problem and a code problem never happen at the same time.

## 1. Safety net

- One checkpoint per app (Reparo, TPV, WhatsApp Pro, Mostrador).
- Keep the global pause (`automations_enabled`) at hand: switching it off stops every automatic message (B-10).

## 2. Secrets to create

Values are new random strings generated at apply time; never reuse one value for two purposes.

| Secret | Apps | Used by |
|---|---|---|
| `OUTBOUND_LOG_SECRET` | WhatsApp Pro + TPV (same value) | B-02 `logOutboundMessage` |
| `TPV_BRIDGE_KEY` (Reparo) = `REPARO_TPV_KEY` (TPV) | Reparo + TPV | B-40 |
| `REPARO_TPV_URL` | TPV | URL of Reparo `tpvBridge` |
| `MOSTRADOR_KEY` | Mostrador + Reparo + TPV + WhatsApp Pro (same value) | B-47 |
| `MOSTRADOR_REPARO_URL`, `MOSTRADOR_TPV_URL`, `MOSTRADOR_WA_URL` | Mostrador | URLs of each `mostradorLookup` |
| `DOC_LINK_SECRET` | TPV | B-29 signed 7-day document links |
| `BRIEF_EMAILS` (optional) | Mostrador | B-43/B-44 e-mail recipients |
| `MOSTRADOR_STAFF` (optional) | Mostrador | emails of staff allowed besides admins |

`INTERNAL_CALL_KEY` already exists (B-01). Setting secrets redeploys every function of that app from main, so set them **after** that app's code is in main.

## 3. Apply order per app

### WhatsApp Pro
1. `git am audit/impl/week1/patches/000*.patch` on main 8d595b9. All 8 patches apply cleanly in sequence; this was verified with a scratch worktree.
2. Push. The repo syncs to Base44.
3. Set the secrets.
4. Deploy.

| Patch | Items |
|---|---|
| 0001 | B-02 auth on internal functions, extractMemory removed, masterTick guard |
| 0002 | B-07 webhook redelivery + dedupe, B-08 instant off-hours ack, B-10 global pause + banner |
| 0003 | B-09 daily backup |
| 0004 | B-47 lookup + `?conv=` link |
| 0005 | B-17/B-18/B-19/B-20 HelloClient jobs out, dead screens hidden, voice off |
| 0006 | B-24 parts notices, B-41/B-42 reminder action |
| 0007 | B-39 no self-approval, admin-only deletes |
| 0008 | B-21 auto-reply topics, B-23 one escalation level, B-38 Crear reparación |

### Reparo

Copy `files/` and run the scripts, in this order, each with `--check` first:
1. `src/reparo` mirror → `publicStatus` + `public/estado.html` (B-05).
2. `projects/B-40-cobrar-en-tpv` (`--reparo`).
3. `projects/B-24-B-41-avisos`.
4. `projects/B-47-mostrador` (Reparo files only).
5. `projects/cleanup-helloclient-doscar` (`--reparo`).
6. `projects/B-39-B-55-roles-pin` (`--reparo`).
7. `projects/B-21-B-23-B-38-whatsapp`.
8. `projects/B-09-backup` (Reparo files).

### TPV
1. `src/tpv` mirror: `shared/inboxPro.ts` (B-02).
2. Delete functions `zzImportTest`, `zzPbkdf2Test`, `cleanupTestData` (B-04).
3. `B-40` (`--tpv`).
4. `B-12`.
5. `B-06-B-22-pendientes`.
6. `B-47` (TPV files).
7. `B-39-B-55` (`--tpv`).
8. `cleanup` (`--tpv`).
9. `B-09` (TPV files).

**Last for Reparo and TPV:** `projects/extra-wizard-voz-frp` (Reparo), then `projects/batch-tpv-reparo-1031` (both). Then B-45-mensajeria, B-48-catalogo-cache, B-50-busqueda-reparo and B-51-B-53-B-31 (last). WhatsApp Pro: patches 0001–0015.

### Mostrador
`B-47` (`--mostrador` + files). Then set the app to **invite-only** (B-35) before anyone opens the panel.

## 4. Data steps (Base44 screens, after deploy)

- Reparo → Configuración → Estados: create **Pieza recibida** (in progress, teal, after "Esperando Material").
- TPV: call `cashierPin {action:'migrate'}` once as admin. It hashes the existing cashier PINs and clears them from users.
- WhatsApp Pro `AnswerLibrary`: horario (T-09) and ubicación (T-10) texts with the Maps link and parking text.
- Registration invite-only on Reparo, TPV, WhatsApp Pro and Mostrador (B-35, platform setting).
- Check in each app's Workflows screen that no old HelloClient/NPS/broadcast workflow is still active.

## 5. Tests after deploy

Only to +34 658 … 734; never to real customers.

| Item | Test |
|---|---|
| B-01/B-02 | Anonymous POST to sendMessage, sendPush, generateDraft, logOutboundMessage → 401. Inbox reply works. TPV document appears in the inbox |
| B-05 | QR link works. Phone + wrong order → "no encontramos". 11th lookup → 429 |
| B-07 | Forced failure → Meta redelivers, one message row |
| B-08 | Message from the test phone when closed → one ack; a second message → no ack |
| B-10 | Switch off → scheduled send refused, inbox reply sent, red banner |
| B-09 | `force` + `verify` per app. Note the duration |
| B-12 | Double-click "Cobrar" → one ticket |
| B-40 | Order → Cobrar en TPV → TPV prefilled → pay → Reparo shows "Cobrado" and "Entregado" |
| B-47 | Logged out: only the login button. Search the test phone. Panel counts match |
| B-24/B-41 | Change a test order to "Esperando Material" → T-01 to the test phone. Reminders log "prueba" for a week |
| B-55 | Stock adjust asks for the PIN. Wrong cashier PIN ×5 → locked |
| B-06/B-22 | Preview of the 13:00 digest |

## 6. One week later (Joney's OK)

- `reminders_live=true`: uncollected and budget reminders start sending.
- `library_autoreply_mode=live`: automatic replies for hours/location.

## 7. Thirty days later

`projects/cleanup-helloclient-doscar/DELETE_AFTER_30_DAYS.md` (B-62).
