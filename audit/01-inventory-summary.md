# Phase 1 — Inventory summary (cross-checked)

Per-app detail: `reparo/inventory.md`, `whatsapp-pro/inventory.md`, `tpv/inventory.md`, `mostrador/inventory.md` (includes Estado).

## Size at a glance [MEASURED]
| App | Entities | Functions | Live automations | Key data |
|---|---|---|---|---|
| Reparo | 23 | 10 | 1 (every 5 min, 156 runs/day) | 19,516 orders · 12,291 clients · ~17–20k unlock codes |
| WhatsApp Pro | 53 (16 empty) | 50 | 2 (masterTick 144/day, weekly signals) | 1,500–2,499 conversations (not ~5,500) |
| TPV | 24 (7 empty) | 28 | 3 | ~9,100 products · ~1,300 customers · 99 live sales · >10k Doscar history |
| Mostrador | 1 | 0 | 0 | launcher only |
| Estado | 1 | 0 | 0 | live pages exist only in deployed site, not in repo |

## Auditor cross-checks
| Claim (subagent) | Check by lead auditor | Result |
|---|---|---|
| TPV invoices reuse Doscar numbers | Queried Invoice, Counter, HistoricSale | **Confirmed** → fixed counter with Joney's approval (CHANGELOG #1) |
| Estado host works although repo is empty | Fetched `/` and `/estado.html` | **Confirmed**; corrected my earlier "broken link" note |
| WhatsApp Pro `sendMessage` skips the approval gate when no user is logged in | Read `sendMessage/entry.ts:158-170` | **Confirmed in code**: gate runs only `if (callerHeader !== 'internal' && user)`; anonymous caller → no check, then sends with service role. Anonymous reachability not tested (would send a real message) [ASSUMPTION, consistent with Reparo finding that public functions answer anonymous requests]. GitHub repo is private (API 404). |
| Reparo workflow 156 runs/day | cron `*/5 9-21 * * 1-6` = 13 h × 12 | Consistent |

## Historic WhatsApp Pro issues (verdict)
| Issue | Verdict |
|---|---|
| (a) Secrets in SystemSettings | **Partly fixed**: code reads env, but 3 rows still hold values (`meta_access_token`, `import_secret`, `webhook_verify_token`) |
| (b) Webhook HMAC fail-open | **Fixed** (fails closed) |
| (c) Template names split | **Partly fixed**: 3 functions + frontend bypass `resolveTemplate` |
| (d) Off-hours automations | **Mostly fixed**: one master scheduler; legacy 9 inactive |

## Top findings carried into Phases 2–4 (provisional priority)
**P0 — safety / broken**
1. WhatsApp Pro: unauthenticated `sendMessage` (and `generateDraft`, `logOutboundMessage`, `sendPush`, `extractMemory`) — anyone with the URL could message customers from the shop number.
2. Reparo `publicStatus`: any phone → last 5 repairs; no ownership check, weak rate limit.
3. TPV `sendPendingDigest` callable without login, message contains customer names/phones.
4. TPV `cleanupTestData` still deployable — can reset invoice/ticket counters.
5. Estado customer pages not in source — a redeploy breaks every link/QR sent.
6. RLS: non-admin `user` role gets full read/write on orders, clients, messages in Reparo and WhatsApp Pro; TPV PIN client-side only. Mitigated today only because all staff are admin.
7. 3 secret values still stored in WhatsApp Pro SystemSettings rows.
8. Review requests use a MARKETING template without consent check.

**Broken features**
9. WhatsApp Pro off-hours auto-ack and watchdog can never fire (gated by shop-hours in masterTick while they need closed hours).
10. TPV 13:00 Pendientes digest misses tasks entered after 13:00; runs Sundays; no retry (first run failed with 502).
11. Shop hours configured 09:30–14 / 17–20:30 vs stated 09–14 / 16–21 (to confirm with Joney).

**Waste / cleanup**
12. Reparo 5-min workflow: HelloClient step dead since cutover; ~29% runs off-hours; ~1,200 credits/month estimated.
13. No Gemini router in use — all LLM via Base44 `Core.InvokeLLM` (~32 calls/day, liveKBCheck 24/7).
14. Leftovers: HelloClient sync/import code (Reparo, WhatsApp Pro), Doscar restore tools (TPV, writes stock from browser), test functions `zzImportTest`, `zzPbkdf2Test`, `tmpReparoPing` (deletion not deployed).
15. Reparo ↔ TPV link is only a free-text `repair_ref`; Deposit/Voucher entities empty, vouchers & señales written from the browser.

## Coverage gaps
- Exact row counts unavailable (count endpoints refuse this credential) → ranges from skip-probing.
- Repo-vs-deployed function comparison not done (API returns full source, truncated). To do in Phase 3 via per-function logs.
