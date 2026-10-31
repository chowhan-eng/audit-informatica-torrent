# Backlog status — 30 Oct 2026

Legend:
- **LIVE**: in production.
- **READY**: code prepared locally and in the package (`DEPLOY.md`), not deployed.
- **WAITING**: needs Joney, the gestoría or a live session.
- **TODO**: not programmed yet.

| Item | Status | Note |
|---|---|---|
| B-01 sendMessage auth | LIVE | 30 Oct, tested |
| B-02 internal auth everywhere | READY | WhatsApp Pro 0001 + TPV inboxPro |
| B-03 secrets | WAITING | rows cleared (LIVE); Joney rotates the Meta token |
| B-04 test functions | READY | tmpReparoPing still to verify (D-33) |
| B-05 status page phone + order | READY | |
| B-06 Pendientes digest auth | READY | |
| B-07 webhook redelivery | READY | |
| B-08 instant off-hours ack | READY | |
| B-09 daily backup | READY | restore test at apply time |
| B-10 global pause | READY | TPV direct sends not covered |
| B-11 reviews only with consent | TODO | |
| B-12 no duplicate sales | READY | |
| B-13 KB purge, no raw LLM | LIVE | 30 Oct |
| B-14 Reparo card in chat | WAITING | live session (D-33) |
| B-15 invoices F 2600408–411 | WAITING | gestoría |
| B-16 Reparo workflow without HelloClient | READY | |
| B-17 masterTick 10 min, jobs trimmed | READY | |
| B-18 hide HelloClient/Doscar | READY | |
| B-19 hide WhatsApp Pro shop screens | READY | |
| B-20 voice and weekly signals off | READY | |
| B-21 auto-reply only hours/location | READY | 1 week trial, then live |
| B-22 13:00 digest Mon–Sat, all, retry | READY | |
| B-23 one escalation level | READY | |
| B-24 parts notices + 💬 | READY | create status "Pieza recibida" |
| B-25 SIM fields only for phones | TODO | |
| B-26 Informes 3,000-product cap | TODO | |
| B-27 TPV phone search +34 | TODO | |
| B-28 catalogue load retry | TODO | |
| B-29 signed expiring PDFs | TODO | |
| B-30 atomic Reparo order number | TODO | |
| B-31 Estado pages into source | TODO | |
| B-32 cash-close reminder | TODO | |
| B-33 FailedSend coverage | TODO | |
| B-34 KB contradictions + prices | WAITING | Joney's prices |
| B-35 invite-only registration | WAITING | platform setting at deploy |
| B-36 money writes server-only | TODO | |
| B-37 hide stale WhatsApp Pro mirrors | TODO | |
| B-38 Crear reparación from chat | READY | |
| B-39 roles / permissions | READY (part) | self-approval and deletes fixed; full role matrix still TODO |
| B-40 Cobrar en TPV | READY | |
| B-41 uncollected 3/7/15 days | READY | final notice T-06 waits for gestoría |
| B-42 budget reminder 24 h | READY | 72 h staff alert = Hoy panel list |
| B-43 morning brief e-mail | READY | Mostrador morningBrief |
| B-44 health check | READY | Mostrador healthCheck |
| B-45 mail-in process | TODO | T-07 approved |
| B-46 KB pipeline | TODO | |
| B-47 Mostrador Hoy + search | READY | |
| B-48–B-50 speed (TPV cache, code-split, Reparo search) | TODO | |
| B-51 events append-only | TODO | |
| B-52 shared helpers | TODO | |
| B-53 audit-log gaps | TODO | |
| B-54 GDPR procedure + retention | READY | retention part (unlock codes, lookup log); written procedure TODO |
| B-55 TPV PIN server-side + cajero | READY | who is cajero: Joney (D-35) |
| B-56 duplicates report | TODO | |
| B-57 PII out of logs | TODO | |
| B-58 unused secrets | WAITING | platform action at deploy |
| B-59 hide TPV compras/proveedores/unidades | TODO | |
| B-60 archive 8 apps | WAITING | platform action, Joney's OK |
| B-61 separate keys per direction | READY | constant-time compare done; separate keys TODO |
| B-62 delete dead code | WAITING | 30 days after deploy; list ready |
| B-63 /tpv deposit | TODO | low priority (D-06) |
| B-64 misc Phase 3 fixes | TODO | |

**Counts (64 items):** 2 LIVE · 29 READY · 8 WAITING · 25 TODO. Plus the 31 Oct extras (D-40…D-42).
