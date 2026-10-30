# Reparo — Phase 3: Speed & Stability (code side, read-only)

App `6ae22784825ce515812bcab8` · repo `/app` at `686fe92` · audited 2026-10-30.
Build made in a copy (`/tmp/sp`, `vite build --sourcemap`). Nothing in `/app` was written.
Tags: [VERIFIED] file:line · [MEASURED] number · [ASSUMPTION] needs confirmation.

**Overall:** the frontend is already tuned (lazy pages, server-side paging, persisted react-query cache, service worker). The main risks to daily counter use are **(a)** background request volume (tab counts every 60 s), **(b)** status changes that fail silently in two places, **(c)** lost updates on the `events[]` array, and **(d)** search running as an unindexed regex across 8 fields plus a count. Nothing silently truncates at the 5,000-row cap.

---

## 1. Build

| Metric | Value |
|---|---|
| Total JS | **1,543 KB raw / ~447 KB gzip**, 19 chunks [MEASURED] |
| CSS | 80 KB raw / 14 KB gzip (1 file) [MEASURED] |
| **First-load JS** (index.html: `index-*.js` + modulepreload `config-*.js`) | **693 KB raw / 226 KB gzip** + 14 KB CSS [MEASURED dist/index.html] |
| Inline script | Base44 page-view tracker, POSTs `/api/app-logs/...` on every navigation (plugin `analyticsTracker:true`, vite.config.js) [VERIFIED] |

**Top chunks** (raw / gzip, contents from sourcemap byte attribution) [MEASURED]:

| Chunk | Raw | Gzip | Main contents | When loaded |
|---|---|---|---|---|
| index (entry) | 539 KB | 169 KB | react-dom 126K, **@hello-pangea/dnd 78K**, react-router 38K, tailwind-merge 26K, tanstack 14K, radix menu/toast 22K, **input-otp 8K**, Tickets page + rows | first paint |
| Panel | 396 KB | 103 KB | **recharts 238K** + lodash 30K + d3-* ~55K + react-smooth 18K + decimal.js 13K | /panel (also warmed 4 s after load) |
| printEngine | 222 KB | 54 KB | **libphonenumber-js 117K**, **jsbarcode 63K**, qrcode 22K | opening a ticket / new-ticket form (static imports, see below) |
| config | 171 KB | 57 KB | axios 49K, @base44/sdk 33K, socket.io/engine.io ~40K, partysocket 7K, tanstack 19K | first paint (modulepreload) |
| Configuracion | 90 KB | 26 KB | config pages | admin only |
| TicketDrawer | 38 KB | 11 KB | ticket page | warmed 0.8 s after list |
| NewTicketDrawer | 35 KB | 11 KB | new-ticket form | warmed 0.8 s after list |
| Informes | 27 KB | 7 KB | reports UI (shares recharts with Panel) | /informes |
| Clientes | 13 KB | 4 KB | | /clientes |

**Code-splitting status**
- Panel, Clientes, Informes, Configuración are lazy, then all four are warmed 4 s after `load` (App.jsx:20-33) [VERIFIED]. On a slow counter PC the warm-up downloads ~130 KB gzip and parses about 500 KB of JS (recharts) in the background while staff are already working. That costs CPU, not first paint.
- **Eager but avoidable on first paint:**
  - `@hello-pangea/dnd` (78 KB raw) is used only by `ColumnsPopover.jsx` (column reordering), but Tickets.jsx:13 imports it statically.
  - Auth pages `Login`, `Register` (pulls `input-otp`), `ForgotPassword`, `ResetPassword`, `OAuthConsent` (338 lines) are imported statically in App.jsx:12-17, although a signed-in user never sees them.
- printEngine (54 KB gzip, mostly libphonenumber + jsbarcode) is imported **statically** by `NewTicketDrawer.jsx:18`, `TicketMoreMenu.jsx:8` (for `statusUrl` and `reviewUrl`, which are just string builders) and `TicketDrawer.jsx:13` (through printActions). So the first ticket opened also downloads the barcode/phone libraries. Warming hides this after the first visit.

**Heavy libraries used in one place:** recharts (Panel + Informes, already lazy); libphonenumber-js, jsbarcode, qrcode (printEngine only); @hello-pangea/dnd (ColumnsPopover only).

**Declared but never imported** (grep `from '<pkg>'` over src) [VERIFIED]: `jspdf`, `html2canvas`, `framer-motion`, `@stripe/react-stripe-js`, `@stripe/stripe-js`, `three`, `react-leaflet`, `react-quill-new`, `canvas-confetti`, `moment`, `lodash` (only reached transitively through recharts), `react-markdown`, `react-hot-toast`, `date-fns`, `zod`, `@hookform/resolvers`. Imported only by shadcn wrappers that nothing uses: `embla-carousel-react` (carousel), `cmdk` (command), `vaul` (drawer), `react-day-picker` (calendar), `sonner` + `next-themes` (sonner), `react-hook-form` (form), `react-resizable-panels` (resizable). Tree-shaking keeps all of these out of the bundle, so the **bundle cost is 0**. The cost is install/build time and supply-chain surface. `nitro` (beta) is a dev dependency that nothing uses.

**`public/` folder**: **6.1 MB** in the repo (`du`; the brief said 7.2 MB) [MEASURED]
- `tac/` 5.9 MB = 387 JSON shards (IMEI TAC → model, about 40 KB each). Fetched **one shard at a time**, only when an IMEI is typed (`imeiLookup.js:30`, `cache:'force-cache'`, and the service worker keeps it stale-while-revalidate). **Not loaded on first paint.**
- `nombres.json` 120 KB: loaded when the new-ticket name field mounts (ClientNameField.jsx:18). Not loaded on first paint.
- `estado.html` 13 KB, `resena.html` 11 KB (customer pages; on this host they sit behind login), `sw.js`, `manifest.json`, icons 15 KB.
- Verdict: public/ has **no effect on first load**. It only adds deploy size.

**Service worker** (`public/sw.js`): `/assets/*` cache-first, so repeat loads come from disk. Registered only on the published host (main.jsx:23). Good for the counter PC. Risk: a fixed `VERSION='reparo-static-v1'` is fine, because asset names are content-hashed and index.html is not cached.

---

## 2. Data loading per screen

**First load waterfall** [VERIFIED code]:
1. 240 KB gzip JS/CSS (disk after the first visit).
2. `getPublicSettings` → `auth.me()`, run **sequentially** (AuthContext.jsx:26-31, 84).
3. In parallel with step 2: `shopConfig` = 8 small list calls (config.js:62-71), prefetched in query-client.js:67.
4. When cfg arrives: list page (`filter` + `count`), **tab counts (1 + N presets, up to 2N calls)**, `distinct order_type`, `UserListSettings`, `unlockCode{can}` (function).
5. On reload, the persisted react-query cache (localStorage, 24 h, first page of each list) draws the list at once and refreshes it in the background (query-client.js:13-63) [VERIFIED]. So a **warm reload is close to instant**, and a cold first load is bounded by steps 2→4 (≈3 sequential round trips) [ASSUMPTION ≈1.5–2.5 s on shop broadband].

| Screen | Queries | Rows | Notes |
|---|---|---|---|
| **Tickets list** | `RepairOrder.filter(q, sort, pageSize, skip)` + `count(q)` (Tickets.jsx:31-36) | 50 (user page size) | Server-side paging, good. The next page is prefetched (l.113-119). Hovering a tab prefetches it (l.122-133), which is 2 more calls per hover. **Full documents** are returned (no field projection), so events[], fields{} and offer_items come with every row. About 2–4 KB per row → ~100–200 KB JSON per page [ASSUMPTION from a sample of events sizes]. `refetchInterval: 60 s` unless a menu is open (l.104). |
| **Tab counts** | `count({})` + per preset `count(strict)` and, when that is 0, `count(byStaff)` (Tickets.jsx:136-155) | — | Presets = 11 rows (OrderPreset) → **12–23 count calls every 60 s per open tab** [VERIFIED code + inventory]. Each count runs on 19.5k rows with `$in` on `fields.<uuid>` (unindexed). This is the largest background load: ~700–1,400 count requests/hour per idle PC, plus 120 list calls/hour. |
| **Open ticket** | `RepairOrder.filter({order_id})` (TicketDrawer.jsx:57), `refetchInterval: 30 s` (l.46). Initial data comes from the list cache, so it opens instantly | 1 | Plus TicketFiles `filter(order_id, 200)` and, on demand, ActionLog `filter(order_id, 200)`. No N+1. |
| **Clients** | `Client.list('-hc_created_at', 50, skip)` + `Client.count({})` (Clientes.jsx:29,33) | 50 | Search: `searchClients(text, 100)` = regex on full_name, dni, email, phone, plus a loose regex on raw_phone (ClientPicker.jsx:10-23). Debounce 300 ms. |
| **Client page** | `Client.get` + `RepairOrder.filter({$or:[client_id, client_hc_id]}, 200)` (ClientPage.jsx:30-38) | ≤200 | Saving a client loops `RepairOrder.update` **sequentially over each open order** (l.55-60). Fine for 1–5 orders. |
| **Panel** | `reports` function, cached 10 min in ReportCache + 5 min staleTime | — | On a cache miss, the dashboard reads the range + previous range + **all open orders (~6,300–7,000 rows [MEASURED by skip probes]) in sequential pages of 1,000** (reports:46-54, 200). ≈ 8–10 sequential DB pages, so likely several seconds when cold [ASSUMPTION]. It pages correctly, so **no truncation**. |
| **Search (tickets)** | `buildQuery` → `$or` of 8 **case-insensitive unanchored regexes** (customer_name, brand, model, averia, dni, IMEI field, model field) + `order_id` exact + `customer_phone` regex (≥4 digits) (listQuery.js:76-86). Runs as filter + count, and for numeric input also `filter({order_id})` to jump (Tickets.jsx:195-203). Debounce **350 ms** (l.86) | 50 | Each settled keystroke → 3 calls (filter, count, prefetch of page 2 = filter+count again → 5). Unindexed regex scan of 19.5k docs ×2 (filter and count). **The <300 ms target is unlikely** [ASSUMPTION; not measured with the staff session]. Phone search matches `customer_phone` only, not `client_phones[]`, so a second number of a client is not found from the ticket list. |
| **Search by order number** | `#39123` → exact `order_id` filter, opens the ticket | 1 | Fast path, good. |
| **New ticket** | `fieldSuggestions` fn → **`RepairOrder.filter({}, '-number', 1500)` with no field projection** (fieldSuggestions:12,36) | 1,500 full docs | Probably 3–6 MB read server-side per call [ASSUMPTION]. 15 calls since the last deploy [MEASURED]. Client cache 30 min. `nextOrderNumber` + clash check (orders.js:81-83). |

**5,000-row cap:** no list in the frontend asks for more than 1,000 rows. Server loops (`reports.loadAll`, `hcImport`, `dataScan`) page with skip. `Review.filter(..., 5000)` (reports:57) has 0 rows. `unlockCode bulk_set` `$in` ≤1000. **No silent truncation found** [VERIFIED].
**Polling summary per open tab:** list 60 s, counts 60 s, open ticket 30 s. `refetchOnWindowFocus:false`, retry 1 (query-client.js:3-9). Polling continues when the browser tab is hidden (react-query default `refetchIntervalInBackground:false` pauses it, so a hidden tab is OK [VERIFIED default]).
**Persisted cache cost:** every update to a persisted query triggers `dehydrate` + `JSON.stringify` of up to 4.5 MB into localStorage (debounced 1.5 s, query-client.js:42-58). With 60 s polling this is ~2 synchronous serialisations/minute on the main thread. That is fine on a modern PC but noticeable on a weak counter PC [ASSUMPTION].

---

## 3. Status change path

`changeStatus` (orders.js:35-43) [VERIFIED]:
1. **Awaited:** `RepairOrder.update(id, {status_*, is_open, closed_*, events:[...order.events, ev], hc_updated_at})` = 1 write. This is the only thing the UI waits for.
2. Not awaited: `ActionLog.create` (silent catch, config.js:194-199) = 1 write.
3. Not awaited: `functions.invoke('notifyWhatsApp')`. The function creates a queue row, **sleeps 60 s inside the request** (notifyWhatsApp:186), then does get + update(sending) + settings + order + status reads + WA Pro POST + ActionLog + queue update. The **UI does not wait for it**. The browser keeps the request open ~61–64 s. Queue data shows processed_at − due_at = **0.6–3.9 s** over 23 rows, so the real work after the sleep is 1–4 s [MEASURED WhatsAppQueue]. If the tab closes, the queue row is already written and the 5-min sweep sends it.
4. Then Tickets.jsx:205-210 invalidates `tickets`, `ticket` and `ticketCounts`, which refetches list + count + **12–23 counts**. The list does not update optimistically: the row keeps the old status pill until the refetch returns. The drawer path does update immediately (`setOrder`, TicketDrawer.jsx:68-75).

Writes per status change: 2 from the browser + ~4 in notifyWhatsApp (queue create, sending, done, ActionLog) ≈ **6 writes**.
**Expected latency:** one update ≈ 200–500 ms [ASSUMPTION], so the 500 ms target is reachable for the click itself. The list refresh after it adds another 0.5–2 s of count traffic.

**Bugs in this path**
- **Silent failure #1:** `TicketDrawer.changeTo` calls `applyStatus(s)` without returning or awaiting it (TicketDrawer.jsx:76-82). StatusSelect's try/catch → toast (ui.jsx:36) never sees the error. Result: an unhandled rejection in the console, no toast, and the spinner stops as if the change worked. The "Continuar" button of the missing-fields dialog has the same problem (l.206).
- **Silent failure #2:** the TicketRow context-menu item calls `onStatus(order, s)` with no catch (TicketRow.jsx:121, Tickets.jsx:205).
- **Lost update:** `events: [...(order.events || []), ev]` is built from the client's copy, which can be up to 60 s old (list poll). If PC A adds a comment and PC B changes the status from a stale row, B overwrites A's comment. The same applies to addComment, updateOrder, addEvent and edit/deleteComment (orders.js:45-64, 133-161). No version check, apart from the drawer's "changed by someone else" banner, which only warns after 2 minutes (TicketDrawer.jsx:58-61).

---

## 4. Reliability

- **Silent catches:** 44 `catch` sites with empty / `[]` / `null` handlers in src (excluding ui/) [MEASURED grep]. Most are acceptable (localStorage, warm-up, logging). **Dangerous ones:**
  1. `createOrder`: `saveUnlockCode(...).catch(() => {})` (orders.js:104). **The device passcode can be lost silently** when a ticket is created.
  2. `notifyStatus` swallows invoke errors (orders.js:127-132). If the invoke fails *before* the queue row exists (network, 401, 429), **no WhatsApp is sent and nothing is logged anywhere**.
  3. `logAction` swallows ActionLog failures (config.js:194-199). The audit trail can have gaps.
  4. `linkWarranty(...).catch(() => {})` (orders.js:107): the warranty link is dropped silently.
  5. `RepairOrder.count(...).catch(() => null)` (Tickets.jsx:35): a failing count shows "Página 1" with no total and no error.
  6. Functions: `publicStatus` / `waLookup` turn DB errors into "not found" (inventory §3). `notifyWhatsApp` `.catch(() => {})` on queue updates (l.81, 132): if `finish()` fails, the row stays `sending`, the sweep resets it after 5 min, and **it may resend** (see idempotency).
- **Retries:** react-query retry 1 for reads. **No retry or backoff on any frontend write** (status, comment, create). `hcImport` is the only frontend code with retry (hcImport.js). Functions: notifyWhatsApp 3×/2 min. syncHelloClient 3× (dormant).
- **UTC without "Z":** there is **no parse helper**. App-written fields (`hc_*_at`, `estimated_at`, `closed_at`, `events[].at`, `due_at`) are written with `toISOString()` and carry `Z` [MEASURED sample]. The platform fields `created_date` / `updated_date` come back **without Z** [MEASURED WhatsAppQueue rows]. They are used as fallbacks with `new Date(v)` in TicketRow.jsx:48, TicketExtraSection.jsx:60, Clientes.jsx:81,106, ClientPage.jsx:140, printEngine.js:186,205. In the browser this parses as **local time (Madrid)**, so it is 1–2 h off. Impact is low today because `hc_*` is always set on imported and app rows. `publicStatus:26` and `waLookup:86` also return raw `created_date` as a fallback to external pages.
- **Rate limit (50 writes/min):** bulk status change (BulkBar.jsx:22-24) runs sequentially, ~6 writes per ticket (2 browser + ~4 server) → **about 8 tickets/min reaches 50 writes/min** if the limit counts all writes [ASSUMPTION on limit scope]. A 429 aborts the loop halfway ("No se pudo completar") with no resume and no backoff. The 60-s sleeping notify calls also pile up (one open request per ticket).
- **Idempotency:**
  - Order numbers: `nextOrderNumber` (read max) + clash check + create is **not atomic** (orders.js:81-83). Two counters saving at the same second can produce **duplicate order_id**.
  - WhatsApp: pending→sending is not atomic (inventory #8). A stuck `sending` row is retried after 5 min even if WA Pro already sent it, so a **double message is possible**.
  - The client save loop (ClientPage.jsx:55-60) is partial on failure.
- **Unlogged sends:** manual "send status/review link" opens `wa.me` with no ActionLog (TicketMoreMenu.jsx:43-46, inventory §7). An invoke failure of notifyWhatsApp before queueing leaves no trace (above).

---

## 5. Function performance (logs since last deploy ≈ 2026-10-29 19:03 UTC)

Logs give only `POST → status` lines, no durations. Durations come from workflow steps and WhatsAppQueue timestamps.

| Function | Invocations (since deploy) | Duration | Errors |
|---|---|---|---|
| notifyWhatsApp | ≥40 lines (≈12/h sweep + ~14 user events today) [MEASURED] | user path ≈ 60 s sleep + **0.6–3.9 s** work [MEASURED queue]. Sweep step in workflow 17–80 s [MEASURED] | 0 error lines [MEASURED level=error] |
| syncHelloClient | every 5 min | workflow step **29–33 s** for code that does `auth.me` + 1 settings read and returns `skipped:'cutover'` [MEASURED] | 0 |
| unlockCode | 38 calls [MEASURED] | n/a | 0 non-200 |
| fieldSuggestions | 15 calls [MEASURED] | n/a (1,500 full docs per call) | 0 non-200 |
| reports | **0 lines** (Panel not opened since deploy, or served from client cache) | n/a | — |
| publicStatus / publicReview / waLookup / importBatch / linkClients | 0 lines (inventory) | — | — |

**Why the 5-min workflow takes ~65 s** (avg 65.2 s over 247 runs, 0 failed [MEASURED stats]): run 10:45 = step 1 29.5 s + step 2 80.3 s; run 10:35 = 33.2 s + 16.8 s [MEASURED run detail]. The code in both steps is a handful of DB calls (the sweep found nothing pending: all 23 queue rows are done/skipped). So **almost all of the time is platform overhead per workflow "call" step** (function cold start / dispatch), not Reparo code [ASSUMPTION, strongly suggested by the user-path timings of 1–4 s for the same function]. Fix: drop step 1 (no-op since cutover), which halves the steps. Better: drop the workflow entirely, or run the sweep only every 15 min during opening hours, since the in-request path handled 23/23 sends.

---

## 6. Top 10 speed/stability fixes (ranked by counter impact)

| # | Fix | Evidence | Expected gain | Effort | Risk |
|---|---|---|---|---|---|
| 1 | **Make status-change failures visible**: return/await `applyStatus` in `changeTo` and the "Continuar" button, and catch + toast in the TicketRow menu path | TicketDrawer.jsx:75-82,206; TicketRow.jsx:121 | Removes 0-silent-failures violations on the most frequent action. Stops the console errors | S | Low |
| 2 | **Stop the `events[]` lost update**: re-read the order (or check `hc_updated_at`) right before writing events, or move history to its own entity (append-only) | orders.js:36-37,46-48,57-61,135-161 | Prevents silently lost comments/status history when 2+ PCs work the same ticket | M | Med |
| 3 | **Cut tab-count traffic**: one `count` per tab every 2–5 min, store the "byStaff" fallback decision instead of recomputing it, skip when the tab is hidden, or compute all counts in one `reports`-style function with a 60 s cache | Tickets.jsx:136-155 (12–23 calls/min) | ~90 % fewer background requests per PC. Faster list refresh after each status change (fewer concurrent counts) | S | Low |
| 4 | **Search: anchor and narrow the regex.** Digits only → `order_id` / phone / IMEI prefix (`^`). Text → name/brand/model only, skip `count` while typing (show "50+"), no next-page prefetch for searches, debounce 250 ms. Add phone match on `client_phones` | listQuery.js:76-86; Tickets.jsx:86,113-119 | From 5 unindexed scans per keystroke to 1–2 smaller ones. Likely needed to approach <300 ms | M | Low |
| 5 | **Don't swallow notify/unlock-code errors**: toast + ActionLog when `notifyWhatsApp` invoke or `saveUnlockCode` fails. Or queue the WA row from the browser (one create) and let a function send it | orders.js:104,106,127-132 | 0 lost passcodes and 0 untraced unsent WhatsApps | S | Low |
| 6 | **Atomic order numbers**: generate the number server-side in a function with retry-on-duplicate (or a counter row updated with a check) | orders.js:81-83, config.js:183-186 | Removes duplicate ticket numbers when two counters save together | M | Med |
| 7 | **Remove the dead workflow step / slow the sweep**: drop `syncHelloClient` step. Run the sweep every 15 min, 10:00–14:00/17:00–20:30 only | workflow runs 29–33 s step 1, 65 s avg, 0.3 credit/run | ~50 % credits and time per run immediately. ~80 % with a smaller schedule. No user-visible change | S | Low |
| 8 | **Bulk actions with backoff**: throttle to ≤6 tickets/min or batch, retry on 429, resume from the failed item; skip notify for bulk or debounce it | BulkBar.jsx:17-34 | Bulk status change of 20+ tickets stops failing halfway | S | Low |
| 9 | **Trim first load and first ticket open**: lazy-load ColumnsPopover (dnd 78 KB) and the 5 auth pages; move `statusUrl` / `reviewUrl` out of printEngine so the ticket drawer doesn't pull libphonenumber/jsbarcode; delay the 4-s warm-up of Panel/recharts until idle *and* after first interaction | Tickets.jsx:13, App.jsx:12-17,31-33, TicketMoreMenu.jsx:8, NewTicketDrawer.jsx:18 | −30 KB gzip / ~110 KB parse on first paint (~5–10 %). −54 KB gzip on the first ticket open on a cold cache. Less CPU contention on a slow PC | S | Low |
| 10 | **Project fields on big reads**: list rows without `events`/`offer_items` (load those in the drawer). `fieldSuggestions` with `fields:[...]` and 500 rows. Add a `parseUtc` helper for `created_date`/`updated_date` | Tickets.jsx:34; fieldSuggestions:36; fallbacks listed in §4 | ~50 % smaller list payloads and faster persisted-cache writes. fieldSuggestions from MBs to ~100 KB. Correct times on rows without hc_* | M | Low |

Also (hygiene, no runtime gain): remove the ~16 unused dependencies and 7 unused shadcn wrappers.

**Not verified (needs a staff session on the counter PC):** real first-load time, search latency, update latency, console errors at runtime. Run a DevTools trace (Network + Performance) on the counter PC with the published app to confirm the estimates above.
