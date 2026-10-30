# WhatsApp Pro: Phase 3 speed and stability, code side (read-only)

App `69f23ccb4284f8588aa5b7a3`, sandbox HEAD `21acef8`. Audit date: 30 Oct 2026.

**Evidence tags:**
- **[V]** verified at file:line, by query or by API.
- **[M]** measured.
- **[A]** assumption.

Paths are relative to `/app`. No secrets, names, phones or message text are reproduced. The bundle was analysed on a copy in `/tmp/sp` (`vite build --sourcemap` plus source-map-explorer, with gzip computed per package from the mapped byte ranges).

> **Headline.** The biggest daily-use problem is not the bundle. `sendNPS` runs every 30 minutes and makes up to 200 `SatisfactionSurveys.filter` calls in a loop. That exhausts the platform limit of **140 entity_list calls per 60 s per caller**. Every masterTick run of sendNPS has failed with HTTP 500 for 7 days (91 of 91 runs), and **Meta webhooks that arrive in the same minute die with "Rate limit exceeded"**. The handler then returns 200 anyway, so Meta never redelivers. That is **226 webhook deliveries lost in October** (silent data loss). Details in §3 and §8, fix #1.

---

## 1. Build

**Why there is one chunk [V]**
- `src/App.jsx:11-38` imports all 27 pages eagerly. There is no `React.lazy` or dynamic `import()` anywhere in `src/`.
- `vite.config.js` has no `build.rollupOptions.manualChunks`.
- Result: one `index-*.js` of **1,365,598 B raw / 392,950 B gzip**, plus 87 KB of CSS [M].

**Top 10 contributors** (raw / gzip; total = 1,334 KB raw / 384 KB gzip) [M]:

| # | Module | Raw KB | Gzip KB | Needed on first load? |
|---|---|---|---|---|
| 1 | App pages (`src/pages`, 27 pages) | 249.6 | 59.3 | Only the current route. The biggest are Taller 24, Ajustes 19, Campanas 17, Biblioteca 17, Sudo 16 |
| 2 | react-dom | 129.0 | 41.4 | yes |
| 3 | **libphonenumber-js** (full metadata) | 114.9 | 28.5 | no. Used only in `src/lib/shop/printEngine.js:20` |
| 4 | **jszip** | 95.4 | 29.3 | no. Used only in `src/pages/ImportarHistorial.jsx` |
| 5 | `components/conversaciones` | 90.1 | 23.0 | inbox only |
| 6 | **jsbarcode** | 60.9 | 13.1 | no. printEngine only |
| 7 | `src/lib` | 53.8 | 19.4 | partly |
| 8 | axios (pulled in by @base44/sdk) | 50.7 | 19.3 | yes |
| 9 | lucide-react | 40.6 | 8.2 | yes (already tree-shaken) |
| 10 | @base44/sdk + @tanstack/query-core | 70.8 | 22.5 | yes |
| – | socket.io-client + engine.io + partysocket (realtime) | 38.3 | 12.4 | yes |
| – | **qrcode** | 23.7 | 9.3 | no. printEngine only |

**Libraries used by one page or feature only [V]:**
- jszip: ImportarHistorial.
- libphonenumber-js, jsbarcode, qrcode: `printEngine` ← `printActions` ← Taller, PedidoDetalle, PedidoNuevo, Inventario, Ventas.
- Together that is **295 KB raw / 80 KB gzip** loaded on every visit to the inbox.

**Unused dependencies [V]** (grep finds no import outside the unused shadcn `components/ui/*` stubs):
- recharts, date-fns, zod, react-hook-form, @hookform/resolvers, embla-carousel-react, cmdk, vaul, react-day-picker, sonner, react-hot-toast, input-otp, react-resizable-panels.
- Tree-shaking already keeps them out of the bundle, so they cost install time and audit noise, not load time.

**Service worker (`public/sw.js`, `scripts/stamp-sw.js`) [V]:**
- `stamp-sw.js` replaces `__BUILD_ID__` in `dist/sw.js`, but `sw.js` contains no `__BUILD_ID__` (grep count 0). **The script does nothing.**
- `CACHE_VERSION = 'v3-clean-slate'` is a constant, so `sw.js` is byte-identical across deploys. The browser therefore never sees an SW update, and the "update available" toast (`usePWA.js:36-42`, `Layout.jsx`) can never fire.
- [A] Base44 hosting may not run the npm `build` script at all.
- Strategy:
  - HTML, JS and CSS are **network-first** (`sw.js:58-100`). Images and fonts are cache-first. Same-origin GET only, so the API is not cached.
  - Stale-code risk is **low**: JS is always fetched fresh when online, and with a single chunk there is no mismatch between old and new chunks. The `vite:preloadError` reload (`usePWA.js:14`) covers the case after code-splitting.
  - Speed benefit is **≈0**: every load goes to the network for the 393 KB script, with HTTP-cache revalidation at best.
  - Offline fallback can serve a stale `index.html` together with whatever JS is cached. That is acceptable.
- Verdict: it neither helps nor hurts speed. The stamp is dead code, and the update-toast path is broken.

**Expected first-load gain from route-level `React.lazy` plus lazy print/zip libraries [A, computed from the table]:**
- The inbox route drops about 59 (pages) − ~8 (Conversaciones) + 80 (print/zip libs) ≈ **130 KB gzip and ≈480 KB raw**.
- That is about **−35% transfer and about −35–40% parse/compile**. Parse time is what dominates on a slow counter PC.

---

## 2. Data loading (frontend)

**Server default `limit` [A].** When `list()`/`filter()` is called without a limit, the SDK sends no `limit` (`@base44/sdk/dist/modules/entities.js:61-73`), so the server default applies. Its value could not be verified. Indirect evidence: `processAlerts` reads `SystemSettings.list()` without a limit and still sees `automations_enabled`, which is row 24 of 95 newest-first. Every unbounded read below therefore silently truncates at an unknown cap. None of them page.

### Inbox / conversation list (`/conversaciones`)

**Reads**
- `Conversations.list('-last_message_timestamp', 200)` returns full 52-field rows, with no `fields` projection (`pages/Conversaciones.jsx:83`) [V].
- Layout separately loads `Conversations.filter({status:'open'})` with no limit, also full rows (`components/Layout.jsx:115`) [V].
- With 1,500–2,499 conversations, conversations older than the 200 shown are reachable only through `searchConversations`.

**Realtime: 7 subscriptions per tab on this page [V]**
- Layout subscribes to Conversations, KnowledgeBase, and (admin only) UserProfile and ActivityLog (`Layout.jsx:127,149,173,197`).
- The page subscribes to Messages and Conversations (`Conversaciones.jsx:141,152`).
- `useAlerts` subscribes to NotificationQueue (`hooks/useAlerts.js:114`).

**Refetch amplification [V]**
- Every `Messages.create` anywhere triggers a full `loadConversations()` (200 rows). If the open chat is affected, it also triggers a full `loadMessages()` (`Conversaciones.jsx:141-149`).
- Every Conversations event triggers Layout's open-conversation reload after an 800 ms debounce.
- One inbound WhatsApp message (1 Messages create + 1 Conversations update) therefore costs about 2–3 list calls per open tab.

**Fetch-all badges [V]**
- `KnowledgeBase.list()` with no limit, refetched on every KB change. liveKBCheck creates KB rows 24/7 (`Layout.jsx:164`).
- `ActivityLog.filter({error:{$exists:true}})` fetches all error rows and filters by date on the client (`Layout.jsx:187`).

**Polling [V]**
- AudioAlertManager every 15 s, 2 lists (`components/audio/AudioAlertManager.jsx:17,342-343,490`). It also writes about 10 `console.log` lines per cycle (`:395-421`).
- PresenceBanner every 12 s: 1 update and 1–2 filters (`PresenceBanner.jsx:6,50`). Its effect depends on `typing`, so every typing start/stop restarts the heartbeat and fires extra writes.
- Steady state is about 18 entity calls per minute per idle agent tab. That is fine against 140/min per user, but bursts add up.

**react-query [V]** is installed (`lib/query-client.js`) but **not used** by any inbox, chat, triage or waiting-list loader. They all use raw `useEffect`/`useState`. That means no caching between routes, a full reload every time a page is opened, and no request de-duplication between Layout and the page.

### Opening a long chat

- `Messages.filter({conversation_id})` has no limit, no sort and no `fields`, and sorts on the client (`Conversaciones.jsx:99-102`) [V]. There is no paging and no virtualisation: `ChatArea.jsx:531` maps every message.
- Measured chat sizes are small [M]: the busiest recent conversations have fewer than 50 messages, the largest found has 52, and the average is about 5 (>10k messages / ~2k conversations). Load is therefore fast today.
- Risk: once a chat exceeds the server default cap, the **newest** messages may be the ones cut off, depending on the server's default sort [A].
- On every chat open, also in sequence or in parallel [V]:
  - `QuickReplies.filter` plus a `clientCard` function call each time the quick-replies popup opens (`ChatArea.jsx:72-76`).
  - `customerOverview` each time the customer sidebar opens (`CustomerSidebar.jsx:43`). These are Reparo `waLookup` round-trips with no caching.
  - Presence create/update.
  - `Conversations.update` (unread).
  - `ConversationNotes.filter` and `CustomFieldDefs.filter`. CustomFieldDefs has 0 rows, so this is a wasted call.

### Sending a reply

**Perceived latency: good [V]**
- `send()` puts the message in a pending bar immediately, with a **3 s cancel window** (`ChatArea.jsx:24,196-225`) before the network call. This is intentional anti-misfire UX.
- Hand-typed text (anything that is not an unedited AI draft) first opens a confirm dialog (`:209-212`).
- Perceived time is therefore under 100 ms. Real delivery is 3 s + sendMessage.

**sendMessage critical path: about 8–9 sequential awaits before and after the Graph POST [V]**
- `auth.me` and `UserProfile.filter` (approval check, `:147-170`).
- `SystemSettings.list()` (`:196`).
- `MessageTemplates.filter` (`:206`), run on every send even when the window is open.
- `Conversations.get`.
- Graph POST.
- `WebhookLogs.create`, `Messages.create`, `Conversations.update` (`:441-479`).
- [A] about 1.5–3 s server time.

**After success [V]**
- `onRefresh` triggers a full `loadMessages`, and the Messages subscription fires `loadMessages` plus `loadConversations` again, so the data is fetched twice.
- `autoLearn` is invoked on **every** send (`ChatArea.jsx:299`) even though `autolearn_enabled=false`. That is one wasted function invocation per reply.
- Server side, `liveKBCheck` is invoked on every outgoing agent text (`sendMessage:484-486`).

### AI draft (`generateDraft`)

**Synchronous in the UI path [V]**
- The button awaits `functions.invoke('generateDraft')` (`ChatArea.jsx:401`).
- Server side, all of these run sequentially before the LLM call (`generateDraft/entry.ts:48-286`):
  - `UserProfile.filter`.
  - `Messages.filter` (whole chat).
  - `CustomerInsights.filter`.
  - Reparo `waLookup` (external, 8 s timeout).
  - `RepairCache.filter` (0 rows, a wasted call).
  - `KnowledgeBase.filter` (all approved, 100–299 rows, keyword-scored in JS).
  - `MessageEmbeddings.filter`.
  - `SystemSettings.list()`.
  - `Core.InvokeLLM`.
- After the LLM call it reads `SystemSettings.list()` again (`:340`).

**Latency [A]:** not logged anywhere. `callModel` writes only `llm:base44` without a duration, and function logs carry no durations. Estimate: 4–10 s, mostly LLM time.

**Failure is silent [V]:** `callModel` returns `''` on error. The UI applies a draft only `if (data?.draft)`, so the user sees the spinner stop and nothing else happens.

### Triage (`/triaje`) and waiting list (`/esperando`)

**Triage [V]**
- `Conversations.filter({unread:true,...}, ..., 300)` (`pages/Triaje.jsx:31`).
- Every TriageCard that is shown **automatically calls `generateDraft`**, even when `ai_drafted_reply` already exists (`components/triaje/TriageCard.jsx:27-43`). That means one LLM call plus about 9 DB reads per card viewed, and a wait on every card.
- Each card also fetches the whole chat to show the last 5 messages (`:16-20`).

**Waiting list [V]**
- `Conversations.filter(open|pending, last 8 days, 300)`, reloaded on **every** Conversations event after a 700 ms debounce (`pages/Esperando.jsx:38-58`), plus a re-render every 30 s. This is acceptable.

**Other fetch-all reads [V]**
- `Campanas.jsx:100` calls `Customers.list()` with no limit. There are 1,000–4,999 customers, so the result is truncated or very large.
- `RevisionKB.jsx:28` calls `KnowledgeBase.filter({review_status:'pending_review'})` with no limit. There are 300+ such rows, so truncation is possible.
- `Sudo.jsx:399` calls `RepairOrder.filter({is_open:true})` with no limit.

---

## 3. Webhook path (`whatsappWebhook`)

**Synchronous work before the 200 response [V] (`entry.ts:126-164,169-373`)**
- HMAC check, then `JSON.parse`.
- Events are processed **sequentially**.
- For each inbound message:
  - idempotency `Messages.filter({meta_message_id})`
  - **media download from Graph plus upload, synchronous, for image/audio/video/document** (`:276-288`, `ingestMedia :505-509`)
  - `Conversations.filter` by phone (twice for a new number)
  - `Customers.filter` (new numbers only)
  - `Conversations.update`/`create`
  - `Messages.create`
- For each status event: `Messages.filter`, `Messages.update`, `SentNotification.filter` (0 rows, wasted), and possibly a BroadcastCampaigns get/update (`:526-560`).
- No LLM call runs before the 200 (the brief LLM runs inside the background `upsertNotificationQueue`).
- Everything else is fire-and-forget through `runBackground`/`EdgeRuntime.waitUntil` (`:24-26,378-454`):
  - opt-out
  - NPS capture
  - NotificationQueue upsert with the brief LLM
  - push (`SystemSettings.list()` with no limit)
  - liveKBCheck (LLM)
  - flowExecutor
  - libraryAutoReply
  - DraftQueue

**Idempotency [V]**
- The check is check-then-create on `meta_message_id` (`:176-179`). It is not atomic and there is no unique constraint.
- Duplicates are caught when Meta retries after the first delivery has completed.
- **Not caught:** a retry that arrives while the first delivery is still running. The `Messages.create` happens only after the slow synchronous media ingest, so media messages have a wide race window.
- The `unread_count` read-modify-write (`:307`) also loses increments under concurrency.

**Failure handling: the most serious stability issue [V/M]**
- Any exception is caught by the top-level `try`, logged as "Unhandled webhook error" and **answered with 200** (`:146-163`). Meta treats that as delivered and never retries.
- Measured [M] (WebhookLogs): **226** "Unhandled webhook error" rows from 14 to 30 Oct.
- The detail on every sampled row is `Rate limit exceeded: entity_list allows 140 requests per 60s for each caller…`.
- They cluster at :11 and :41 past the hour, seconds after masterTick logs "Job sendNPS failed". There are also bursts of 22 in one second (23 Oct 10:11) and about 40 in 3 minutes (26 Oct 19:31), which look like status floods.
- The first list call is the idempotency check, so a failing inbound message is **never stored**. The customer message is lost.
- Whether the 226 were inbound messages or status updates cannot be told from the log. The log writes the recipient phone into `message` but no event type.
- Additional finding: phone numbers are stored in WebhookLogs `message`, which is a privacy issue.

**Time budget [A]**
- No durations are logged. Function logs show only `POST → 200` lines.
- A text message takes about 5–7 sequential entity calls, roughly 1–2 s.
- Media adds two Graph round-trips plus a file upload (several seconds for video or documents), and that is the path where Meta timeouts and retries can occur.

---

## 4. masterTick

**Runs [M]** (workflows stats and runs API):

| Window | Runs | Failed | Avg duration | Credits/run |
|---|---|---|---|---|
| 1–30 Oct | 3,018 | 4 | **21.4 s** | – |
| 23–30 Oct | 906 | 0 | **45.9 s** | **0.2** (last 60 runs; Phase 1 saw 0.1) |
| Last 60 runs | – | – | min 6.0 s, max **93.2 s**, typical 30–60 s | 0.2 |

The workflow shows "completed" even when a job fails, because masterTick catches job errors (`masterTick/entry.ts:97-111`). So **0 failed runs hides 91 failed sendNPS jobs in 7 days** (every run of it, HTTP 500).

**Why it is slow [V]**
- The jobs run **sequentially** (`:119-149`), and each job is a cold function invocation that reloads `SystemSettings` (95 rows).
- Dominant jobs:
  - **processAlerts**:
    - generateDraft (LLM) is called synchronously for each due DraftQueue row (`processAlerts/entry.ts:100-117`).
    - The reminder sweep makes one `NotificationQueue.filter` per waiting conversation, an N+1 pattern (`:136-165`).
    - The open/pending conversation lists are fetched 4 times per run (`:131,184,227,283`).
    - `NotificationQueue.filter({status:'pending'})` runs against a table of 5k–10k rows.
  - **sendNPS** (every 6th tick): `RepairOrder.filter(closed)` returns up to 200 rows, followed by **200 × `SatisfactionSurveys.filter`** (`sendNPS/entry.ts:33-40`). That alone exceeds 140 list calls per minute, which explains the 500 errors and the starved webhooks. It also runs even though `survey_auto_send=false`.
  - **pollHelloClient**: one invocation every tick that returns `app_is_master` right away (`pollHelloClient/entry.ts:675`). That is pure overhead.
  - **escalateWaiting**: 2 bounded lists. It is light.

**Limit risk [A]**
- The run time rises with backlog. The longest run (93 s) is getting close to the 5-minute cadence, and Base44 function timeouts are unknown.
- If one run exceeds 300 s, runs overlap. There is no lock (the `poll_lock` setting belongs to pollHelloClient only).
- sendNPS already breaches the entity-list rate limit every time it runs.
- `alertOwner` sends the owner a WhatsApp template at most once every 2 h on failure (`:153-160`). Since sendNPS always fails, that is about 5 template sends per open day [A], which costs Meta fees and creates alert fatigue.

---

## 5. LLM calls

Source: WebhookLogs `llm:base44`, 23–30 Oct (7.5 days, 234 calls, 0 failures logged) [M]:

| Function | Calls | Per day | Trigger |
|---|---|---|---|
| liveKBCheck | ~120 | ~16 | each inbound text and **each outgoing agent text** (`sendMessage:484`), at most 1 per conversation per 6 h, 24/7 |
| generateDraft | ~96 | ~13 | UI button, **TriageCard auto-call**, DraftQueue sweep in processAlerts |
| whatsappWebhook (brief) | 17 | ~2 | inbound text > 280 chars |
| buildContentSignals | 1 | weekly | cron |
| Browser AISidebar (direct `Core.InvokeLLM`, `AISidebar.jsx:30-71`) | not logged | ? | UI. These calls bypass `callModel` logging entirely |

**Latency: not measurable.** No duration is logged at any call site, and function logs contain no timings [V]. Add timing to `callModel` (fix #8).

---

## 6. Reliability

**Dangerous silent catches [V]**
1. `whatsappWebhook:160-163`: every error returns 200, so the inbound message is lost (226 in October, see §3).
2. `callModel` in all 10 copies returns `''`/`{}` on error, and generateDraft returns an empty draft. The UI does nothing (`ChatArea.jsx:404-409`).
3. Webhook fan-out `runBackground(...catch(()=>{}))` for libraryAutoReply, flowExecutor, liveKBCheck and DraftQueue (`:437-454`). A failed live auto-reply leaves no trace.
4. `sendMessage` calls `FailedSend.create(...).catch(()=>{})` (`:402,426`). If the failure record itself cannot be written, the failed send disappears.
5. In the frontend, every Layout badge loader uses `catch {}` (`Layout.jsx:122,145,169,192`), clientCard and customerOverview use `.catch(()=>{})`, and the unread updates swallow errors. Wrong badges go unnoticed.

**Retries [V]**
- In the frontend, `withRateLimitRetry` retries 3 times at 2/4/8 s, but only for "rate limit"/"aborted" errors (`lib/rateLimitRetry.js`).
- On the backend, the only retry is `retryFailedSends` (every 3rd tick) over FailedSend.
- There is no retry on Reparo `waLookup`, and none on media ingest. A failed ingest stores the body `[type no descargado]` and never fetches the media again.

**FailedSend coverage.** FailedSend has 1 row in total [M]. Send paths **not** covered [V]:
- `sendMessage` network error, i.e. `fetch` throws (`:376-382`): only a WebhookLogs entry, no FailedSend, and the UI receives `ok:false`.
- `sendMessage` with `kind` `retry` or `scheduled` (by design, `:398,422`).
- `escalateWaiting`, `watchdog` and `masterTick.alertOwner`: direct Graph calls, with no FailedSend and no Messages row (these go to staff phones).
- `tpvWhatsappRelay`: Messages row written, but no FailedSend.
- Async delivery failures (status `failed`, e.g. 131026) only log to WebhookLogs (`whatsappWebhook:557-560`). They create no FailedSend and no staff alert.

**Unlogged sends (no Messages row, so not visible in the chat) [V]** (grep for `Messages.create`):
- `sendDueReviews`: review requests to customers.
- `escalateWaiting`, `watchdog`, `masterTick.alertOwner`: staff only.
- Every path through `sendMessage` is logged, including templates and libraryAutoReply.

**UTC without "Z" [V]**
- Backend Deno runs in UTC, so `new Date(created_date)` is correct there.
- The app's own timestamps use `toISOString()`, which includes the Z.
- **Browser parsing of `created_date`/`updated_date` treats the value as local time (CET), so displayed times are off by −1 h.** Affected:
  - `InternalNotes.jsx:74`
  - `Biblioteca.jsx:323`
  - `RespuestasAutomaticas.jsx:289`
  - `Sudo.jsx:350`
  - `AudioAlertManager.jsx:410,421,453`: `ageMs` is too large by 1 h, so the 120 s safety gate never applies. Playback still works through the string watermark compare.
- String comparisons between Z and non-Z ISO values (Layout errors badge, audio cutoffs) work by luck.

---

## 7. Function performance from logs

`functions-mgmt/{fn}/logs` returns sparse lines (`POST → 200` plus telemetry) with **no durations**. It appears to cover only the latest deployment (29 Oct 18:02). `sendMessage`, `masterTick` and `generateDraft` returned 0 error lines [M].

Usable error data comes from WebhookLogs, 23–30 Oct [M]:

| Source | error/warn rows | Main cause |
|---|---|---|
| masterTick | 91 | `Job sendNPS failed`, HTTP 500, on every 6th tick (all of them). Also 1 processAlerts failure (26 Oct) |
| whatsappWebhook | ~130 | "Unhandled webhook error" (entity_list rate limit); a few `Delivery failed (131026)` |
| generateDraft | 3 | – |
| flowExecutor | 3 | – |

**Invocation volume [A from §5 and the workflow]:**
- masterTick: 144 runs/day, fanning out to about 4–8 jobs each, so about 700–1,000 internal invocations per day.
- whatsappWebhook: about 150–300 per day (inbound plus statuses).
- liveKBCheck: about 16 LLM calls per day, with more invocations skipped by the rate limit.
- generateDraft: about 13 per day.
- autoLearn: one per agent send, all no-ops.

---

## 8. Top 10 speed and stability fixes (ranked by impact on daily use)

| # | Fix | Evidence | Expected gain (reasoning) | Effort | Risk |
|---|---|---|---|---|---|
| 1 | **Stop sendNPS from flooding entity_list.** Skip it while `survey_auto_send=false`, and replace the 200× per-repair filter with one `SatisfactionSurveys.filter({repair_job_id:{$in:[…]}})` | `sendNPS/entry.ts:33-40`; 91/91 job failures; 226 lost webhooks with the rate-limit detail | Removes the 500s and the owner WhatsApp alert spam. Ends the loss of inbound messages and statuses at :11/:41. masterTick gets about 10–20 s faster on those ticks | S | Low |
| 2 | **Webhook must not ack failures.** Return 5xx (or rethrow) when ingestion fails, so Meta redelivers. Back the dedupe with a unique key or upsert so redelivery stays safe | `whatsappWebhook:146-163,176-179` | Turns silent data loss into a delayed retry. This meets the "0 silent failures" and "idempotent" targets | S–M | Med: needs reliable dedupe first, or retries create duplicates |
| 3 | **Ack fast, process later in the webhook.** Store the raw event and the Messages row first, then move media ingest and conversation update to `waitUntil` or a queue | `:276-288,505-509` | Response time for media drops from several seconds to under 1 s. Closes the duplicate race for media | M | Med |
| 4 | **Route-level code-splitting.** `React.lazy` for all pages, plus dynamic `import()` for printEngine (libphonenumber, jsbarcode, qrcode) and jszip | `App.jsx:11-38`; bundle table §1 | About −130 KB gzip and about −480 KB raw on the inbox route (−35%). Parse time on the counter PC falls in proportion, which is the main lever for the < 2 s target | S–M | Low (the `vite:preloadError` reload already exists) |
| 5 | **Cut inbox refetch storms.** Apply realtime events in place: append the created message and patch the conversation instead of calling `loadConversations()` and `loadMessages()`. Merge the Layout and page Conversations subscriptions. Use react-query with shared keys and `fields` projections | `Conversaciones.jsx:141-162`, `Layout.jsx:115-128,164,187` | Each inbound message goes from about 3 full lists of 200×52 fields per tab to 0–1 small reads. Opening the chat after sending is instant (no double fetch). Pressure on the 140/min budget drops | M | Low–Med |
| 6 | **Bound every unbounded read.** Explicit `limit`, `sort` and paging for Messages (chat: newest N plus "load older"), the KB badge (use a count or a `reviewed_at` filter), ActivityLog errors (add a date filter), `Customers.list()` (Campanas), RevisionKB, `SystemSettings.list()` (functions) | §2 list; SDK `entities.js:61-73` | Prevents silent truncation (newest chat messages, settings keys) as the data grows. Smaller payloads | S | Low |
| 7 | **Make masterTick cheaper and safer.** Drop the pollHelloClient call (`app_is_master`). Load settings once and pass them to jobs. Run independent jobs in parallel. Take the processAlerts DraftQueue LLM calls out of the tick. Fetch the conversation list once and remove the N+1 NotificationQueue lookups. Add an overlap lock | `masterTick:119-149`, `processAlerts:100-165,184,227,283` | Average 46 s → about 10–15 s. Removes the risk of runs overlapping. Credits/run may drop back from 0.2 to 0.1 [A] | M | Low–Med |
| 8 | **Make the AI draft faster and its failures visible.** Run the Reparo/KB/insights/messages reads in parallel (`Promise.all`). Cache KB and settings per instance. Show a toast on an empty draft. Log `ms` in `callModel`. Stop the TriageCard auto-generate when `ai_drafted_reply` exists | `generateDraft:48-286`, `ChatArea.jsx:404-409`, `TriageCard.jsx:27-43` | Draft time drops by the sum of about 6 serial DB and Reparo hops (about 1–3 s) [A]. Triage stops costing one LLM call per card viewed (part of the ~13/day). Draft time becomes measurable | S–M | Low |
| 9 | **Close FailedSend and logging gaps.** Create FailedSend on a sendMessage network error. Raise failed delivery statuses (131026) as FailedSend or an alert. Write Messages rows for `sendDueReviews`. Route the escalate/watchdog/alertOwner sends through one logged sender | §6 lists | Meets "every send logged" and "0 silent failures". Staff can see undelivered status updates | M | Low |
| 10 | **Remove per-send waste and console noise.** Stop invoking `autoLearn` on every send while it is disabled. Skip liveKBCheck on outgoing text. Remove the CustomFieldDefs, RepairCache and SentNotification reads (0-row tables). Strip the `[AUDIO]` console logs. Parse `created_date` as UTC in the browser (append Z) | `ChatArea.jsx:299`, `sendMessage:484`, `AudioAlertManager.jsx:395-421`, §6 UTC | Fewer function invocations (one per reply) and fewer LLM calls (part of liveKBCheck's ~16/day). A clean console. Correct displayed times | S | Low |

**Not code, but related:**
- Fix the dead `stamp-sw.js`: put a `__BUILD_ID__` into `CACHE_VERSION`, or drop the update toast.
- Remove the 13 unused dependencies.
- Stop writing phone numbers into WebhookLogs `message`.
