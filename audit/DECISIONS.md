# Decisions by Joney (recorded during the audit)

Decisions are recorded here as they are taken. Nothing below has been executed yet: per AUDIT.md §4 rule 1 the apps stay read-only until Joney approves the final report (Phase 9); each item then goes into an implementation batch (AUDIT.md §7). Hidden features stay hidden 30 days before code removal; data is archived, never deleted.

## 2026-10-30 — Phase 5 answers

| # | Question | Decision (Joney, in chat) | Backlog items affected | Action after approval |
|---|---|---|---|---|
| D-01 | HelloClient and Doscar migration finished? | **Yes, finished. Importers can be hidden.** | U-07, U-17, U-31, U-42 | Hide HC importers (Reparo `/configuracion/importar`, cutover screens; WA Pro `/importar-helloclient`, `/importar`, Dashboard "Escanear HelloClient"), Doscar restore tab in TPV Ajustes; remove HC jobs from schedulers; revoke `HC_SESSION_FULL`. Remove code after 30 days. |
| D-02 | TPV purchasing and buy-from-customer used? | **Not used for now. Hide them (behind Ajustes).** | U-45, U-46 | Hide `/compras`, `/proveedores`, `/unidades` from the menu; reachable only from Ajustes (admin + PIN). Keep code and data (Supplier rows). |
| D-03 | Voice alerts and weekly website content feed needed? | **No. Disable the voice queue and the weekly AI summary.** | U-15, U-16 | Stop writing `VoiceQueue` and the voice translation in `processAlerts`; pause workflow "Build Content Signals" (keep `exportContentSignals` returning the last cached feed until removal). |
| D-04 | Which WhatsApp topics may auto-reply? | **Only "Horario" and "Ubicación / Cómo llegar", with reviewed and approved texts. Everything else: draft only, staff reviews and sends.** | U-11 (+ Phase 7/8) | Enable live only for the two topics; all other topics `draft_only`. **Blocking:** the two texts must be drafted by the auditor from approved data and approved by Joney before go-live (business data is not invented — AUDIT §4 rule 4). Note the hours mismatch found in Phase 1 (configured 09:30–14 / 17–20:30 vs stated 09–14 / 16–21) must be resolved first, because the "Horario" reply would publish it. |
| D-05 | Archive inactive apps? | **Yes, archive the 7 inactive apps. "Inventario Visual Torrent" is not used either.** | U-52 | Archive (not delete) 8 apps: RepairTrack Pro, SyncRepair, App Hub, Informática Torrent Companion, Informática Torrent Portal, InventoryPro, SUDO Command Center, Inventario Visual Torrent. **TorrentConnect** (1 event) was in the "activity" group, not the 7, so it stays until Joney confirms. Before archiving, check each app's published URL is not linked from the website or Mostrador. |

## 2026-10-30 — Phase 6 answers

| # | Question | Decision (Joney, in chat) | Effect on the plan |
|---|---|---|---|
| D-06 | Do you take a deposit (señal) on repairs? | **No.** | Drop "Cobrar señal" (workflow §3 item 3 keeps only "Cobrar en TPV"). The `/tpv` deposit bug becomes low priority (P3). Señales menu can be hidden later (Phase 5 rule, Joney confirms). |
| D-07 | Storage of uncollected devices | **1 year.** Final-notice wording not given yet. | Reminder schedule in Phase 7 ends with a final notice before 1 year; the text is drafted by the auditor and must be approved by Joney (legal wording, ask gestoría). |
| D-08 | Mail-in process | **Customer pays shipping, GLS or MRW; payment once the repair is done and ready.** | Phase 7 item 11: instructions message on mail-in order + "ready, pay to ship back" notice + tracking notice. Statuses/fields to add in Reparo (backlog). |
| D-09 | Merge "Listo" and "Listo + Whatsapp"? | **No, keep both.** | Keep both statuses. Proposal reduced to: show 💬 next to statuses that message the customer, so the choice is visible. |
| D-10 | Notify on "Esperando material"? | **Yes.** | Auditor drafts the text (Phase 7, marked draft); goes live after approval. |
| D-11 | Tarjeta SIM / Bandeja SIM only for phones and tablets? | **Yes.** | Make both fields conditional (backlog, Reparo). |
| D-12 | Real shop hours | **Mon–Fri 09:30–14:00 and 17:00–20:30; Sat 10:00–14:00; Sun closed.** | **Matches the configured `shop_hours` in WhatsApp Pro** → Phase 1 finding 11 closed, no change needed there. AUDIT.md §2 hours (09–14 / 16–21) are outdated. Unblocks D-04 "Horario" text. All schedules in Phase 7 use these hours. |

## 2026-10-30 — Phase 7 answers

| # | Question | Decision (Joney, in chat) | Effect on the plan |
|---|---|---|---|
| D-13 | Message drafts | **Approved: T-01 to T-05 and T-07 to T-10.** Completed by Joney: Ubicación link `https://maps.google.com/?q=Calle+Germanies+74+Torrent`; parking "Parking público Metro Torrent Avinguda o zona azul cercana"; mail-in packaging "Proteger el dispositivo con plástico de burbujas en caja rígida ajustada; no incluir cables, fundas ni tarjetas SIM/SD salvo que se soliciten explícitamente para el diagnóstico." | T-07 and T-10 placeholders filled with Joney's text. Texts go live only in the implementation batch, after shadow week (automations.md §6). |
| D-14 | Final custody notice (T-06) | **The gestoría provides the final legal clause** (Código Civil / deposit rules). | T-06 blocked until the clause arrives; A-03 final notice stays off until then. Day 3/7/15 reminders can go live before it. |
| D-15 | Morning brief channel | **E-mail only. No WhatsApp sends for internal system notifications.** | A-10 e-mail only. Health check (A-12) → push + e-mail, no WhatsApp. Saves the internal-WhatsApp line in the cost table. **To confirm:** the 13:00 Pendientes WhatsApp to Japji (A-09a) is a staff task list, not a system notice — keep it by WhatsApp, or move it to e-mail/push? |
| D-16 | Unanswered chats > 60 min | **Centralise all operational alerts to the shop's main / administrator number; remove duplicate escalations to the same phone.** | One escalation level only (the 30-min and 60-min levels today both go to the same phone). **Open:** which number is "the main number"? The shop's WhatsApp Business number (+34 601 110 325) cannot message itself, so the recipient must be another phone — Joney to give it in chat (not invented). Under D-15 this alert could also be push/e-mail only — Joney to confirm. |
| D-17 | Review page on netlify | **Remove the intermediate link completely. Send review requests only to the official Google Business Profile link, with no satisfaction pre-filter.** | Setting `review_redirect_url` to be cleared; `review_url` (g.page/r/…) is the only link. Together with SEC-06 (consent) before A-07 goes live. |

## 2026-10-30 — Phase 8 answers (policies and knowledge base) + Phase 7 open points

Phone numbers given by Joney are recorded masked here (this repo is shared); the full values are already stored in the apps' settings, where the implementation reads them.

| # | Topic | Decision (Joney, in chat) | Effect on the plan |
|---|---|---|---|
| D-18 | Warranty (C-1) | **Standard hardware repairs: 3 months** (parts and labour). **Switch modification/soldering (modchip): 1 year** on installation and chip. | Supersedes AUDIT.md "6-month warranty". Update AnswerLibrary `garantia` (today says 6 months) and `como_puedo_reparar_el_drift…` (says 6 months), the PriceList `warranty` fields and the ticket/warranty texts. Archive the KB entries with 90 days / 30 days / 6 months. Warranty **claims** are still always handled by a person. |
| D-19 | Diagnosis (C-2) | **In the shop: 0 € if the quote is rejected or there is no solution; if the quote is accepted, the diagnosis is free (included in the total).** | In practice the diagnosis is always free. Set PriceList `diagnostico` = "gratuito" (confirmed). Archive the 5 € / 10 € / 15 € entries. |
| D-20 | Mail-in (C-3/C-4) | **By default the customer sends the device to the shop with GLS or Correos Express. Return arranged by the shop: 10 €** (or **19 € full service, both ways**, if the customer asks). **Switch: the customer may send their own microSD** (recommended 128/256 GB, original, high speed) **or buy one in the shop.** | Updates D-08 (carriers: GLS/Correos Express, not MRW). Add PriceList key `envio_vuelta` = 10 € next to `envio_ida_vuelta` = 19 €. **T-07 (approved in D-13) needs a small re-wording** (carriers + 10 € return + Switch microSD exception to the D-13 packaging rule) → new draft in REPORT.md §8 for Joney's OK. |
| D-21 | Payment (C-5) | **Counter: cash, card, Bizum. Mail-in: Bizum or transfer before the repaired device is sent back.** | AnswerLibrary `pago` matches. Bank details are still only sent by a person. Archive the "solo transferencia" and "three banks" entries. |
| D-22 | 24/7 service (C-9) | **There is no 24/7 service. Purge/archive every emergency-service entry.** | Archive the 3 approved "Servicio 24/7" entries (archive, not delete — AUDIT §4 rule 3). |
| D-23 | Sensitive policies | Joney's text, verbatim: *"Cuentas de Google (FRP): No hace falta factura de compra a nombre del titular como prueba inequívoca."* · *"ROMs / Descarga de juegos: No Prohibido terminantemente. No Purgar todas esas entradas y vetar cualquier recomendación por IA."* | **Wording is ambiguous; confirmation needed before any text about these topics is written.** What both possible readings share is implemented: **(a) these topics are never answered by AI (no drafts, no auto-replies) — always a person; (b) the AI blocklist rejects candidate KB entries about game/ROM downloads, VPN download sites and FRP/account removal.** Existing entries are removed from what the AI can read (archived, reversible), not deleted. **Auditor's recommendation for FRP:** require proof of ownership (purchase invoice in the holder's name, or ID matching the account) before removing a Google account — removal without proof can help with stolen phones (legal and reputational risk). Open question Q-1 in REPORT.md. |
| D-24 | Draft language | **Spanish only for internal draft generation, always reviewed by a person before sending.** | `answer_en/answer_pa` stay empty. The auto-replies (horario, ubicación) remain Spanish (T-09/T-10). Staff can still write in English/Punjabi by hand. |
| D-25 | Prices to add | **Yes, prepare the 10 most common models in Reparo to define standard battery and screen prices.** | Done: `audit/kb/top10-price-template.md` (prices left blank for Joney; no prices invented). |
| D-26 | Operational alerts (D-16) | **Send operational alerts to the mobile +34 658 … 734.** | This number is already in WhatsApp Pro `escalation_phone_1` and `escalation_phone_2` [VERIFIED]. Keep **one** escalation level to it; remove the duplicate second level. |
| D-27 | 13:00 Pendientes (D-15) | **Keep the daily WhatsApp to Japji at 13:00 as it works today, to +34 601 … 837.** | Matches TPV Settings `pending_digest_phone` [VERIFIED]. A-09a fixes still apply (Mon–Sat, all open tasks, retry). D-15 "no WhatsApp for internal system notifications" applies to system notices (brief, health check), not to this staff task list. |
| D-28 | TorrentConnect | **Keep active (do not archive); used for technical operations.** | Archive list (D-05) stays at 8 apps. |

## 2026-10-30 — Final approval

| # | Topic | Decision (Joney, in chat) | Effect |
|---|---|---|---|
| D-29 | REPORT.md + BACKLOG.csv | **Approved.** The audit is closed; read-only mode ends. Implementation starts with Week 1 (P0/P1 security). **Stop and ask before every commit to an app or deploy to production.** | Every change is prepared as a reviewed patch first, then applied only after Joney's OK (AUDIT §7). |
| D-30 | FRP (replaces D-23) | **Removing a Google account (FRP) requires a purchase invoice and the customer's DNI. Doing it without proof of ownership is strictly forbidden.** | Staff policy. AI never answers on this topic (always a person). |
| D-31 | ROMs / piracy (replaces D-23) | **Strictly forbidden.** **The AI must never answer on these topics. Purge (delete completely) every knowledge-base entry about bypassing accounts without requirements or downloading ROMs.** | Explicit exception to AUDIT §4 rule 3 ("never delete"), limited to these KB entries. The list of entries is shown to Joney before deletion; a JSON export of them is kept in the audit folder as the only record. AI blocklist for these topics in drafts, auto-replies and extraction. |
| D-32 | Production hotfixes | **CHANGELOG #1 (invoice counter) and #2 (NPS paused) confirmed and approved.** | No action. |
| D-33 | Live measurements | **WhatsApp Pro inbox load, counter stopwatch and `tmpReparoPing` check are deferred to a later live session.** B-04 therefore keeps a "verify first" step for `tmpReparoPing`. | — |
| D-34 | T-07 (mail-in text) | **The re-worded T-07 in REPORT.md §8 is approved** (GLS/Correos Express, return 10 € or 19 € both ways, Switch microSD exception). | Goes live with B-45. |
| D-35 | Joney's own tasks | **Joney defines cashier roles, asks the gestoría (invoices F 2600408–411 and custody clause) and fills the top-10 price template.** | B-15, B-55, B-34 prices and T-06 wait for these inputs. |

### Open from D-04 (for Joney)
- Confirm the real opening hours (Mon–Fri 09–14 / 16–21? Saturday hours?) so the "Horario" text and `shop_hours` can be fixed in one go.
- Confirm the "Cómo llegar" content (address is known: C/ Germanies 74 bajo, 46900 Torrent; parking/transport details only if Joney provides them).
