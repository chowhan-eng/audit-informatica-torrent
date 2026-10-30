# Phase 5 — Usage, unused & duplicated features

Date: 2026-10-30 · Auditor: Claude Code · Mode: **read-only** (only GET/query calls; nothing changed in any app).
Tags: **[VERIFIED]** code/data · **[MEASURED]** measured · **[ASSUMPTION]** to confirm.
No personal data reproduced. **Joney confirms every removal**; the rule is hide → wait 30 days → remove code; data is archived, never deleted.

## 0. Evidence sources and their limits

| Source | What it shows | Limit |
|---|---|---|
| Base44 analytics, `page_url` of all events, 31 Aug → 30 Oct (60 days) [MEASURED] | Which screens staff actually had open (heartbeat/session events carry the current URL, so counts ≈ time spent per screen) | No explicit `page_view` events. A screen opened briefly between heartbeats may not appear. Window is shorter for young apps: **TPV 16 days** (created 14 Oct), **Reparo 2 days** (28 Oct), **Mostrador 1 day** (29 Oct). |
| Function logs (`functions-mgmt/.../logs`) [MEASURED] | Calls since each function's **latest deployment** | Reparo/TPV: only ~1.5 days (last deploy 29 Oct). **WhatsApp Pro returns no logs at all** (older runtime), so not used for it. |
| WhatsApp Pro `WebhookLogs.source`, 60 days [MEASURED] | Functions that log their own activity | Many functions do not log; absence ≠ unused. |
| Newest write per entity (`-updated_date`) [MEASURED] | Whether a feature produced data in the last 60 days | Strong evidence for features that must write to work. |
| Code callers (`functions.invoke`, routes, masterTick job map) [VERIFIED] | Whether anything can still call a function | — |

Screen usage, 60 days (counts of analytics events by URL) [MEASURED]:
- **WhatsApp Pro** (2,498 events): `/conversaciones` 1,115 · `/` (Dashboard) 383 · `/login` 74 · `/triaje` 28 · `/importar-helloclient` 12 · `/esperando`, `/auto-reply`, `/respuestas-rapidas`, `/pedidos` 3 each · `/chatbot`, `/clientes`, `/conocimiento`, `/plantillas`, `/campanas`, `/ajustes`, `/reservas-vacaciones`, `/importar`, `/usuarios`, `/sudo`, `/logs`, `/revision-kb` 1 each · **0**: `/ventas`, `/inventario`, `/tareas`, `/taller`, `/biblioteca`, `/pedidos/nuevo`, `/pedidos/:id`.
- **Reparo** (464, 2 days): `/tickets` (+ open ticket) ~94 · `/login` 81 · `/configuracion/importar` 16 (cutover) · `/tickets/nuevo` 6 · `/configuracion/general` 4 · `/configuracion/datos` 4 · `/panel` 1 · `/configuracion/whatsapp` 1 · **0**: `/clientes`, `/informes`.
- **TPV** (343, 16 days): `/tpv` 65 · `/` 52 · `/venta` 12 · `/ajustes` 7 · `/caja` 5 · `/documentos` 5 · `/inicio` 4 · `/clientes` 3 · `/articulos` 2 · **0**: `/stock`, `/compras`, `/proveedores`, `/unidades`, `/informes`, `/senales`, `/vales`, `/tickets`, `/familias`.
- **Mostrador** (97, 1 day): `/` only.

---

## 1. Key findings (before the table)

1. **[MEASURED] The WhatsApp Pro auto-reply in "live" mode has sent 0 messages since 2 Oct.** The last 500 evaluations (19–30 Oct, ≈45 per day) all ended `blocked`: ~55 % `no_library_match`, the rest `draft_only` or `not_live` (the topic exists but is not enabled for live sending; e.g. *horario* scored 3–6 and was still `not_live`). Each evaluation still runs a Reparo lookup and writes an `AutoReplyLog` row, 24/7. → the feature costs runs and gives nothing today. Decision belongs to Phase 7/8 (enable 2–3 safe topics, or turn evaluation off).
2. **[MEASURED] Voice alerts are dead.** `VoiceQueue` gets new rows every day (latest 30 Oct 11:32 UTC) but **nothing has been spoken since 18 Jun** (`spoken=true` newest 2026-06-18): the local `voice_client.py` stopped polling. `processAlerts` still writes (and, for voice translation, may call the LLM, `processAlerts:68`) for nobody.
3. **[MEASURED] The website stopped pulling the content feed on 26 Sep** (`exportContentSignals` last logged access), but `buildContentSignals` still runs every Monday 05:00 with one LLM call (last 26 Oct).
4. **[MEASURED] `flowExecutor` (chatbot flows) only produces errors**: 5 "error no controlado" (14, 26, 27 Oct) and nothing else, while the setting `chatbot_flows_enabled=false`. It is still invoked on **every inbound message** by the webhook (`whatsappWebhook:442`).
5. **[VERIFIED] WhatsApp Pro still contains a complete second repair-order system and a mini-POS**: `/pedidos`, `/pedidos/nuevo` (creates `RepairOrder` in WhatsApp Pro, with its own order numbering, `shopConfig.js:103`), `/pedidos/:id`, `/taller` (print templates, employees, lists), `/tareas` (ShopTask), `/ventas` (creates `Sale` and changes `Product.stock` from the browser), `/inventario`. Usage: 3 visits to `/pedidos`, 0 to the rest; **no order created or updated there since the cutover** (last manual order 12 Jul) [MEASURED]. Risk if someone uses it: orders and stock outside Reparo/TPV.
6. **[VERIFIED] Dashboard "Escanear HelloClient" button** (`Dashboard.jsx:16,62-84`) still calls `pollHelloClient` from the browser using the old host `app--informatica-torrent-crm.base44.app`. HelloClient is switched off; the button can only show "Sesión HelloClient caducada" or do nothing.
7. **[MEASURED] NPS never worked**: `SatisfactionSurveys` rows are created by `sendNPS` (`:46`) and all stay `pending`; `sendNPS` was paused today (CHANGELOG #2). `survey_auto_send=false`.
8. **[MEASURED, to confirm] Reparo `waLookup` shows 0 calls since Reparo's last deploy (29 Oct 19:12 UTC)**, although WhatsApp Pro calls it from `clientCard` every time a chat is opened, plus `sendMessage`, `generateDraft`, `libraryAutoReply`, `customerOverview`. Every caller swallows errors and returns an empty card. Either the calls do not reach Reparo or this function's log is not captured (`unlockCode` and `notifyWhatsApp` do log). **Check:** open one chat of a known Reparo customer in WhatsApp Pro and see if the "Reparo" card shows orders. If not, the new "Ficha del chat: cliente y pedidos desde Reparo" (29 Oct) is silently broken → P1 fix, not a removal.
9. **[VERIFIED] The same LLM-call block is copied byte-for-byte into 10 WhatsApp Pro functions** (comment in `autoKBExtract:320`, `autoLearn:111`, …), and the shop-hours/template helper into 7 (`autoKBExtract:267`). Any change (e.g. a real Gemini router, anonymiser) must be made 10 times today.

---

## 2. Keep / merge / hide / remove table

Effort S < 2 h · M ½–2 days. "Saving" = credits, Meta fees, LLM calls, or risk removed. IDs `U-xx` are for Joney's yes/no.

### 2.1 WhatsApp Pro

| ID | Feature | Evidence of use (60 d) | Recommendation | Risk of change | Saving |
|---|---|---|---|---|---|
| U-01 | Inbox `/conversaciones`, `/triaje`, `/esperando`, `sendMessage`, webhook, templates, quick replies | Main screen (1,115 + 28 + 3 events); daily sends | **Keep** | — | — |
| U-02 | Orders `/pedidos`, `/pedidos/nuevo`, `/pedidos/:id` (local `RepairOrder` mirror) | 3 visits; 0 writes since cutover; mirror frozen 29 Oct | **Hide now** (menu + routes), later remove; replace with "Ver reparaciones" via Reparo lookup | Low (Reparo is master) | Removes a second place to create orders |
| U-03 | `/ventas`, `/inventario` (Sale/Product, browser stock writes) | 0 visits; Sale = 0, Product = 0 rows | **Hide → remove** (TPV is the POS) | Low | Removes stock writes outside TPV |
| U-04 | `/tareas` (ShopTask) | 0 visits; 0 rows | **Hide → remove**; Pendientes lives in TPV | Low | — |
| U-05 | `/taller` (print templates, employees, handbooks) + `src/lib/shop/*` | 0 visits; PrintTemplate/Employee/Handbook 0 rows | **Hide → remove** (Reparo has them) | Low | — |
| U-06 | `unlockCode` function + `DeviceUnlockCode` copy (1k+ rows) | Callers only in WA `src/lib/shop` (U-05); Reparo is master | **Hide → remove function; archive table** (see SEC-11) | Low | Removes a second store of passcodes |
| U-07 | HelloClient code: `pollHelloClient` (still run every open tick, returns `app_is_master`), `helloClientLogin`, `hcImportBatch`, reparoBridge `hc` proxy, `/importar-helloclient` page (12 visits, cutover), Dashboard "Escanear" button, `watchdog` (checks HelloClient freshness), `Shop*` mirror entities (0 rows), HC settings, `HC_SESSION_FULL` secret | HelloClient off since 29 Oct; watchdog cannot run (Phase 1) | **Remove from masterTick now; hide pages/button; remove code after 30 days**; revoke the HC session secret | Low; keep the importer until Joney confirms the HelloClient export is complete | Shorter masterTick (144 runs/day); one less 1,011-line function |
| U-08 | `syncMessages` (Whapi.cloud) | No caller anywhere; token setting absent | **Remove** | None | — |
| U-09 | `extractMemory` + `CustomerInsights` | No caller anywhere; last write 26 May | **Remove function; archive table** (also a GDPR profiling risk, SEC-19) | None | — |
| U-10 | `flowExecutor` + ChatbotFlows + `/chatbot` | 1 visit; flows disabled; only errors; still invoked per inbound message | **Hide**; stop invoking from the webhook | Low | 1 invocation per inbound message (~150/day) |
| U-11 | Auto-reply live `libraryAutoReply` + AnswerLibrary + `/auto-reply`, `/biblioteca`, `libraryShadowReport`, `evaluateAutoReply` (mode off) | 0 sends in 500 evaluations; `/biblioteca` 0 visits; shadow report is an obsolete go-live gate | **Merge**: one "suggested answer" engine shared with drafts (Phase 8); remove `libraryShadowReport`; keep AnswerLibrary content | Medium: decide which topics may go live (Joney) | ~45 Reparo lookups + 45 log rows/day; 1 masterTick job |
| U-12 | Broadcasts `/campanas`, `processBroadcasts` | 1 visit; last campaign 26 May (seed) | **Hide** until a consented campaign is planned; stop running every 3rd tick | Low | ~48 job runs/day |
| U-13 | NPS `sendNPS`, SatisfactionSurveys, NPS settings | Never sent (all `pending`); paused today | **Remove after 30 days**, or rewrite only if Joney wants NPS | None | Already paused |
| U-14 | Scheduled messages (`ScheduledMessages`, `sendScheduledMessages`) | Last row 2 Oct | **Keep** (cheap, useful), but run every 3rd tick | — | ~96 job runs/day |
| U-15 | Voice alerts: VoiceQueue writes, `getUnspokenVoiceAlerts`, `getUnspokenAlerts`, voice translation in `processAlerts` | Nothing spoken since 18 Jun | **Hide** (stop writing VoiceQueue + translation); ask Joney if the voice PC will return | Low | Daily rows + possible LLM calls |
| U-16 | Content feed `buildContentSignals` (weekly LLM) + `exportContentSignals` | Website stopped pulling on 26 Sep | **Pause workflow**; ask Joney if the website still needs it | None | 4 LLM runs/month |
| U-17 | Legacy ingestion `ingestChatHistory`, `ingestChatKnowledge`, `ingestClientFromShop` (ShopManager.py), `importChats` + `/importar`, ImportJobs (0 rows) | No log lines in 60 days (they log every call); 1 visit to `/importar` | **Hide → remove** after Joney confirms the history import is finished (Phase 8 needs the KB, not these) | Low | Removes IMPORT_SECRET attack surface |
| U-18 | `autoLearn` (frontend calls it after each sent reply; `autolearn_enabled=false`) | Returns early | **Remove call or merge into Phase 8 learning loop** | None | 1 call per staff reply |
| U-19 | `generateFAQ`, `suggestButtons`, `sudoCommand`/`getAIReply`, `/sudo`, `/logs` | 1 visit each to `/sudo`, `/logs` | **Keep** (admin tools, on demand) | — | — |
| U-20 | `serviceRecoverySweep` (Ajustes card) | Ran once, 15 Sep (8 sent) | **Keep** (manual, admin) | — | — |
| U-21 | Push to staff (`sendPush`, PushSubscriptions) | Subscription updated 30 Oct | **Keep** (after adding auth, SEC-02) | — | — |
| U-22 | `orderStatus` + WA `/estado.html` (reads frozen mirror) | Unknown callers (old QRs) | **Redirect** to the Estado/Reparo status page, then remove | Medium: old QR codes in customers' hands | Ends stale status shown to customers |
| U-23 | `Customer` entity (0 rows), `RepairJobs` (seed), `AgentProfiles`, `CustomFieldDefs` (0), `OrderPreset`/`PrintTemplate`/`Product`/`Sale`/`RepairCache`/`RepairLookupQueue`/`SentNotification` (0), `DraftQueue` (last 12 Jun) | 0 rows or no writes for months | **Remove schemas after 30 days** (empty) / archive | None | Simpler schema |
| U-24 | 9 inactive legacy workflow files | Inactive since 28 Jun | **Remove files** | None | — |

### 2.2 Reparo

| ID | Feature | Evidence of use | Recommendation | Risk | Saving |
|---|---|---|---|---|---|
| U-30 | Tickets, new ticket, status change, `notifyWhatsApp`, `unlockCode`, `fieldSuggestions` | Main screen; notify/unlock logged today | **Keep** | — | — |
| U-31 | Workflow step 1 `syncHelloClient` (+ HcSyncCard, Cambio/undo cutover, `linkClients`, `importBatch`, `Importar` page, `hcImport.js`) | No-op since cutover; importer used 16× during cutover | **Remove step 1 now**; move sweep inside shop hours; hide importer/cutover screens after Joney confirms no re-import | Low | ~1,200 credits/month (Phase 1) |
| U-32 | `Product`, `Sale`, `ShopTask` entities (routes already removed) | 0 rows | **Remove schemas** after 30 days | None | Closes user-writable empty tables |
| U-33 | Reviews: `publicReview`, `resena.html`, `Review` (0 rows), `shop_reviews` not set | Never used | **Merge** with the single review flow (WA Pro `sendDueReviews`, consent first — SEC-06); hide Reparo's until decided | Low | One review flow instead of three |
| U-34 | `/informes`, `/clientes`, `/panel` (`reports`) | 0 / 0 / 1 visits in 2 days | **Keep, re-measure after 30 days** (too early) | — | — |
| U-35 | `TicketFile` (photos), `PrintTemplateVersion` | 0 rows | **Keep** (photos are a Phase 6 need); re-check in 30 days | — | — |

### 2.3 TPV

| ID | Feature | Evidence of use | Recommendation | Risk | Saving |
|---|---|---|---|---|---|
| U-40 | `/tpv` (desktop), `/venta` (touch), caja, invoices, refunds, price edits, Pendientes, daily report | 65 / 12 visits; 99 sales, 4 invoices, 3 refunds, 3 price changes, Z closes | **Keep** (both sale screens: desktop vs mobile) | — | — |
| U-41 | `cleanupTestData`, `zzImportTest`, `zzPbkdf2Test` | One-shot / test | **Remove now** (SEC-20) | None | Removes counter-reset risk |
| U-42 | Doscar restore (`/ajustes` tab, `src/lib/doscar/*`, 1,237 lines, browser bulk writes) | Last import 28 Oct | **Hide after Joney confirms Doscar is fully migrated; remove after 30 days** | Low | Removes browser stock writes |
| U-43 | Stripe payment links (`createPaymentLink`, `stripeWebhook`, parked-sale flow) | Not configured (no secrets); 0 parked sales | **Hide** until Joney wants card links | None | — |
| U-44 | HelloClient lookup (`helloClientLookup`) | Not configured; HelloClient off | **Remove**; replace with Reparo lookup ("Cobrar en TPV", Phase 6) | None | — |
| U-45 | Purchasing `/compras`, `/proveedores`, `receivePurchase`, PurchaseOrder (0) | 0 visits; 0 rows (21 suppliers imported) | **Keep hidden in menu? → ask Joney** (does he order stock through the TPV?) | — | — |
| U-46 | Units `/unidades` (SerialUnit, buy from customer) | 0 visits; 0 rows | **Ask Joney** (REBU second-hand question, AUDIT §9); hide if not used | — | — |
| U-47 | Quotes/docs `Document` (0), señales `Deposit` (0), vales `Voucher` (0), `CashMovement` (0), `/stock` adjustments (0 adjust movements) | 0 rows in 16 days | **Keep** (core POS functions, young app); fix SEC-09 first; re-measure in 30 days | — | — |
| U-48 | Verifactu panel/functions | Off until 2027 by decision | **Keep (off)** | — | — |
| U-49 | Settings duplicate row (orphan) | 2 rows, readers use oldest | **Archive orphan row** | Low | Avoids wrong-row edits |

### 2.4 Mostrador, Estado and other apps

| ID | Feature | Evidence | Recommendation |
|---|---|---|---|
| U-50 | Mostrador unused `search()` (`destinations.js:80-128`), unused auth pages, unused UI libs | Dead since 29 Oct | **Remove** (or reuse for the Phase 6 global search) |
| U-51 | Estado app source = empty starter; live pages only in deployed site | — | **Keep app, put pages in source** (SEC-21) |
| U-52 | Other Base44 apps overlapping the scope — **list only, Joney decides**: RepairTrack Pro, SyncRepair, App Hub, Informática Torrent Companion, Informática Torrent Portal, InventoryPro, SUDO Command Center (0 analytics events in 60 days); TorrentConnect (1 event); Inventario Visual Torrent (17 load events, ask who opens it) | [MEASURED analytics] | **Candidates to archive** |

---

## 3. Duplicated features across apps

| Feature | Where it exists today | Recommendation |
|---|---|---|
| Repair orders | Reparo (master, 19.5k) · WhatsApp Pro `RepairOrder`/`OrderState` mirror + `/pedidos` + `orderStatus` | Reparo only; WA reads via `waLookup` (U-02, U-22) |
| Customers | Reparo `Client` · WA `Customers` (+ empty `Customer`) · TPV `Customer` | One key (E.164 phone), masters per field (Phase 2 customer-identity.md) |
| Sales / stock | TPV (master) · WA `/ventas`, `/inventario` · Reparo empty `Sale`/`Product` | TPV only (U-03, U-32) |
| Tasks / pending | TPV `PendingTask` (used) · WA `ShopTask` (0) · Reparo `ShopTask` (0) | TPV Pendientes only (U-04, U-32) |
| Unlock codes | Reparo (master) · WA copy + `unlockCode` | Reparo only (U-06) |
| Print templates / employees / lists | Reparo (used) · WA `/taller` (0 rows) | Reparo only (U-05) |
| Customer status page | Estado host → Reparo `publicStatus` · WA `orderStatus` (stale) | One page (U-22) |
| Review requests | WA `sendDueReviews` (sends) · Reparo `publicReview`/`resena.html` (0) · Reparo status "Entregado + Reseña" · TPV staff reminder + per-device counter | One flow with consent (U-33, SEC-06) |
| WhatsApp sending paths | WA `sendMessage` · `reparoBridge` · `tpvWhatsappRelay` · `pollHelloClient` (dead) · direct Graph calls in `masterTick`, `escalateWaiting`, `watchdog` · TPV direct-Graph branch (token unset) · Reparo manual `wa.me` links | Every send through one WA Pro sender with logging + FailedSend (Phase 7) |
| Templates / hours settings | MessageTemplates vs SystemSettings vs hard-coded fallbacks; `shop_hours` vs `business_hours_*` vs ≥8 code copies | One store each (Phase 1 §7–8) |
| LLM calls | 10 byte-identical `invokeLLM` copies + 2 direct `Core.InvokeLLM` (generateFAQ, browser AISidebar); no router | One shared helper in `base44/shared/` with model choice + anonymiser (Phase 8) |
| Importers | Reparo HC importer · WA HC importer + chat importers · TPV Doscar restore | Hide all once migrations are confirmed (U-07, U-17, U-31, U-42) |
| Report e-mails / digests | TPV daily, weekly stock, cash-not-closed · WA EOD digest (`NotificationQueue eod_digest`) | Merge into one morning brief (Phase 7 item 10) |
| Staff alerts | WA `NotificationQueue` (~100 alerts/day: new_message, reminder1, reminder2) + escalation WhatsApps + push · TPV Pendientes WhatsApp | Review volume in Phase 7 (alert fatigue risk) |
| App switcher | `appSwitcher.js` copied in 3 apps | Keep; note it must be changed 3× |

---

## 4. Estimated saving if all "remove/hide" items are approved

| Item | Today | After | Saving |
|---|---|---|---|
| Reparo workflow HelloClient step + off-hours runs | 156 runs/day × 0.3 credits | sweep only, shop hours | ≈ 1,000–1,200 credits/month [MEASURED basis, Phase 1] |
| masterTick jobs (pollHelloClient, watchdog, libraryShadowReport, processBroadcasts, sendNPS) | run every tick / 3rd / 6th / 12th | removed or paused | shorter ticks; masterTick 0.1–0.2 credits/run is per run, so the credit saving is small, but rate-limit pressure drops (Phase 3 S1) [ASSUMPTION] |
| Per-message work (flowExecutor, libraryAutoReply evaluation, autoLearn) | ~150 + 45 + n calls/day | 0 until re-enabled | fewer function runs and fewer `entity_list` calls per inbound message |
| Weekly content-signals LLM | 4 runs/month | 0 | small |
| Code size | WA Pro: ~10 functions + ~10 pages + ~15 entities removable | — | smaller 1.37 MB bundle (Phase 3), less to secure (Phase 4) |

Running cost is computed in Phase 7 together with the automation catalogue.

## 5. Questions for Joney (only for this phase)
1. ¿Habéis terminado de importar todo de HelloClient y de Doscar? (Si sí, ocultamos los importadores.)
2. ¿Se usa en el TPV la parte de compras/proveedores y la de compra de móviles a clientes (unidades)?
3. ¿Sigue haciendo falta el aviso por voz en el PC (no habla desde junio) y el "feed" de contenidos para la web (la web dejó de pedirlo el 26 sep)?
4. Respuesta automática: ¿qué 2–3 temas pueden contestarse solos (p. ej. horario, dirección), o la apagamos y dejamos solo borradores?
5. ¿Quién abre "Inventario Visual Torrent"? ¿Archivamos las otras apps de la lista U-52?
