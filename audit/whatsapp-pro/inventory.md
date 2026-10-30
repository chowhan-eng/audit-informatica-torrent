# WhatsApp Pro: Phase 1 inventory (read-only)

App `69f23ccb4284f8588aa5b7a3`. Sandbox HEAD `21acef8` (29 Oct 2026 18:02 UTC). Audit date: 30 Oct 2026.
Evidence tags: **[V]** verified (file:line / query / API), **[M]** measured, **[A]** assumption.
No secret values, names, phones or message text are reproduced. Paths are relative to `/app`.

---

## 1. Pages and routes (`src/App.jsx:100-130`)

Every route needs a login. Non-admins also have to pass onboarding and an approval gate on the client side (`App.jsx:84-96`). `isAdmin` = `user.role==='admin'` OR a hard-coded `ADMIN_EMAIL` (`src/lib/AuthContext.jsx:70,110`). That email check exists only in the UI. The backend checks `role==='admin'` only.

| Route | Page | Visible to |
|---|---|---|
| `/` | Dashboard | approved users + admin |
| `/conversaciones` | Conversaciones (inbox, AISidebar) | approved + admin |
| `/clientes` | Clientes | approved + admin |
| `/campanas` | Campanas (broadcast, NPS settings) | approved + admin |
| `/pedidos`, `/pedidos/nuevo`, `/pedidos/:orderId` | Orders (RepairOrder) | approved + admin |
| `/ventas` | Ventas | approved + admin |
| `/inventario` | Inventario | approved + admin |
| `/tareas` | Tareas | approved + admin |
| `/taller` | Taller | approved + admin |
| `/conocimiento` | BaseConocimiento (KB) | approved + admin |
| `/respuestas-rapidas` | RespuestasRapidas | approved + admin |
| `/plantillas` | Plantillas (templates) | approved + admin |
| `/chatbot` | Chatbot flows | approved + admin |
| `/ajustes` | Ajustes (settings) | approved + admin (SystemSettings RLS is admin-only, so the writes fail for non-admins) |
| `/logs` | Logs | approved + admin |
| `/importar` | ImportarHistorial | approved + admin |
| `/revision-kb` | RevisionKB | approved + admin |
| `/auto-reply` | RespuestasAutomaticas | approved + admin |
| `/triaje`, `/esperando` | Triage / waiting ("zero unanswered") | approved + admin |
| `/biblioteca` | Biblioteca (AnswerLibrary) | approved + admin |
| `/usuarios` | Usuarios | admin only |
| `/sudo` | Sudo console | admin only |
| `/importar-helloclient` | ImportarHelloClient | admin only |
| `*` | PageNotFound | all |

`OAuthConsent.jsx` exists but no route uses it [V]. The nav menu also has a "supervisor" group (`UserProfile.role==='supervisor'`, `Layout.jsx:92`).

---

## 2. Entities (53)

**RLS shorthand:** **A** = admin only. **AU** = admin or any `user` role. **Own** = admin or `created_by == user.email`. Row counts come from `query_entities` skip-probes [M] (the platform `/count` and `v2/list` endpoints return 0 for every entity with this credential, so they cannot be used). Ranges are shown where an exact count was not needed.

| Entity | Key fields | Rows [M] | Oldest / newest created | RLS R/C/U/D [V] |
|---|---|---|---|---|
| ActivityLog | order_id, from/to_status, template_name, sent | 500–4,999 | 2026-06-12 / 2026-10-30 | A/A/A/A |
| AgentProfiles | user_id, email, role | 2 | 2026-05-26 (seed) | AU×4 |
| AnswerLibrary | topic_key, answer_es/en/pa, price_keys | 10–49 | – / 2026-10-19 | AU / A / A / A |
| AutoReplyLog | conversation_id, proposed_reply, decision, mode_at_time | 1,000–1,999 | – / 2026-08 (row 1000) | AU×4 |
| BroadcastCampaigns | name, message_body, target_*, status | 2 (sample) | 2026-05-26 | AU×4 |
| ChatbotFlows | trigger_keywords, response_message, is_active | 4 (sample; 2 active) | 2026-05-26 | AU×4 |
| ContentSignalsCache | generated_at, repair_totals, top_questions, kb_faq | 9 | 2026-09-22 / 2026-10-26 | A×4 |
| ConversationNotes | conversation_id, body, author_* | 2 | 2026-07-14 / 07-16 | AU×4 |
| Conversations | customer_phone, status, assigned_agent, last_*_at (52 fields) | 1,500–2,499 | 2026-04-29 / 2026-10-30 | AU×4 |
| CustomFieldDefs | field_key, label, field_type | **0** | – | AU×4 |
| Customer | phone_e164, is_vip, marketing_consent | **0** | – | AU×4 |
| CustomerInsights | customer_id, personal_facts, devices_owned… | 1–999 | 2026-05-26 newest-probe | AU×4 |
| Customers | full_name, dni, email, hc_client_id… | 1,000–4,999 | – / 2026-07-07 (row 1000) | AU×4 |
| DeviceUnlockCode | code, order_id, ticket_uuid | 1,000+ | – / 2026-10-21 | A / AU / A / A |
| DraftQueue | conversation_id, fire_at, status | ≥100 | – | A×4 |
| Employee | name, email, hc_id, can_view_codes | **0** | – | AU / AU / AU / A |
| FailedSend | to_phone, purpose, retry_data, classification, status | **1** (resolved, transient) | 2026-10-17 | A×4 |
| Handbook | entries, hc_id | **0** | – | AU / AU / AU / A |
| ImportJobs | file_name, html_content, status | **0** | – | AU×4 |
| KnowledgeBase | title, content, category, review_status, auto_extracted | 500–999 | – / 2026-10-30 | AU×4 |
| MessageEmbeddings | source_text, embedding | 1–99 | – / 2026-06-17 | A×4 |
| MessageTemplates | template_name, language_code, category, purpose, is_active | 4 | 2026-06-08 / 07-12 | AU×4 |
| Messages | conversation_id, sender_type, message_body, timestamp, media_url | **>10,000** | 2026-04-29 / 2026-10-30 | AU×4 |
| NotificationQueue | conversation_id, notification_type, debounce_until, status | 5,000–9,999 | – / 2026-10-19 | A×4 |
| OrderPreset | – | **0** | – | AU×4 |
| OrderState | order_id, last_status, customer_* | 1,000–4,999 | – | A×4 |
| PendingReviews | order_id, phone, due_at, sent | ≥100 | – | A×4 |
| Presence | agent_email, conversation_id, heartbeat_at | ≥1 | – / 2026-10-08 | AU×4 |
| PriceList | price_key, service, price_eur | ≥1 | – / 2026-10-02 | AU / A / A / A |
| PrintTemplate | – | **0** | – | AU / AU / AU / A |
| Product | – | **0** | – | AU / AU / AU / A |
| PushSubscriptions | endpoint, keys_auth, keys_p256dh, user_email | ≥1 | – / 2026-07-25 | A×4 |
| QuickReplies | title, body, shortcut | ≥1 | – / 2026-10-21 | AU×4 |
| RepairCache | – | **0** | – | AU×4 |
| RepairJobs | job_number, customer_*, status | ≥1 | – / 2026-05-26 (seed only) | AU×4 |
| RepairLookupQueue | – | **0** | – | A×4 |
| RepairOrder | order_id, ticket_uuid, client_dni/email/phones, status (41 fields) | 1,000–4,999 | – | AU×4 |
| Sale | – | **0** | – | AU / AU / AU / A |
| SatisfactionSurveys | repair_job_id, score, status | ≥1 | – / 2026-10-28 | AU×4 |
| ScheduledMessages | message_body, scheduled_at, status | ≥1 | – / 2026-10-02 | AU×4 |
| SentNotification | phone_e164, notification_type, dedupe_key | **0** | – | A×4 |
| ShopField / ShopPayment / ShopRole / ShopStatus / ShopTask | hc_id mirrors | **0** each | – | AU (D: A) |
| SystemSettings | setting_key, setting_value | **95** | 2026-05-26 / 2026-10-30 | A×4 |
| User | role (built-in) | – | – | platform |
| UserPreferences | user_id, notify_* | 4 | 2026-06-17 / 06-22 | A×4 |
| UserProfile | user_id, display_name, **approval_status**, **role** | 3 (all approved, role=agent) | 2026-06-11 / 06-23 | Own / Own / **Own** / A |
| VacationReservation | queue_number, device, problem | ≥1 | – / 2026-08-06 | AU×4 |
| VoiceQueue | kind, text, spoken | 1,000–4,999 | – / 2026-09-09 (row 1000) | A×4 |
| WebhookLogs | level, source, message, detail | **>10,000** | 2026-05-31 / now | A×4 |

**Entities with 0 rows (16):** Customer, CustomFieldDefs, Employee, Handbook, ImportJobs, OrderPreset, PrintTemplate, Product, RepairCache, RepairLookupQueue, Sale, SentNotification, ShopField, ShopPayment, ShopRole, ShopStatus, ShopTask. Seed or sample data only: BroadcastCampaigns, ChatbotFlows, AgentProfiles, RepairJobs.

**Duplicated models [V]:** `Customer` (0 rows) vs `Customers` (1,000+). `RepairJobs` (seed) vs `RepairOrder` (live). `AgentProfiles` vs `UserProfile`.

**RLS notes [V]:**
- Almost all customer-data entities (Messages, Conversations, Customers with DNI and email, RepairOrder, CustomerInsights) allow full CRUD to any `user` role. The approval gate exists only in the UI. Any registered user can read and write these entities through the SDK, approved or not.
- `UserProfile` update rule is `created_by == user.email`. A user can therefore set their own `approval_status` and `role` ('supervisor').

---

## 3. Backend functions (50 dirs, incl. `_shared`)

**Caller types:**
- **PUB** = the function has no caller authentication of its own. It runs as service role. [A] It is reachable by anyone who knows the function URL.
- **USR** = `auth.me()` required.
- **ADM** = admin role.
- **SEC** = shared-secret header.
- **SCH** = invoked by masterTick or a workflow.
- **WH** = Meta webhook.
- **INT** = called internally by other functions.

| Function | Purpose | Caller [V] | External calls | Errors / retries |
|---|---|---|---|---|
| whatsappWebhook | Meta inbound: ingest, brief, fan-out to liveKBCheck, flowExecutor, libraryAutoReply, sendPush, DraftQueue | WH (GET verify token; POST HMAC fail-closed, `:133-139`) | Graph v21.0 (media), LLM (brief > `brief_llm_min_chars`=280) | 12 empty catches; fire-and-forget `runBackground` |
| sendMessage | central outbound: text, media, template, 24 h fallback, hours gate | **PUB if no session.** Approval checked only `if (x-caller!=='internal' && user)` (`:166-170`) | Graph, Reparo waLookup | FailedSend on failure; 8 empty catches |
| generateDraft | AI draft (KB, Reparo lookup, LLM) → evaluateAutoReply | USR approved, **bypassed by the `x-caller: internal` header** (`:66-69`) | LLM, Reparo waLookup | degrades to '' |
| evaluateAutoReply | classify and auto-send (mode = `off` now) | PUB/INT | LLM, sendMessage | – |
| libraryAutoReply | template-first auto-reply (mode **live**), 60 s debounce | PUB/INT | Reparo waLookup, sendMessage | – |
| liveKBCheck | KB extraction per inbound text (6 h/conv rate limit) | PUB/INT | LLM | 7 empty catches |
| autoKBExtract | batch KB extraction, cap 20 convs/run | PUB/SCH | LLM | logs to WebhookLogs |
| autoLearn | learn from replies (`autolearn_enabled`=false) | PUB (frontend invokes) | LLM | – |
| getAIReply | AI reply for sudo | USR | LLM | – |
| suggestButtons | quick-reply buttons | USR | LLM | – |
| generateFAQ | FAQ generation | ADM | **direct Core.InvokeLLM** (`:127,174`) | – |
| sudoCommand | admin console | ADM | LLM, getAIReply, serviceRecoverySweep | – |
| buildContentSignals | weekly anonymised feed | ADM or `_sched` constant (`:167`) | LLM via `base44/shared/llmRouter.ts` (cross-dir import) | – |
| exportContentSignals | GET feed for informaticatorrent.com | SEC `x-signals-secret` (SIGNALS_SECRET, length 64) | – | logs every access |
| masterTick | master scheduler | SCH (PUB HTTP) | Graph (owner alert, template) | per-job try/catch → WebhookLogs + WhatsApp alert to owner (max 1 per 2 h) |
| pollHelloClient | HelloClient status scanner → WhatsApp status | SCH/PUB; `?fast=1` needs PING_KEY | HelloClient (HC_SESSION_FULL), Graph, sendPush | FailedSend; **now returns `app_is_master`** (orders_master=app since 2026-10-29) |
| reparoBridge | Reparo → WA events, HC read-only proxy, set_master | SEC `X-Reparo-Key` (non-constant-time `!==`, `:164`) | HelloClient, Graph, sendPush | FailedSend |
| tpvWhatsappRelay | TPV → template send / template lookup | SEC `x-tpv-key` (constant-time) | Graph | – |
| orderStatus | public order-status page (/estado.html) | PUB by design; UUID lookup | – | – |
| clientCard / customerOverview | Reparo customer lookup | USR | Reparo waLookup | – |
| processAlerts | alerts, briefs, voice translation, reminders, **off-hours ack**, EOD | PUB/SCH | LLM (voice translation `:68`), generateDraft, sendMessage | – |
| escalateWaiting | 30/60 min unanswered escalation to staff phone | PUB/SCH | Graph (hard-coded template fallback) | no FailedSend |
| processBroadcasts | marketing broadcasts, consent filter | PUB/SCH | Graph | FailedSend |
| retryFailedSends | FailedSend retry | PUB/SCH | Graph, sendMessage | marks resolved/dead |
| sendDueReviews | Google review requests | PUB/SCH (manual `?manual=1` bypasses gates) | Graph | FailedSend |
| sendNPS | NPS surveys | PUB/SCH | sendMessage | – |
| sendScheduledMessages | ScheduledMessages | PUB/SCH | sendMessage | – |
| watchdog | staleness dead-man switch | PUB/SCH | Graph (default template `'actualizacion_taller'`, `:104`) | no FailedSend |
| libraryShadowReport | shadow-mode evaluation | PUB/SCH | – | – |
| serviceRecoverySweep | recovery messages | ADM | sendMessage | – |
| flowExecutor | chatbot flows (`chatbot_flows_enabled`=false) | PUB/INT | sendMessage | – |
| sendPush | web push to staff | **PUB** (no auth, `:9`) | Web Push (VAPID) | – |
| logOutboundMessage | upserts Conversation + Message from `{phone, body}` | **PUB** (no auth, `:5`). The OUTBOUND_LOG_SECRET secret exists but the code never checks it | – | – |
| extractMemory | upserts CustomerInsights | **PUB** (no auth, `:3`) | – | – |
| getUnspokenAlerts / ingestChatHistory / ingestChatKnowledge / ingestClientFromShop / importChats | external ingestion | SEC IMPORT_SECRET (`X-Ingest-Secret` / `X-Import-Secret`); importChats also ADM | LLM (ingestChatKnowledge) | – |
| getUnspokenVoiceAlerts | voice client feed | SEC VOICE_CLIENT_SECRET | – | – |
| helloClientLogin | HC session check/login | USR | HelloClient (HC_EMAIL/HC_PASSWORD, which are **not set**) | – |
| hcImportBatch, mergeCustomers, unlockCode | admin tools | ADM | – | – |
| manageTemplates | sync Meta templates ↔ MessageTemplates | USR | Graph | – |
| saveUserProfile, searchConversations | user tools | USR | – | – |
| syncMessages | **legacy Whapi.cloud sync** | USR | gate.whapi.cloud (token from `whapi_api_token` setting, absent) | – |

**Repo vs deployed [V/partial]:**
- `GET /backend-functions` returns the full source of every function (~450 KB). It was not pulled, to stay within context limits, so a file-by-file comparison is **not done** (carry over to Phase 2).
- `tmpReparoPing` (deleted in HEAD `21acef8`; present in `b608898`) is an **unauthenticated proxy** to Reparo `waLookup`. It uses REPARO_WA_KEY and returns whether a client exists plus order count and status for any `phone` sent to it. Function logs since 2026-09-01 are empty [M]. Whether it is still deployed is **unverified**.

**masterTick job map (`base44/functions/masterTick/entry.ts`) [V]:**
- Kill switch: `automations_enabled` must equal 'true' (it does).
- Hours gate: shop open per `shop_hours` setting, Mon–Fri 09:30–14:00 & 17:00–20:30, Sat 10:00–14:00, Sun closed (`:43` default, same as the stored setting).
- **While open (`:119`):** every tick runs pollHelloClient, sendScheduledMessages, processAlerts, escalateWaiting. Every 3rd tick adds processBroadcasts and retryFailedSends. Every 6th tick adds sendDueReviews and sendNPS.
- **While closed, every 12th tick (`:145-148`):** autoKBExtract, watchdog, libraryShadowReport.
- Because the cron window is `*/5 9-20 * * 1-6` Madrid, the "closed" branch only runs during closed slots *inside* that window: weekdays 09:00–09:30, 14:00–17:00, 20:30–20:55; Saturday 09:00–10:00 and 14:00–20:55.

---

## 4. Automations (workflows API) [V/M]

| Workflow | Trigger | Status | Runs/day (est.) | Outside stated hours* | Notes |
|---|---|---|---|---|---|
| masterTick | cron `*/5 9-20 * * 1-6` Europe/Madrid | active, 12,083 runs, 0 consecutive failures | 144 Mon–Sat | partly: weekday 14–16 h; Sat 14–21 h | 0.1 credit/run [M]. Failures: 2026-09-28, 10-05 (platform ClickHouse OOM), 10-15, and **10-19 00:27 and 01:57 UTC (Sunday night, outside the cron)**, all "user worker threw an exception" |
| Build Content Signals | cron `0 5 * * 1` Madrid | active, 5 runs, last 2026-10-26 success | 1/week | yes (Mon 05:00) | LLM 1 call/run |
| 9 legacy (Process Broadcast, Retry Failed Sends, Send NPS, Send Scheduled, autoKBExtract_daily, pollHelloClient, processAlerts, sendDueReviews, watchdog) | interval 5 min–3 h UTC | **inactive**, last run 2026-06-28 | 0 | – | repo files still present |
| Modo Vacaciones (entity trigger Messages.create, sender_type=customer) | entity | **archived**, 3,735 runs, last 2026-10-02 | 0 | – | not in repo `base44/workflows/`; 2 auth failures 2026-09-08 |

*Stated shop hours: Mon–Fri 09–14 & 16–21, Sat morning, Sun closed. **The configured `shop_hours` (09:30–14:00 / 17:00–20:30, Sat 10–14) differs from these stated hours [V]** (SystemSettings `shop_hours`, `business_hours_start/end` = 09:30/20:30).

Event-driven work runs 24/7 regardless of hours: the Meta webhook → liveKBCheck (LLM), the webhook brief (LLM), libraryAutoReply (live sends), flowExecutor.

---

## 5. Integrations and secrets (names only)

**Platform secrets (`GET /secrets`) [V]:** REPARO_WA_KEY, TPV_RELAY_KEY, SIGNALS_SECRET, WEBHOOK_URL_TOKEN, OUTBOUND_LOG_SECRET, IMPORT_SECRET, VOICE_CLIENT_SECRET, PING_KEY, HC_SESSION_FULL, META_APP_SECRET, VAPID_SUBJECT, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, WHATSAPP_VERIFY_TOKEN, OPENAI_API_KEY, `Whatsapp`, META_ACCESS_TOKEN, META_PHONE_ID, WEBHOOK_VERIFY_TOKEN.

**`Deno.env.get` names in code [V]:** META_ACCESS_TOKEN (12), META_PHONE_ID (10), GEMINI_API_KEY (11), REPARO_WA_KEY (6), REPARO_LOOKUP_URL (5), IMPORT_SECRET (5), HC_SESSION_FULL (4), HC_EMAIL, HC_PASSWORD, META_APP_SECRET, WEBHOOK_VERIFY_TOKEN, PING_KEY, TPV_RELAY_KEY, VAPID_*, VOICE_CLIENT_SECRET, LLM_PROVIDER/LLM_API_KEY/LLM_MODEL (`_shared/llmFree.ts`, unused). `secrets.get('SIGNALS_SECRET')` (exportContentSignals).

- **Referenced but not set:** GEMINI_API_KEY (dead read), HC_EMAIL, HC_PASSWORD, REPARO_LOOKUP_URL (falls back to a hard-coded URL), LLM_*.
- **Set but unused in code:** OPENAI_API_KEY, `Whatsapp`, WHATSAPP_VERIFY_TOKEN, WEBHOOK_URL_TOKEN, OUTBOUND_LOG_SECRET.

**Secret-like values outside the secret store (location only) [V]:**
- SystemSettings rows that still hold values: `meta_access_token` (EAA-prefixed, more than 50 chars, last updated 2026-06-08), `import_secret` (token-like, 20+ chars), `webhook_verify_token` (13–15 chars). Rows scrubbed to placeholders: `gemini_api_key`, `ping_key`, `voice_client_secret`, `hc_session_full`. Row empty: `openai_api_key`. No code reads any of these rows [V] (grep).
- `buildContentSignals/entry.ts:167` and `workflows/buildContentSignals_weekly_monday_0500.jsonc:16`: hard-coded shared secret `_sched` (repo is synced to GitHub).
- Hard-coded staff fallback phone number in masterTick, escalateWaiting and watchdog (`watchdog_phone` fallback). This is personal data in code.
- `ADMIN_EMAIL` constant in `src/lib/AuthContext.jsx` and `sendMessage/entry.ts`.
- No API-key patterns (EAA…, AIza…, sk-…) were found in `src/`, `base44/` or the docs [V] (grep).

**External endpoints:** graph.facebook.com (v21.0 webhook media, v23.0 elsewhere), app.helloclient.by, reparo-812bcab8.base44.app `/functions/waLookup`, gate.whapi.cloud (legacy), Base44 Core.InvokeLLM, Web Push.

---

## 6. LLM usage [V]

- **There is no Gemini router in effect.** Every `callModel` copy has carried the comment "Joney (2 Oct 2026): ALL AI work uses Base44's built-in models (Core.InvokeLLM)" (12 files), including `base44/shared/llmRouter.ts:46-59`.
- `loadModelConfig` still reads `GEMINI_API_KEY` and `gemini_model`, but nothing uses the result.
- SystemSettings `ai_provider`='gemini' (stale). `gemini_model` holds the placeholder note "not used: Base44 internal AI since 2 Oct 2026". No model name is configured.
- `_shared/llmFree.ts` (Gemini/Groq/OpenAI OpenAI-compatible endpoints, default `gemini-1.5-flash`) is dead code that no function imports.

| Call site | Path | Trigger |
|---|---|---|
| whatsappWebhook `:599` brief | callModel → Core.InvokeLLM | each inbound message > 280 chars, 24/7 |
| liveKBCheck | callModel → InvokeLLM | each inbound text, at most 1 per conv per 6 h, 24/7 (autokb_live=true) |
| generateDraft `:286` | callModel → InvokeLLM | DraftQueue / processAlerts / UI |
| evaluateAutoReply `:119` | callModel | only if autoreply_mode≠off (currently off) |
| autoKBExtract `:150` | callModel | masterTick closed slots, ≤20/run |
| autoLearn, getAIReply, sudoCommand, suggestButtons, ingestChatKnowledge, processAlerts `:68` (voice translation) | callModel | on demand / settings-gated |
| buildContentSignals | imports `shared/llmRouter.ts` callModel | weekly |
| generateFAQ `:127,174` | **direct Core.InvokeLLM** | admin UI |
| `src/components/conversaciones/AISidebar.jsx:30,41,64,71` | **direct Core.InvokeLLM from the browser** | UI |

Measured: 234 `llm:base44` log lines between 2026-10-23 and 2026-10-30 (≈32 per day). Most came from liveKBCheck and generateDraft; about 17 from the webhook brief; 1 from buildContentSignals; 0 from autoKBExtract [M] (WebhookLogs).

---

## 7. Settings stores [V]

- **SystemSettings** (95 key/value rows; admin-only RLS). Read by every function via `list(null,500)`. Notable live values:
  - automations_enabled=true
  - library_autoreply_mode=**live**
  - autoreply_mode=off
  - autokb_enabled=true, autokb_live=true
  - offhours_autoack_enabled=true
  - escalation_dry_run=false
  - orders_master=app
  - meta_graph_version=v23.0
  - survey_auto_send=false
  - chatbot_flows_enabled=false
  - vacation_* = "removed 2 Oct 2026"
- **Duplicates or overlaps:**
  - `shop_hours` (JSON) vs `business_hours_start/end` (Ajustes UI) vs the hard-coded default in each function (≥8 copies) vs `src/lib/businessHours.js`.
  - Template names in `meta_template_name`/`review_template_name` vs the MessageTemplates entity.
  - `ai_provider`/`gemini_model` stale.
  - Secret rows listed in §5.
  - Runtime state stored as settings: mastertick_counter, poll_lock, eod_last_run, escalation_alert_last_<phone> (**a phone number used inside a key name**), hc_field_map.
- **UserPreferences** (per-user notification preferences, 4 rows). `UserProfile.role` / `approval_status`. `localStorage` is used in the frontend [A].
- The frontend reads non-secret keys by filter (`Ajustes.jsx:198-210` whitelist). Several pages also read SystemSettings as non-admin users (ConvList, businessHours.js), and admin-only RLS makes those reads return nothing for non-admins [V/A].

---

## 8. WhatsApp templates [V]

| Template | Category (MessageTemplates) | Purpose | Active | Where referenced |
|---|---|---|---|---|
| actualizacion_taller2 | UTILITY | status | yes (verified 2026-10-30) | MessageTemplates; setting `meta_template_name`; **hard-coded fallbacks:** masterTick `:176`, escalateWaiting `:107`, sendMessage `:203` (FORCED_WINDOW_TEMPLATE), `src/components/conversaciones/TemplatePicker.jsx:8` |
| resena_google | **MARKETING** | review | yes | MessageTemplates; setting `review_template_name` |
| actualizacion_taller | MARKETING | other | no | **watchdog `:104` default** |
| hello_world | UTILITY | other | no | MessageTemplates only |
| broadcast template | – | broadcast | – | processBroadcasts: campaign override or setting `broadcast_template_name` (setting absent) |
| vacation_return_template | – | – | – | setting placeholder (removed) |
| ShopStatus.whatsapp_template | – | – | – | entity has 0 rows |

**(c) is partially fixed.**
- `resolveTemplate` (MessageTemplates first, SystemSettings fallback) is the documented single source. It is stamped into sendMessage, sendDueReviews, pollHelloClient, retryFailedSends, reparoBridge and processBroadcasts.
- masterTick, escalateWaiting and watchdog bypass it and read the setting plus a hard-coded fallback; watchdog's fallback is the inactive marketing template.
- The two stores currently agree (both name `actualizacion_taller2` / `resena_google`) [V].
- The review flow sends a MARKETING-category template, and there is no consent check in sendDueReviews, pollHelloClient or reparoBridge [V] (grep "consent" returns nothing).

---

## 9. Knowledge base pipeline (brief)

- **Entities:** KnowledgeBase (500–999 rows). Status breakdown [M]: pending_review ≥300, approved 100–299, rejected 1–49. Newest auto-extracted row 2026-10-30 08:53 UTC. Related: AnswerLibrary (10–49), MessageEmbeddings (1–99), ContentSignalsCache (9).
- **Functions:** liveKBCheck (per inbound message), autoKBExtract (batch), ingestChatKnowledge (import, IMPORT_SECRET), autoLearn (off), generateFAQ, buildContentSignals → exportContentSignals.
- **Use in drafts:** generateDraft reads KnowledgeBase (6 references) and evaluateAutoReply uses it when `autoreply_require_kb` is set [V].
- `autokb_autopublish`='' so extracted entries queue as pending_review, which explains the growing backlog [A].

---

## 10. Cross-app calls [V]

| Direction | Endpoint | Auth | Retries |
|---|---|---|---|
| WA Pro → Reparo | `https://reparo-812bcab8.base44.app/api/apps/6ae22784825ce515812bcab8/functions/waLookup` (hard-coded; env override unset) from sendMessage, generateDraft, libraryAutoReply, clientCard, customerOverview (and tmpReparoPing in b608898) | `X-Reparo-Key` = REPARO_WA_KEY | none seen [A] |
| Reparo → WA Pro | `reparoBridge` (ping, `hc` proxy, `event` → WhatsApp + push + review scheduling, `set_master`) | `X-Reparo-Key` (plain `!==`) | sender-side unknown; FailedSend on the WA side |
| TPV → WA Pro | `tpvWhatsappRelay` (`template` lookup, `send` template) | `x-tpv-key` = TPV_RELAY_KEY (constant-time) | – |
| WA Pro → HelloClient | pollHelloClient (now short-circuited by orders_master=app), reparoBridge `hc` read-only proxy (regex allow-list), helloClientLogin | HC_SESSION_FULL cookie | – |
| Website → WA Pro | exportContentSignals GET | x-signals-secret | – |
| Public QR page → WA Pro | orderStatus | none (UUID) | – |
| External ingest → WA Pro | ingestChatHistory / ingestChatKnowledge / ingestClientFromShop / getUnspokenAlerts | IMPORT_SECRET header | – |

---

## 11. HelloClient-era code still present [V]

- pollHelloClient (1,011 lines, still invoked every open tick but returns `app_is_master`).
- helloClientLogin (references unset HC_EMAIL/HC_PASSWORD).
- hcImportBatch, the reparoBridge `hc` proxy, the `/importar-helloclient` page.
- `hc_*` fields on Customers/Employee/Shop* entities. The Shop* mirror entities (all 0 rows).
- SystemSettings `hc_session_full`, `hc_auth_alerted`, `hc_field_map*`, `fast_last_ping`, `poll_lock`.
- The HC_SESSION_FULL secret.
- `syncMessages` + Whapi.cloud (an even older provider).
- The 9 inactive legacy workflow files.

---

## 12. Historic issues: verdict

| # | Issue | Verdict | Evidence |
|---|---|---|---|
| (a) | Plaintext secrets in SystemSettings | **Partially fixed.** Code reads secrets only from env (`whatsappWebhook:567-569`; the llmRouter comment). Ajustes no longer fetches secret keys (`Ajustes.jsx:194-204`). 4 rows were scrubbed to placeholders. **But `meta_access_token` (EAA token shape), `import_secret` and `webhook_verify_token` still hold values in SystemSettings**, so any admin session can read them. | [V] query_entities regex/shape tests (values not read out) |
| (b) | Meta HMAC failing open | **Fixed.** `verifyMetaSignature` returns false when the secret or header is missing. POST returns 401 on an invalid signature before parsing (`whatsappWebhook/entry.ts:35-50,133-139`). Rejections were logged 5–12 Jul and none since. Inbound messages are still arriving (newest Messages 2026-10-30), so valid signatures pass. Deployed-code parity not checked. | [V] code + [M] WebhookLogs |
| (c) | Template names split between two stores | **Partially fixed.** See §8: resolveTemplate is used in 6 functions, 3 functions bypass it, there are hard-coded fallbacks including a stale marketing template in watchdog, and the frontend hard-codes the template name. | [V] |
| (d) | 8 automations burning credits off-hours | **Mostly fixed.** One active scheduler (Mon–Sat 09–20:55 Madrid) plus one weekly job. 9 legacy workflows inactive since 28 Jun. The Vacaciones entity workflow is archived. Remaining: 144 fires/day at 0.1 credit each; masterTick runs during the 14–17 h break and Saturday afternoon; webhook-driven LLM (liveKBCheck, brief) runs 24/7; 2 unexplained masterTick runs on Sunday 19 Oct around 02:27/03:57 Madrid. | [V] workflows API + [M] runs |

---

## 13. Top 10 notable findings (no recommendations)

1. **Unauthenticated WhatsApp send path.** `sendMessage` skips the approval check when there is no user session (`sendMessage/entry.ts:166-170`, condition `&& user`). A caller with any session can bypass it with the header `x-caller: internal`. Combined with the service-role Graph token, this allows sending WhatsApp messages from the shop number without logging in. [V code; A: the function URL is publicly reachable, as is standard for Base44.]
2. **Several other service-role functions have no caller authentication:** logOutboundMessage (creates Conversations/Messages; the OUTBOUND_LOG_SECRET secret exists but is never checked), sendPush (push notifications to all staff devices), extractMemory (writes CustomerInsights), masterTick, autoKBExtract, liveKBCheck, evaluateAutoReply, retryFailedSends and others (§3). generateDraft's approval check can be bypassed with `x-caller: internal` (`generateDraft/entry.ts:66-69`), which returns AI drafts built from conversation and KB data. [V]
3. **The approval gate exists only on the client side.** Entity RLS grants full CRUD on Messages, Conversations, Customers (DNI, email), RepairOrder and CustomerInsights to any `user` role. UserProfile lets users update their own `approval_status`/`role`. [V entity jsonc]
4. **Live Meta access token (EAA… shape) and two other secrets remain in SystemSettings** (§5, §12a). [V]
5. **The off-hours auto-acknowledgement cannot run.** processAlerts only acks when the shop is closed (`processAlerts/entry.ts:177-183`), but masterTick invokes processAlerts only while open (`masterTick/entry.ts:119-126`). The same contradiction affects watchdog: it is invoked only while closed (`:145-147`) and returns `skipped_off_hours` when closed (`watchdog/entry.ts:80`). The dead-man switch therefore never evaluates. [V]
6. **The "central Gemini router" does not exist in practice.** All LLM calls go to Base44 `Core.InvokeLLM` (credit-billed). generateFAQ and the browser AISidebar call it directly. Gemini and OpenAI keys and settings are stale. About 32 LLM calls/day, a large share from liveKBCheck 24/7. [V/M]
7. **Review requests use the MARKETING template `resena_google`** without any marketing-consent check. watchdog defaults to the inactive marketing template `actualizacion_taller`. [V]
8. **The configured shop hours (09:30–14 / 17–20:30, Sat 10–14) differ from the stated hours (09–14 / 16–21).** The hours logic is duplicated in at least 8 function copies plus the frontend. [V]
9. **libraryAutoReply is in `live` mode:** it sends automatic replies to customers 24/7, outside the masterTick hours gate. `escalation_dry_run`=false, so real escalation WhatsApps go to staff. [V settings]
10. **Data and code hygiene:**
    - 16 empty entities and duplicate models (Customer/Customers, RepairJobs/RepairOrder).
    - ImportJobs has 0 rows and Conversations has only 1,500–2,499, versus the "~5,500 imported chats" claim.
    - The deleted `tmpReparoPing` was an unauthenticated Reparo PII lookup proxy, and its deployment status is unverified.
    - Hard-coded `_sched` shared secret and a staff phone number in a GitHub-synced repo.
    - 5 masterTick failures with opaque "user worker threw an exception".
    - [V/M]
