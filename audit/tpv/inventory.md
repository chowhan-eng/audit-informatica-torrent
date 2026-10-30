# TPV Informática Torrent: Phase 1 inventory (read-only)

App `6acf624e6e89e6f32c43243f` · sandbox `/app` · audited 2026-10-30 · 188 commits, the last on 2026-10-29 12:44 UTC.
Evidence tags: [VERIFIED] = file:line or query, [MEASURED] = live data or API, [ASSUMPTION] = not proven.
No personal data appears below. Customer and staff values were seen in some outputs and are deliberately left out.

---

## 1. CLAUDE.md / AGENTS.md hard rules

| Item | Finding |
|---|---|
| `CLAUDE.md` | Only says "See AGENTS.md" (57 bytes). [VERIFIED] `/app/CLAUDE.md` |
| `AGENTS.md` | This is the generic Base44 template: use the CLI, keep secrets out of git, run checks. **It has no TPV hard rules.** [VERIFIED] `/app/AGENTS.md` |
| README | Generic Base44 text. It says to publish from the dashboard, not with `base44 deploy`. [VERIFIED] |

The repo does not write down the TPV rules. Below they are checked against the brief instead.

| Rule (from brief) | Complies? | Evidence |
|---|---|---|
| Money is handled only in the backend | **Partly.** Sales, refunds, cash, invoices and stock use backend functions. **Vouchers (vales) with a money value are created straight from the frontend**, with no sale behind them. Deposits (señales) are created and refunded from the frontend after the backend call, so the two steps are not atomic. | [VERIFIED] `src/components/vales/NuevoValeDialog.jsx:55`, `src/components/venta/VoucherDialog.jsx:34`, `src/components/senales/NuevaSenalDialog.jsx:103` (after `completeSale` at :85), `src/components/senales/RefundSenalDialog.jsx:31` |
| Stock is changed only in the backend | **Mostly.** Changes go through `stockAdjust`, `receivePurchase`, `completeSale` and `refundSale`. Exceptions: (a) the Doscar restore writes `Product.stock_qty` and StockMovement rows in bulk from the browser; (b) `BuyFromCustomerDialog` works out the absolute `new_qty` in the client from a value read earlier (lost-update race); (c) RLS lets any admin (all 3 users) update `Product` directly. | [VERIFIED] `src/lib/doscar/restore.js:148,301,344`; `src/components/unidades/BuyFromCustomerDialog.jsx:136-141`; `base44/entities/Product.jsonc` rls.update=admin |
| Numbering is done only in the backend | **Yes.** It goes through `nextNumber` / `shared/counters.ts`, which uses a conditional `updateMany` (CAS) with 10 retries. Client RLS on Counter blocks updates. **But see Finding #1: the invoice series duplicates Doscar numbers.** | [VERIFIED] `base44/shared/counters.ts`; `Counter.jsonc` rls.update `__inmutable__` |
| Completed sales cannot be changed | **Yes** for clients: Sale RLS blocks update, client create cannot use status `completed`, and delete is allowed only for `parked`. Only the service role can update. | [VERIFIED] `base44/entities/Sale.jsonc` rls |
| Numbers are never reused | **No.** Invoices 2600408–2600411 reuse Doscar invoice numbers (#1). `cleanupTestData` can reset counters if it is run again (#3). Gaps exist (T counter 99 vs 96 T sales; R counter 5 vs 3 R sales). Gaps are allowed; reuse is not. | [MEASURED] Counter, Sale, HistoricSale queries |
| Prices include IVA | **Yes**, by design: `sale_price` holds the IVA-inclusive price, with net/VAT breakdown fields on Sale. Not spot-checked in depth. | [ASSUMPTION] field names `net_total`, `vat_total`, `vat_breakdown` |
| Verifactu stays OFF | **Yes** (section 11). | [MEASURED] |

---

## 2. Pages and routes (`src/App.jsx`)

Gates: `ProtectedRoute` means logged in. `AdminRoute` sends role≠admin back to `/`. `PinGate` asks for the manager PIN through the `adminPin` function and keeps the area unlocked for 5 minutes in sessionStorage. **Non-admins skip the PIN** (`PinGate.jsx`: `if (!isAdmin || unlocked) return <Outlet/>`). All 3 users are admin, so in practice everyone gets the PIN prompt. [VERIFIED]

| Route | Page | Gate |
|---|---|---|
| /login /register /forgot-password /reset-password | auth pages | public |
| /tpv | VentaRapida ("Venta", the main desktop POS; holds the Pendientes and Reminder panels) | login |
| /venta | Venta ("TPV táctil"; mobile primary) | login |
| / | Inicio | login + Layout |
| /caja /tickets /articulos /familias /clientes /senales /vales /documentos | | login |
| /stock | Stock | login + **PIN** |
| /compras /proveedores /unidades /informes /ajustes | | login + admin + **PIN** |
| * | PageNotFound | public |

- **PIN on admin areas: it exists.** It was set up on 2026-10-28 (one AdminPin row, PBKDF2-SHA256 with 100k iterations and a salt; 5 failed tries lock it for 5 minutes; only the owner can reset it). [VERIFIED] `base44/functions/adminPin/entry.ts`; [MEASURED] AdminPin = 1 row.
- The PIN gate is enforced in the client only. Backend functions and entity RLS do not check whether the PIN was unlocked; any admin session can call `stockAdjust` and the others directly. [VERIFIED]
- `/articulos`, `/clientes`, `/caja`, `/tickets` and `/documentos` have no PIN. [VERIFIED]
- `/ajustes` includes the "Restaurar desde Doscar" tab (lazy-loaded). [VERIFIED] `src/pages/Ajustes.jsx:11,23`
- **Pendientes panel:** appears only on `/tpv`, and only at widths ≥ lg (1024px, `hidden lg:flex`). It is **not on `/venta` and not on mobile.** Reminders (`ReminderPanel`) appear on both pages, but on `/tpv` only at ≥ xl. [VERIFIED] `src/pages/VentaRapida.jsx:754-760`, `src/lib/nav.js:28`

---

## 3. Entities

The count endpoint was refused ("auth_required"), so counts come from skip probing with `query_entities`. Dates are UTC.

| Entity | Key fields (short) | Rows [MEASURED] | Oldest → newest created | RLS read / create / update / delete [VERIFIED] |
|---|---|---|---|---|
| AdminPin | pin_hash, salt, failed_attempts, locked_until | 1 | 10-28 | server-only (all 4) |
| AuditLog | actor_email, action, entity, before/after, summary | 115 | 10-23 → 10-30 | admin / any / blocked / blocked |
| CashMovement | cash_session_id, type, amount, reason | **0** | – | any / server / blocked / blocked |
| CashSession | opened/closed, float, counted, expected, difference, z_number | 4 (Z1–Z3 closed; 1 open since 10-29 19:29) | 10-23 → 10-29 | any / server / server / admin |
| Counter | key, last_number | 3 (F-2026=2600411, T-2026=99, R-2026=5) | 10-23 | admin / admin / blocked / blocked |
| Customer | doscar_code, name, nif, phone, email, consents, helloclient_id | ~1,251–1,329 | 10-23 → 10-30 | any / any / admin / admin |
| Deposit | customer_id, amount, repair_ref, status, taken/applied_sale_id | **0** | – | any / any / admin / admin |
| Document | type, number, lines, total, status, converted_to_id | **0** | – | any / any / owner or admin / admin |
| Family | name, color, sort_order, show_in_tpv | 6 | 10-23 | any / admin / admin / admin |
| FiscalRecord | sale/invoice_id, hash, prev_hash, status, qr_url | **0** | – | admin / any / blocked / blocked |
| HistoricSale | doscar_type, doscar_number, date, customer_*, lines, total | **>10,000** | 10-23 → 10-27 (business dates go back to 2008/2009) | admin (all 4) |
| ImportJob | source, file_name, mode, status, counts, errors | 4 (2 "con_errores") | 10-23 → 10-28 | admin (all 4) |
| Invoice | series, number, customer_* (snapshot), sale_ids, lines, vat_breakdown, rectifies_* | 4 (F 2600408–2600411) | 10-23 → 10-30 | any / **admin** / server / server |
| MessageLog | channel, doc_kind, to, template, status, error | 13 (3 failed) | 10-23 → 10-29 | any / any / blocked / blocked |
| PendingTask | kind, title, customer_name/phone, amount, status, done_* | 4 (3 open) | 10-28 → 10-29 | **open to all (all 4 `{}`)** |
| Product | sku, barcode, doscar_codes, name, family, sale_price, vat_rate, stock_qty, min_stock, active | **~9,101–9,150** | 10-23 → 10-29 | any / admin / admin / admin |
| PurchaseOrder | number, supplier, lines, receptions, status | **0** | – | admin (all 4) |
| Sale | series, number, status, customer_* snapshot, lines, payments, totals, repair_ref, fiscal_status | 99 (96 T + 3 R; all completed; 0 parked) | 10-23 → 10-30 | any / status≠completed / blocked / parked only |
| SerialUnit | imei, serial, grade, buy/sold price, status, warranty_until | **0** | – | any / admin / admin / admin |
| Settings | 37 fields (section 7) | **2 rows** | 10-14, 10-23 | any / admin / admin / admin |
| StockMovement | product_id, qty, type, reason, old/new_qty | 73 | 10-23 → 10-30 | any / admin / blocked / blocked |
| Supplier | doscar_code, name, nif, phone, email, lead_days | 21 | 10-23 | any / admin / admin / admin |
| User | role, **pin** (4-digit "cashier switch" PIN, plain string field) | 3 (all admin) | 10-14 → 10-29 | built-in |
| Voucher | code, amount, balance, origin_sale_id, status, expires_at | **0** | – | any / admin / admin / admin |

- **Rows with 0 data:** CashMovement, Deposit, Document, FiscalRecord, PurchaseOrder, SerialUnit, Voucher. [MEASURED]
- **Product catalogue size:** about 9.1k products. Search is server-side with `$regex` (Senales shows the same pattern). The Inicio low-stock card loads all products with `track_stock` through `fetchAllPages`. [MEASURED]/[VERIFIED] `src/components/inicio/HomeCards.jsx:16`
- Sales from before 2026-10-28 (23–27 Oct; test period, plus Z1/Z2) are still present, so `cleanupTestData` was never run with `confirm:true`. [MEASURED]
- `User.pin` is a plain-text schema field. No usage was confirmed in this phase. [VERIFIED] `base44/entities/User.jsonc`

---

## 4. Backend functions (28 dirs)

Caller type: **user** = any logged-in user; **admin** = role admin; **public** = no auth check. "Svc" means the function uses `asServiceRole` internally. Every function wraps its body in try/catch and returns `{error}` with a 500 status. [VERIFIED] `grep catch` across `base44/functions/*/entry.ts`.

| Function | Purpose | Caller | External calls / notes |
|---|---|---|---|
| adminPin | PIN status/verify/set/reset | admin | Owner email hard-coded at :12 |
| cashMovement | cash in/out | user | – |
| cashSummary | X totals | user | – |
| **cleanupTestData** | one-time (28 Oct) delete of test sales; **resets counters R-2026 and F-2026** | admin | Dry run by default; `confirm:true` writes. Still in the repo. |
| closeCashSession | Z close + daily email | user (admin branch) | Core.SendEmail |
| completeSale | sale, stock and number (via `shared/saleCompletion.ts`) | user | – |
| createInvoice | invoice from sales/docs; deletes the invoice if a later step fails (leaves a number gap) | user | PDF, FiscalRecord (no-op while off) |
| createPaymentLink | Stripe checkout link | user | api.stripe.com, email. **Not configured** (no Stripe secret). |
| generateDocumentPdf | PDF, stored as a private file | user | Core.UploadPrivateFile / signed URL |
| helloClientLookup | repair order → service line | user | HELLOCLIENT_API_URL. **Not configured.** |
| integrationStatus | which secrets are present (booleans) | admin | – |
| nextNumber | next number in a series | user | – |
| openCashSession | open a cash session | user | – |
| receivePurchase | receive a purchase order, add stock | admin | stock-change email |
| rectifyInvoice | corrective invoice (rectificativa) | admin | – |
| refundSale | R ticket, stock back, voucher, optional rectificativa | admin | email alert |
| sendChangeAlert / sendLowStockAlert | alert emails | admin | Core.SendEmail |
| sendDailyReport | daily report (`modo` auto / prueba / cierre) | admin | Core.SendEmail. The scheduler runs as a user context (runs complete). |
| sendDocument | ticket/invoice/quote/deposit by WhatsApp or email | user | WhatsApp: direct Graph v21.0 if `WHATSAPP_TOKEN` is set, else Reparo relay; email via Core.SendEmail (template `DocumentoServicio`); copy to Inbox Pro; **makes a public permanent copy of the PDF** (`Core.UploadFile`) (:131-145) |
| **sendPendingDigest** | 13:00 WhatsApp of Pendientes created today | **public when `modo` is `auto` or missing** (:131-137) | Reparo relay, 20s timeout, **no retry**; MessageLog |
| sendWeeklyStockReport | weekly stock report + xlsx | admin | Core.SendEmail |
| stockAdjust | stock adjustment, stock count, purchase | admin | alert emails |
| stripeWebhook | completes a parked sale when Stripe pays | public + HMAC signature check | Returns 503 because no secrets are set |
| updateProduct | product edit with audit and price/stock alerts | admin | email |
| verifactuSubmit | send to Verifactu provider | admin | Returns early when mode=off |
| **zzImportTest / zzPbkdf2Test** | dev test stubs | **public**, no auth | None. Leftovers. |

- **Repo vs deployed: not measured.** `GET /backend-functions` came back `{"truncated":true}` because the payload includes all the code. Whether `cleanupTestData` and the `zz*` functions are deployed is [ASSUMPTION: deployed]. Phase 2 can check per-function logs (`GET /functions-mgmt/{name}/logs`).
- Hard-coded owner email in `adminPin/entry.ts:12` (the owner's own account; noted, not a secret). [VERIFIED]

---

## 5. Automations

All 3 automations are `active` with 0 consecutive failures. [MEASURED] `GET /workflows`

| Workflow | Cron (Europe/Madrid) | Calls | Runs/day | Outside shop hours? | Recent runs [MEASURED] |
|---|---|---|---|---|---|
| WhatsappPendientes | `0 13 * * *` | sendPendingDigest {modo:auto} | 1 | **Yes, on Sundays** (shop closed); 13:00 Mon–Sat is inside hours | 2 runs: 10-28 **failed** (Reparo answered 502), 10-29 OK. The digest was also sent by hand at 12:43 UTC on 10-28 (MessageLog). |
| InformeSemanalStock | `45 8 * * 1` | sendWeeklyStockReport | ~0.14 | Yes (08:45, before 09:00 opening; it is an email, so this is harmless) | 10-26 OK |
| InformeDiarioCaja | `35 21 * * 1-6` | sendDailyReport {modo:auto} | 1 Mon–Sat | Yes (21:35, after closing; by design) | 6 runs OK (10-23…10-29). MessageLog shows 2 report emails **failed** (10-26, 10-27) even though the workflow run "completed". |

- Older archived/legacy workflows ran between 10-14 and 10-22 ("Informe diario 21:30" and an earlier stock report, ids `6acf67a3…`). [MEASURED]
- The workflow run history stores the full error body, which includes the recipient phone and the Pendientes text. Personal data ends up in platform logs. [MEASURED] (values not copied)
- **Digest logic gap:** the digest picks up only tasks with `created_date` = today (Madrid) at the moment it runs. Anything entered after 13:00 is never included in any digest. [VERIFIED] `sendPendingDigest/entry.ts:153-156`

---

## 6. Integrations and secrets (names only)

**Secrets set on the app:** `REPARO_RELAY_URL`, `REPARO_RELAY_KEY`, `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `INBOX_PRO_ENDPOINT`. [MEASURED] `GET /secrets`

**Read in code but not set:** `WHATSAPP_TOKEN` (so WhatsApp always goes through the Reparo relay), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `HELLOCLIENT_API_URL`, `HELLOCLIENT_API_KEY`, `VERIFACTU_API_URL`, `VERIFACTU_API_KEY`. [VERIFIED] `functions/integrationStatus/entry.ts:25-34`

- All secrets are read with `secrets.get()` from `base44:runtime`. There is **no** `Deno.env.get` anywhere. [VERIFIED]
- No secret-like literals were found in `src/`, `base44/`, `index.html`, `public/` or `vite.config.js` (regex for sk_/whsec_/EAA/AKIA/Bearer/long hex). No `.env` files. [VERIFIED]
- `IntegracionesPanel.jsx:30` shows the public webhook URL. This is not a secret. [VERIFIED]

---

## 7. Settings stores

- **Settings entity: 2 rows.** Every reader, frontend and backend, takes the **oldest** row (`sort:'created_date', limit:1`), id `6acf638b…`. The second row (`6adb56d1…`, created 10-23) is an orphan. [MEASURED]/[VERIFIED] (20+ call sites)
- Fields: company identity (company_name, trade_name, cif, address, postcode, city, province, phone, email, web); ticket_footer, warranty_text; report_recipients; opening_hours; max_discount_pct_cashier (=10); verifactu_mode (=off); cash_denominations, opening_float; ticket_width_mm, ticket_feed_mm, label_width/height_mm, ticket_printer, invoice_printer, z_print_ticket_list; google_review_url, review_daily_goal, worker_reminders; pending_digest_enabled (=true), pending_digest_phone, pending_digest_name; email_sender_name; whatsapp_enabled (=true), whatsapp_template_ticket/invoice/deposit/quote. [VERIFIED] `base44/entities/Settings.jsonc`
- Other stores: AdminPin (PIN hash), Counter (numbering), `User.pin`, sessionStorage `tpv_admin_unlocked_until`, localStorage `tpv_resenas_<day>` (daily review counter, per device) and `it-switcher.y`. [VERIFIED]

---

## 8. WhatsApp and email templates

| Kind | Name | Where the name is stored |
|---|---|---|
| WhatsApp (Meta UTILITY) | `actualizacion_taller2` | Settings `whatsapp_template_ticket/invoice/deposit/quote` (all four hold this value) [MEASURED]; default constant `sendDocument/entry.ts:22`; **hard-coded** in `sendPendingDigest/entry.ts:15` (ignores Settings) |
| Email (Base44 templates) | `DocumentoServicio`, `EnlaceDePago` | `base44/emails/*.html`; used at `sendDocument/entry.ts:377`, `createPaymentLink/entry.ts:96` |
| Report emails | `informe_diario`, `informe_caja_sin_cerrar`, `informe_semanal_stock` (MessageLog.template labels) | `base44/shared/reportMail.ts` (HTML built in code) |

---

## 9. Cross-app calls

| Direction | Target | URL source | Auth | Timeout / retries |
|---|---|---|---|---|
| TPV → Reparo (WhatsApp relay) | `{action:'send'|'template'}` | secret REPARO_RELAY_URL | header `x-tpv-key` = REPARO_RELAY_KEY | 20s, **no retry** (`sendPendingDigest:38-50`, `sendDocument:50-56`) |
| TPV → WhatsApp Inbox Pro (CRM, "logOutboundMessage") | copy of each WhatsApp sent | secret INBOX_PRO_ENDPOINT | **no auth header** (only the URL is secret) | 10s, no retry, errors swallowed (`shared/inboxPro.ts`) |
| TPV → Meta Graph (direct) | only if WHATSAPP_TOKEN is set (it is not) | constant | Bearer | 15s |
| TPV → HelloClient | `/orders/{n}` | secret, not set | Bearer | 10s |
| Inbound | none from other apps; only `stripeWebhook` (Stripe HMAC, not configured) | – | – | – |
| Mostrador / Reparo / WhatsApp Pro | UI links only (app switcher) | `src/lib/appSwitcher.js:8-12` | – | – |

- **Reparo order ↔ TPV sale/deposit:** the only link is the free-text `repair_ref` (max 60 chars) on Sale and Deposit. There is no foreign key, no sync and no callback to Reparo. The HelloClient lookup that would fetch order data is not configured. [VERIFIED] `shared/saleCompletion.ts:213`, `NuevaSenalDialog.jsx:107`

---

## 10. Doscar-era code still present

- `src/components/doscar/*` (DoscarRestore, BackupPanel, ExcelPanel, RestorePanel, PlanPreview) and `src/lib/doscar/*` (7 files, 1,237 lines). Reachable from Ajustes → "Restaurar desde Doscar". It does browser-side `bulkCreate`/`bulkUpdate`/`deleteMany` on Product, Customer, Supplier, HistoricSale, StockMovement and AuditLog. [VERIFIED]
- `dist/assets/DoscarRestore-*.js` (366 KB) is a stale local build dated 10-29. `dist` is gitignored. [VERIFIED]
- `cleanupTestData` (one-shot); `doscar_*` fields on Customer, Product, Supplier and HistoricSale; ImportJob entity (4 runs, the last on 10-28). [VERIFIED]/[MEASURED]

## 11. Verifactu

- **It is OFF.** Settings `verifactu_mode = "off"` on both rows [MEASURED]. The schema default is `off` [VERIFIED] `Settings.jsonc:54-62`. The gate is `shared/verifactu.ts:12-13` (active only for `test`/`live`), and `verifactuSubmit/entry.ts:29-32` returns early when off. FiscalRecord has 0 rows. Provider secrets are not set. [MEASURED]
- Anyone with access to Ajustes → VerifactuPanel (admin + PIN) could switch it on. [VERIFIED] `src/components/ajustes/VerifactuPanel.jsx`

## 12. Handling of UTC timestamps without "Z"

- **Frontend:** a shared helper exists: `src/lib/dates.js:5-12` `toDate()` adds `Z` to naive ISO strings. It is imported by 52 files. Spot-check: no direct `new Date(x.created_date)` in `src/`. The only raw use is `DocumentosTab.jsx:44`, which sorts business `date` values. [VERIFIED]
- **Backend: there is no shared helper.** `sendPendingDigest:97-100` and `cleanupTestData:17-21` each define their own `toMs()`. `shared/reportMail.ts:35-38` `asDate()` and `shared/documentPdf.ts:738,740,783` use plain `new Date(value)` on naive strings. That is correct only if the Deno runtime timezone is UTC. [VERIFIED] code; [ASSUMPTION] runtime TZ=UTC.

---

## 13. Top 10 notable findings (no recommendations)

1. **Invoice numbers clash with Doscar.** TPV invoices F 2600408, 2600409, 2600410 and 2600411 (issued 10-23, 10-29, 10-30, 10-30) reuse numbers already on Doscar invoices 2600408–2600430 (dated 10-14 to 10-26, imported in HistoricSale). The F-2026 counter is at 2600411. `cleanupTestData` meant to set it to 2600430, but it never ran. [MEASURED] Counter, Invoice and HistoricSale queries; [VERIFIED] `cleanupTestData/entry.ts:15,93`
2. **Money created in the browser:** vouchers (vales) with a money value are created straight from the client with no sale or payment record. Deposits (señales) are written by the client after `completeSale`, so the two steps are not atomic. Admin RLS allows both, and all users are admin. [VERIFIED] `NuevoValeDialog.jsx:55`, `VoucherDialog.jsx:34`, `NuevaSenalDialog.jsx:103`
3. **`cleanupTestData` is still in the repo.** If run again with `confirm:true` it resets counter R-2026 and sets F-2026 to a fixed value, which can make numbers move backwards or be reused. It also deletes sales from before the cutoff (moved to trash). [VERIFIED] `cleanupTestData/entry.ts:88-117`
4. **`sendPendingDigest` needs no login when `modo` is `auto` or missing.** Any caller can trigger the WhatsApp to staff. The message includes customer names and phone numbers from Pendientes. [VERIFIED] `sendPendingDigest/entry.ts:131-137,104-113`
5. **The 13:00 digest misses afternoon tasks.** Only tasks created "today" before 13:00 are sent, so tasks entered between 13:00 and 21:00 are never reported. The cron also runs on Sunday when the shop is closed. The first production run failed (Reparo 502) and there is no retry. [VERIFIED]/[MEASURED]
6. **Pendientes is not visible on mobile or on `/venta`.** It renders only on `/tpv` at widths ≥1024px. PendingTask RLS is fully open (any user can create, update or delete). [VERIFIED] `VentaRapida.jsx:754-760`, `PendingTask.jsonc`
7. **The PIN is enforced only in the client.** Backend functions and entity RLS rely only on role=admin, and all 3 users are admin. `/articulos` (prices) and `/clientes` have no PIN. Any admin can change Product price/stock or Counter create, and Invoice create, directly through the SDK. [VERIFIED] `PinGate.jsx`, entity RLS
8. **Public permanent PDF links.** `sendDocument` re-uploads ticket and invoice PDFs, which contain customer data, as public files with no expiry. The Inbox Pro endpoint is called with no auth header. Workflow logs keep phone numbers and message text. [VERIFIED] `sendDocument/entry.ts:131-145`, `shared/inboxPro.ts`; [MEASURED] run logs
9. **Cash and reporting gaps.** 0 CashMovements. Z3 covered 10-27 evening to 10-29 (multi-day; no Z on 10-28). The current session has been open since 10-29 19:29 UTC. 2 of 7 report emails failed (MessageLog 10-26, 10-27) while the workflow showed "completed", so email failures do not surface as workflow failures. [MEASURED]
10. **Leftovers and config drift.** Public test functions `zzImportTest` and `zzPbkdf2Test`; 2 Settings rows (one orphan); `WHATSAPP_TOKEN`, Stripe, HelloClient and Verifactu secrets are absent although the UI offers those features (payment links and HelloClient lookup cannot work); the backend has no shared UTC parser; `CLAUDE.md`/`AGENTS.md` contain no TPV rules at all; repo vs deployed functions could not be compared. [VERIFIED]/[MEASURED]
