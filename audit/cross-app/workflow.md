# Phase 6 — Real workflow walk-through

Date: 2026-10-30 · Auditor: Claude Code · Mode: **read-only**.
Tags: **[VERIFIED]** code/data · **[MEASURED]** measured · **[ASSUMPTION]** to confirm with Joney/staff.
No personal data reproduced.

## 0. Method

- **Counts come from the code paths staff use** (forms, buttons, required fields, configured `ShopField`/`ShopStatus` rows), not from watching staff. They are the *minimum* for the normal path; real use is usually higher. A live walk-through with Joney at the counter PC is still needed to confirm (§6).
- **Units:** *clicks* = mouse clicks / taps / Enter on a picker · *typed* = fields where staff types · *re-typed* = data that already exists in another app and is typed again · *switches* = moving between apps (via the Mostrador icon: icon → Mostrador → tile = 2 clicks + page loads) · *waiting* = system time staff waits for.
- **Measured inputs used:**
  - App load times from Phase 3: Mostrador 1.0 s, TPV `/venta` usable 2.8–3.8 s (catalogue re-downloaded on every visit), Reparo tickets list 2.2 s, search by order number 0.9 s, open ticket 1.9 s.
  - Volumes [MEASURED, Reparo ActionLog + TPV data]:
    - ≈ 12–15 new repair orders per day (9 on 30 Oct by 13:35 Madrid). 2 of them that day were warranty claims.
    - ≈ 10–15 status changes per day.
    - ≈ 25 TPV sales per day (69 live sales 28–30 Oct). 4 invoices issued in total.
    - Welcome WhatsApp sent ≈ 62 s after an order is created (e.g. created 12:33:44 → WhatsApp 12:34:46 UTC) ✅ target "1 minute" met.

## 1. Summary — today vs proposed (per occurrence)

| # | Step | Today: clicks / typed / re-typed / switches | Proposed: clicks / typed / re-typed / switches | Main change |
|---|---|---|---|---|
| 1 | Find/create customer (walk-in, existing) | 2 / 1 / 0 / 0 | 2 / 1 / 0 / 0 | already good (phone autocomplete) |
| 1b | Customer who wrote on WhatsApp → new order | 4 / 1 / **1 (phone)** / **1** | **1 / 0 / 0 / 0** | "Crear reparación" button in the WhatsApp chat |
| 2 | Repair order form | ≈ 14 / ≈ 10 required inputs / 0 / 0 · ~1–2 min | ≈ 10 / ≈ 6 / 0 / 0 | conditional fields, defaults |
| 3 | Deposit (señal) in TPV | ≈ 9 / 3–5 / **2–3 (phone, order no., name if new)** / **1** + 3–4 s load | **2 / 1 (amount) / 0 / 0** | "Cobrar señal" from the Reparo ticket |
| 4 | Status change (+ customer notice) | 4 / 0–1 / 0 / 0 | 3 / 0 / 0 / 0 | show which status messages the customer; fewer ambiguous statuses |
| 4b | Budget answer from customer (arrives on WhatsApp) | 6 / 0–1 / **1 (order no.)** / **1** | **2 / 0 / 0 / 0** | Accept/reject buttons on the chat's Reparo card |
| 5 | Pickup → charge → ticket → review | ≈ 16 / 4–5 / **3–4 (description, price, phone, order no.)** / **2** + 3–4 s | **≈ 5 / 0 / 0 / 1** | "Cobrar en TPV" with prefilled line, deposit applied, paid → order closed |
| 6 | Uncollected devices reminders | manual, per device ≈ 5 clicks + free text, sent from a personal WhatsApp | **0** (automatic, Phase 7) | scheduled reminders + "Sin recoger" list |
| 7 | Warranty claim (find order + original ticket) | Reparo ≈ 4 / 1 · TPV ticket: ≈ 5 / 1 / **1** / **1** | ≈ 4 / 1 / 0 / 0 | order ↔ sale link, "Ver ticket" button |
| 8 | Accessory sale (scan) | ≈ 4 / 0 / 0 / 0 · 12 ms per scan | same | already good |
| 8b | Pendientes + 13:00 digest | add: 3 / 2 · visible only on `/tpv` ≥1024 px | same + visible everywhere | visibility + digest fix |
| 9 | Mail-in repair | no process in the apps (all manual WhatsApp) | defined process (to design with Joney) | — |
| 10 | Cash close X/Z | X: 1 · Z: ≈ 5 + 1–15 inputs | same + reminder | reminder, not more UI |

**Estimated time saved:** ≈ **20–35 min per day** at today's volumes. The calculation is in §4 and depends on 3 assumptions marked there.

---

## 2. Step by step (today)

### Step 1 — Customer walks in or writes on WhatsApp → find/create customer
**Walk-in (Reparo):** "+ Ticket" (1) → type phone (1 field); `ClientPhoneField` suggests existing clients → pick (1). Linked client prefills name, phones, email, DNI and shows the last 5 tickets ✅ [VERIFIED `NewTicketDrawer.jsx:116-122,452-472`].
New client: + name + **DNI (required for every client)** [VERIFIED `ShopField` DNI `required=true`].

**Customer who wrote on WhatsApp first:**
- Staff is in WhatsApp Pro. To open a repair they switch app (Mostrador icon → Mostrador → Reparo: 2 clicks + 1 switch, ≈ 2–3 s).
- In Reparo they click "+ Ticket" and **type the phone again** (it is shown in WhatsApp Pro but not passed on).
- WhatsApp Pro has no "create order" button; its own `/pedidos/nuevo` is the obsolete mirror (Phase 5 U-02) [VERIFIED].

**Identity issue:** three customer databases. A new customer created in Reparo does not exist in the TPV (≈45 % of TPV customers exist only in the TPV) [MEASURED Phase 2].

### Step 2 — Repair order in Reparo
Form = client column + 13 active ticket fields [VERIFIED `ShopField`, 13 active].

| Field | Required | How it is filled |
|---|---|---|
| Nombre, DNI | yes | prefilled for known clients |
| Ejecutor | no | select |
| Plazo | yes | prefilled (+ `estimate_days`) ✅ |
| Forma de comunicación | yes | list (handbook) |
| ¿Se enciende? | yes | text |
| Avería | yes | list / text, quick-pick chips ✅ |
| Apariencia | no | list |
| IMEI / SN | yes | type or scan; at 15 digits Marca + Modelo filled automatically ✅ |
| Marca, Modelo, Color, Accesorios | no | auto / lists / chips |
| Contraseña (secret) | yes | type |
| Presupuesto aproximado | yes | list / text |
| Tarjeta SIM, Bandeja SIM | yes | lists — asked also for laptops, consoles, PCs |
| Print documents | — | remembered per PC ✅ |

- **≈ 10 required inputs per order**, many with one-tap chips. Typing time ≈ 1–2 min [ASSUMPTION; to time live].
- Good: IMEI auto-detect, quick-pick values, "Aceptar en garantía", "Duplicar", photos/camera button. **TicketFile has 0 rows**, so photos are never attached today [MEASURED].
- Friction:
  - SIM fields are required for every device type.
  - "¿Se enciende?" is free text.
  - Every created order logs an `unlock_code_viewed` right after `order_created` (ActionLog) — the print step reads the code. Not a time cost, but it makes the audit trail noisy [VERIFIED data pattern].
- Customer WhatsApp after ≈ 62 s ✅ (`notifyWhatsApp` queue → WhatsApp Pro `reparoBridge` "welcome").

### Step 3 — Deposit (señal) in the TPV linked to the order
Today [VERIFIED `NuevaSenalDialog.jsx`]:
1. Switch to the TPV (2 clicks + 1 switch). The catalogue loads in 2.8–3.8 s [MEASURED].
2. `/senales` (1) → "Nueva señal" (1).
3. Customer: search by phone (**re-typed**). If not in the TPV: create it (name + phone **re-typed**).
4. Amount (typed) + method (1).
5. "Encargo" = Reparo order number, **free text, re-typed**.
6. Cobrar (1) → print or send (1–2).

- **Total ≈ 9 clicks, 3–5 typed, 2–3 re-typed, 1 switch.**
- **Usage today: `Deposit` = 0 rows** [MEASURED]. Señales are either not taken or not recorded in the TPV → **question for Joney**.
- The Reparo order never learns the deposit exists (no link back) [VERIFIED Phase 2].

### Step 4 — Status updates, budgets, parts
Today: open the ticket (click in list, or type the number: 0.9 s) → status pill → pick status → saved (≈ 4 clicks). Customer WhatsApp ≈ 60 s later **only for these statuses** [VERIFIED `reparoBridge/entry.ts:64-76,212-228`]:

| Status | Customer message | Comment |
|---|---|---|
| Nuevo | welcome | ✅ |
| Listo + Whatsapp | "listo para recoger" | ✅ |
| **Listo** (plain) | **none** (was "voice only"; voice is dead since June, Phase 5) | Same meaning as above, no message → risk of a customer never told [ASSUMPTION on how often staff picks it] |
| No Reparación | "no ha sido posible reparar" | ✅ |
| Contactar con Nosotros | "necesitamos contactar" (contains a hard-coded landline number) | wording check |
| Enviar un Presupuesto | sends `estimated_cost` text | ✅ but the answer comes back on WhatsApp (step 4b) |
| Iniciar Conversación | opener | ✅ |
| En proceso, Esperando Material, Pendiente | **none** | "parts ordered" notice missing (AUDIT step 4) |
| Entregado / Entregado + Reseña / Cerrado / Cancelado | none / review scheduled next day | review uses a MARKETING template without consent check (SEC-06) |

- The status groups are odd: "Entregado", "Cerrado" and "Cancelado" all sit in group `failed` [VERIFIED `ShopStatus`]. This works because `reparoBridge` matches status **names**, but any report by group mixes delivered and cancelled orders.
- **Step 4b, budget answered on WhatsApp:** the customer replies in WhatsApp Pro. Staff reads it, switches to Reparo (2 clicks), types the order number (re-typed, or searches by phone), and changes the status. There is **no "Presupuesto aceptado / rechazado" status**.
- The chat's Reparo card (`clientCard` → `waLookup`) should show the order. Its working is **unconfirmed**: 0 waLookup calls since 29 Oct 19:12 (Phase 5 finding 8).

### Step 5 — Repair done → notified → pickup → charge in TPV with deposit → ticket/invoice → review
Today [VERIFIED code; counts minimum]:
1. Reparo: find ticket (≈ 2–3 clicks or type number).
2. Switch to the TPV (2 clicks, 1 switch, 2.8–3.8 s catalogue load).
3. `/tpv`: add the repair line. There is no link to the order, so the **description and price are re-typed** from Reparo, or a generic service is used and the price typed.
4. Customer: search by **phone, re-typed**. Searching with "+34" or spaces fails (Phase 3 S8).
5. **Deposit:** `/tpv` (the main desktop screen, 65 vs 12 visits) **cannot apply a señal**: it always sends `deposit_id: ''` [VERIFIED `VentaRapida.jsx:460`]. Only the touch screen `/venta` → `CobrarDialog` can, and only the customer's *first* open deposit, with the amount typed by hand [VERIFIED `CobrarDialog.jsx:45-48,96-103`]. So a desk sale with a deposit means changing screen or refunding manually.
6. "Encargo" (`repair_ref`) is optional free text. It was **filled on 0 of 69 sales** [MEASURED], so in practice it is never filled.
7. Cobrar → method → confirm (≈ 3 clicks). Print or WhatsApp/email the ticket (1–2 clicks; 2 tickets sent by WhatsApp so far [MEASURED MessageLog]).
8. Back to Reparo (1 switch) → status "Entregado + Reseña" (2 clicks). The review request goes out the next day.

**Total ≈ 16 clicks, 4–5 typed, 3–4 re-typed, 2 switches, ≈ 6–8 s of loading.**

### Step 6 — Uncollected devices
- No automation and no "ready for X days" view [VERIFIED: no scheduler for it in any app; NotificationQueue reminders are staff alerts for unanswered chats].
- The ticket menu "send status link" opens **`wa.me` (the PC's personal WhatsApp), not WhatsApp Pro**, with free text. That message is not logged and is not from the shop's API number flow [VERIFIED `TicketMoreMenu.jsx:43-46`].
- **Storage policy (days, final notice) unknown → question for Joney.**

### Step 7 — Warranty claim within 6 months
- Reparo: search by phone or number → open the delivered ticket → "Aceptar en garantía" creates a linked new ticket with the same client and device ✅. Used 2× on 30 Oct [MEASURED].
- Original sales ticket: switch to the TPV → `/tickets` → search by customer (phone re-typed; "+34" bug) → guess which ticket matches. There is no order ↔ sale link (0/69 `repair_ref`).

### Step 8 — Accessory sales, accessory orders, Pendientes, 13:00 WhatsApp to Japji
- Accessory sale at `/tpv`: scan (12 ms) → cobrar → method → print ≈ 4 clicks ✅ fast.
- Pendientes:
  - Panel only on `/tpv` at ≥1024 px (not on `/venta`, not on mobile) [VERIFIED].
  - Adding one = ≈ 3 clicks + 2 typed (title, customer).
  - The 13:00 digest includes only tasks created today before 13:00, runs on Sundays, and has no retry [VERIFIED Phase 1]. 3 digests were sent and 1 failed [MEASURED MessageLog].
- Accessory orders ("encargos") are Pendientes of kind order. No supplier order is linked (purchasing is hidden by decision D-02).

### Step 9 — Mail-in repair customers (national)
- **No mail-in process exists in any app**: no status (e.g. "Recibido por mensajería", "Enviado"), no tracking field, and no instructions message [VERIFIED `ShopStatus` list, ticket fields].
- The question arrives on WhatsApp. AnswerLibrary has topics `envio_recogida` and "cómo puedo enviar mi dispositivo", both draft or not-live (Phase 5).
- → Needs Joney's description of the real process (courier, who pays, packaging, payment before return) before designing anything.

### Step 10 — Cash close (X then Z) and end-of-day reports
- X: `/caja` shows the live summary (`cashSummary`), 1 click ✅.
- Z: tab "Cierre de caja" → Arqueo (count per denomination, up to 15 inputs, or one total) → accept → close (≈ 5 clicks).
- Daily e-mail at 21:35 is automatic (`sendDailyReport`), with a "caja sin cerrar" variant ✅.
- Measured problem: **the Z is not done every day**. Z3 covered 27 → 29 Oct, there was no Z on 28 Oct, and the current session has been open since 29 Oct 19:29 UTC [MEASURED Phase 1]. 2 of the report e-mails failed silently.

---

## 3. Proposed flow (same counts)

Designs for the backlog. Nothing implemented. Fields and wording to be approved by Joney.

1. **One customer key = phone E.164** (Phase 2). Every cross-app button passes `phone`, `name` and `order_id` in the URL, so nothing is re-typed.
2. **WhatsApp Pro chat → "Crear reparación"** (opens `reparo…/tickets/nuevo?phone=…&name=…` in the same tab). Reparo's form already accepts `?client=`; add `?phone=`.
   → step 1b: 4→1 clicks, re-typed 1→0, switches 1→0 (the button *is* the switch).
3. **Reparo ticket → "Cobrar señal" / "Cobrar en TPV"** (opens TPV `/venta?order=39358&phone=…&amount=…`).
   - The TPV finds or creates the customer by phone (Reparo data prefilled).
   - It adds the repair line with the order's `offer_total`/`estimated_cost` (editable, admin rules apply) and sets `repair_order_id` (structured, not free text).
   - It **auto-selects the customer's open deposit for that order**. This first needs the `/tpv` desktop fix (send `deposit_id`) and deposit choice by order instead of "first deposit".
   - On completion the TPV calls Reparo (`paid` event, queue + retry like `notifyWhatsApp`). Reparo stores `sale_id` and moves the order to "Entregado" (+ review only if consent, SEC-06).
   → step 3: 9→2 clicks; step 5: ≈16→5 clicks, re-typed 3–4→0, switches 2→1.
4. **Statuses:**
   - Merge "Listo" into "Listo + Whatsapp", or make plain "Listo" also notify.
   - Add "Presupuesto aceptado" / "Presupuesto rechazado".
   - Optional customer notice for "Esperando material" (draft text for Joney).
   - Show a 💬 icon next to statuses that message the customer.
   - Fix the status groups (delivered ≠ failed).
5. **Chat Reparo card** (after confirming `waLookup` works): show the open order with buttons *Aceptar presupuesto / Rechazar / Ver en Reparo*. → step 4b: 6→2 clicks, no switch.
6. **New-order form trimming** (Joney decides; no business data invented):
   - Tarjeta/Bandeja SIM required only when Marca/IMEI says it is a phone.
   - "¿Se enciende?" as Sí/No chips.
   - "Forma de comunicación" defaulting to WhatsApp when the phone is a mobile.
   - → ≈ 10→6 required inputs for non-phones.
7. **Uncollected:** automatic reminders at 3/7/15 days from "Listo" through WhatsApp Pro (utility template, logged, retried); final notice per Joney's storage policy. Plus a "Sin recoger" list in the Mostrador "Hoy" panel. Remove the `wa.me` free-text menu item, or route it through WhatsApp Pro. (Detail and cost in Phase 7.)
8. **Warranty:** "Ver ticket de venta" on the order (via `sale_id`) and "Ver reparación" on the TPV ticket. → original ticket in 1 click.
9. **Pendientes:** visible on `/venta`, on mobile and in the Mostrador "Hoy" panel. The 13:00 digest sends *all open* Pendientes (not only today's before 13:00), skips Sunday, and retries via the queue.
10. **Mostrador "Hoy" panel + global search** (Phase 6 idea, value confirmed by the counts above):
    - Panel: ready to collect, budgets awaiting answer, unanswered chats, Pendientes, cash still open, failed sends.
    - One search box: phone / name / order no. / ticket no. / IMEI → jumps to the record.
    - Saves most "switch + re-type phone" pairs, which are the main cost in every step above.
11. **TPV load:** cache the catalogue (IndexedDB + delta, Phase 3). Every switch into the TPV then costs < 1 s instead of 2.8–3.8 s.
12. **Cash close:** a discreet reminder on the TPV at closing time if the session is open, and the item in the morning brief (Phase 7). No extra screens.
13. **Mail-in:** after Joney describes the process:
    - statuses "Recibido por mensajería" / "Enviado al cliente";
    - a tracking field;
    - an instructions message on order creation (template draft for Joney).

---

## 4. Time saved — calculation

| Flow | Saving per occurrence | Occurrences/day | Minutes/day |
|---|---|---|---|
| WhatsApp → new order (1b) | ≈ 15–20 s (switch + phone) | 4–6 [ASSUMPTION: ~⅓ of 12–15 orders start on WhatsApp] | 1–2 |
| Repair pickup with charge (5) | ≈ 40–60 s (2 switches + ≈7 s loads + re-typing 3–4 fields + order search) | 8–12 [ASSUMPTION: ≈ one pickup per order in] | 5–12 |
| Deposit (3) | ≈ 30–40 s | 2–5 [ASSUMPTION: Deposit = 0 today, so this is the target once recorded] | 1–3 |
| Budget answers (4b) | ≈ 15–20 s | 3–5 [ASSUMPTION] | 1–2 |
| Uncollected reminders (6) | ≈ 60 s each (find + write + send) | 3–6 [ASSUMPTION] | 3–6 |
| Warranty / "where is the ticket" lookups (7) | ≈ 30–60 s | 1–3 (2 warranty tickets on 30 Oct [MEASURED]) | 1–3 |
| TPV catalogue cache (all switches into TPV) | ≈ 2–3 s per entry | 30–50 | 1–2 |
| Fewer required fields for non-phones (2) | ≈ 10–15 s | 4–7 [ASSUMPTION: ~½ of orders are not phones] | 1–2 |
| Mostrador search/"Hoy" (avoids hunting across apps) | ≈ 10–20 s | 20–30 | 3–8 |
| **Total** | | | **≈ 17–40 min/day; central estimate 20–35** |

Non-time gains:
- No pickup without the deposit applied.
- Every repair sale linked to its order (warranty, reports).
- No customer left uninformed because "Listo" was chosen instead of "Listo + Whatsapp".
- Reminders logged in WhatsApp Pro instead of a personal WhatsApp.

Running cost of the proposals: ≈ 0 for buttons and links. The automations (reminders, digest) are costed in Phase 7.

## 5. Dependencies and order (for the backlog)
1. Phase 4 P0 fixes first (auth on functions) — the new cross-app calls must use the same signed-call pattern.
2. Confirm `waLookup` works (Phase 5 finding 8).
3. TPV `/tpv` deposit fix + structured `repair_order_id` → then "Cobrar en TPV" + paid callback.
4. "Crear reparación" from WhatsApp, status clean-up, chat card buttons.
5. Mostrador "Hoy" + global search (reads only; uses the lookups above).
6. Reminders / digest / cash reminder → Phase 7 automations.

## 6. To verify live with Joney at the counter (read-only, ~20 min)
- Time one real new-order entry, one pickup with payment, and one Z close, with a stopwatch and click count.
- Watch which ready status staff picks ("Listo" vs "Listo + Whatsapp").
- Open one chat of a known Reparo customer in WhatsApp Pro: does the Reparo card show orders?

## 7. Questions for Joney (this phase)
1. ¿Cobráis señal en reparaciones? En el TPV no hay ninguna registrada: ¿se cobra fuera del TPV, o no se cobra?
2. ¿Cuántos días guardáis un equipo listo sin recoger y qué dice el aviso final?
3. Envíos por mensajería: ¿cómo funciona hoy (quién paga el envío, empresa, pago antes de devolver)?
4. "Listo" y "Listo + Whatsapp": ¿hace falta tener los dos? ¿Unificamos en uno que siempre avisa?
5. ¿Quieres que "Esperando material" avise al cliente? (Te prepararía el texto.)
6. Campos de Tarjeta SIM / Bandeja SIM: ¿solo para móviles y tablets?
