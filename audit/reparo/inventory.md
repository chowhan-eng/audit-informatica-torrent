# Reparo — Phase 1 Inventory (read-only)

App: **Reparo** · Base44 ID `6ae22784825ce515812bcab8` · host `https://reparo-812bcab8.base44.app` · audited 2026-10-30
Repo: `/app` in Base44 sandbox, 169 commits, first 2026-10-28, last `686fe92` 2026-10-29 19:11 UTC.
`CLAUDE.md` only points to `AGENTS.md` (generic Base44 boilerplate, no project rules) [VERIFIED CLAUDE.md:1-3, AGENTS.md].

**Key state** (SystemSettings rows) [VERIFIED data]:
- `orders_master` = `app` and `orders_cutover_at` = 2026-10-29T12:18Z → **cutover from HelloClient already done** (2026-10-29 13:18 Madrid).
- `shop_whatsapp` = `{enabled:true, delay_seconds:60}` → automatic WhatsApp is live.
- **`shop_public_base` has no row** → customer links use the code default `https://estado-informatica-torrent-75674229.base44.app` [VERIFIED src/lib/shop/config.js:210, 74].
- `shop_reviews` has no row → no Google review URL configured.

Evidence tags: [VERIFIED] read in code/data · [MEASURED] number measured · [ASSUMPTION] needs confirmation.

---

## 1. Pages / routes (src/App.jsx)

Login is required for every route except the auth pages (App.jsx:48-67). The app is **private** at platform level: anonymous GET of `/estado.html` on the Reparo host returns 401 [MEASURED]. Every authenticated route is wrapped in `EmployeeGate` (App.jsx:71): admins, or users whose e-mail matches a non-archived `Employee` row (EmployeeGate.jsx:12). This check runs only in the frontend. **There is no PIN gate** anywhere (grep for pin/PIN found only the placeholder regex) [VERIFIED].

| Route | Page | Who can see it |
|---|---|---|
| /login, /register, /forgot-password, /reset-password, /oauth-consent | auth pages | public (App.jsx:36-46) |
| / | redirects to /tickets | user + admin (employee) |
| /tickets, /tickets/:orderId | Tickets (eager-loaded) | user + admin |
| /panel | Panel (dashboard, `reports` fn) | user + admin |
| /clientes, /clientes/:clientId | Clientes | user + admin |
| /informes, /informes/:report | Informes | user + admin |
| /configuracion, /configuracion/:section | Configuración. Sections: general, empleados, roles, estados, campos-ticket, campos-cliente, pestanas, documentos, manuales, whatsapp, importar, datos, cambio (cutover), widgets, resenas | **admin only** (frontend check Configuracion.jsx:25; menu item hidden AppLayout.jsx:58) |
| /marketing/* | redirects to /configuracion/resenas | — |
| /tareas, /inventario/*, /tienda | redirect to /tickets (removed features) | — |
| * | PageNotFound | — |
| static `public/estado.html`, `public/resena.html` | customer status / review pages | served on Reparo host but behind login there (401); the live copies are on the Estado host (see §8) |

Users [MEASURED]: **3 platform users, all `admin`** (created 2026-10-28 and 2026-10-29). Employee: 20 rows, 6 active, 4 active with `can_view_codes`, 1 super user. So every current login is admin, and Employee/ShopRole permissions do not restrict anyone today.

## 2. Entities

RLS shorthand: **A** = admin, **U** = role user (any signed-in non-admin), **own** = created_by_id = the user. Counts come from query_entities paging and partitioning. The platform count endpoint returned "auth_required" [MEASURED].

| Entity | Key fields (short) | Rows | Oldest / newest created | RLS read / create / update / delete |
|---|---|---|---|---|
| RepairOrder | order_id, number, ticket_uuid, status_*, is_open, customer_name/phone, client_id, device_brand/model, averia, estimated_cost, offer_items/total, events[], fields{}, source, hc_* | **19,516** [MEASURED: number<29500 = 9,697 + ≥29500 = 9,819; 0 with null number] | 2026-10-28 17:46 (import) / 2026-10-30 09:20. Order numbers 19769–39352 | A,U / A,U / A,U / **A,U** |
| Client | full_name, phone, phones[], raw_phone, email, dni, client_type, notes, fields, hc_client_id, source | **12,291** [MEASURED, 2 partitions] | 2026-10-28 17:43 / 2026-10-30 09:01 | A,U / A,U / A,U / **A,U** |
| DeviceUnlockCode | order_id, ticket_uuid, code, last_viewed_by/at | **~16,900–20,000** [MEASURED, range only: 3 partitions bounded by skip probes] | 2026-10-28 17:59 / 2026-10-30 09:20 | A / A / A / A (users go through `unlockCode` fn) |
| ActionLog | action, at, detail, order_id, user_email/name | 60 | 2026-10-28 17:55 / 2026-10-30 10:18 | A / A,U / A / A |
| WhatsAppQueue | order_id, event, status, due_at, state, attempts, sent, result, requested_by | 22 (19 done, 3 skipped, 0 failed) | 2026-10-29 12:17 / 2026-10-30 10:17 | A / A / A / A |
| SystemSettings | setting_key, setting_value (JSON string) | 6 | 2026-10-28 17:43 / 2026-10-29 12:17 | A,U / A / A / A |
| Employee | name, email, phone, role_name, can_view_codes, is_super_user, archived, hc_id | 20 | 2026-10-28 17:43 (import) | A,U / A / A / A |
| ShopStatus | name, group, color, position, allowed_roles, whatsapp_template, hc_id | 14 | 2026-10-28 17:38 | A,U / A / A / A |
| ShopField | name, type, scope, is_secret, handbook_hc_id, hc_id | 21 (1 secret) | 2026-10-28 17:38 | A,U / A / A / A |
| Handbook | name, entries, hc_id | 17 | 2026-10-28 17:39 | A,U / A / A / A |
| OrderPreset | name, status/executor/manager_names, field_filters | 11 | 2026-10-28 17:43 | A,U / A / A / A |
| PrintTemplate | name, html, images, scope, print_mode, size | 12 | 2026-10-28 17:43 / 18:13 | A,U / A / A / A |
| ShopRole | name, permissions, status_permissions | 4 | 2026-10-28 17:43 | A,U / A / A / A |
| ReportCache | key, data, computed_at | 11 | 2026-10-28 18:18 / 2026-10-30 09:23 | A / A / A / A |
| UserListSettings | user_email, columns, page_size | 2 | 2026-10-28 / 10-29 | own,A / *(no create rule)* / own,A / A |
| PublicLookupLog | ip, at | 1 | 2026-10-28 18:25 | A / A / A / A |
| User (built-in) | role | 3 | 2026-10-28 / 10-29 | platform default |
| **Review** | order_id, ticket_uuid, rating, comment, customer_name | **0** | — | A,U / A / A / A |
| **TicketFile** | order_id, url, name, mime, size | **0** | — | A,U / A,U / A / A |
| **PrintTemplateVersion** | template_id, html, saved_at | **0** | — | A,U / A / A / A |
| **Product** | title, sku, price, cost, stock | **0** | — | A,U / A,U / A,U / A |
| **Sale** | items, total, customer_*, sold_at | **0** | — | A,U / A,U / A,U / A |
| **ShopTask** | content, due_at, executor_name, order_id | **0** | — | A,U / A,U / A,U / A,U |

Zero-row entities: Review, TicketFile, PrintTemplateVersion, Product, Sale, ShopTask. Product, Sale and ShopTask belong to removed routes (App.jsx:81-83) [VERIFIED].
Entity files: `base44/entities/*.jsonc` [VERIFIED].

## 3. Backend functions (base44/functions/*/entry.ts)

| Function | Purpose | Caller / auth | External calls | Error handling |
|---|---|---|---|---|
| notifyWhatsApp (189 l.) | Queues a ticket event in WhatsAppQueue, sleeps `delay_seconds` (60 s) inside the request, re-reads the ticket, then POSTs to WhatsApp Pro `reparoBridge`. Also `sweep`, `test`, `set_master` | user (frontend `orders.js:41,106`, fire-and-forget). **No auth for `{sweep:true}`** (scheduler); `set_master` admin only (l.46,74) | `REPARO_WA_URL` (WA Pro reparoBridge), header `X-Reparo-Key` | 30 s timeout. Retries on network/5xx: up to 3 attempts, 2 min apart. Stuck "sending" rows are reset after 5 min. Result goes to ActionLog + queue row. Many `.catch(()=>{})` on log/queue writes. Good overall [VERIFIED l.29-33,124-131,152-156] |
| syncHelloClient (375 l.) | Mirrors HelloClient tickets and clients into Reparo. **Returns `skipped:'cutover'` immediately because orders_master=app** (l.149-150) | admin, or no user (scheduler, limited to once per 4 min) | `https://app.helloclient.by/api/rpc/` with cookie `HC_SESSION_FULL`, or through the WA Pro bridge (`action:'hc'`) | 3 retries on 5xx/network, 4-min deadline, auth errors logged to ActionLog at most once per hour. State saved in `hc_sync_state` [VERIFIED] |
| publicStatus (69 l.) | Public status page API: by `ticket_uuid`, or by phone (up to 5 orders) | **public, no auth**, CORS `*` | none | 10 lookups per 10 min per IP (phone path only; skipped when no IP header). Silent `.catch(()=>[])` turns DB errors into "not found" [VERIFIED l.43-55] |
| publicReview (39 l.) | Public review page: read order number / submit rating 1–5 + comment, one per order | **public, no auth**, CORS `*` | none | silent catches; no rate limit; anyone with the UUID can submit [VERIFIED] |
| waLookup (121 l.) | Client + orders lookup by phone for WhatsApp Pro (customer card, auto-replies) | cross-app, shared secret `X-Reparo-Key` = `REPARO_WA_KEY` (plain `!==` compare) | none (returns links to Reparo host) | silent catches → empty result [VERIFIED l.45-48] |
| unlockCode (82 l.) | Get/set device unlock codes. Logs each reveal to ActionLog | user. get: admin, OWNER_EMAILS, or Employee.can_view_codes/super user. **set: any signed-in user**. bulk_set: admin | none | Main writes have no try/catch, so a failure returns a 500 [VERIFIED l.53-62] |
| reports (289 l.) | Dashboard / report statistics, cached 10 min in ReportCache | any signed-in user (no admin/employee check) | none | cache errors are swallowed; compute errors return an uncaught 500 [VERIFIED l.261-289] |
| fieldSuggestions (74 l.) | Most-used values for quick chips in "Nuevo ticket" (last 1500 tickets) | user (uses the user's RLS) | none | try/catch → 500 with message [VERIFIED] |
| importBatch (61 l.) | Server-side writer for the HelloClient importer (create/update/list/setting on 13 entities) | admin or OWNER_EMAILS | none | try/catch, 429 passthrough [VERIFIED] |
| linkClients (52 l.) | Links tickets with no client_id to clients (by hc id, then phone), 400 per call | admin or OWNER_EMAILS | none | try/catch → 500 [VERIFIED] |

Deployed vs repo: `GET /backend-functions` returned only `{"truncated":true}`, so the comparison was **not possible** [MEASURED]. Function logs since the latest deploy: no error lines for notifyWhatsApp, unlockCode or reports. syncHelloClient answers `POST → 200` every 5 min. **publicStatus, publicReview and waLookup have no log lines at all** [MEASURED]. Logs only cover the latest deployment, so this is weak evidence that they have not been called since then [ASSUMPTION].
Hard-coded `OWNER_EMAILS = ['chowhan@gmail.com']` grants admin-equivalent rights in unlockCode:14, importBatch:11, linkClients:9 and src/lib/shop/config.js:20 [VERIFIED].
SDK versions are mixed: 0.8.52 (publicStatus, publicReview, unlockCode, reports, importBatch, fieldSuggestions) and 0.8.54 (others) [VERIFIED].

## 4. Automations & schedules

| Workflow | Trigger | What it does | Runs/day | Outside shop hours? |
|---|---|---|---|---|
| "Sincronizar HelloClient y WhatsApp pendientes" (`base44/workflows/Sincronizar HelloClient.jsonc`, id 6ae23958…a4af, **active**) | cron `*/5 9-21 * * 1-6`, tz Europe/Madrid | step 1 `syncHelloClient` (no-op since cutover). Step 2 `notifyWhatsApp {sweep:true}` (sends overdue queued messages) | **156** Mon–Sat (13 h × 12) [VERIFIED cron] | **Yes**: 14:00–15:55 (24 runs), 21:00–21:55 (12 runs) and Saturday afternoon 14:00–21:55 (~96 runs). ≈276 of 936 weekly runs (~29 %) fall outside opening hours [MEASURED from cron] |

Run history [MEASURED, workflows API]: 243 runs since 2026-10-28 18:05, **0 failed**, 0 consecutive failures. Average duration **64.9 s**, recent runs 49–196 s. **0.3 credits per run** → ~47 credits/day, ~1,200/month for a job whose first step does nothing and whose second step usually finds nothing to send (all 22 queue rows were handled by the in-request path).
Stale comment: syncHelloClient header says "every 10 minutes" (entry.ts:3), but the cron runs every 5 minutes [VERIFIED].
No entity-triggered automations or webhooks.

## 5. Integrations & secrets

| Secret (names only) | Read in |
|---|---|
| `REPARO_WA_URL` | notifyWhatsApp:41, syncHelloClient:157 (Deno.env.get) |
| `REPARO_WA_KEY` | notifyWhatsApp:42, syncHelloClient:158, waLookup:46 |
| `HC_SESSION_FULL` | syncHelloClient:154 via `secrets.get` (base44:runtime). **Not set on the app** (secrets list has only the two above), so before cutover the sync read HelloClient through the WA Pro bridge [VERIFIED] |

No hard-coded secret values found in `src/`, `base44/` or `public/` (regex scan for key/secret/token/password literals) [VERIFIED]. SystemSettings rows checked: no credentials in the keys inspected. HelloClient custom-field UUIDs and the app ID are hard-coded but are not secrets.
External hosts in the frontend: `wa.me`, `static.wixstatic.com` (image component), `g.page/r/` (placeholder), `app.helloclient.by` (postMessage origin for the importer, Importar.jsx:25) [VERIFIED].
App switcher hard-codes the sister apps: torrent.base44.app (Mostrador), whats-app-pro.base44.app, tpvtorrent.base44.app (src/lib/appSwitcher.js:8-12).

## 6. Settings stores

| Store / key | Fields | Read by |
|---|---|---|
| SystemSettings `shop_company` | name, address, phone, requisites… | frontend loadAll (config.js:61-99); publicStatus:36, publicReview:26 |
| `shop_defaults` | warranty_days, estimate_days | frontend |
| `shop_whatsapp` | enabled, delay_seconds (comment also mentions `endpoint`, unused) | notifyWhatsApp:61-66; Config → WhatsApp; Cambio.jsx:45 |
| `shop_public_base` (**missing**) | URL of public pages | config.js:74 → printEngine.js:88-89 (QR/links), Marketing.jsx:49 |
| `shop_reviews` (**missing**) | google_url, min_for_google, enabled | publicReview:24; Marketing → Reseñas |
| `orders_master` | helloclient / app | syncHelloClient:149; frontend; mirrored to WA Pro via `set_master` |
| `orders_cutover_at` | ISO date | frontend |
| `hc_sync_state` | last_run_at, last_updated_at, errors, auth_error… | syncHelloClient |
| `shop_import` (not present) | last import info | importer |
| ShopStatus.whatsapp_template | only `"no"` (opt-out) is honoured; **all 14 rows null** | notifyWhatsApp:104-109 |
| ShopRole.permissions / status_permissions, ShopStatus.allowed_roles | per-role UI permissions | frontend only (config.js:150, rules.js) |
| UserListSettings | per-user list columns | frontend |

Overlap with WhatsApp Pro: `orders_master` is duplicated there ("Origen de los pedidos", set through `set_master`, Cambio.jsx:47-48). Message texts and templates live in WhatsApp Pro, not in Reparo [VERIFIED notifyWhatsApp:2-4]. No TPV overlap seen.

## 7. WhatsApp templates

Reparo stores **no template names**. It sends `{action:'event', event:'ticket_created'|'status_changed', status, status_group, customer_*, device, averia, estimated_cost, executor_name}`, and WhatsApp Pro's `reparoBridge` chooses the template [VERIFIED notifyWhatsApp:111-124]. Actions returned by WA Pro, as recorded in WhatsAppQueue.result [MEASURED]: `welcome` (sent ×7), `listo_wa` (sent ×7), `voice_only` (no message ×3), `close` (no message ×3). Template categories (utility/marketing) are unknown from here → check in WA Pro [ASSUMPTION]. Manual "send status/review link" menu items open `wa.me` with free text (TicketMoreMenu.jsx:43-46).

## 8. Cross-app calls (brief)

| Direction | URL / mechanism | Auth | Retry |
|---|---|---|---|
| Reparo → WhatsApp Pro | POST `REPARO_WA_URL` (reparoBridge): `event`, `ping`, `set_master`, `hc` (HelloClient proxy) | header `X-Reparo-Key` (shared secret) | notify: 3 attempts / 2 min + 5-min sweep; hc proxy: 3 attempts with backoff |
| WhatsApp Pro → Reparo | POST `https://reparo-812bcab8.base44.app/api/apps/6ae2…/functions/waLookup` [ASSUMPTION about the caller side] | `X-Reparo-Key` | n/a. No log lines for waLookup since the last deploy |
| Reparo → HelloClient | `https://app.helloclient.by/api/rpc/` (direct cookie, unused because the secret is absent) or through WA Pro | session cookie | 3 attempts. **Dormant since cutover** |
| HelloClient tab → Reparo | `postMessage` from `app.helloclient.by` into Config → Importar | origin check | — |
| Customer browser (Estado host) → Reparo | **Live**: `https://estado-informatica-torrent-75674229.base44.app/estado.html` and `/resena.html` return HTTP 200 (titles "Estado del ticket…", "Su opinión…") [MEASURED GET]. Their JS POSTs to `https://reparo-812bcab8.base44.app/api/apps/6ae22784825ce515812bcab8/functions/publicStatus` / `publicReview` with `X-App-Id` [MEASURED page source]. An anonymous OPTIONS preflight on publicStatus returns 200 with the function's own CORS headers (`POST, OPTIONS`, `Content-Type, X-App-Id`), so the function is reachable without login even though the app is private [MEASURED]. An anonymous POST was not sent (rules). That the full flow works end-to-end is therefore [ASSUMPTION, likely]. Note: the Estado repo has only auth pages, but its live host serves these two static files, so they were deployed outside its current source or as static assets [ASSUMPTION] | none (public) | none |
| Reparo → TPV / Mostrador | links only (app switcher) | — | — |

Links in Reparo: QR/status `${PUBLIC_BASE}/estado.html#<ticket_uuid>`, review `${PUBLIC_BASE}/resena.html#<ticket_uuid>` (printEngine.js:88-89). waLookup returns `reparo_url` deep links to the private Reparo host (staff only).

## 9. HelloClient-era code still present

- `syncHelloClient` function + 5-min workflow step (no-op after cutover, still billed per run) [VERIFIED].
- `src/lib/shop/hcImport.js` (full export importer, retry logic) + `src/pages/config/Importar.jsx` + `importBatch` function + `dataScan.js` [VERIFIED].
- `linkClients` (post-import client linking), `HcSyncCard.jsx`, `CutoverChecks.jsx`, `Cambio.jsx` (cutover / undo cutover) [VERIFIED].
- `hc_*` fields on most entities; `source:'helloclient'` on imported rows; HelloClient field UUIDs hard-coded in syncHelloClient:26-33, hcImport.js:13-19 and reports:19-20 [VERIFIED].
- printEngine "reverse-engineered from app.helloclient.by" (printEngine.js:3).
- `HC_SESSION_FULL` referenced in UI messages (HcSyncCard.jsx:23,46), but the secret is not set.

## 10. Top 10 notable findings

1. **Customer status/review links work in practice** and point at the Estado host default (no `shop_public_base` row). The Estado host serves `estado.html`/`resena.html` (HTTP 200). They call Reparo's public functions, which answer anonymous preflight. However, the Estado app's source does not contain these files, so a redeploy of Estado from its repo could silently break every QR code and link already printed or sent [MEASURED + ASSUMPTION].
2. **publicStatus phone lookup has no ownership check.** Anyone who knows or guesses a phone number gets that customer's last 5 orders: device, status, dates and order number. Rate limit is per IP only, 10 per 10 min, and is **skipped when no IP header is present** (publicStatus:44-55) [VERIFIED]. PII-adjacent (GDPR).
3. **Scheduled workflow is mostly dead weight:** 156 runs/day at ~65 s and 0.3 credits each (~1,200 credits/month). Step 1 is a no-op since cutover. ~29 % of runs fall outside opening hours (lunch break, 21:00–21:55, Saturday afternoon) [MEASURED].
4. **RLS lets any role-`user` delete RepairOrder and Client** and read/update all customer data (RepairOrder.jsonc, Client.jsonc). EmployeeGate and ShopRole permissions exist only in the frontend. If an account outside staff is ever invited or registered (a /register page exists), it gets full data access through the SDK. Today all 3 users are admin [VERIFIED + MEASURED].
5. **unlockCode `set` lets any signed-in user overwrite any device unlock code** without the can_view_codes check (unlockCode:52-62) [VERIFIED]. DeviceUnlockCode holds ~17–20k rows (≈ one per order, placeholders included) [MEASURED].
6. **Deployed functions could not be compared to the repo** (the API response was truncated). publicStatus, publicReview and waLookup show no log lines since the last deploy. Either they have not been used since the last deploy, or WA Pro still does not call waLookup [MEASURED/ASSUMPTION]. To check in Phase 2 against WA Pro.
7. **Review system unused:** Review = 0 rows and `shop_reviews` is not configured (no Google URL), although a status "Entregado + Reseña" exists. publicReview has no rate limit and accepts a rating for any valid UUID (publicReview:31-37) [VERIFIED/MEASURED].
8. **Possible double WhatsApp send:** processRow reads `state==='pending'` and then writes `sending`, which is not atomic (notifyWhatsApp:86-89). The in-request path and the 5-min sweep (30 s grace) can process the same row if the request is delayed more than 30 s past due [ASSUMPTION, low probability; 0 duplicates seen in 22 rows].
9. **Hard-coded owner e-mail as an authorization bypass** in 3 functions + frontend (OWNER_EMAILS) [VERIFIED]. `reports` returns customer names to any signed-in user without an employee check (reports:22,263) [VERIFIED].
10. **Dead/orphan code and data:** Product, Sale and ShopTask entities (0 rows, routes removed) are still writable by users and in the importBatch allow-list. TicketFile and PrintTemplateVersion have 0 rows. The `shop_whatsapp.endpoint` field is documented but unused. Stale "every 10 minutes" comment. Mixed SDK versions. Silent `.catch(()=>[])` in public functions hides DB errors as "not_found" [VERIFIED].
