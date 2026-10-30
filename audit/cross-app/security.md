# Phase 4 — Security & data protection

Date: 2026-10-30 · Auditor: Claude Code · Mode: **read-only** (no app, entity, setting, function or secret was touched in this phase).
Tags: **[VERIFIED]** read in code/data · **[MEASURED]** measured · **[ASSUMPTION]** needs confirmation.
No secret values, phone numbers, names or message text are reproduced. Secrets are named by location only.

## 0. Method and limits

- **Sources.** This phase consolidates the security evidence gathered in Phases 0–3 (`00-access.md`, `*/inventory.md`, `*/speed.md`, `cross-app/*.md`, `CHANGELOG.md`). Every row below cites the file:line or query recorded there.
- **Access in this session.** The Base44 connector was **not available** in this working session (only the audit repo). So no new live query was run in Phase 4. Items that need a live check are marked **PENDING-LIVE** and listed in §6. None of them changes a FAIL into an OK on its own; they only confirm scope.
- **Result values:** **OK** · **PARTIAL** (control exists but has a gap) · **FAIL** · **N/A** · **UNKNOWN** (no evidence either way).
- **Mitigating fact today:** every Reparo and TPV login is `admin`, and WhatsApp Pro has 5 users (3 admin, 2 user, all approved) [MEASURED, Phase 0/1]. Several RLS gaps are therefore *latent* (they bite the day a non-admin or stranger gets an account). The **public-function gaps are not latent**: they need no account at all.

---

## 1. Checklist matrix

| # | Control | Mostrador | Reparo | WhatsApp Pro | TPV | Estado |
|---|---|---|---|---|---|---|
| 1 | RLS matches role needs | N/A (no data) | **FAIL** (latent) | **FAIL** | **PARTIAL** | N/A |
| 2 | No public function writes data / exposes customer data | N/A | **FAIL** | **FAIL** | **FAIL** | N/A (static pages; calls Reparo) |
| 3 | Secrets only in env/secrets (none in entities, source, bundle) | OK | OK (source) · bundle PENDING-LIVE | **FAIL** | OK (source) · bundle PENDING-LIVE | OK |
| 4 | Meta webhook HMAC fails closed | N/A | N/A | **OK** (code) · deployed parity PENDING-LIVE | N/A (Stripe webhook HMAC also fails closed) | N/A |
| 5 | Cross-app endpoints authenticated **and** rate-limited | N/A | **PARTIAL** | **FAIL** | **PARTIAL** | N/A |
| 6 | Admin areas behind role + PIN (where asked) | N/A | **PARTIAL** (role in UI only; no PIN requested) | **PARTIAL** | **PARTIAL** | N/A |
| 7 | Audit log for money, stock, price, status | N/A | **PARTIAL** | **PARTIAL** | **PARTIAL** | N/A |
| 8 | Data minimisation, retention, GDPR access/erasure | OK (no data) | **FAIL** | **FAIL** | **FAIL** | OK (no data) |
| 9 | Backups exist, restore known, last test | N/A (code only) | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **FAIL** (live pages not in source) |

Overall: **0 of 4 data-holding apps pass the checklist.** The most urgent items are the anonymous paths (#2) and the secret values left in a database table (#3).

---

## 2. Evidence per control

### 2.1 RLS vs role needs

| App | Result | Evidence |
|---|---|---|
| Reparo | FAIL (latent) | `RepairOrder.jsonc` and `Client.jsonc`: role `user` has read/create/update/**delete** on 19,516 orders and 12,291 clients [VERIFIED reparo/inventory §2]. `EmployeeGate` and ShopRole permissions exist only in the frontend (`EmployeeGate.jsx:12`, `config.js:150`) [VERIFIED]. `ShopTask`, `Product`, `Sale` (0 rows, dead routes) are still writable by `user` [VERIFIED]. `ActionLog` update is admin → an admin can rewrite history (not append-only) [VERIFIED]. `DeviceUnlockCode` is admin-only ✅, reached through `unlockCode`, but `set` lets **any signed-in user overwrite any unlock code** (`unlockCode/entry.ts:52-62`) [VERIFIED]. |
| WhatsApp Pro | FAIL | Messages (>10k), Conversations, Customers (with DNI, email), RepairOrder, CustomerInsights, KnowledgeBase, ImportJobs: **AU×4** = any `user` has full CRUD [VERIFIED whatsapp-pro/inventory §2]. The approval gate is client-side only (`App.jsx:84-96`). `UserProfile` update rule `created_by == user.email` → a user can set their own `approval_status` and `role` [VERIFIED]. Admin-only entities are correct: SystemSettings, FailedSend, WebhookLogs, PushSubscriptions [VERIFIED]. |
| TPV | PARTIAL | Good: Sale immutable once completed; Counter update `__inmutable__`; AdminPin server-only; AuditLog cannot be updated/deleted [VERIFIED tpv/inventory §1, §3]. Gaps: **PendingTask fully open** (`{}` on all 4); `Invoice` and `Counter` **create = admin from the browser** (bypasses the numbering function); `Product` update = admin from the browser (bypasses `updateProduct` audit + alerts); `Voucher` create = admin from the browser (money with no sale behind it); `Customer` read = any [VERIFIED]. No cajero role exists: all 3 users are admin [MEASURED]. `User.pin` is a plain-text field [VERIFIED `User.jsonc`]. |

### 2.2 Public (anonymous) functions

Base44 function URLs are reachable without login unless the code checks the caller. An anonymous OPTIONS on Reparo `publicStatus` answered 200 although the Reparo app itself is private [MEASURED reparo/inventory §8]. **No anonymous POST was sent to any function** (rule 2: it could message a real customer).

| App | Function | What an anonymous caller gets | Evidence |
|---|---|---|---|
| WhatsApp Pro | `sendMessage` | **Sends WhatsApp from the shop number** with the service-role Meta token. Approval check runs only `if (x-caller !== 'internal' && user)`; no session → no check | `sendMessage/entry.ts:158-170` [VERIFIED; anonymous reachability ASSUMPTION, consistent with Reparo test] |
| WhatsApp Pro | `generateDraft` | AI draft built from the conversation, KB and Reparo order data; check bypassed by header `x-caller: internal` | `generateDraft/entry.ts:66-69` [VERIFIED] |
| WhatsApp Pro | `logOutboundMessage` | Creates/updates Conversations and Messages for any phone (fake history). Secret `OUTBOUND_LOG_SECRET` exists but is never checked | `logOutboundMessage/entry.ts:5` [VERIFIED] |
| WhatsApp Pro | `extractMemory` | Writes CustomerInsights | `:3` [VERIFIED] |
| WhatsApp Pro | `sendPush` | Push notification to every staff device | `:9` [VERIFIED] |
| WhatsApp Pro | `masterTick`, `sendDueReviews` (`?manual=1` bypasses its gates), `processBroadcasts`, `retryFailedSends`, `sendScheduledMessages`, `escalateWaiting`, `processAlerts`, `libraryAutoReply`, `evaluateAutoReply`, `flowExecutor`, `liveKBCheck`, `autoKBExtract`, `watchdog`, `sendNPS` | Can be triggered at will: real sends to customers (reviews, broadcasts, retries) and LLM credit burn, **outside the shop-hours gate** | whatsapp-pro/inventory §3 caller column "PUB" [VERIFIED] |
| WhatsApp Pro | `tmpReparoPing` | Phone → "is a Reparo client" + order count + status (unauthenticated proxy to `waLookup` with REPARO_WA_KEY). File deleted in repo; **deployed state unknown** (deletion is not a function undeploy) | whatsapp-pro/inventory §3 [VERIFIED code b608898] · PENDING-LIVE |
| WhatsApp Pro | `orderStatus` | Status by ticket UUID (by design). Reads a stale mirror | data-flows #6 [VERIFIED] — acceptable (UUID is unguessable) |
| Reparo | `publicStatus` | **Any phone number → that customer's last 5 repairs** (device, status, dates, order no.). No ownership proof. Rate limit 10/10 min per IP, **skipped when no IP header**. DB errors shown as "not found" | `publicStatus/entry.ts:43-55` [VERIFIED] |
| Reparo | `publicReview` | Rating/comment for any known UUID, no rate limit | `publicReview:31-37` [VERIFIED] — low risk |
| Reparo | `notifyWhatsApp {sweep:true}` | Triggers the queue sweep (sends only already-due rows) | `notifyWhatsApp:46,74` [VERIFIED] — low risk |
| TPV | `sendPendingDigest` | With `modo` = `auto`/missing: **sends the staff WhatsApp containing customer names and phones** | `sendPendingDigest/entry.ts:131-137,104-113` [VERIFIED] |
| TPV | `zzImportTest`, `zzPbkdf2Test` | Dev stubs, no auth | tpv/inventory §4 [VERIFIED code; deployment ASSUMPTION] |
| TPV | `stripeWebhook` | Public by design, HMAC-checked, returns 503 (no secret set) | OK |

### 2.3 Secrets

| Location | Finding | Evidence |
|---|---|---|
| WhatsApp Pro · SystemSettings rows | `meta_access_token` (EAA-shaped, >50 chars, updated 2026-06-08), `import_secret`, `webhook_verify_token` **still hold values**. No code reads them, but any admin session (and any data export) exposes them. Other secret rows were scrubbed ✅ | whatsapp-pro/inventory §5, §12a [VERIFIED by shape tests; values not read out] |
| WhatsApp Pro · source (synced to GitHub `chowhan-eng/whatsapp-inbox-pro`, private) | Hard-coded shared secret `_sched` in `buildContentSignals/entry.ts:167` and `workflows/buildContentSignals_weekly_monday_0500.jsonc:16` → admin-equivalent trigger of an LLM job | [VERIFIED] |
| WhatsApp Pro · platform secrets | **Set but unused:** OPENAI_API_KEY, `Whatsapp`, WHATSAPP_VERIFY_TOKEN, WEBHOOK_URL_TOKEN, OUTBOUND_LOG_SECRET. **Session cookie** HC_SESSION_FULL for HelloClient still stored after the switch-off | §5 [VERIFIED] |
| WhatsApp Pro · source | Hard-coded staff fallback phone (masterTick, escalateWaiting, watchdog) and `ADMIN_EMAIL`; SystemSettings key name `escalation_alert_last_<phone>` contains a phone | §5, §7 [VERIFIED] — personal data in code/keys, not a secret |
| Reparo · source | No secret literals in `src/`, `base44/`, `public/` | reparo/inventory §5 [VERIFIED regex] |
| TPV · source | No secret literals; no `.env`; all secrets via `secrets.get()` | tpv/inventory §6 [VERIFIED regex] |
| All · built bundles | Source scans were clean and Vite only inlines `VITE_*` variables (none found), so a leak in `dist/` is unlikely. A grep of the **built** bundles was not recorded → PENDING-LIVE | [ASSUMPTION, low risk] |

### 2.4 Meta webhook HMAC — OK

`verifyMetaSignature` returns false when the secret or header is missing; POST answers 401 before parsing (`whatsappWebhook/entry.ts:35-50,133-139`). Last rejections 5–12 Jul; valid traffic still flows [VERIFIED + MEASURED]. Deployed source not compared to repo (API truncated) → PENDING-LIVE.
Related reliability (not security) issue, already P0 in Phase 3: processing errors are acknowledged with 200, so ~220 deliveries were lost (03-speed-summary S1).

### 2.5 Cross-app endpoints

| Flow | Auth | Compare | Rate limit | Result |
|---|---|---|---|---|
| Reparo → WA `reparoBridge` | `X-Reparo-Key` | plain `!==` (`reparoBridge:164`) | none | PARTIAL |
| WA → Reparo `waLookup` | `X-Reparo-Key` | plain `!==` | none | PARTIAL |
| TPV → WA `tpvWhatsappRelay` | `x-tpv-key` | constant-time ✅ | none | PARTIAL |
| TPV → WA `logOutboundMessage` | **none sent, none checked** | — | none | **FAIL** |
| Website → WA `exportContentSignals` | `x-signals-secret` (64 chars), access logged ✅ | — | none | OK-ish |
| External → WA ingest functions | IMPORT_SECRET (value also in a SystemSettings row) | — | none | PARTIAL |
| Customer → Reparo `publicStatus` | none (public) | — | per-IP, bypassable | FAIL (see 2.2) |

The **same secret** (`REPARO_WA_KEY`) authenticates both directions between Reparo and WhatsApp Pro, so one leak opens both [VERIFIED secret names]. No endpoint has its own request rate limit; only platform limits apply [ASSUMPTION about platform].

### 2.6 Admin areas — role + PIN

| App | Result | Evidence |
|---|---|---|
| TPV (PIN asked by Joney) | PARTIAL | PIN exists: PBKDF2-SHA256 100k + salt, 5 tries → 5-min lock, unlock kept 5 min in sessionStorage ✅ (`adminPin/entry.ts`). But: enforced **in the browser only** (backend functions and RLS ignore it); **non-admins skip the PIN** (`PinGate.jsx`); `/articulos` (prices), `/clientes`, `/caja`, `/documentos` have no PIN; Verifactu switch reachable from Ajustes (admin+PIN) [VERIFIED]. |
| Reparo | PARTIAL | `/configuracion` admin check is frontend-only (`Configuracion.jsx:25`); `reports` returns customer names to any signed-in user (`reports:22,263`); `OWNER_EMAILS` hard-coded as admin bypass in 3 functions [VERIFIED]. No PIN requested by Joney for Reparo → PIN item N/A. |
| WhatsApp Pro | PARTIAL | `/usuarios`, `/sudo`, `/importar-helloclient` admin-only in UI; ADM functions check `role==='admin'` server-side ✅; `ADMIN_EMAIL` grants admin **in the UI only** (mismatch with backend); `/ajustes` visible to approved users (writes fail by RLS) [VERIFIED]. Browser calls `Core.InvokeLLM` directly (`AISidebar.jsx:30-71`) → any user can spend LLM credits [VERIFIED]. |

### 2.7 Audit log (money, stock, price, status)

| App | Money | Stock | Price | Status | Notes |
|---|---|---|---|---|---|
| TPV | PARTIAL | PARTIAL | PARTIAL | n/a | `AuditLog` (115 rows) append-only ✅ and written by backend money/stock functions. Gaps: vouchers and señales written from the browser (`NuevoValeDialog.jsx:55`, `VoucherDialog.jsx:34`, `NuevaSenalDialog.jsx:103`, `RefundSenalDialog.jsx:31`); Doscar restore writes stock in bulk from the browser (`lib/doscar/restore.js:148,301,344`); direct `Product` updates via RLS skip `updateProduct` audit; AuditLog **create = any** → entries can be forged from the browser (not altered) [VERIFIED]. |
| Reparo | — | — | PARTIAL | PARTIAL | `ActionLog` (60 rows) records status/unlock-code reveals, but `logAction` swallows failures (`config.js:194-199`), admin can update rows, manual `wa.me` sends are not logged, and `events[]` history can be overwritten by a 60-s-old copy (03-speed S4) [VERIFIED]. |
| WhatsApp Pro | — | — | — | PARTIAL | `ActivityLog` (status sends, admin-only ✅) and `WebhookLogs`. Settings changes (e.g. `library_autoreply_mode`, `automations_enabled`) are not logged [ASSUMPTION: no writer found in Phase 1]. Async Meta delivery failures only in WebhookLogs, no FailedSend (03-speed S10). |

### 2.8 Personal data, minimisation, retention, GDPR requests

**Personal data map** [VERIFIED schemas, counts from Phase 1–2]:

| Data | Where | Note |
|---|---|---|
| Name, phone(s), email, DNI/NIF, address | Reparo Client (12.3k), TPV Customer (~1.3k), WA Customers (1–5k), Reparo/WA RepairOrder snapshots | 3 copies, 3 phone formats, 3 consent models (customer-identity.md) |
| Device **unlock codes** (passcodes) | Reparo DeviceUnlockCode (~17–20k) **and a stale copy in WA Pro DeviceUnlockCode (1k+, create = any user)** | Highly sensitive; the copy is not needed since cutover |
| WhatsApp messages + media | WA Messages (>10k), Conversations | Customer content |
| Inferred profile ("personal_facts", devices owned) | WA CustomerInsights (written by `extractMemory`, LLM) | **Profiling**; customers are not told [ASSUMPTION: no notice found] |
| Fiscal records | TPV Sale, Invoice, HistoricSale (>10k, back to 2008/2009) | Legal retention applies |
| Phones / message text in logs | WA WebhookLogs `message`; TPV workflow run history (error bodies); WA SystemSettings key names | Logs are not a lawful long-term store (whatsapp-pro/speed §3; tpv/inventory §5) [VERIFIED/MEASURED] |
| Public ticket/invoice PDFs | TPV `sendDocument` re-uploads PDFs as **public, permanent** files (`:131-145`) | Anyone with the link, forever [VERIFIED] |
| Content sent to the LLM | whatsappWebhook brief, liveKBCheck, generateDraft, autoKBExtract, AISidebar → Base44 `Core.InvokeLLM` | Rule 6 requires anonymisation before any LLM call. Only `buildContentSignals` is documented as anonymised. **No anonymiser found on the per-message paths** [ASSUMPTION — verify in Phase 8 kb-audit] |

**Retention rules:** none in any app (no TTL, no archive job, no setting) [VERIFIED: no such code found in Phases 1–3]. → FAIL.

**GDPR access / erasure request procedure:** none exists; the data for one person sits in up to 9 entities across 3 apps plus logs → FAIL. A draft procedure is in §5 for Joney/gestoría to approve.

### 2.9 Backups

| App | What exists | Restore | Last test |
|---|---|---|---|
| All | Base44 **checkpoints** (code/app versions; used in CHANGELOG #2) [VERIFIED]. Whether checkpoints include **entity data** is not documented in our evidence → [ASSUMPTION: code only]. | Checkpoint restore = code rollback | never tested for data |
| WhatsApp Pro | Source mirrored to GitHub (private) [VERIFIED] | code only | — |
| TPV | "Restaurar desde Doscar" imports *from* the old system; it is not a backup of TPV [VERIFIED] | — | — |
| Estado | Live `estado.html` / `resena.html` are **not in the app's source**; a redeploy would erase them and break every QR already printed [VERIFIED mostrador/inventory] | none | — |

No scheduled data export (CSV/JSON) of orders, customers, sales or invoices was found in any app [VERIFIED: no such function/workflow in the Phase 1 inventories]. Invoices and sales must be kept for years (see §5) → treat as **UNKNOWN until Joney/Base44 confirms platform data backups; FAIL if none**.

---

## 3. Findings, scored

Score = (Impact 1–5 × 2) − Effort (S=1, M=2, L=3) − Risk (0–2). Running cost of every fix ≈ **0 €/month** (code changes only) unless stated; several *reduce* abuse exposure of credits and Meta fees.

| ID | Finding | App | Impact | Effort | Risk of change | Score | Priority |
|---|---|---|---|---|---|---|---|
| SEC-01 | Anonymous WhatsApp sending via `sendMessage`; `x-caller: internal` header bypass (also `generateDraft`) | WA Pro | 5 — anyone could message customers from the shop number; Meta quality/ban risk | S | Low (internal callers switch to a secret header) — 1 | **8** | **P0** |
| SEC-02 | Other public service-role functions: `logOutboundMessage`, `extractMemory`, `sendPush`, and all masterTick jobs (`sendDueReviews ?manual=1`, broadcasts, retries…) triggerable anonymously | WA Pro | 5 — fake chat history, staff push spam, real customer sends off-hours, credit burn | M | Low–Med: masterTick must pass a secret to its jobs — 1 | **7** | **P0** |
| SEC-03 | Secret values still in SystemSettings rows (Meta token, import secret, verify token); Meta token should be rotated after removal | WA Pro | 4 — a live token gives full control of the WhatsApp number | S | Low: no code reads the rows — 1 | **7** | **P0** |
| SEC-04 | `tmpReparoPing` may still be deployed (anonymous phone → client/orders lookup) | WA Pro | 4 — PII disclosure | S | None — 0 | **7** | **P0** (verify first) |
| SEC-05 | `publicStatus` phone lookup: any phone → last 5 repairs; bypassable rate limit | Reparo | 4 — GDPR disclosure, enumeration | S | Low: keep UUID path, require phone + order no. (or remove phone path) — 1 | **6** | **P0** |
| SEC-06 | Review requests use MARKETING template `resena_google` with no consent check | WA Pro | 4 — LSSI/GDPR + Meta marketing fees | S | Low — 1 | **6** | **P0** |
| SEC-07 | `sendPendingDigest` callable anonymously; message holds customer names/phones | TPV | 3 — spam to staff, PII to Meta logs | S | None — 0 | **5** | **P0** (quick) |
| SEC-08 | No verified data backup / restore test; invoices and sales under legal retention | all | 5 — irrecoverable loss of orders, sales, invoices | M | None (additive export) — 0 | **8** | **P0** |
| SEC-09 | TPV money/numbering entities writable from the browser by admin: Invoice & Counter create, Product price/stock update, Voucher & Deposit create | TPV | 4 — breaks rule 8 (money/stock/numbering only in backend), audit gaps | M | Med: needs backend functions for vales/señales first — 1 | **5** | **P1** |
| SEC-10 | Public permanent PDF copies of tickets/invoices (`sendDocument` `Core.UploadFile`) | TPV | 4 — customer NIF/address public forever | S | Low: signed, expiring URL (already used by `generateDocumentPdf`) — 1 | **6** | **P1** |
| SEC-11 | Stale copy of **unlock codes** (and RepairOrder/OrderState mirrors) in WA Pro; DeviceUnlockCode create open to any user | WA Pro | 4 — passcodes duplicated with weaker rules | S (hide/RLS lock now, archive after 30 days) | Low — 1 | **6** | **P1** |
| SEC-12 | RLS: `user` role full CRUD on customer data (Reparo incl. delete; WA Pro Messages/Customers/…); WA `UserProfile` self-approval; TPV PendingTask open; frontend-only gates | Reparo, WA Pro, TPV | 4 — latent full data access for any non-admin account | M | Med: wrong rule can lock staff out; test with a non-admin account — 2 | **4** | **P1** |
| SEC-13 | Self-registration: Reparo/TPV/WA Pro expose `/register`; WA Pro public setting not confirmed | Reparo, WA Pro, TPV | 4 — combined with SEC-12, a stranger could sign up and read data (WA Pro gate is UI-only) | S | Low — 0 | **7** | **P1** (PENDING-LIVE: check each app's "invite only") |
| SEC-14 | TPV PIN client-side only; non-admins skip PIN; prices/customers screens without PIN; `User.pin` plain text | TPV | 3 — weak separation once a cajero role exists | M | Med — 1 | **3** | **P2** (needs Joney: who is cajero?) |
| SEC-15 | `reparoBridge`/`waLookup` non-constant-time compare; one shared key for both directions; no rate limits on cross-app endpoints | Reparo, WA Pro | 2 | S | Low (rotate keys in a planned window) — 1 | **3** | **P2** |
| SEC-16 | Hard-coded `_sched` secret in a GitHub-synced repo; unused secrets set (OPENAI_API_KEY, `Whatsapp`, WHATSAPP_VERIFY_TOKEN, WEBHOOK_URL_TOKEN); HelloClient session cookie still stored | WA Pro | 2 — paid-API key exposure, dormant credentials | S | Low — 0 | **3** | **P2** |
| SEC-17 | Personal data in logs and code: phones in WebhookLogs and SystemSettings key names, TPV run logs with Pendientes text, hard-coded staff phone | WA Pro, TPV | 2 | S | Low — 0 | **3** | **P2** |
| SEC-18 | Audit-log gaps: Reparo `logAction` swallows failures, admin can edit ActionLog, manual `wa.me` sends unlogged; TPV AuditLog forgeable from browser; WA settings changes unlogged | all | 3 | M | Low — 0 | **4** | **P2** |
| SEC-19 | No retention rule, no GDPR access/erasure procedure; CustomerInsights profiling without notice; customer text sent to LLM without anonymiser | all | 3 — legal exposure, grows every day | M (procedure S; tooling M) | Low (archive, never delete) — 1 | **3** | **P2** |
| SEC-20 | Test/one-shot functions still in repo/deployed: `zzImportTest`, `zzPbkdf2Test` (public), `cleanupTestData` (resets counters) | TPV | 3 — numbering integrity (see CHANGELOG #1) | S | None — 0 | **5** | **P1** |
| SEC-21 | Estado customer pages not in source (integrity/availability of every QR sent) | Estado | 3 | S | Low — 0 | **5** | **P1** (already in backlog) |
| SEC-22 | Hard-coded owner email as authorization bypass (`OWNER_EMAILS`, `ADMIN_EMAIL`, adminPin) | Reparo, WA Pro, TPV | 1 | S | Low — 0 | **1** | **P3** |

### Fix sketches (for the backlog; nothing applied)
- **SEC-01/02:** one shared helper per app, `requireCaller(req, {user|admin|secret})`. Scheduled and internal calls send `X-Internal-Key` (new platform secret, constant-time compare); anonymous → 401. Remove the `x-caller: internal` trust. `logOutboundMessage` checks `OUTBOUND_LOG_SECRET` and TPV starts sending it (both sides in one batch).
- **SEC-03:** blank the three rows (archive old value hash only), **rotate** the Meta system-user token and the import secret in Meta/Base44 secrets, confirm sends still work with Joney's test number.
- **SEC-05:** phone path requires phone **and** order number (or a 6-digit code printed on the receipt); per-phone + global rate limit; no IP header → reject.
- **SEC-06:** check `marketing_consent && !opted_out` before any `resena_google` send; or move the review ask into the utility "ready/delivered" message wording (Meta decides the category — Joney to approve the text).
- **SEC-08:** daily export function (inside shop hours, e.g. 14:15) of Reparo RepairOrder/Client, TPV Sale/Invoice/Customer/Product, WA Customers/Conversations to private files, keep 30 dailies + 12 monthlies; quarterly restore test into a copy app. Cost ≈ 3 runs/day × ~0.3 credits ≈ 27 credits/month [ASSUMPTION: same per-run cost as Reparo workflow]. First ask Base44 what platform-level data backups exist.
- **SEC-09:** backend functions `createVoucher`, `takeDeposit` (atomic with `completeSale`), RLS create/update → server-only for Invoice, Counter, Voucher, Deposit; Product update via `updateProduct` only.
- **SEC-12:** test matrix with one non-admin test account per app before switching rules; RLS by role, approval checked server-side (WA Pro), `UserProfile.role/approval_status` writable by admin only.

---

## 4. Answers to the historic WhatsApp Pro questions (re-checked)

| Issue | Phase 4 verdict |
|---|---|
| Secrets in SystemSettings | **Still open** (SEC-03): code fixed, data not cleaned. |
| HMAC fail-open | **Fixed** in code (fails closed). Deployed parity PENDING-LIVE. |
| Template names split | Partly fixed (Phase 1 §8); security angle = SEC-06 (marketing template without consent). |
| Off-hours automations | Mostly fixed; but the jobs are **anonymously triggerable** (SEC-02), so the hours gate can be bypassed by anyone with the URL. |

---

## 5. Draft GDPR procedure and retention proposal (for Joney + gestoría; not legal advice)

**Who:** controller = Pcmatica Torrent SL. Requests by email or in person; answer within **1 month** (GDPR art. 12.3). Verify identity (DNI at the counter, or reply from the same WhatsApp number).

**Access request (art. 15)** — staff searches by normalised phone `34XXXXXXXXX` in:
1. Reparo: Client, RepairOrder (+ events), DeviceUnlockCode (state that a code exists; do not print it), ActionLog.
2. WhatsApp Pro: Customers, Conversations + Messages, CustomerInsights, RepairOrder/OrderState mirrors, PendingReviews, FailedSend.
3. TPV: Customer, Sale, Invoice, Deposit, Voucher, PendingTask, MessageLog, HistoricSale.
Export as one PDF/ZIP. A future admin function `gdprExport(phone)` makes this one click (Effort M).

**Erasure request (art. 17)** — rule 3 of this audit forbids deleting data, and fiscal records must be kept, so the proposal is **anonymise in place**:
- Keep: sales, invoices, tickets (fiscal duty: commercial records **6 years**, Código de Comercio art. 30; tax prescription **4 years**, LGT art. 66 — gestoría to confirm), with name/phone replaced by "Cliente anonimizado" where the law allows (invoices to companies keep NIF).
- Anonymise: Client/Customers rows, chat messages and media, CustomerInsights (delete content), unlock codes (blank), KB source links.
- Mark the phone as `opted_out` in WhatsApp Pro so it is never messaged again.
- Log the request (date, scope, who did it) without the erased data.

**Retention proposal (Joney decides the numbers):**

| Data | Proposed rule | Why |
|---|---|---|
| Unlock codes | blank **30 days after delivery** of the device | only needed during the repair |
| WhatsApp chats & media | archive after **24 months** without contact | warranty is 6 months; keep a margin |
| CustomerInsights (AI profile) | stop collecting, or 12 months + privacy notice | profiling needs transparency |
| Customers with no order/sale | archive after **36 months** without activity | minimisation |
| Logs (WebhookLogs, run logs) | **90 days**, no phones in text | troubleshooting only |
| Sales, invoices, Z closes | **6 years** minimum | legal |
| Public PDF links | expire after **7 days** | enough to download |

All archive jobs would run inside shop hours in the master scheduler (one run/day). Privacy notice (ticket footer / web) must mention WhatsApp, AI-assisted replies and retention — **wording is customer-facing → Joney approves**.

---

## 6. Verification still to do (needs the Base44 connector, read-only)

1. Is `tmpReparoPing` still deployed? (function list / logs) — SEC-04.
2. Are `zzImportTest`, `zzPbkdf2Test`, `cleanupTestData` deployed? — SEC-20.
3. Each app's auth settings: public vs private, **invite-only vs open sign-up** (WA Pro, TPV; Reparo is private) — SEC-13.
4. Deployed `whatsappWebhook` and `sendMessage` match the repo (HMAC + gate) — §2.4, SEC-01.
5. `grep` of the built `dist/` bundles of all four apps for `EAA`, `AIza`, `sk-`, `whsec_`, long hex — §2.3.
6. Base44 platform: are entity data backups taken, how long kept, how to restore? — SEC-08.
7. WA Pro: does any per-message LLM path anonymise text before `InvokeLLM`? (Phase 8 kb-audit) — SEC-19.

## 7. Open questions for Joney (only what this phase needs)
- Who works the counter without being owner? Should they become **cajero** (no prices, no Ajustes, no Informes) in TPV and **user** in Reparo/WhatsApp Pro?
- Can review requests go only to customers who gave marketing consent, or should the review ask become part of the "listo para recoger" message?
- Retention numbers in §5: OK or change? Does the gestoría want sales/invoices kept longer than 6 years?
- Do you know of any data backup today (Base44 plan, manual exports)?

---

## Resumen para Joney (estado Fase 4)
1. Lo más urgente: en WhatsApp Pro se puede **enviar WhatsApp desde el número de la tienda sin iniciar sesión** (y lanzar reseñas, campañas y reintentos a mano). Hay que cerrarlo ya (P0).
2. Quedan **3 claves secretas guardadas en una tabla** de WhatsApp Pro (entre ellas el token de Meta): borrarlas y cambiar el token.
3. La página pública de estado permite ver las **últimas 5 reparaciones de cualquier teléfono**; el resumen de Pendientes del TPV también se puede disparar sin login.
4. **No hay copia de seguridad de datos comprobada** ni regla de borrado/conservación (RGPD); propongo plazos en §5 para que los decidas con la gestoría.
5. Firma de Meta (HMAC) ✅ correcta. Nada se ha cambiado en las apps en esta fase.
