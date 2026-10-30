# Phase 8 — Knowledge base from answered WhatsApp chats

Date: 2026-10-30 · Auditor: Claude Code · Mode: **read-only** (no entry approved, edited, archived or created; no LLM run on customer data by the auditor).
Tags: **[VERIFIED]** code/data · **[MEASURED]** measured · **[ASSUMPTION]** to confirm.
Privacy: no customer names, phones or message text are reproduced. Entries quoted below are already generalised KB text. Bank details found in the KB are **not** reproduced.

This file covers AUDIT §6 Phase 8 in one place:
- §1 audit of what exists (AUDIT's `whatsapp-pro/kb-audit.md`)
- §3 real FAQs with the current answers and their status
- §4 30-entry quality sample (AUDIT's `kb/sample-30.md`)
- §5 target design (AUDIT's `kb/design.md`)
- §6 cost (AUDIT's `kb/cost.md`)

---

## 1. Audit of the existing pipeline

### 1.1 What exists [VERIFIED code, MEASURED data]

| Piece | What it is | State |
|---|---|---|
| `KnowledgeBase` (WhatsApp Pro) | Free-text facts (title, content, category, review_status) | **715 entries**: **≈ 171 approved**, ≈ 16 rejected, **≈ 528 pending_review**. Approved ones are mostly a bulk load of 9–17 June (`auto_extracted=false`). The last approval was on 5 Oct. **303 entries were created in October and nobody has reviewed them.** |
| `AnswerLibrary` | Structured answers per topic: `topic_key`, example questions, keywords, `blocked_keywords`, `answer_es/en/pa`, `price_keys`, `automation_level` (never / draft / auto), `live`, `approved`, `times_asked`, `share_pct` | **23 topics**, built 1–19 Oct from chat mining. **0 are `live`**, which is why the auto-reply has sent nothing since 2 Oct (Phase 5). `answer_en` and `answer_pa` are empty everywhere. |
| `PriceList` | Volatile prices per `price_key` (`{precio:key}` placeholders in AnswerLibrary) | **12 keys, 11 confirmed by Joney on 2 Oct 2026**. `diagnostico` is unconfirmed ("confirma si también es gratis para portátiles y consolas"). |
| `liveKBCheck` | Per inbound message, 24/7: sends the recent transcript to the LLM and writes candidate facts to KnowledgeBase (max 1 per conversation per 6 h) | ≈ 16 LLM calls/day [MEASURED]. Source of most October pending entries. |
| `autoKBExtract` | Batch extractor (masterTick, closed slots) | **0 LLM calls** logged in the last week [MEASURED]. |
| `ingestChatKnowledge`, `importChats` | History import | No activity in 60 days (Phase 5 U-17). |
| `generateDraft` | Staff AI draft; reads KnowledgeBase (6 references) | On demand. |
| `libraryAutoReply` | Matches inbound text to AnswerLibrary, no LLM | Runs on every message; 500 of 500 evaluations blocked (Phase 5). |
| `MessageEmbeddings` | Vectors for similarity | 1–99 rows, last update 29 Oct. Barely used. |
| `TPV Product` | Live prices of goods | **Has no repair-service items** (only accessories, many inactive) [MEASURED]. So the live price source for *services* is `PriceList`, and for *goods* the TPV. |

### 1.2 Verdict

**The right design already exists** (AnswerLibrary + PriceList), but it is **switched off and fed by a messy pipeline**:

1. **Privacy (rule 6): FAIL [VERIFIED].**
   - `liveKBCheck` builds the prompt from raw messages (`liveKBCheck/entry.ts:91-115`: "Cliente: …/Tienda: …").
   - The only PII scrubber in the app (`buildContentSignals:67-113`) runs on the *output* of a different job.
   - Customer text therefore reaches the LLM un-anonymised, 24/7.
2. **Review queue abandoned:** ≈ 528 pending entries. Several are near-duplicates (e.g. "Dual-NAND +10 €" appears in ≥ 9 approved entries).
3. **Approved content is not safe to send as-is.** Approved entries include:
   - **"Servicio 24/7 para emergencias"** (3 entries; contradicts D-12 hours);
   - piracy/download advice ("no garantizamos la fiabilidad de las páginas para descargar juegos…");
   - a placeholder price ("X euros");
   - the shop's **IBAN** (should only ever be sent by a person — the AnswerLibrary `pago` notes already say so);
   - an internship policy and irrelevant one-offs.
4. **Contradictions** between approved entries, AnswerLibrary, PriceList and Joney's decisions (§2).
5. **Volatility:** prices are copied into free text in KnowledgeBase, so they go stale. AnswerLibrary avoids this with `{precio:key}`.
6. **Traceability:** entries do not keep source chat IDs [ASSUMPTION — no such field seen in the Phase 1 schema]. Contradictions therefore cannot be traced back to the conversation.
7. **Cost so far:** ≈ 16 LLM calls/day for liveKBCheck ≈ **480 credits/month**. That spend produced ≈ 300 unreviewed entries in October.

---

## 2. Contradictions Joney must resolve (blocking for any automatic answer)

| # | Topic | What the apps say today | Source |
|---|---|---|---|
| C-1 | **Warranty length** | (a) "6 meses en reparaciones y 1 año en la modificación de Switch" · (b) "Pantallas móvil 90 días, Baterías 6 meses, Portátil/placa 30 días, Consolas 3 meses" · (c) pending: "90 días" · (d) AUDIT.md: "6-month written warranty" · (e) chip: 1 year | (a) AnswerLibrary `garantia` (draft); (b) approved KB seed 26 May; (c) KB pending 28 Oct; (e) PriceList / KB |
| C-2 | **Diagnosis price** | free (mobiles, tablets, consoles) · laptops **5 €** · **10 €** · **15 €** (deductible) · "revisión sin coste" | AnswerLibrary `realizais_diagnosticos…`, KB approved ×4, PriceList `diagnostico` unconfirmed |
| C-3 | **Mail-in / pickup** | "No ofrecemos recogida a domicilio; el cliente envía por mensajería" (approved, May) · "Recogida y entrega a domicilio asegurada, 19 € ida y vuelta, GLS" (PriceList confirmed 2 Oct + AnswerLibrary) · pending: "envío de devolución gratuito" · **D-08: customer pays, GLS/MRW, pays when ready** | — Probably the current offer is: the shop books GLS pickup and return for 19 € *or* the customer sends it themselves. To confirm. |
| C-4 | **What to send in the box** | Approved: "solo la consola con la base… y la tarjeta de memoria" · **D-13: no cables, cases, SIM/SD cards unless requested for the diagnosis** | For a Switch modification the microSD is part of the service → the instructions need a Switch exception |
| C-5 | **Payment** | Shop: cash, card, Bizum (AnswerLibrary `pago`) · Mail-in: transfer or Bizum before return · approved: "solo transferencia" · pending: transfers to three other banks | AnswerLibrary vs KB |
| C-6 | **PS5 HDMI** | 69 € (PriceList, confirmed 2 Oct) vs 55 € (approved seed, May) | PriceList is newer → keep 69 €, archive the seed line |
| C-7 | **PS5 cleaning time** | 2–3 days (AnswerLibrary) vs 1–2 days (KB) | — |
| C-8 | **Appointment** | pending: "se recomienda cita previa" vs walk-in everywhere else | — |
| C-9 | **24/7 emergency service** | approved ×3 | contradicts D-12; probably extracted from one conversation |

---

## 3. Real FAQs (what customers actually ask) and the current answer

**Demand:**
- AnswerLibrary mining (`times_asked`, ≈ 1,450 first questions): presupuesto de una reparación **25 %**, modificación Switch **17 %**, ¿está lista mi reparación? **12 %**, ayuda tras modificación Switch 4 %, horario 3.7 %, drift mando PS5 3.6 %, envío 2.6 %, pago 1.2 % [MEASURED].
- Last 500 inbound messages (19–30 Oct): **55 % match no topic**. Of the 222 that match: presupuesto ≈ 70, Switch chip/mod ≈ 47, pantallas móvil ≈ 18, estado reparación ≈ 18, ubicación ≈ 18, pago ≈ 14, envío ≈ 14, Dual-NAND ≈ 11, horario ≈ 11, ayuda Switch ≈ 6, drift ≈ 3, garantía 1 [MEASURED, counts rounded].

Status column:
- **OK** = consistent and confirmed (PriceList confirmed or a Joney decision).
- **CONFIRMAR** = seen in chats/KB but not confirmed, or contradictory.
- **PERSONA** = must always be answered by staff.

### 3.1 Standard prices (volatile → always read from `PriceList`, never typed into the answer)

| Service | Price | Time | Warranty | Status |
|---|---|---|---|---|
| Modificación Switch Lite / V1-V2 / OLED (chip Picofly, microsoldadura) | 59 € / 69 € / 79 € | 24–48 h | 1 año | **OK** (PriceList 2 Oct) |
| Dual-NAND / EmuNAND (extra) | +10 € | — | — | **OK** |
| MicroSD preparada 128 / 256 GB | 29 € / 46 € | — | — | **OK** |
| Drift mando PS5: 1 / 2 joysticks | 25 € / 40 € | 24–48 h | 6 meses (library) | **OK** price · warranty = C-1 |
| PS5 limpieza profunda + metal líquido | 69 € | 2–3 días vs 1–2 días | — | price **OK** · time C-7 |
| PS5 puerto HDMI | 69 € | — | — | **OK** (C-6) |
| Recogida y entrega asegurada (ida y vuelta, GLS) | 19 € | — | — | **OK** price · process C-3 |
| Diagnóstico / revisión | gratis / 5 / 10 / 15 € | — | — | **CONFIRMAR** (C-2) |
| Cambio batería iPhone | "45–65 €" (seed May); iPhone 12 mini 59 € (one chat) | 30–60 min / 1 día | 6 meses | **CONFIRMAR** — add per-model keys to PriceList |
| Pantalla Switch · carga Switch · lector/HDMI PS4 · lector PS5 | 85 · 30 · 45/35 · 80 € (seed May) | — | — | **CONFIRMAR** (not re-confirmed since May) |
| Windows 11 Pro + Office · licencia W10 Pro · formateo con copia · copia de datos móvil · Adobe por programa | 49 · 25 · 45 · 65 · 15 € (single chats) | 1–2 días | — | **CONFIRMAR** |
| Pantallas de móvil (any model) | per model | 24–48 h after the part arrives | — | **PERSONA** until per-model PriceList keys exist (top request with 25 % share) |

### 3.2 Usual times
- Switch modification and drift: 24–48 h ✅.
- Most repairs: "24–48 h desde que llega el equipo / la pieza". This depends on parts, so it is used as a general sentence, not a promise.
- Customer is notified when the repair is ready ✅ (A-01).

### 3.3 Warranty (stable once Joney decides C-1)
- Written warranty on every repair ✅. Covers the same repaired fault; excludes later knocks, liquid and outside manipulation ✅ (consistent across sources).
- Length: **C-1 to decide.**
- Warranty **claims** are always answered by a person (AnswerLibrary already blocks them) ✅.

### 3.4 Collection and storage
- Customers are told by WhatsApp when it is ready ✅.
- Storage: **1 year** (D-07); final notice = legal clause from the gestoría (D-14).
- "No hay problema si tarda unos días en recoger" (approved KB) ✅ compatible.

### 3.5 Mail-in (after C-3 is resolved)
- Customer pays shipping; GLS or MRW; payment once repaired and ready, before return (D-08).
- Packaging per D-13.
- Address and hours per D-12/D-13.
- Bank details: **PERSONA** only.

### 3.6 Location and hours — ready for auto-reply (D-04)
- T-09 Horario and T-10 Ubicación (approved D-13).
- AnswerLibrary `horario` and `direccion` already match D-12 ✅.

### 3.7 Things the shop does not do (stable, safe as drafts)
- iCloud unlock (only the original owner can) ✅.
- Monitors and TVs are not repaired ✅.
- Games are not installed on consoles ✅ (but see the legal note in §4).

### 3.8 Always a person
- Order status, until it reads live Reparo data (§5).
- Complaints and haggling (`queja` = never).
- Warranty claims.
- Bank details.
- Anything about downloading games, ROMs or removing accounts from locked phones.

---

## 4. Quality sample — 30 newest auto-extracted entries (pending, 28–30 Oct)

Verdicts:
- **USE** = generalisable and consistent → can become a library answer after approval.
- **EDIT** = right idea but volatile, one-off or needs wording/confirmation.
- **DROP** = one-off, wrong, garbled or risky.

All 30 were already generalised: **0 contained names or phone numbers** [VERIFIED by reading].

| # | Entry (paraphrased) | Verdict | Why |
|---|---|---|---|
| 1 | Recommends a game-download website used through a VPN | **DROP** | Legal/IP risk; must never be suggested |
| 2 | "Se recomienda cita previa" | EDIT | C-8 to confirm |
| 3 | Console software update 10 € in the shop | EDIT | Volatile → PriceList key |
| 4 | Phone USB-C chargers are not suitable for laptops | USE | Stable advice |
| 5 | Technical reports printed or by e-mail | USE | Stable |
| 6 | Signed expert reports so the customer can claim the manufacturer's warranty | EDIT | Confirm the service and price |
| 7 | Software installation takes 1–2 working days | USE | Consistent |
| 8 | Unclear faults need extra test time before informing | USE | Stable |
| 9 | Screen repairs 24–48 h once the part arrives | USE | Consistent |
| 10 | No iCloud removal/unlock | USE | Stable policy |
| 11 | Return shipping of consoles is free | **DROP** | Contradicts 19 € (C-3) |
| 12 | Shipping of the repaired device is free (garbled characters) | **DROP** | Garbled + C-3 |
| 13 | Transfers accepted to three named banks | **DROP** | Contradicts other payment entries (C-5); bank info only by a person |
| 14 | Damaged memory = total data loss | EDIT | Too absolute; wording needs Joney |
| 15 | Google account removed from locked phones at no cost if the customer does not know the credentials | **DROP** | Ethical/legal risk (could help with stolen phones); policy for Joney |
| 16 | Windows 11 Pro + Office licensed, 49 € (FreeDOS laptops) | EDIT | Volatile → PriceList |
| 17 | Base price of a laptop similar to the one asked about: 639 € | **DROP** | One-off quote |
| 18 | PS Vita hardware repairs incl. screens | EDIT | Confirm the service is still offered |
| 19 | Component-level repair and data recovery | USE | Matches the seed "micro-soldadura" |
| 20 | Second-hand equipment may not include the original charger | EDIT | Sales policy; confirm |
| 21 | Adobe program installation 15 € each | EDIT | Volatile; licensing wording to check |
| 22 | Swollen battery → stop using the device | USE | Safety advice |
| 23 | OLED screen replacement 120 €, 90 € "bajo presupuesto" | **DROP** | One-off, model unknown |
| 24 | Repair warranty 90 days, excludes knocks/manipulation | EDIT | C-1; keep only the exclusions |
| 25 | Graphics card fault appears after installing drivers | **DROP** | Technical one-off, no customer value |
| 26 | New hardware has a 3-year manufacturer warranty | EDIT | Legal wording (Spain: 3 years for goods since 2022 — gestoría to confirm) |
| 27 | Graphics card 320 € incl. fitting | **DROP** | One-off quote |
| 28 | RAM swap for one specific PC model 30 € | **DROP** | One-off |
| 29 | PC restarting at the CPU LED = hardware test needed | **DROP** | One-off diagnosis |
| 30 | Picofly chip sold alone 39 € incl. shipping | EDIT | Volatile; confirm it is a product the shop sells |

**Result: USE 9 · EDIT 11 · DROP 10 (33 %).** 3 of the 10 DROPs are legal or ethical risks (#1, #15, #13).
→ The extractor produces mostly one-off facts and some dangerous ones. Its output must never reach drafts or auto-replies without review, and the review queue must be fast and small.

---

## 5. Target design (improve what exists; no parallel system)

### 5.1 Roles of the existing entities

| Entity | Role in the target |
|---|---|
| **AnswerLibrary** | The **only approved answer library** used by drafts and auto-replies. It already has almost every field of AUDIT's proposed `KnowledgeEntry`. Add: `volatile` (derived: has `price_keys` or `live_source`), `live_source` (`none` / `pricelist` / `tpv_stock` / `reparo_status`), `source_chat_ids[]` (internal), `last_used_at`, `use_count`, `edit_count`, `valid_until`. |
| **PriceList** | The only store for volatile service prices and times. Joney edits one row and every answer changes. Add keys for the top requested models (§3.1 CONFIRMAR rows). Later, link TPV service products to the same `price_key` for "Cobrar en TPV". |
| **KnowledgeBase** | Becomes the **candidate inbox** only. Approving a candidate means merging it into an AnswerLibrary topic (new or existing). It is never read directly by drafts. |
| **New `DraftFeedback`** | `{conversation_id, topic_keys[], draft_text, sent_text, edited, created_at}` for the learning loop and metrics. |
| Reparo `waLookup` | `live_source=reparo_status` for "¿está lista mi reparación?" (12 % of questions). Today this topic reads WhatsApp Pro's frozen RepairOrder mirror (Phase 5 U-22). |

### 5.2 Pipeline

1. **Select** (no LLM): conversations of the day with ≥ 1 customer message followed by a **human staff reply** (`sender_type=agent`). Exclude templates/system, auto-replies, broadcasts, internal notes and exchanges < 15 words ("ok", "gracias").
2. **Anonymise before any LLM call** (one shared helper in `base44/shared/`, reusing the `buildContentSignals` redactors):
   - phones, e-mails, DNI/NIE/CIF, IMEI/serials, order numbers, plates, IBAN/card numbers, URLs (except the shop's), customer names from Customers/Reparo → placeholders;
   - log redaction counts;
   - unit-test it (AUDIT §7).
3. **Segment + extract** in batches of ≈ 20 anonymised conversations per call (cheapest model that passes the 30-sample test). Output: canonical question, variants (ES/EN/PA if present), answer, category, device brand/model, language, confidence, `volatile`, source date, candidate `topic_key`.
4. **Match and deduplicate** without LLM: keywords and example questions against AnswerLibrary (`MessageEmbeddings` only if keywords miss).
   - Matches an existing topic → increment `times_asked`; if the staff answer differs, raise a **conflict** for Joney (e.g. a different price → "update PriceList?").
   - New → KnowledgeBase candidate.
5. **Block lists:** candidates mentioning downloads/ROMs/VPN, account removal on locked phones, bank details, or "24/7" go straight to DROP with a reason; they never reach the queue.
6. **Review queue** in `/revision-kb`, keyboard-first:
   - **A** aprobar (→ AnswerLibrary), **E** editar, **D** descartar;
   - filter by category;
   - shows conflicts first;
   - target ≤ 10 candidates per day.
7. **Use in the inbox:**
   - On each new message: top 3 approved topics + live data (PriceList; Reparo status by phone; TPV stock for goods) → draft in the customer's language → staff sends with one click.
   - Auto-send only for `live=true` topics: **horario + ubicación** (D-04), at any hour (no LLM).
   - Everything else stays draft.
8. **Learning loop:**
   - Each sent draft writes a `DraftFeedback` row.
   - Weekly (Monday 14:15): topics with ≥ 3 edits get a proposed new wording for Joney.
   - Topics unused for 6 months are flagged.
9. **Metrics** (a small panel in `/revision-kb`):
   - % drafts sent unedited;
   - median first reply time in shop hours;
   - top 20 topics;
   - top 20 questions with no topic (today 55 % of messages);
   - coverage %.

### 5.3 Clean-up of today's data (after approval; archive, never delete)
1. Archive the ≈ 528 pending candidates older than 14 days. After de-duplication, re-run only the October ones through the new matcher.
2. Archive these approved KB entries: "Servicio 24/7" ×3, game-download advice, "X euros", internship policy, one-off products (vacuum spares, 3DS joysticks), the May seed lines superseded by PriceList (C-6).
3. Move the IBAN entry to a staff-only note.
4. Resolve C-1…C-9 with Joney, then write the answers once in AnswerLibrary/PriceList.
5. Switch `liveKBCheck` off (per-message 24/7 LLM). The daily batch replaces it.

### 5.4 Languages
- Today `answer_en` and `answer_pa` are empty.
- Proposal: drafts in the customer's language (the LLM translates the approved Spanish answer at draft time, for staff review). Auto-replies (horario/ubicación) in ES and EN with fixed approved texts.
- Punjabi only as staff-reviewed drafts until Joney decides (AUDIT §9 question).

---

## 6. Cost

Basis: 1 integration credit per LLM call [ASSUMPTION, as in Phase 7]. Token estimate: an anonymised conversation is ≈ 400–800 tokens, so a 20-conversation batch is ≈ 12k in + 2k out.

| Item | Today | Target | Maths |
|---|---|---|---|
| Per-message extraction (liveKBCheck, 24/7) | ≈ 16 calls/day → **≈ 480/month** | **0** (off) | [MEASURED] |
| One-off history pass | — | **≈ 60–100 calls once** | ≈ 1,500–2,500 conversations; ≈ 60 % have a staff reply; 20 per call. Run in shop hours over 2–3 days at 14:15 |
| Daily incremental (Mon–Sat 14:15 and 20:45) | — | ≈ 2–4 calls/day → **≈ 80/month** | ≈ 30–60 answered conversations/day ÷ 20 |
| Weekly learning-loop proposals | — | ≈ 4/month | 1 call per week |
| Drafts (`generateDraft`) | on demand, ≈ 10–15/day | same, but with fewer reads (library top 3 instead of the whole KB) | unchanged ≈ 300–450/month |
| Auto-replies horario/ubicación | 0 sends | **0 LLM** (library match) | Meta: free-form inside the open window → €0 |
| **KB extraction total** | **≈ 480 credits/month** | **≈ 85 credits/month** (+ 60–100 once) | **≈ −80 %** |

This is consistent with the Phase 7 LLM line (≈ 960 → ≈ 450/month including drafts).

---

## 7. Questions for Joney (only what this phase needs)
1. **Garantía (C-1):** ¿6 meses en todas las reparaciones y 1 año en la modificación de Switch? ¿O distinta por tipo (pantallas, portátiles, consolas)?
2. **Diagnóstico (C-2):** ¿gratis en móviles, tablets y consolas? ¿Cuánto en portátiles/PC, y se descuenta si se repara?
3. **Envíos (C-3/C-4):** ¿la oferta actual es "os gestionamos GLS ida y vuelta por 19 €", o "el cliente lo envía por GLS/MRW a su cargo", o ambas? En la modificación de Switch, ¿el cliente envía su microSD?
4. **Pago (C-5):** en tienda efectivo, tarjeta y Bizum; por envío, transferencia o Bizum antes de devolver. ¿Correcto?
5. **¿Existe un servicio 24/7 de urgencias? (C-9)** Si no, se archiva.
6. **Políticas delicadas:** ¿quitáis cuentas de Google de móviles bloqueados? ¿Se dan webs de descarga de juegos? (Recomendación: nunca en respuestas automáticas; idealmente nunca por escrito.)
7. **Idiomas:** ¿borradores en inglés y punjabí revisados por el personal, o solo español/inglés?
8. **Precios más pedidos para añadir a la lista:** pantallas y baterías de los modelos de móvil más frecuentes. ¿Quieres que prepare la lista de modelos (desde los pedidos de Reparo) para que pongas los precios?
