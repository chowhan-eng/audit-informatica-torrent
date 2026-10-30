# Phase 7 — Automation catalogue

Date: 2026-10-30 · Auditor: Claude Code · Mode: **read-only** (no workflow, setting or function changed).
Tags: **[VERIFIED]** code/data · **[MEASURED]** measured · **[ASSUMPTION]** to confirm.
Shop hours used everywhere (decision D-12): **Mon–Fri 09:30–14:00 and 17:00–20:30 · Sat 10:00–14:00 · Sun closed** (Europe/Madrid).
All customer-facing texts below are **BORRADOR (draft) — Joney approves before anything goes live**. Business data in the drafts comes only from Joney's answers or from text already in the apps; anything unknown is a `{placeholder}`.

## 0. Cost basis

| Item | Value | Evidence |
|---|---|---|
| Base44 plan | Builder, 50 USD/month, no top-ups bought in 12 months | [MEASURED] billing invoices |
| Workflow run cost | **0.1 credit + 0.1 per step**: TPV jobs 0.2, masterTick 0.2, Reparo 2-step job 0.3, a run failing before its step 0.1 | [MEASURED] `workflows/runs` `credits_consumed` |
| LLM calls (`Core.InvokeLLM`) | ≈ 32/day today (234 in 7.5 days) | [MEASURED] WhatsApp Pro WebhookLogs `llm:base44`, Phase 1 |
| LLM / e-mail credit price | **1 integration credit per call** | [ASSUMPTION — confirm on the Base44 usage page] |
| Meta rate, Spain, per delivered template | Utility ≈ **€0.0166**, Marketing ≈ **€0.05–0.06** (third-party copies of Meta's rate card; not confirmed on Meta's own page) | [ASSUMPTION — confirm in WhatsApp Manager → Billing]. Sources: [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing), [whautomate Spain](https://whautomate.com/whatsapp-business-api-pricing-spain), [chatmaxima Spain](https://chatmaxima.com/whatsapp-api-pricing/spain/), [go4whatsup Spain](https://www.go4whatsup.com/spain/whatsapp-business-api-pricing/) |
| Free messages | Free-form replies inside the 24 h customer-service window are free. Whether **utility templates inside an open window** stay free after 1 Oct 2026 is reported inconsistently | [ASSUMPTION] → costs below assume **every template is billed** (worst case); add 21 % VAT if Meta invoices it |
| Message volume | Week 23–29 Oct: **816 messages** (≈ 117/day, in + out). Last 30 days: **240 templates sent**, all `actualizacion_taller2` (UTILITY); review template `resena_google` (MARKETING) sent **3×** | [MEASURED] Messages, PendingReviews |
| Repair volumes | ≈ 12–15 new orders/day; **139 orders reached "ready" in the last 30 days**; between 1,500 and 3,000 orders are still open in a "ready" status, many from 2025 (never closed after HelloClient) | [MEASURED] Reparo RepairOrder |
| Month | 26 shop days (Mon–Sat), 30 calendar days | — |

---

## 1. Findings that change the design

1. **[MEASURED] The off-hours auto-acknowledgement does fire, and it fired as a burst.** This corrects Phase 1 finding 5.
   - On Mon 26 Oct at 20:31–20:33 Madrid (the "closed" slot inside masterTick's cron window, right after the 20:30 close), it sent **45 acknowledgements in 2 minutes**: "Gracias por su mensaje. Le responderemos en cuanto abramos…".
   - All 45 went out **as paid templates**, which means these customers had last written more than 24 h earlier. The ack went to old conversations, not to people writing out of hours.
   - The burst coincided with 10+ "Unhandled webhook error" rows (rate limit) in the same minutes, so incoming messages may have been lost.
   - It runs in any closed slot inside the cron (14:00–17:00 too).
   - → Customer spam risk and wasted fees. **P1**: make it event-driven (see A-05).
2. **[MEASURED] Staff escalation is noisy.**
   - `escalateWaiting` writes ≈ 120 log rows a day. Escalation is **enabled, not dry-run**, and both levels go to the same staff phone (throttled to 1 per hour per number).
   - `NotificationQueue` generates ≈ 100 staff alerts a day (new_message, reminder1, reminder2) on top of that.
3. **[VERIFIED] Status messages already have a good engine.** Reparo queues the event, waits 60 s, skips it if the status changed again (this *is* the debounce) and retries 3×. WhatsApp Pro chooses the text. Missing pieces: "Esperando material" (D-10), parts arrived, mail-in.
4. **[MEASURED] Uncollected backlog.** 1,500–3,000 orders are still "ready" in Reparo, most of them months or years old (imported from HelloClient). **Any uncollected-device reminder must apply only to orders that become ready after go-live.** Running it on the backlog would message hundreds of customers at once.
5. **[VERIFIED] Review requests:**
   - They use a MARKETING template with no consent check (SEC-06).
   - The setting `review_redirect_url` points to an external netlify page. If that page filters happy vs unhappy customers before Google ("review gating"), it breaks Google's review policy [ASSUMPTION — open the page and check before re-enabling].
6. **[VERIFIED] Switches that already exist:**
   - WhatsApp Pro `automations_enabled` (kill switch for masterTick).
   - Reparo `shop_whatsapp.enabled`.
   - TPV `pending_digest_enabled`.
   - There is **no single "pause all customer messages" switch** covering every sender (Phase 5: 7 sending paths).

---

## 2. Catalogue (AUDIT §6 Phase 7, items 1–12 + 2 extra)

Columns:
- **Runs/day**: extra scheduler runs this item needs on its own. "in tick" means it runs inside an existing scheduler, so it adds 0 runs.
- **Meta €/month**: worst case at the rates in §0.
- Recommendation: **ON** · **ON (changed)** · **OFF**.

| ID | Automation | Trigger (proposed) | Category | Volume/month [basis] | Runs | Meta €/mo | Risk | Rec. |
|---|---|---|---|---|---|---|---|---|
| A-01 | New order / status change → WhatsApp after 1 min, debounced | Reparo event → queue → 60 s → skip if changed → WA Pro. **Add "Esperando material" (D-10) and "Pieza recibida".** Show 💬 in Reparo next to statuses that message (D-09) | Utility (template only if window closed) | ≈ 195 templates today [MEASURED 240 − 45 burst] + ≈ 80 new notices [ASSUMPTION 3/day] = **≈ 275** | event, 0 | **4.6** | Low — engine proven | **ON (extend)** |
| A-02 | Budget sent, no answer → reminder 24 h / 72 h + staff alert | in tick: order in "Enviar un Presupuesto", no inbound message and no status change for 24 h (counted in shop hours) → 1 reminder; at 72 h → staff alert in the "Hoy" panel only (no 2nd customer message) | Utility | ≈ 50 budgets/month [ASSUMPTION 2/day], half unanswered → **≈ 25** | in tick | **0.4** | Low | **ON** |
| A-03 | Ready, not collected → reminders 3 / 7 / 15 days; final notice (storage 1 year, D-07) | in tick, 10:00 Mon–Sat: orders that become ready **after go-live**, still open → day 3, 7, 15; final notice at month 11 | Utility | 139 ready/month [MEASURED] × (50 % + 25 % + 15 %) [ASSUMPTION] ≈ **125** + a few final notices | in tick | **2.1** | Medium: must exclude the backlog; final-notice wording is legal | **ON** (backlog excluded) |
| A-04 | Parts arrived → customer notice | Reparo status leaves "Esperando material" → "Pieza recibida" message | Utility | in A-01 volume | event | (in A-01) | Low | **ON** |
| A-05 | Unanswered WhatsApp → alert; off-hours ack | **Alert:** in tick, shop hours only, chat waiting > 15 min → "Hoy" panel + 1 push; > 60 min → 1 WhatsApp to staff (max 1/h). **Off-hours ack:** in the webhook, *event-driven*, only for a message received while closed, once per conversation per closed period, free-form text (window is open) | Staff: utility · Customer: free-form | staff WhatsApp ≈ 50 [ASSUMPTION, was ≈ 100+] · acks free | in tick / event | **0.8** | Low; removes burst spam | **ON (changed)** |
| A-06 | Failed sends → retry + daily list | `retryFailedSends` every 3rd tick (shop hours) + list in the morning brief. **Also cover** network errors and Meta async failures (131026), which today only go to logs (Phase 3 S10) | — | retries only | in tick | 0 | Low | **ON (extend)** |
| A-07 | Review request after pickup | "Entregado + Reseña" → next shop day → **only if marketing consent**, max 1 per customer per 12 months; review link straight to Google (no gating page) | **Marketing** | today 3/month; with consent ≈ 40 [ASSUMPTION] | in tick | **2.0** | Medium: legal/consent; Meta marketing rate | **ON after consent check** (SEC-06) |
| A-08 | Warranty ending soon | — | Marketing | — | — | 0 | Needs marketing consent; low value for a 6-month warranty | **OFF** |
| A-09a | TPV Pendientes WhatsApp to Japji 13:00 | **Mon–Sat** 13:00 (not Sunday); **all open** Pendientes (not only today's before 13:00); 1 retry after 10 min through the queue | Utility (staff) | 26 | 1 (+ retry) | **0.4** | Low | **ON (fixed)** |
| A-09b | TPV cash not closed / low stock / price-stock change alerts | Cash-not-closed → item in the morning brief + discreet banner on the TPV at 20:15 (Sat 13:45) if the session is open. Low stock and price/stock alerts → morning brief digest instead of one e-mail per event | e-mail | — | (in brief) | 0 | Low | **ON (merged)** |
| A-09c | TPV daily report 21:35 + weekly stock Monday 08:45 | Merged into A-10 | e-mail | — | −2 workflows | 0 | Low | **MERGE** |
| A-10 | Morning brief for Joney | 09:20 Mon–Sat, first masterTick of the day reads Reparo + TPV (signed calls): yesterday's sales/Z, orders in/out, budgets waiting, ready > 7 days, unanswered chats, failed sends, cash still open, low stock; Monday adds the weekly stock list. **E-mail** (free); WhatsApp copy optional | e-mail (+ utility) | 26 | in tick | 0 (0.4 with WhatsApp copy) | Low | **ON** |
| A-11 | Mail-in (D-08: customer pays, GLS/MRW, pays when ready) | (a) order created with "Envío por mensajería" → instructions; (b) ready → existing "listo" text + payment/shipping line; (c) shipped back with tracking number → tracking message | Utility | ≈ 10 mail-in orders/month [ASSUMPTION] × 2 = **20** | event | **0.3** | Low; texts need Joney's packaging/payment details | **ON (after statuses/fields exist)** |
| A-12 | Health check | in tick, shop hours, every hour. Alerts if: Reparo sweep silent > 30 min · no inbound webhook for 2 h · TPV 13:00 digest missing at 13:15 · masterTick job failing · FailedSend > 5 open · `waLookup` failing. Push + e-mail; WhatsApp to Joney only for critical, max 2/day | utility (rare) | ≈ 5 [ASSUMPTION] | in tick | **0.1** | Low | **ON** |
| A-13 | Auto-reply "Horario" and "Ubicación / Cómo llegar" (D-04) | Inbound message, library match ≥ threshold, these 2 topics only, any hour; everything else → draft only | free-form (window open) | — | event | 0 | Low once texts approved | **ON** |
| A-14 | Global "pause automations" switch | One setting in WhatsApp Pro, checked by `sendMessage` (the single customer sender after Phase 4/5 clean-up), masterTick, the Reparo sweep and TPV digests, with a red banner in all apps while paused | — | — | — | 0 | Low | **ON** |

**Stays OFF / removed (from Phase 5 + decisions):** NPS (U-13), broadcasts (U-12, until a consented campaign), voice queue (D-03), weekly content signals (D-03), flowExecutor (U-10), watchdog/pollHelloClient (U-07), Reparo HelloClient step (U-31).

---

## 3. Schedulers: today vs proposed

Rule (AUDIT §6 Phase 7): one master scheduler per app, shop hours only, no per-record triggers on every write.

| App | Today | Runs/month | Credits/month | Proposed | Runs/month | Credits/month |
|---|---|---|---|---|---|---|
| WhatsApp Pro | masterTick `*/5 9-20 * * 1-6`, 1 step | 144 × 26 = 3,744 | **749** | masterTick **every 10 min, shop hours only** (plus a 09:20 run for the brief). Jobs: escalation, scheduled msgs, alerts, A-02, A-03, A-06 (every 3rd), A-07, A-10, A-12 | ≈ 1,220 | **≈ 244** |
| WhatsApp Pro | Build Content Signals, weekly 05:00 | 4.3 | ≈ 1 (+ 4 LLM) | **OFF** (D-03) | 0 | 0 |
| Reparo | `*/5 9-21 * * 1-6`, 2 steps (HelloClient no-op + sweep) | 156 × 26 = 4,056 | **1,217** | Sweep only (safety net; the in-request path sends 22/22 today) **every 15 min, shop hours** | ≈ 810 | **≈ 162** |
| TPV | Pendientes daily incl. Sunday; daily report 21:35; weekly stock Mon 08:45 | 30 + 26 + 4.3 | **≈ 12** | Pendientes Mon–Sat 13:00 (+ retry). Reports move into the morning brief | ≈ 30 | **≈ 6** |
| **Total workflow credits** | | ≈ 7,860 | **≈ 1,979** | | ≈ 2,060 | **≈ 412** |

TPV note: AUDIT's "one master scheduler per app" is met in spirit. One daily workflow is cheaper than an hourly TPV tick, so no tick is added there.

---

## 4. Total monthly cost: today vs recommended set

| Cost line | Today | Recommended | Δ | Maths |
|---|---|---|---|---|
| Workflow credits | **≈ 1,979** | **≈ 412** | **−1,567** | §3 |
| LLM integration credits | ≈ 960 | ≈ 450 [ASSUMPTION; detailed in Phase 8 `kb/cost.md`] | −510 | today 32/day × 30. Proposed: liveKBCheck moves from per-message 24/7 to one daily batch at 14:15; webhook brief only in shop hours; auto-reply uses the library (no LLM); drafts stay on demand |
| E-mail credits | ≈ 40 | ≈ 35 | −5 | daily + weekly + per-event alerts → 1 brief/day + documents |
| **Credits total** | **≈ 2,980** | **≈ 900** | **≈ −70 %** | |
| Meta utility templates | 240 → **€4.0** | ≈ 275 + 25 + 125 + 50 + 26 + 20 + 5 = **526 → €8.7** | +€4.7 | × €0.0166 |
| Meta marketing templates | 3 → **€0.2** | ≈ 40 (with consent) → **€2.0** | +€1.8 | × €0.05 |
| Customer spam bursts (off-hours ack) | 45 in one evening (in the 240) | **0** | — | A-05 |
| **Meta total** | **≈ €4.2** (+ staff escalations ≈ €1.7 [ASSUMPTION]) = **≈ €5.9** | **≈ €10.7** | **+ ≈ €5/month** | add 21 % VAT if invoiced |

**Reading for Joney:** the platform work (credits) drops by about two thirds. Meta fees rise by about €5 a month, because customers would now get reminders for budgets, uncollected devices, parts and mail-in. Everything stays inside a 50 USD Builder plan with margin [ASSUMPTION on the plan's credit allowance — check the usage page]. Meta fees stay under ≈ €15/month even if volumes double.

---

## 5. Message drafts (BORRADOR — para aprobar por Joney)

Existing texts are in `reparoBridge/entry.ts:78-96` (welcome, listo, no reparación, contactar, presupuesto, iniciar). New ones:

| ID | Moment | BORRADOR (ES) |
|---|---|---|
| T-01 | Esperando material (D-10) | "Hola {nombre}, le informamos de que para su {dispositivo} (Orden #{orden}) estamos esperando una pieza. Le avisaremos por aquí en cuanto llegue. Gracias por su paciencia. Informática Torrent" |
| T-02 | Pieza recibida | "Hola {nombre}, ya ha llegado la pieza para su {dispositivo} (Orden #{orden}) y continuamos con la reparación. Le avisaremos cuando esté listo. Informática Torrent" |
| T-03 | Presupuesto sin respuesta (24 h) | "Hola {nombre}, le recordamos el presupuesto de su {dispositivo} (Orden #{orden}): {presupuesto}. ¿Desea que sigamos adelante? Puede responder a este mensaje. Informática Torrent" |
| T-04 | Sin recoger, día 3 | "Hola {nombre}, su {dispositivo} (Orden #{orden}) está listo para recoger desde el {fecha_listo}. Le esperamos en C/ Germanies 74 bajo, Torrent. Horario: L-V 9:30-14:00 y 17:00-20:30, sáb 10:00-14:00. Informática Torrent" |
| T-05 | Sin recoger, días 7 y 15 | "Hola {nombre}, le recordamos que su {dispositivo} (Orden #{orden}) sigue pendiente de recoger en nuestra tienda. Si necesita que le guardemos el equipo unos días más o tiene alguna duda, responda a este mensaje. Informática Torrent" |
| T-06 | Aviso final (antes de 1 año, D-07) | "**Texto legal pendiente — debe redactarlo/validarlo la gestoría.** Contenido mínimo: orden, fecha de 'listo', plazo de custodia de 1 año, fecha límite de recogida, qué pasa después, contacto." |
| T-07 | Mensajería: instrucciones (D-08) | "Hola {nombre}, hemos registrado su reparación por mensajería (Orden #{orden}). Envíe el equipo con GLS o MRW (el envío corre a su cargo) a: Informática Torrent, C/ Germanies 74 bajo, 46900 Torrent (Valencia). {instrucciones_embalaje — pendiente de Joney}. Le avisaremos al recibirlo. El pago se realiza cuando la reparación esté terminada, antes del envío de vuelta." |
| T-08 | Mensajería: enviado | "Hola {nombre}, su {dispositivo} (Orden #{orden}) ya va de camino con {GLS/MRW}. Número de seguimiento: {tracking}. Gracias por confiar en Informática Torrent." |
| T-09 | Auto-respuesta "Horario" (D-04) | "Nuestro horario es de lunes a viernes de 9:30 a 14:00 y de 17:00 a 20:30, y los sábados de 10:00 a 14:00. Domingos cerrado. Informática Torrent" |
| T-10 | Auto-respuesta "Ubicación / Cómo llegar" (D-04) | "Estamos en C/ Germanies 74 bajo, 46900 Torrent (Valencia). {enlace_google_maps — pendiente de Joney} {aparcamiento/transporte — solo si Joney lo indica}. Informática Torrent" |
| T-11 | Aviso fuera de horario (A-05, solo mensajes recibidos con la tienda cerrada) | keep the current text from `offhours_autoack_text` (already matches D-12 hours) |
| T-12 | Reseña (solo con consentimiento) | keep `resena_google` (MARKETING); link direct to Google, no intermediate page |

Template note: when the 24 h window is closed, these go inside the approved utility template `actualizacion_taller2` (body variable), as today. Meta can re-classify a template whose content looks promotional. T-04/T-05 must stay purely informative (no offers).

---

## 6. Implementation notes (for the backlog, after approval)

1. Do these first:
   - Phase 4 P0: authenticate the public functions, so nobody can trigger these jobs from outside.
   - Phase 3 S1: the webhook must not ack failures.
2. All new customer messages go through WhatsApp Pro `sendMessage`. That gives one log, `FailedSend` + retry, the pause switch (A-14) and the 24 h window logic in one place.
3. A-03 needs a "ready since" date on the order. Reparo has no such field today (only `closed_at`; status history is in `events[]`). Add `ready_at`, set on the change to a ready status. **Do not backfill** (this keeps the backlog excluded).
4. Every scheduled job checks shop hours from one shared helper and one setting (`shop_hours`, which already matches D-12). The ≥ 8 copies found in Phase 1 are removed.
5. Go-live in stages:
   - shadow mode for 1 week (log "would send", send nothing);
   - Joney reviews the list;
   - go live with the pause switch ready.

## 7. Questions for Joney (only what this phase needs)
1. ¿Apruebas los borradores T-01 a T-05 y T-07 a T-10? Faltan: instrucciones de embalaje (T-07) y enlace de Google Maps / aparcamiento (T-10).
2. Aviso final (T-06): ¿lo prepara la gestoría?
3. ¿El resumen de la mañana te llega solo por email, o también por WhatsApp?
4. Escalado de chats sin responder: hoy los dos niveles van al mismo móvil. ¿A quién debe ir el aviso de 60 min?
5. ¿Qué es la página `stellar-salamander…netlify.app` de reseñas? (Si filtra clientes contentos/descontentos, Google lo prohíbe.)
