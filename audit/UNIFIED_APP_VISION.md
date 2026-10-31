# Informática Torrent — Unified "3-in-1" app: master plan

Date: 31 Oct 2026. Author: Claude (audit follow-up). Status: **vision / design only, nothing built**.

Inputs:
- the audit (Phases 1–9, `REPORT.md`, `BACKLOG.csv`);
- the code read during the audit and the deploy of 31 Oct;
- the decisions D-01…D-42.

Figures marked [MEASURED] come from the audit. [ESTIMATE] means reasoned but not measured.

---

## 0. Starting point and one correction

**Before building anything new, finish the 31 Oct deploy** (`PROGRESS_HANDOFF.md`, "NOT live yet"). The current apps are not 100 % done:
- new functions are missing in Reparo, TPV and Mostrador;
- some RLS changes and workflows are not applied.

The new app will take months. The current apps must be complete and safe while it is built, and they are also the migration source.

**What we know about today's system [MEASURED]:**

| Item | Today |
|---|---|
| Apps | Reparo (orders), TPV (money, stock), WhatsApp Pro (chats), Mostrador (launcher + "Hoy"), Estado (public pages) |
| Customer tables | **4**: Reparo `Client`, TPV `Customer`, WhatsApp Pro `Customers` and `Customer` (+ stale `RepairOrder`/`DeviceUnlockCode` mirrors) |
| Phone formats | `34XXXXXXXXX`, `XXXXXXXXX`, `+34…`, free text with spaces; ≥ 8 copies of the normaliser (B-52) |
| Cross-app links | notifyWhatsApp→reparoBridge, waLookup, tpvWhatsappRelay, logOutboundMessage, tpvBridge (B-40), mostradorLookup ×3, inboxPro copy |
| Shared keys | INTERNAL_CALL_KEY, REPARO_WA_KEY, OUTBOUND_LOG_SECRET, TPV_BRIDGE_KEY, MOSTRADOR_KEY, IMPORT_SECRET… |
| Volume | ≈ 13 orders, ≈ 25 sales and ≈ 117 WhatsApp messages per day; 3,751 orders/year; 9,100 products |
| Speed | TPV `/venta` ready in 2.8–3.8 s (catalogue reload); Reparo search 0.9 s; WhatsApp Pro first load 1.37 MB |
| Credits | ≈ 2,980/month before the audit → ≈ 900 after the audit plan |

**Key technical fact (proved on 31 Oct):** the TPV's newer Base44 runtime supports `base44/shared/*.ts` imported by several functions. WhatsApp Pro's older runtime does not. **Building the new app on the newer runtime solves B-52 by construction.**

---

## 1. One data model: "Cliente 360"

### 1.1 Principle

- **One record per real person.** Everything else points to it by `person_id`.
- **The phone is not the key.** It is a contact point with a uniqueness rule. Families share phones, people change numbers, and companies have several.
- **Nothing is copied between modules.** A chat, a repair and an invoice are rows that reference the same person. No sync, no mirrors.

### 1.2 Entities (new app)

| Entity | Purpose | Replaces |
|---|---|---|
| `Person` | name, type (individual/company), NIF/DNI, language, notes, `merged_into` | Client, Customer, Customers, Customer |
| `ContactPoint` | `person_id`, kind (mobile/landline/email), `value_e164` (normalised, **unique**), `primary`, `verified_via` (whatsapp, ticket, invoice) | phone fields scattered in 6 entities |
| `Consent` | `person_id`, channel (whatsapp/email/marketing), granted_at, source, revoked_at | `whatsapp_consent`, `marketing_consent`, `opted_out` copies |
| `Device` | `person_id` (current owner), brand, model, **IMEI / serial (unique)**, colour, `ownership_proof` (D-40: data + signature) | IMEI inside `RepairOrder.fields`, `SerialUnit` |
| `RepairOrder` | `person_id`, `device_id`, status, budget lines, `ready_at`, `status_since`, history | Reparo RepairOrder (+ WhatsApp Pro mirror) |
| `RepairEvent` | append-only history (status, comment, file, paid) | `RepairOrder.events[]` (B-51) |
| `Sale` / `SaleLine` / `Payment` | money; `repair_order_id`, `device_id` per line | TPV Sale (+ `repair_ref` free text) |
| `Invoice` / `FiscalRecord` | invoices and the Verifactu chain, immutable | same as TPV |
| `Conversation` / `Message` | `person_id` + `contact_point_id`, 24 h window | WhatsApp Pro Conversations/Messages |
| `Product` / `StockMovement` / `SerialUnit` | catalogue and stock; `SerialUnit` becomes a `Device` with `status=in_stock` | TPV |
| `Deposit` / `Voucher` | linked to person **and** repair order | TPV |
| `Counter` | one row per series, conditional increment | TPV Counter + Reparo order number (B-30) |
| `Task` | Pendientes + follow-ups, linked to person/order | TPV PendingTask, WhatsApp Pro ShopTask |
| `TimelineItem` (derived, optional) | one row per event for the customer card: message, status, payment, invoice | 4 separate lookups today |
| `AuditLog` | server-written only | 3 audit logs |

**The device is the hidden key of this business.** Warranty, FRP (D-40), second-hand sales and repeat repairs all hang off the IMEI or serial. Today the IMEI lives in a free custom field of the order. In the new app:
- scanning or typing an IMEI resolves the device;
- from the device you get every repair, every sale and the current owner.

### 1.3 Identity rules (no duplicates without sync)

1. **One normaliser** (`core/phone.ts`) for every input: forms, imports, the webhook and search. It produces E.164, so `+34 619 48 09 04` → `34619480904`.
2. **`ContactPoint.value_e164` is unique.** Base44 has no unique index, so uniqueness uses the **claim pattern already proved in B-12/B-30**:
   - a single server function `resolvePerson(phone|email|nif)` is the only creator;
   - it does a conditional write and re-reads;
   - two counters typing the same number at the same time get the same person.
3. **Inbound WhatsApp from an unknown number** creates a *provisional* Person, flagged `unverified`. It becomes real when the shop attaches a name, an order or a sale. No customer is ever duplicated just because they wrote first.
4. **Merge, not delete.** Two people found to be the same get `merged_into`. References are re-pointed by a server job with an audit row, and the losing record stays as a tombstone.
5. **Shared phones** (a parent repairing a child's phone) are handled by `ContactPoint` → several Persons. The WhatsApp card then shows "este número es de 2 clientes" and lets you pick, instead of guessing.

### 1.4 What "real time" means here

- **Same database**: the chat, the repair and the ticket are read from the same app. Nothing is copied, so nothing can be stale.
- **Live screen**: Base44 entity subscriptions (already used by WhatsApp Pro's inbox) push new messages, status changes and payments to every open screen.

---

## 2. The counter screen (all-in-one UI)

### 2.1 Layout (desktop at the counter; tablet and phone collapse it)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [⌘K  Buscar: teléfono · nombre · nº orden · ticket · IMEI · código]   🟢 Caja │
├─────────────┬───────────────────────────────────────┬────────────────────┤
│ INBOX (fijo)│  PANEL CENTRAL (modo)                  │ FICHA CLIENTE 360  │
│ • esperando │  [Taller] [Caja] [Asistente] [Hoy]     │ (aparece al elegir │
│ • no leídos │                                        │  chat/orden/ticket)│
│ • alertas   │  Taller: lista/kanban de órdenes       │ • datos + consent. │
│   en vivo   │  Caja: ticket + teclado + lector       │ • dispositivos     │
│             │  Asistente: tarjeta a tarjeta (D-42)   │ • órdenes abiertas │
│             │  Hoy: el panel de Mostrador            │ • tickets/facturas │
│             │                                        │ • chat (últimos)   │
│             │                                        │ [Cobrar] [Avisar]  │
└─────────────┴───────────────────────────────────────┴────────────────────┘
```

- **Left:** the inbox is always visible, with the waiting count and live alerts. These replace today's voice queue and push notifications.
- **Centre:** one work area that switches mode with keyboard shortcuts (F1 Taller, F2 Caja, F3 Asistente, F4 Hoy) and never reloads the page.
- **Right:** the Cliente 360 card. It opens from anything you select and stays while you work in the centre.
- **Top:** one search box that understands what you type:

  | Input | Result |
  |---|---|
  | 9–13 digits | phone |
  | ≤ 7 digits | order |
  | `T-2026/120` | ticket |
  | 15 digits | IMEI |
  | EAN | product |
  | text | name |

### 2.2 Speed targets

| Action | Today | Target | How |
|---|---|---|---|
| Barcode → line on ticket | 12 ms [MEASURED] | ≤ 12 ms | catalogue in IndexedDB (B-48 design), in-memory index by barcode/SKU |
| Open Caja | 2.8–3.8 s per switch | 0 s (already loaded) | one app; Caja is a mode, not a page load |
| Global search | 0.9 s (Reparo) | < 300 ms | exact-match routing (B-50) + local index of recent customers |
| Customer card | 3 apps, 3 logins | 1 query | same database, one `getPersonCard` function |

### 2.3 New automatic flows (possible only with everything together)

1. **Scan anything.**
   - Product barcode → added to the ticket.
   - IMEI or serial → device card: repairs, warranty end, owner and sale.
   - Receipt QR (`ticket_uuid`) → the repair opens with **[Cobrar]** pre-filled (price, deposit, customer).
   - Voucher code → applied to the ticket.
2. **WhatsApp arrives → card pops up.** If the customer has an order "Listo", the card shows **Listo para recoger · 89 € · [Cobrar] [Avisar]**. When they walk in, it is one click.
3. **Cobrar = close the repair.**
   - One server transaction creates the sale, applies the deposit, closes the order as Entregado, starts the warranty on the device and links the invoice.
   - There is no bridge, no retry queue (B-40's `ReparoSync` disappears) and no "pagado pero no entregado".
4. **Budget answered in chat.**
   - The customer replies "sí" to the budget → the card shows **[Aceptar presupuesto]**.
   - One click: the status changes, the technician queue updates and the customer gets the confirmation.
5. **Warranty without searching.** The IMEI on a new order finds the previous repair and sale and proposes "garantía de #39227 · quedan 41 días".
6. **One "Hoy" built from live data** (not three lookups): ready to collect, chats waiting, budgets, parts, cash and pending tasks.
7. **Mail-in (B-45) end to end.** A tracking number typed on the order is sent in T-08 and printed on the label.
8. **Second-hand buy/sell.** Buying a phone from a customer creates a `Device` with ownership proof and a `SerialUnit`. Selling it later keeps the chain, which also serves the FRP rule (D-40).

---

## 3. Architecture, security and credits

### 3.1 One app, modules inside

```
base44/
  shared/core/       ← B-52: the only copy of each rule
    phone.ts         E.164 normaliser + validation
    hours.ts         shop hours D-12 + holidays, one setting
    meta.ts          send (24 h window → template), retries, FailedSend, global pause (B-10)
    ai.ts            anonymiser (B-46) + provider + blocklist/allowlist (D-40/D-41, B-21)
    auth.ts          roles (admin / técnico / cajero), PIN pass (B-55), approval
    money.ts         rounding, VAT, totals (one implementation)
    counters.ts      conditional increment (TPV pattern)
    audit.ts         server-only audit writes
  functions/
    webhookMeta      the ONLY Meta webhook
    checkout, refund, issueInvoice, takeDeposit, issueVoucher   ← B-36
    resolvePerson, mergePeople, getPersonCard, search
    repairs/*, inbox/*, reports/*, scheduler (one tick)
  entities/  …       (section 1)
src/
  modules/inbox · taller · caja · asistente · hoy · ajustes  (lazy-loaded, B-49)
```

### 3.2 B-36 built in: money and numbering only on the server

- **RLS:**
  - `Sale`, `Invoice`, `FiscalRecord`, `Counter`, `Payment`, `Deposit`, `Voucher` and `StockMovement` have **create/update/delete = server only** from day 1;
  - `Product` price and stock are changed only through functions.
- **Validation:** the browser sends *intent* (lines, payment method). The server recomputes prices, discounts (cajero limits) and VAT, assigns the number with `counters.ts` and writes everything in one function.
- **Same id makes cobros idempotent:** `client_request_id` with the `SaleRequest` claim (B-12, already proved).
- **Numbering:**
  - series per year (`T-2026`, `R-2026`, `F-2026`, `FR-2026`, `P-2026`, order numbers);
  - no number is reused (the F 2600408–411 problem cannot happen again);
  - gaps are logged.
- **Verifactu:**
  - every invoice gets its `FiscalRecord` with the hash chain at creation, even while sending stays off until 2027;
  - the chain is continuous from the first imported record.

### 3.3 B-52 built in: one engine

Each rule exists once (`shared/core`). Today:
- the hours check exists ≥ 8 times;
- the phone normaliser ≥ 10 times;
- the LLM call 9 times;
- there are 4 send paths to Meta (sendMessage, reparoBridge, tpvWhatsappRelay, direct Graph calls in 6 jobs).

In the new app, **every** WhatsApp goes through `meta.ts`. That gives one log, one retry queue, one pause switch and one 24 h window rule.

### 3.4 Security by default

- invite-only registration (B-35); roles enforced by RLS **and** in functions (B-39);
- no public function without a signature or an unguessable id (B-01/B-02/B-05/B-29);
- one webhook with HMAC (already in place);
- secrets only in the platform (B-03);
- **4 keys disappear**: REPARO_WA_KEY, OUTBOUND_LOG_SECRET, TPV_BRIDGE_KEY, MOSTRADOR_KEY. Nothing calls across apps any more.
- daily backup (B-09) and retention jobs (B-54) from day 1.

### 3.5 Credits and time [ESTIMATE, to measure in the shadow phase]

| Source | After the audit plan | Unified app | Why |
|---|---|---|---|
| Scheduler workflows | WA masterTick 10 min (≈ 244) + Reparo 15 min (≈ 160) + TPV jobs (≈ 60) + Mostrador brief/health (≈ 80) + reminders/voice/backup ×3 apps (≈ 120) | **one tick** every 10 min in shop hours, ≈ 250–300 | one scheduler instead of 4–5; backup and retention once, not per app |
| Bridge calls | queue + reparoBridge + waLookup + relay + tpvBridge + 3 lookups | 0 | same database |
| LLM | drafts + KB batch | same, minus duplicated context fetches | `getPersonCard` gives the AI context in one read |
| **Total** | **≈ 900/month** | **≈ 550–650/month** | ≈ −30 % more on top of the −70 % already planned |

**Staff time [ESTIMATE]:**
- The audit's cross-app buttons already save 20–35 min/day.
- Removing the remaining switches, logins and 3-s reloads, and getting the pop-up card, adds **≈ 10–15 min/day**.
- **Errors avoided**: wrong customer chosen, order paid but not closed, duplicate customer. Fewer of them, which is worth more than the minutes.

**Load:**
- one bundle split by module;
- the Caja catalogue is cached (≈ 9,100 products, delta sync), so ≈ 0 s per switch instead of 2.8–3.8 s;
- the first load of the day is similar to today's WhatsApp Pro, then instant.

### 3.6 Risks of "one app" (and answers)

| Risk | Answer |
|---|---|
| One failure stops everything | Webhook and checkout are small, separate functions with their own error handling. The global pause plus health check (B-44) stays. **Caja must keep working offline for cash sales** (queue in IndexedDB, synced with `client_request_id`). |
| Platform limits (rate limit ≈ 140 calls/min/user measured; entity count; bundle) | Batch reads (`getPersonCard`), subscriptions instead of polling, lazy modules |
| Big-bang change | Section 4: parallel build, shadow weeks, one-day switch with rollback |
| RLS mistakes lock staff out | Test matrix with one account per role before go-live (B-39 lesson) |

---

## 4. Migration with zero downtime

### 4.1 Approach: build in parallel, switch once

The new app is a **new Base44 app** with its own database. Base44 apps cannot share a database, so data is **copied**, never synced, and the copy is repeated until the result is boring.

### 4.2 Phases

| Phase | Weeks [ESTIMATE] | What | Exit check |
|---|---|---|---|
| **0. Finish today's deploy** | 1 | Pending items of 31 Oct; daily backups running in the 3 apps (B-09) | 7 successful verified backups per app |
| **1. Core + data model** | 3–4 | `shared/core`, entities, RLS, `resolvePerson`, counters, checkout | Unit tests on money/VAT/numbering/phone; role matrix |
| **2. Importer** | 2 | Reads the **B-09 backup files** (no load on production), maps to the new model, builds the identity graph | Dry run: every source row accounted for (imported / merged / rejected with reason) |
| **3. Modules** | 4–5 | Caja → Taller → Inbox → Hoy/Asistente → Ajustes | Each module tested on imported data |
| **4. Shadow** | 2–3 | Nightly re-import. Staff use the new app **in training mode** on Sundays/evenings. Inbound WhatsApp copied read-only to the new app (forwarder, no sending) | Same totals as the old apps for 2 weeks (Z, orders, chats); Joney's OK |
| **5. Switch day** | 1 day (Sunday) | Below | Checklist green |
| **6. Old apps read-only** | 30 days | Consultation only, then archive (B-60/B-62) | No one needed them for 2 weeks |

### 4.3 Identity merge at import (the hard part)

1. Normalise every phone, email and NIF from the 4 customer tables.
2. **Automatic merge** only when two or more strong keys agree (same E.164 phone **and** same name or NIF), or same NIF.
3. Everything else goes to a **review list**:
   - the duplicates report (B-56) gives the size;
   - Joney or staff decide in batches, and the decisions are stored so re-imports repeat them.
4. Devices: IMEI from order fields and `SerialUnit`, validated with the Luhn check. Order and sale history attach to the device.

### 4.4 Numbering and Verifactu continuity

- **Invoices, tickets and fiscal records are imported as they are:** same series, same numbers, same dates, marked `imported`. Never renumbered.
- **Counters** in the new app start at **max(imported) + 1** per series. The cut-over checklist compares them with the old apps' counters at freeze time.
  - Example: F-2026 old counter 2600430 + invoices issued until the switch → the new app starts at the next one.
- **The F 2600408–411 clash** (B-15) must be resolved with the gestoría **before** the import, so the decision is imported, not the problem.
- **Verifactu chain:** the last imported `FiscalRecord` hash is the previous hash of the first new one. Validate the whole chain at import (hash recomputation).
- **Order numbers** continue from Reparo's last number. Receipt QR codes (`ticket_uuid`) are kept, so every QR already printed keeps working.

### 4.5 Switch day (Sunday, shop closed)

| Time | Step |
|---|---|
| Sat 14:00 | Shop closes. **Freeze** old apps: Caja closed (Z), global pause on, banner "cambio de sistema" |
| Sat 15:00 | Final backup of the 3 apps + **delta import** (only rows changed since the last nightly import) |
| Sat 16:00 | Automatic checks: counts per entity, sums of sales/invoices per day, counters, Verifactu chain, 20 random customers compared side by side |
| Sun 10:00 | **Meta webhook** switched to the new app (one setting in Meta). Public status page and review links point to the new app (Estado host redirect, same `ticket_uuid`) |
| Sun 11:00 | Live tests with +34 658 … 734 only: inbound, reply, template, status notice, sale, invoice, refund, PIN, backup |
| Sun 12:00 | Go / no-go with Joney |
| Mon 9:30 | Open on the new app. Old apps read-only |

**Rollback** (any time until Monday 14:00):
- point the Meta webhook back;
- unfreeze the old apps;
- re-key only the sales of that morning (few, printed tickets exist).

After Monday 14:00, roll forward only.

### 4.6 What the shop sees

- **Saturday afternoon:** nothing to do.
- **Monday:** one app, one login, the same order numbers, customers, history and QR codes.
- **Training:** two short sessions during the shadow weeks, with an "Asistente" tour.

---

## 5. Recommendations (in order)

1. **Finish and stabilise the 31 Oct deploy first.** It is also the safest migration source (backups).
2. **Decide the gestoría questions** (F 2600408–411, custody clause T-06) before the import.
3. **Build the core and the importer first.** Running the importer against real backups early shows the true size of the duplicate-customer problem, which drives the rest of the timeline.
4. **Caja first among the modules:** it is the money and the strictest legally. Then Taller, then Inbox.
5. **Keep scope tight for v1:**
   - no new features beyond those listed here;
   - parity first; the new flows (§2.3) are the reason to switch.
6. **Realistic total: 12–16 weeks** of part-time build plus 2–3 shadow weeks [ESTIMATE].
