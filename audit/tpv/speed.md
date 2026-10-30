# TPV Informática Torrent: Phase 3, speed and stability (code side, read-only)

App `6acf624e6e89e6f32c43243f` · audited 2026-10-30 · build analysed in a copy at `/tmp/sp` (`vite build --sourcemap` + `source-map-explorer`). Nothing in `/app` was written.
Tags: [VERIFIED] file:line · [MEASURED] build output, live data or API · [ASSUMPTION] estimate, not proven.
No personal data appears below.

---

## 1. Build

### 1.1 First-load JS (what loads before `/tpv` or `/venta` can be used)

`/tpv` (VentaRapida), `/venta` (Venta) and `/` (Inicio) are imported **eagerly** in `src/App.jsx:21-23`. All other pages use `lazy()` (`App.jsx:25-38`). So both sale screens are in the entry chunk and no extra chunk is needed to show them. [VERIFIED]

| What loads | Raw | Gzip |
|---|---|---|
| Entry `index-*.js` + 8 modulepreloads (jsx-runtime, base44Client, button, 5 icon chunks) | **630 KB** | **193 KB** |
| CSS `index-*.css` | 87 KB | 15 KB |
| **Total before first paint** | ~717 KB | **~208 KB** [MEASURED] |

What is in the entry chunk (459 KB raw): react-dom 126 K, `src/components/venta` 75 K, VentaRapida 34 K, react-query 23 K, lucide 16 K, `src/components/documentos` 16 K (NuevaFacturaDialog is imported statically by VentaRapida), Venta 13 K, print lib 10 K, radix toast 10 K, router 19 K, input-otp 8 K. base44Client (133 K) is mostly axios 49 K + SDK 33 K + socket.io/engine.io 37 K (realtime). [MEASURED]

**The bundle is not the bottleneck.** About 208 KB gzip loads in about 0.3–0.6 s on shop broadband, and a repeat visit uses the HTTP cache (hashed assets). [ASSUMPTION] What blocks the sale screen is the **catalogue download** (§2).

### 1.2 Top chunks

| # | Chunk | Raw | Gzip | Main contents | On the sale path? |
|---|---|---|---|---|---|
| 1 | index (entry) | 459 K | 134 K | react-dom, Venta/VentaRapida, venta components | **yes** |
| 2 | xlsx | 437 K | 142 K | SheetJS | no (Informes, DoscarRestore only) |
| 3 | Informes | 386 K | 103 K | recharts 222 K, lodash 29 K, d3-* | no (lazy) |
| 4 | DoscarRestore | 357 K | 107 K | pako, stream-browserify, fast-xml-parser, node polyfills, mdb-reader | no (lazy, inside Ajustes) |
| 5 | base44Client | 133 K | 44 K | axios, @base44/sdk, socket.io | **yes** |
| 6 | Documentos | 42 K | 9 K | | no |
| 7 | Caja | 41 K | 10 K | | no |
| 8 | Articulos | 31 K | 8 K | | no |
| 9 | Clientes | 30 K | 7 K | | no |
| 10 | button | 29 K | 9 K | tailwind-merge 25 K | **yes** |

[MEASURED] `dist/assets` from the build, 119 chunks in total.

- **xlsx, recharts, the Doscar code (pako, mdb-reader, fast-xml-parser) are kept off the sale path.** xlsx is imported statically only by the Informes and DoscarRestore chunks. The entry chunk lists it only in Vite's preload map for those lazy routes. [MEASURED] `grep from"./xlsx` → only `Informes-*.js`, `DoscarRestore-*.js`
- **jspdf and html2canvas are not imported anywhere in `src/`** (0 matches). Tickets are printed as plain text in a hidden iframe, and PDFs are built on the server (`shared/documentPdf.ts`). [VERIFIED]
- **Unused dependencies** (0 imports in `src/`): `@hello-pangea/dnd`, `@stripe/react-stripe-js`, `@stripe/stripe-js`, `canvas-confetti`, `date-fns`, `framer-motion`, `html2canvas`, `jspdf`, `lodash` (direct), `moment`, `react-hot-toast`, `react-leaflet`, `react-markdown`, `react-quill-new`, `three`, `zod`. Tree-shaking keeps them out of the bundle, so the cost is only install time and supply-chain surface. They do not slow the counter. [VERIFIED]
- `vite.config.js` has no `manualChunks` and turns on `vite-plugin-node-polyfills` globally (buffer/process/stream). That plugin adds about 27 K to DoscarRestore and about 2 K to base44Client. [VERIFIED]

### 1.3 PWA / service worker

`public/sw.js` caches only `/offline.html` and one icon. For navigations it tries the network first and falls back to the offline page. **The JS/CSS assets and API calls are not cached.** [VERIFIED] `public/sw.js:22-26`
- Effect: a cold start after a browser cache eviction downloads the full ~208 KB again. If the network is down, the installed app shows "offline" and cannot be used at all (see §6.5). This is by design ("todo va siempre a la red"), but it also means the PWA does not speed up startup.

---

## 2. Catalogue and scan path

### 2.1 How products are loaded

- `/tpv` and `/venta` both run, on **every mount**, `fetchAllPages(Product, {}, {fields: PRODUCT_FIELDS})` together with Family, Settings and open CashSession in a `Promise.all`. [VERIFIED] `VentaRapida.jsx:150-167`, `Venta.jsx:96-113`
- `fetchAllPages` reads pages of 5,000 using the cursor, **one after another**. For ~9,100 products that is **2 sequential requests**. [VERIFIED] `src/lib/fetchAll.js:6-19`
- Payload: 14 fields, about 290 bytes of JSON per row on a sample → **about 2.6 MB of JSON for 9,100 rows** (about 0.4–0.6 MB if gzipped). Many rows are `active:false` (0 sales in 24 months), and they are loaded too. [MEASURED] sample at skip 4000; size extrapolated [ASSUMPTION]
- **No caching:** products live in component `useState`, not in react-query or IndexedDB. Every switch `/tpv` ⇄ `/venta` ("Táctil" button), every visit to Inicio and back, and every reload downloads the whole catalogue again. [VERIFIED]
- **The screen is blocked until all of it arrives:** `if (!ready || !products) return <Loader2/>` (`VentaRapida.jsx:696`). Barcode scans made during this time go nowhere, because the input does not exist yet.
- **No error handling:** the IIFE has no `try/catch`. If any of the 4 requests fails (network, 429, timeout), the promise rejects without being handled and the page **spins forever** with no message and no retry. [VERIFIED] `VentaRapida.jsx:152-166`, `Venta.jsx:98-111`
- **Stale data:** prices and `stock_qty` are a snapshot from page load. A product created or repriced in Artículos does not show on an open TPV until reload. The server always uses its own price for fixed-price items when the user is not admin, so this is not a money risk. [VERIFIED] `saleCompletion.ts:68` (but all users are admin)

**Estimated time until `/tpv` is usable:** auth (public-settings + `me`) about 0.3–0.6 s, plus 2 sequential pages of 5,000/4,100 rows at about 0.8–2 s each (server serialisation + 2.6 MB download + JSON parse), so **about 2–4.5 s on every visit**, above the < 2 s target. [ASSUMPTION; to be confirmed by Phase 3 live timing]

### 2.2 Barcode scan → line in cart

- Scan = keystrokes into the code input, then Enter → `submitCode()` → `findByCode(products, term)` → `addProduct` → `pushLine` (setState). **No network call.** [VERIFIED] `VentaRapida.jsx:250-285`, `src/lib/venta/search.js:4-12`
- `findByCode` does **up to 3 linear scans** over 9,100 rows (barcode, then sku, then `doscar_codes`), calling `trim().toLowerCase()` on every row each time. That is about 27k string operations, roughly **1–5 ms** on a counter PC. [ASSUMPTION]
- On every keystroke `setCode` re-renders the whole 1,229-line VentaRapida component. `liveResults` skips pure digit strings (`/^\d+$/`), so scanning EAN codes does not run the text search. [VERIFIED] `VentaRapida.jsx:190-194`
- The page also re-renders the whole tree once a second because of the clock (`setInterval(setNow, 1000)`, `VentaRapida.jsx:169-172`). This is harmless but wasteful.
- **Estimate: about 15–50 ms from Enter to the line painted, so the < 150 ms target is met once the catalogue is loaded.** [ASSUMPTION] Risks: (a) scans during the 2–4 s load are lost; (b) a product created after load (quick-create on another device) is "not found" until reload; (c) a non-unique barcode returns the first match silently.

### 2.3 Product search

| | `/tpv` | `/venta` |
|---|---|---|
| Where | client, in memory (`searchProducts`) | client, in memory |
| Trigger | every keystroke, **no debounce** (`useMemo` on `code`) | debounced **130 ms** (`useDebouncedValue`, `Venta.jsx:170`) |
| Cost | each call copies the array into active + inactive lists (2× `filter` over 9,100) and normalises name/sku/barcode for every row until 6 "starts with" hits. About 3–10 ms per keystroke [ASSUMPTION] | same, limit 8 |
| Normalisation | `trim().toLowerCase()` only. **No accent folding**: "raton" does not find "RATÓN", "bateria" does not find "BATERÍA". Single substring, no multi-word ("cargador usb" must be contiguous). | same |

Meets < 300 ms comfortably. The weak point is match quality, not speed. [VERIFIED] `search.js:15-31`
`/articulos` (ProductList) searches on the server with unescaped `$regex` over name/sku/barcode (`ProductList.jsx:49-51`).

### 2.4 5,000-row cap

- Sale screens and Inicio use `fetchAllPages` with the cursor → **all ~9,100 products are loaded; nothing beyond row 5,000 is lost.** [VERIFIED]
- **Informes is capped:** `loadProducts()` uses `max: 3000`, sorted by name, with all fields, in 6 sequential pages of 500 (`src/lib/informes/load.js:4-18,36`). With 9,100 products, about **2/3 of the catalogue is missing** from the report. Lines whose product is past "row 3,000 by name" get no cost and no family. Margins come out inflated, "by family" is wrong, and the **idle-stock list is incomplete. All of this happens silently.** [VERIFIED]
- Other silent caps: Informes sales `max 4000` per period (a yearly report truncates at about 50 tickets/day); stock movements 3,000; `cashTotals` 2,000 sales per session; `cashSummary` 600 product ids. Only the Informes caps matter now. [VERIFIED] `load.js:21-45`, `shared/cashTotals.ts:24`, `cashSummary/entry.ts:52`

---

## 3. Customer search by phone

- `ClienteDialog.search()` runs on Enter or button (not live). It sends one server query `Customer.filter({$or:[name,phone,nif,email] each $regex i]}, {limit:30})`. [VERIFIED] `src/components/venta/ClienteDialog.jsx:28-51`
- Cost: one request; an unanchored case-insensitive regex over about 1,300 rows × 4 fields means a full collection scan, but the collection is small. About **150–400 ms** [ASSUMPTION], borderline against the 300 ms target.
- **Correctness problems that look like "slow or broken":**
  - Phones are stored as `+34XXXXXXXXX` (`lib/doscar/text.js:20-26`). Typing `+34 612…` sends `+` as a regex quantifier, so the query **errors**. Typing with spaces (`612 34 56 78`) **finds nothing**. The user input is never normalised or regex-escaped (same in `ClienteList.jsx:41-44`, `BuyFromCustomerDialog.jsx:53`, `Tickets.jsx:83`). [VERIFIED]
  - Any `(`, `[`, `*` or `?` in a name causes an error.

---

## 4. Payment → ticket path

### 4.1 Client

`finalize()` sets `phase='saving'` (which blocks Enter and F-keys), makes **1 call** to `completeSale`, then shows the change. Printing happens after the next Enter (`finishDone(true)` → `printSaleDirect`): plain-text HTML in a hidden iframe, `print()` after 150 ms, **fully client-side and with no network**. [VERIFIED] `VentaRapida.jsx:445-485,487-495`, `src/lib/print/direct.js:28-49`
- No PDF on the sale path. PDFs are made on the server only for send/invoice (`generateDocumentPdf`, `sendDocument`).
- **No request timeout:** the SDK client is created without one (`src/api/base44Client.js`), so a hung request leaves the till on "saving" until the browser gives up. [VERIFIED]

### 4.2 Server: `completeSale` → `shared/saleCompletion.ts`

Every step is **sequential** (`await` one after another):

| # | Call | Notes |
|---|---|---|
| 1 | `auth.me()` | entry.ts:9 |
| 2 | CashSession.filter(open) | :28 |
| 3 | Settings.filter | :33 |
| 4 | Product.filter `$in` ids | :45, **catch → "artículo ya no existe"** |
| 5 | Customer.get (if any) | :110, **`.catch(() => null)`** |
| 6–7 | Deposit.get / Voucher.filter (if used) | |
| 8–9 | Counter.filter + Counter.updateMany (CAS) | ×N on conflict, up to 10, **no backoff** (`counters.ts:14-35`) |
| 10 | **Sale.create** | |
| 11 | Product.bulkUpdate (stock, units_sold_24m, last_sold) | absolute `stock_qty` computed from the value read in step 4 |
| 12 | StockMovement.bulkCreate | |
| 13+ | if below min: `sendLowStockAlert` **awaited** → Settings + Product.filter + email + Product.bulkUpdate | :258 |
| | SerialUnit / Deposit / Voucher updates | if used |
| 14 | `createFiscalRecord` → **Settings.filter again** (returns because Verifactu is off) | verifactu.ts:50 |
| 15 | AuditLog.create | |

That is **about 11 sequential round trips** in the common case (cash, no customer, no alert). Steps 2–5 do not depend on each other and could run in parallel. Step 14 repeats step 3.

**Real durations** [MEASURED]: function logs keep only the latest deployment (`completeSale`: 2 "POST → 200" lines in 7 days, with no durations). Instead, for the last 40 sales, the gap from `Sale.created_date` to `AuditLog.created_date` (the second half of the function) was: **median about 0.35 s, range 0.21–0.48 s, outliers 0.95 s (T/81) and 1.89 s (T/77)**. The outliers fit a low-stock email in the path [ASSUMPTION]. The first half (steps 1–9, about 6 calls) is probably 0.3–0.6 s, so **end-to-end server time is about 0.7–1.1 s typical and up to about 2.5 s**, plus function cold start. [ASSUMPTION for the first half]

**Atomicity:** the Sale is created at step 10, before the stock writes. If steps 11–15 throw, the client gets an error ("No se pudo cobrar el ticket…") **but the completed sale and its number already exist**. Stock may or may not be updated. The cashier will naturally press Cobrar again → **a second sale, a second number, stock taken off twice.** [VERIFIED] logic

**Idempotency:** none. There is no client request id and no dedupe key (`grep idempot|request_id` → 0). Double-click and double-Enter are guarded by `phase` (`finalize` returns unless `phase==='entrega'`; keydown ignores Enter while saving) → **good for double-click**. But a **network retry after a timeout or lost response duplicates the sale**. [VERIFIED] `VentaRapida.jsx:446,636-639`

**Stock race:** `stock_qty` is written as an absolute value from the value read earlier in the same call. Two devices selling the same product at the same moment can lose one decrement. The same pattern is in `refundSale` and `BuyFromCustomerDialog` (Phase 1). [VERIFIED] `saleCompletion.ts:224-235`

---

## 5. Other screens

| Screen | Load | Risk |
|---|---|---|
| **Caja** (X) | `cashSummary` function: session + sales (limit 2000) + movements in parallel, then Product `$in` (600) for families. 1 call from the client. [VERIFIED] | fine. Product lookup `catch {}` → everything goes to "Sin familia" silently (`cashSummary/entry.ts:56-61`) |
| **Cierre Z** | `closeCashSession`: z_number = max+1 with **no CAS** (two simultaneous closes could share a Z, low risk); **the daily report email is built and sent inside the request** (`closeCashSession:106`) → the close waits for the email. [VERIFIED] | slow close if email is slow; the email result is in the response |
| **Informes** | 3 parallel loaders with **page size 500**: sales (up to 8 sequential pages), products (6 pages, all fields), invoices; then movements (6 pages) + serial units. A month is about 10–20 requests, 2–5 s. HistoricSale is **not** loaded in bulk here. [VERIFIED] | **products truncated at 3,000 → wrong margins/families/idle stock (§2.4)**; recharts + xlsx chunks (~245 KB gzip) on first open |
| **Históricos** (clientes tab, historicos tab) | server queries, limit 200/300, `$regex` on `customer_name` / `lines.descripcion` over >10k rows (full scan) [VERIFIED] `HistoricosTab.jsx:43-46` | about 0.5–2 s per search [ASSUMPTION]; errors swallowed with `.catch(() => {})` → empty list with no message |
| **Tickets** | Sale.filter, limit 200, sorted, filters with unescaped regex [VERIFIED] `Tickets.jsx:90` | fine at 99 sales; `has_more` is shown |
| **Inicio** | low-stock card: `fetchAllPages(Product, {track_stock:true}, 2 fields)` → about 9k rows (small payload) on every visit [VERIFIED] `HomeCards.jsx:16` | adds about 0.5–1 s of background load whenever the user goes back to Inicio |
| **PendientesPanel** (on `/tpv`) | load + realtime subscribe + **60 s polling** [VERIFIED] `PendientesPanel.jsx:44-52` | double refresh; fine |

---

## 6. Reliability

### 6.1 Silent catches (dangerous ones first)

| Where | What happens |
|---|---|
| `VentaRapida.jsx:152-166`, `Venta.jsx:98-111` | **No catch at all** on the catalogue load → endless spinner, unhandled rejection in the console. |
| `saleCompletion.ts:110` `Customer.get(...).catch(() => null)` | A transient error → **the sale completes with no customer**, with no warning (wrong invoice/WhatsApp later). |
| `saleCompletion.ts:44-49` Product `$in` `catch {}` | A transient error is reported as "Algún artículo del ticket ya no existe" (fails safe, but the message is misleading). |
| `cashSummary/entry.ts:56-61` | Families lost → "Sin familia" in the X report. |
| `HistoricosTab.jsx:28`, `clientes/tabs/{Historicos,Senales,Vales}Tab.jsx` `.catch(() => {})` | Empty list shown as "no data". |
| `Caja.jsx:50` `refreshQuiet` | Background refresh errors hidden (acceptable). |
| `shared/inboxPro.ts` | CRM copy errors swallowed (by design). |

In total about 34 empty/null catches in `src`, most of them harmless (storage, PWA). [VERIFIED] grep

### 6.2 Retries

- react-query `retry: 1`, but the sale screens do not use react-query. [VERIFIED] `src/lib/query-client.js`
- Counter CAS: 10 tight retries with **no backoff/jitter**. Fine for 1–2 tills. [VERIFIED]
- Doscar restore: proper 429 handling (Retry-After, exponential backoff, chunking). [VERIFIED] `src/lib/doscar/restore.js:16-66`
- WhatsApp relay / Inbox Pro: no retry (Phase 1).

### 6.3 UTC without "Z" in the backend

The backend writes with `toISOString()` (has a Z) and compares stored naive strings directly in queries (`created_date: {$gte: iso}`). That is fine because both are UTC. Parsing naive values with `new Date(x)` happens in `shared/documentPdf.ts:38,47,738,740,783` and `reportMail.ts:36`; it is correct only if the Deno TZ is UTC [ASSUMPTION: it is]. Madrid day ranges are computed correctly with an offset probe (`reportMail.ts:63-66`). There is no shared parser (Phase 1). Low speed impact.

### 6.4 Rate limits (bulk writes 50/min)

- Sale path: 2 bulk writes per sale (Product.bulkUpdate + StockMovement.bulkCreate), plus 1 more with a low-stock alert. At counter rates (< 1 sale/min) this is far below the limit. A rush of more than 15–25 sales/min across all tills, plus any import running at the same time, could hit 429. [ASSUMPTION]
- **Doscar restore and imports running during shop hours would share the 50/min budget with live sales** and could make `completeSale` fail at step 11 (after Sale.create → the duplicate risk in §4.2). [ASSUMPTION]
- `updateProduct` bulk price changes chunk by 500 with no 429 handling (`updateProduct/entry.ts:181`).

### 6.5 Offline / network drop mid-sale

- No offline queue, no cached catalogue, and the SW serves only `offline.html` for navigations. [VERIFIED]
- Drop **before** sending: axios network error → back to `entrega` with an error. The cart is kept in memory (not persisted), so a **page reload loses the cart**.
- Drop **after** the request reached the server: the sale is recorded, but the client shows an error → the cashier retries → **duplicate sale** (no idempotency).
- A hung connection: no timeout → stuck on "saving".
- Reload while offline → offline page, and **the till is unusable** until the network is back (no cash-only fallback).

### 6.6 Other

- Recovering a parked ticket does not delete the parked `Sale`. It stays as an orphan unless someone deletes it by hand in the dialog (`ParkedDialog.jsx:27`, `VentaRapida.jsx:568-592`). There are 0 parked sales today. [VERIFIED]

---

## 7. Function performance from logs

`GET /functions-mgmt/{name}/logs` (last 7 days, also since 10-20, env default/prod) [MEASURED]:

| Function | Lines | Errors |
|---|---|---|
| completeSale | 2 (`POST → 200`, 10-30 09:16 and 10:22) | 0 |
| cashSummary | 1 (`POST → 200`, 10-29 19:28) | 0 |
| closeCashSession | 1 (`POST → 200`, 10-29 19:28) | 0 |
| nextNumber | 0 | – |

The logs keep only the **latest deployment** of each function and **no duration** field, so invocation counts and durations cannot be read from them. 99 live sales against 2 log lines confirms this. Server timing for completeSale was taken from entity timestamps instead (§4.2: Sale→AuditLog median 0.35 s, max 1.89 s over 40 sales). Recommendation: log `Date.now()` deltas inside completeSale.

---

## 8. Top 10 speed and stability fixes (ranked by counter impact)

| # | Fix | Evidence | Expected gain (reasoning) | Effort | Risk |
|---|---|---|---|---|---|
| 1 | **Make completeSale idempotent**: the client generates a `client_request_id` (UUID) per cart, the server first looks for a Sale with that id and returns it; also retry the same id once automatically on network error. | §4.2, §6.5; `saleCompletion.ts:194`, `VentaRapida.jsx:452` | Removes duplicate sales, numbers and double stock deductions on timeouts and drops. This is the main stability risk at the counter. | M | Low (additive field) |
| 2 | **Cache the catalogue across visits**: react-query (`staleTime` ~5–10 min) or IndexedDB with a delta refresh (`updated_date > last`), shared by `/tpv`, `/venta` and Inicio. Show the screen at once from cache. | §2.1; `VentaRapida.jsx:150-167` | Repeat opens go from about 2–4.5 s to under 0.5 s; switching Táctil ⇄ Venta becomes instant; about 2.6 MB less download per visit. | M | Low–Med (stale prices: the server already re-prices) |
| 3 | **Add error handling and retry to the catalogue load** (try/catch, message + "Reintentar", no endless spinner). | §2.1, §6.1 | Turns a frozen till into a recoverable one; meets the "0 silent failures" target. | S | Very low |
| 4 | **Parallelise and slim the completeSale pre-checks**: run steps 2–5 with `Promise.all`; pass settings to `createFiscalRecord`; move `sendLowStockAlert` out of the awaited path (fire after the response, or via the daily job). | §4.2 table | About 3–4 fewer sequential round trips (≈0.2–0.4 s), and removes the 1–2 s email outliers → payment-to-change about 0.5–0.7 s typical. | S | Low |
| 5 | **Make the sale write order safe**: write stock/movements before or in a way that a failure after `Sale.create` does not reach the client as "not charged" (return success with a warning and queue a stock fix), plus #1. | §4.2 atomicity | Prevents "error shown but sale recorded" → stops re-charging. | M | Med (touches money path; needs tests) |
| 6 | **Fix the Informes product cap**: use `fetchAllPages` with `fields` (id, family, cost_price, stock_qty, min_stock, name) instead of `max: 3000` at page size 500; raise or paginate the 4,000-sale cap. | §2.4; `informes/load.js:36` | Correct margins, families and idle stock (now about 2/3 missing); fewer round trips (6 → 2). | S | Very low |
| 7 | **Normalise and escape search input**: escape regex metacharacters everywhere `$regex` is used; for phone, strip non-digits and search the digits (or `+34`+digits); accent-fold the product search (`normalize('NFD')`) and match multiple words. | §2.3, §3 | Phone search stops erroring on "+34" and finds numbers typed with spaces; product search finds "raton/bateria". Fewer "not found → quick-create" duplicates. | S | Low |
| 8 | **Add a request timeout and a visible state on payment** (for example 15 s, then "Comprobando…" followed by a lookup by `client_request_id`). | §4.1, §6.5 | No more stuck "saving"; with #1 the cashier knows for sure whether the sale went through. | S | Low |
| 9 | **Persist the cart locally** (sessionStorage/localStorage on every change; restore on mount) and **cache the app shell in the SW** (precache hashed assets). | §1.3, §6.5 | A reload or crash no longer loses the cart; cold start uses cached JS (about 208 KB less over the network). Offline sale queuing stays out of scope (numbering must be server-side). | M | Low (SW versioning needs care) |
| 10 | **Cut the cost of scan and keystroke handling**: build `Map`s for barcode/sku/doscar_code once (O(1) lookup); pre-normalise names once; precompute the active/inactive split; debounce `/tpv` live search (~100 ms); move the 1 s clock into its own small component. | §2.2, §2.3 | Scan lookup goes from about 1–5 ms to under 0.1 ms, keystroke work from about 3–10 ms to under 1 ms, no full-page re-render every second. This is headroom on slow counter PCs and mobiles. The target is already met, so the gain is small. | S | Very low |

Also worth doing (not top 10): log timing deltas in completeSale (§7); use a CAS for `z_number`; delete the parked Sale when it is recovered and completed; remove the unused dependencies; keep Doscar/imports out of shop hours or throttle them below the shared write budget.
