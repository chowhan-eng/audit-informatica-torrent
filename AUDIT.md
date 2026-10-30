# Claude Code work order — Deep audit & improvement plan
## Reparo · WhatsApp Pro · TPV Informática Torrent (+ Mostrador hub)

> **How to use**
> 1. Open a new Claude Code session in the desktop app with the **Base44 connector** available (or the apps synced to GitHub under `chowhan-eng`).
> 2. Create an empty working folder (e.g. `audit-informatica-torrent/`), save this file there as `AUDIT.md`.
> 3. First message: **"Read AUDIT.md completely, then start Phase 0. Report after each phase."**
> 4. Claude Code stays **read-only** until Joney approves the final report.

---

## 1. Mission

You are acting as a **senior software architect, performance engineer and operations consultant** hired by a small repair shop. Your job is to study three production apps that run the shop every day, measure them, and deliver a **prioritised, evidence-based improvement plan** covering:

1. **Workflow** — fewer clicks, no re-typing, no app hopping for the shop's daily routine.
2. **Smooth running** — no silent failures, no lost messages, no data drift between apps.
3. **Speed** — near-instant screens, search and barcode scanning.
4. **Simplification** — remove or hide what nobody uses; merge duplicated features.
5. **New useful features** — only those that save real time or money.
6. **Automations** — reliable, cheap, inside shop hours, no customer spam.
7. **Knowledge base** — turn already-answered WhatsApp chats into an approved, anonymised answer library that powers one-click replies.

**Success = Joney can read a 15-line Spanish summary, approve a list, and you then implement it in safe batches.**

### What "professional" means here
- Every finding has **evidence** (file + line, query result, measurement, screenshot). No guesses presented as facts.
- Every recommendation has **impact, effort, risk and cost** attached.
- Separate clearly: *verified fact* / *measured* / *assumption to confirm*.
- Plain language for Joney, precise language for code.

---

## 2. Owner and working style

- **Owner:** Joney (Arshdeep Singh Chowhan). Business: **Informática Torrent**, legal entity **Pcmatica Torrent SL, CIF B40591042**, C/ Germanies 74 bajo, 46900 Torrent (Valencia). Computer, mobile and console repairs since 2003, 6-month written warranty, national mail-in repairs, customers speak **Spanish, English and Punjabi**.
- Joney has **no coding background**. He delegates deeply and wants **direct execution**: do the work, verify, report in a few lines. Ask only for genuine business decisions (money, legal, customer-facing wording, irreversible actions).
- **Languages:** app UIs Spanish · code, comments, commits, technical report English · summaries for Joney **Spanish**.
- **Shop hours:** Mon–Fri ~09:00–14:00 and 16:00–21:00, Saturday morning, closed Sunday. Timezone Europe/Madrid.
- **Staff:** Joney plus counter staff (Japji receives the daily "Pendientes" WhatsApp). Ask Joney who else uses which app.

---

## 3. Systems in scope

| App | Base44 ID | Role / known facts |
| --- | --- | --- |
| **Mostrador** | `6ae3308edd92d52aa3a656b3` | Shop home page at `torrent.base44.app`. Opens Reparo, WhatsApp Pro and TPV **in the same tab**. Every app's "switch app" icon must point back here. |
| **Reparo** | `6ae22784825ce515812bcab8` | New repair-orders app, replaces HelloClient (switch decided end Oct 2026). Separate app, talks to WhatsApp Pro **by API**. Joney wants every new order or status change to send the customer a WhatsApp **1 minute after the change**. |
| **WhatsApp Pro** | `69f23ccb4284f8588aa5b7a3` | WhatsApp CRM on **Meta Cloud API** (shop number +34 601 110 325). Has: inbound webhook, outbound sends, templates (utility `actualizacion_taller2`, `resena_google`), AI drafts through a central **Gemini LLM router** (settings in SystemSettings), **Knowledge Base auto-extraction pipeline**, imported chat history (~5,500 HTML chats), "zero unanswered chats" system, off-hours auto-acknowledgement, review requests, FailedSend retry, broadcast consent. History: secrets once stored in plaintext in SystemSettings, HMAC webhook verification once failing open, template names once split between two stores, 8 automations once burning credits off-hours. **Verify each of these is fixed.** |
| **TPV Informática Torrent** | `6acf624e6e89e6f32c43243f` | POS replacing Doscar TPV-Comercio, used at the counter since 28 Oct 2026, installable web app on PC and mobile. Has its own `CLAUDE.md` with hard rules — **read it first**. Known limits: Base44 bulk writes 50 req/min, reads max 5,000 rows/page (use cursor paging), timestamps returned in UTC without "Z". Wants: PIN for admin areas, discreet staff reminders on Venta (e.g. ask for Google review), visible "Pendientes" list, daily 13:00 WhatsApp of new Pendientes to Japji, sending tickets/invoices by WhatsApp or email, report emails to chowhan@gmail.com. Verifactu stays **off** until next year (deadline 1 Jan 2027). |
| *Estado Informática Torrent* | `6ae230ddc401827f75674229` | Probably the public repair-status page. Include **only if** Reparo or WhatsApp Pro links to it. |

**Out of scope (do not touch):** every other Base44 app Joney owns (website, SEO, Aide, old experiments). You may only **list** apps that overlap with the scope (e.g. RepairTrack Pro, SyncRepair, App Hub, Informática Torrent Companion, Informática Torrent Portal, Inventario Visual Torrent) as *candidates to archive*, with evidence, nothing more.

---

## 4. Non-negotiable rules

1. **Read-only until approval.** No schema edits, entity writes, deploys, function redeploys, settings changes or builder AI turns during Phases 0–8.
2. **Never message real customers.** WhatsApp/email tests go only to numbers/addresses Joney gives you in chat.
3. **Never delete data.** Removal of a feature = hide behind a setting → wait 30 days → remove code. Data is archived, not deleted.
4. **Never invent business data** (prices, phones, emails, opening times, policies). Unknown → open question.
5. **Secrets:** report location and name only, never print values. Secrets belong in Base44 secrets/env, never in entity rows or frontend.
6. **Privacy (GDPR):** customer chats and data stay inside the apps. Anything sent to an LLM is anonymised first. Samples shown in reports are anonymised.
7. **No passwords.** Browser testing needs Joney logged in in Chrome; you never type credentials.
8. **TPV rules stand:** money, stock and numbering only in backend functions; completed sales immutable; numbers never reused; prices include IVA.
9. **Credits and fees matter:** prefer designs that reduce automation runs, LLM calls and Meta marketing-rate messages.
10. **Stop and ask** before anything irreversible or customer-facing.

---

## 5. Method

- Use **one subagent per app** for Phases 1–3 (inventory, speed, usage); merge and cross-check results yourself. Phases 4–8 are cross-app, do them yourself.
- Work folder layout:
  ```
  audit/
    00-access.md
    reparo/        inventory.md  speed.md  usage.md
    whatsapp-pro/  inventory.md  speed.md  usage.md  kb-audit.md
    tpv/           inventory.md  speed.md  usage.md
    mostrador/     inventory.md
    cross-app/     data-flows.md  customer-identity.md  workflow.md  automations.md  security.md
    kb/            design.md  sample-30.md  cost.md
    REPORT.md
    RESUMEN_JONEY.md
    BACKLOG.csv
  ```
- Evidence tags on every finding: **[VERIFIED]** (read in code/data), **[MEASURED]** (number you measured), **[ASSUMPTION]** (needs confirmation).
- After each phase send Joney a **≤5-line Spanish status** and continue without waiting, unless you need a decision.

### Scoring every recommendation
| Field | Values |
| --- | --- |
| Impact | Minutes saved per day · € saved/earned per month · risk removed (data loss, legal, customer complaint) |
| Effort | S (< 2 h) · M (half day–2 days) · L (> 2 days) |
| Risk of change | Low / Medium / High + why |
| Running cost | Credits/month, Meta fees/month, LLM tokens/month (estimate, show the maths) |
| Priority | **P0** safety/broken · **P1** quick win · **P2** valuable project · **P3** nice to have |

Priority score = (Impact 1–5 × 2) − Effort (1–3) − Risk (0–2). Show it.

---

## 6. Phases

### Phase 0 — Access & baseline (≤ 15 min)
For each app: can you list files, entities, functions, automations? Source (Base44 / GitHub)? Last checkpoint and deploy date? Does `npm install && npm run build` pass?
Output `audit/00-access.md`. If access fails, tell Joney exactly what to click and stop.

### Phase 1 — Inventory (per app)
- **Pages/routes**: list from the router, one line each, who can see them (role).
- **Entities**: fields, row count, newest/oldest record date, RLS rules (read/create/update/delete per role).
- **Backend functions**: purpose, caller type (public / user / admin / service / scheduler / webhook), external calls, error handling.
- **Automations & schedules**: trigger, cron, what it does, runs per day, runs outside shop hours (yes/no).
- **Integrations & secrets** (names only): Meta, Gemini router, email, cross-app keys.
- **Settings stores**: every settings entity/field; duplicates across apps.
- **Templates**: every WhatsApp template referenced, category (utility/marketing), where its name is stored.

### Phase 2 — Cross-app data flows & identity
- Every call between apps: direction, URL, auth (shared secret header? none?), payload, retries, what happens if the other app is down.
- Draw it as a **Mermaid diagram** in `cross-app/data-flows.md`.
- **Customer identity**: where customers live in each app, primary key (E.164 phone?), duplicates and mismatches (sample 50 customers, check they match across apps). Recommend a **single source of truth** and sync rule.
- Order ↔ deposit ↔ ticket links: can you go from a Reparo order to its señal and final TPV ticket and back?

### Phase 3 — Speed & stability (measure)
**Build:** bundle size per app, top 10 heaviest chunks/libraries, missing code-splitting, unused dependencies.
**Data loading:** lists fetching all rows; queries hitting the 5,000-row cap without cursor paging; N+1 calls; refetch on every render; no caching; polling; large payloads (images, full chat histories) loaded upfront.
**Live measurement in Chrome (Joney logged in):**
| Screen | Measure |
| --- | --- |
| Mostrador home | time to usable |
| TPV `/venta` | time to usable, barcode scan → line in cart, product search, customer search by phone, payment dialog → ticket |
| Reparo | order list, open order, change status, search by phone/order no. |
| WhatsApp Pro | inbox load, open a long chat, send a reply, AI draft time |

Record console errors, failed network requests, slowest requests (name + ms).
**Targets:** first load < 2 s on the counter PC · search < 300 ms · scan-to-cart < 150 ms · status change < 500 ms · 0 console errors · 0 silent failures.
**Typical fixes to evaluate:** paginated/server-side search functions; local cache (memory/IndexedDB) of the product catalogue with delta sync; React Query-style caching and prefetch; lazy routes; virtualised long lists; image thumbnails; debounced search; moving heavy logic to backend functions; removing unused libs.
**Reliability:** silent catches, missing retries, Base44 rate limits (50 bulk writes/min, 5,000 rows/read), UTC timestamps parsed without the fix, webhooks not idempotent (duplicate Meta deliveries), message sends not logged.

### Phase 4 — Security & data protection
Checklist per app, result OK / FAIL / N/A with evidence:
- RLS on every entity matches role needs (cajero vs admin; staff vs public).
- No public functions that write data or expose customer data.
- Secrets only in env/secrets; none in entities or frontend bundle (grep the build).
- Meta webhook HMAC verification **fails closed**.
- Cross-app endpoints authenticated and rate-limited.
- Admin areas behind role + PIN where Joney asked.
- Audit log for money, stock, price and status changes.
- Personal data minimisation; retention rule for chats and old customers; how to answer a GDPR deletion/access request.
- Backups: what exists, how to restore, last tested.

### Phase 5 — Usage, unused & duplicated features
- Pages/functions with no writes or calls in the last 60 days; entities with 0 rows; dead routes, dead components, unused automations.
- HelloClient-era code left in WhatsApp Pro or elsewhere now that Reparo exists (sync jobs, importers, scrapers, ShopManager hooks).
- Duplicated features across apps: customer lists, WhatsApp sending from several places, multiple template/setting stores, LLM calls bypassing the Gemini router, multiple report emails.
- Output table: feature · app · evidence of use · recommendation (**keep / merge / hide / remove**) · risk · saving. **Joney confirms every removal.**

### Phase 6 — Real workflow walk-through
Map the real day end to end. For each step count **clicks, typed fields, app switches, waiting time**, then propose the improved version with the same counts.

1. Customer walks in or writes on WhatsApp → find/create customer.
2. Repair order in Reparo (device, fault, IMEI/serial, budget, photos) → customer gets WhatsApp 1 min later.
3. Deposit (señal) in TPV linked to the order.
4. Status updates, budget sent/approved, parts ordered → WhatsApp notices.
5. Repair done → customer notified → pickup → charged in TPV with deposit applied → ticket/invoice by WhatsApp or email → Google review request with consent.
6. Uncollected devices → reminders.
7. Warranty claim within 6 months → find original order and ticket in seconds.
8. Accessory sales, accessory orders, "Pendientes" list, daily 13:00 WhatsApp to Japji.
9. Mail-in repair customers (national).
10. Cash close (X then Z) and end-of-day reports.

**Ideas to evaluate (verify value, don't assume):**
- One customer key (E.164 phone) and one shared lookup across apps.
- **"Cobrar en TPV"** button in Reparo → opens TPV with repair line, price and order ref prefilled; TPV reports "pagado" back to Reparo and closes the order.
- **"Ver chat"** from Reparo order and **"Ver reparaciones"** from a WhatsApp chat (by phone).
- **Global search in Mostrador**: phone, name, order no., ticket no., IMEI/serial → jumps to the right record.
- **Mostrador "Hoy" panel**: ready to collect, budgets awaiting answer, unanswered WhatsApps, pendientes, cash still open, failed sends.
- Same login and roles across apps; app-switch icon to `torrent.base44.app`; keyboard shortcuts at the counter.
- Quick-reply buttons inside Reparo for common customer questions.
- Label printing for repair intake (order no. + QR) and product labels.
- Multilingual templates (ES/EN/PA) chosen by customer language.

### Phase 7 — Automation catalogue
**Rules:** one master scheduler per app; runs only in shop hours; no per-record triggers on every write; debounce bursts; utility templates for service messages; respect the 24 h customer-service window and marketing consent; every automated send is logged and retried on failure; a global "pause automations" switch.

Evaluate at least, each with: trigger · message (Spanish draft, marked as draft for Joney) · template category · runs/day · cost/month · risk · on/off recommendation:
1. Reparo new order / status change → WhatsApp after 1 min, debounced (several quick changes = one message).
2. Budget sent, no answer after 24 h / 72 h → reminder + staff alert.
3. Ready to collect, not collected after 3 / 7 / 15 days → reminders; final notice per storage policy.
4. Parts arrived → customer notice.
5. Unanswered WhatsApp older than X min in shop hours → alert on Mostrador.
6. Failed WhatsApp sends → automatic retry + daily list.
7. Review request after pickup (consent, max once per customer per N months).
8. Warranty ending soon (only with marketing consent).
9. TPV: cash not closed alert, low stock, daily 13:00 Pendientes to Japji, daily/weekly reports, price/stock change alerts.
10. Morning brief for Joney (WhatsApp or email): yesterday's sales, orders in/out, budgets pending, unanswered chats, failed sends.
11. Mail-in: shipping label/instructions sent on order creation; tracking update when shipped back.
12. Health check: each app's scheduler pings; alert if a scheduler, webhook or cross-app call stops working.

Show the **total monthly cost** of the recommended set vs today.

### Phase 8 — Knowledge base from answered WhatsApp chats
WhatsApp Pro **already has** a KB extraction pipeline and imported history. **Audit it first** (`whatsapp-pro/kb-audit.md`): what was extracted, how many entries, quality on a sample of 30, are drafts using it, cost so far. **Improve it; do not build a parallel system.**

**Target pipeline**
1. **Select** conversations where a customer question received a human staff reply. Exclude templates, auto-replies, broadcasts, internal notes, very short exchanges ("ok", "gracias").
2. **Segment** into Q→A pairs (one conversation can hold several).
3. **Anonymise before LLM and before storage**: names, phones, emails, addresses, DNI/NIE/CIF, IMEI/serials, order numbers, plates, payment details → placeholders. Store only generalised Q&A; keep source chat IDs internally for traceability.
4. **Extract** in batches through the existing Gemini router (cheapest model that passes quality): canonical question, question variants (ES/EN/PA), answer, category, device brand/model, language, confidence, source answer date.
5. **Classify volatility**: prices, times and stock are *volatile* → drafts must pull the live value from TPV catalogue / Reparo, never trust an old KB price. Policies (warranty, hours, address, mail-in process) are *stable*.
6. **Deduplicate & resolve conflicts**: cluster similar questions (embeddings or normalised intent), keep the newest answer, flag contradictions for Joney.
7. **Review queue** (fast, keyboard-friendly): Aprobar / Editar / Descartar, filter by category. Nothing reaches drafts until approved.
8. **Use in inbox**: on each new message retrieve top 3 approved entries + live data (Reparo order status by phone, TPV price/stock) → draft in the customer's language → staff sends with one click. Off-hours auto-replies only for safe categories (horario, ubicación, envío) with approved text.
9. **Learning loop**: when staff edits a draft, store the diff; weekly job proposes KB updates from repeated edits; entries unused for 6 months flagged for review.
10. **Metrics dashboard**: % drafts sent unedited, median first-reply time (shop hours), top 20 intents, top 20 questions without a KB answer, KB coverage %.

**Proposed data model (adapt to what exists):**
```
KnowledgeEntry {
  id, status: draft|approved|archived,
  category: precio|plazo|garantia|horario_ubicacion|envio_nacional|estado_reparacion|compra_venta|accesorios|otros,
  canonical_question, variants: [{lang, text}],
  answer_es, answer_en, answer_pa,
  device_brand, device_model,
  volatile: bool, live_source: none|tpv_price|tpv_stock|reparo_status,
  confidence, source_count, source_chat_ids[] (internal),
  source_last_date, approved_by, approved_at, last_used_at, use_count, edit_count
}
DraftFeedback { chat_id, entry_ids[], draft_text, sent_text, edited: bool, created_at }
```

**Categories to cover first** (verify against real volume): screen/battery/charging-port prices and times by model, console repairs (e.g. Switch), data recovery, budget/diagnosis fee, warranty terms, opening hours and location, parking/arrival, mail-in process, payment methods, second-hand buy/sell, order status questions.

**Deliver first a sample of 30 anonymised extracted entries** (`kb/sample-30.md`) for Joney to judge quality, plus `kb/cost.md` (tokens and € for the one-off history pass and the daily incremental pass, run inside shop hours, e.g. 14:15).

### Phase 9 — Report & plan
Deliver:
1. **`audit/REPORT.md`** (English):
   - Executive summary (10 lines).
   - Current architecture diagram (Mermaid) and proposed target diagram.
   - Findings per area with evidence tags.
   - Speed table: screen · now · target · fix.
   - Security checklist results.
   - Keep/merge/hide/remove table.
   - Workflow before/after (clicks, typing, switches).
   - Automation catalogue with costs.
   - KB audit + design + sample results.
   - Risks and mitigations.
2. **`audit/BACKLOG.csv`**: id, title, app, type (fix/speed/remove/feature/automation/KB/security), priority, impact, effort, risk, cost/month, depends_on, acceptance criteria.
3. **Top 10 quick wins** and **Top 5 bigger projects**, with a suggested 4-week order (week 1 = P0 safety + quick wins).
4. **Open questions** only Joney can answer.
5. **`audit/RESUMEN_JONEY.md` in Spanish, max 15 lines**: qué va lento, qué falla, qué quitar, qué añadir, qué hacer primero, cuánto cuesta al mes.

Then **stop and wait for Joney's approval.**

---

## 7. After approval — implementation protocol
For every batch:
1. Branch or checkpoint before changes.
2. Small, focused changes; one batch = one theme.
3. Tests for pure logic (money maths, debounce, anonymiser, KB matching).
4. `npm run build` passes, functions redeployed correctly (remember: editing a Base44 function file does not redeploy it by itself).
5. Checkpoint → deploy → test in Chrome with Joney logged in; WhatsApp tests only to Joney's test number.
6. Report in Spanish ≤ 8 lines: what changed, checkpoint IDs, what Joney must do, anything to watch.
7. Hidden features stay hidden 30 days before code removal.

## 8. Definition of done (for the audit)
- [ ] All 4 apps inventoried with evidence.
- [ ] Cross-app flow diagram and customer-identity analysis done.
- [ ] Speed measured on real screens with numbers.
- [ ] Security checklist completed.
- [ ] Unused/duplicate table ready for Joney's yes/no.
- [ ] Workflow before/after with click counts.
- [ ] Automation catalogue with monthly costs.
- [ ] KB audit, design, 30-entry sample and cost estimate.
- [ ] REPORT.md, BACKLOG.csv, RESUMEN_JONEY.md delivered.
- [ ] No changes made to any app; no message sent to any customer.

## 9. Questions to ask Joney (only when the topic comes up, not all at once)
- Which screens/features do he and staff use daily in each app? What annoys them most?
- Who uses which app, on which device (counter PC, phone, tablet)?
- Storage policy for uncollected devices (days) and wording of the final notice.
- Which messages may go out automatically vs only after staff approval?
- Monthly budget for Meta fees and Base44 credits.
- Receipt/label printers and scanner models; is the cash drawer on the printer?
- Does the shop sell second-hand devices under REBU?
- Should the KB answer in Punjabi automatically, or only Spanish/English with staff handling Punjabi?
- Which old Base44 apps can be archived?
