# Phase 3 — Speed & stability summary (cross-checked)

Detail: `reparo/speed.md`, `whatsapp-pro/speed.md`, `tpv/speed.md`, `live-measurements.md`.

## Speed table (now → target)
| Screen | Now | Target | Main cause | Fix |
|---|---|---|---|---|
| Mostrador home | 1.0 s [MEASURED] | < 2 s | — | (trim unused libs, optional) |
| TPV `/venta` ready | 2.8–3.8 s [MEASURED] | < 2 s | full catalogue (~9,100 products, ~2.6 MB JSON / ~290 KB transferred) re-downloaded every visit, 2 sequential requests, no cache | IndexedDB cache + delta sync; parallel pages; error/retry instead of endless spinner |
| TPV barcode scan → cart | 12 ms [MEASURED] | < 150 ms | ✅ in-memory | queue scans made before catalogue is ready |
| TPV product search | 19 ms [MEASURED] | < 300 ms | ✅ in-memory | accent-insensitive matching ("raton" ≠ "RATÓN" today) |
| TPV payment → ticket | ~0.7–1.1 s typical, max ~1.9 s [MEASURED from record timestamps] | — | ~11 sequential server calls | parallelise checks; move low-stock email out of payment path |
| Reparo tickets list | 2.2 s, 31 API calls [MEASURED] | < 2 s | 12–23 tab-count requests every 60 s per tab | single counts endpoint / longer interval |
| Reparo search by order no. | 0.9 s [MEASURED] | < 300 ms | 3–5 requests per keystroke, unindexed regex over 8 fields | exact fast path for numbers/phones, fewer fields, debounce |
| Reparo open order (cold) | 1.9 s, 24 calls [MEASURED] | — | static print libs + many reads | lazy print chunk |
| Reparo status change | 1 awaited write [VERIFIED]; WhatsApp work 0.6–3.9 s after the 60 s delay, non-blocking | < 500 ms | ✅ | show errors (2 silent paths) |
| WhatsApp Pro inbox | not measured live (audit-browser session issue) | < 2 s | 1.37 MB single bundle (all 27 pages eager), 7 realtime subscriptions refetching 200 conversations per new message | code-split routes (−35 % first-load), react-query caching |
| WhatsApp Pro AI draft | ~9 sequential reads before LLM call [VERIFIED] | — | — | parallel reads, show error on failure |

## Stability — verified by lead auditor
| # | Finding | App | Evidence | Severity |
|---|---|---|---|---|
| S1 | **~220 Meta webhook deliveries failed in October and were acknowledged 200 → never retried by Meta** (customer messages or delivery statuses, unknown which). Failures cluster at :11/:13/:41/:43 = when `sendNPS` runs (up to 200 sequential reads → platform read-rate limit hit for all functions). Started 14 Oct, last 30 Oct 08:41 UTC. | WA Pro | [VERIFIED] `whatsappWebhook/entry.ts:146-163` catches and returns `ok()`; `sendNPS/entry.ts:33-40` loop; [MEASURED] 243 WebhookLogs errors since 1 Oct (≈220 "Unhandled webhook error") | **P0** |
| S2 | No idempotency in `completeSale`: retry after network drop → duplicate sale, number and stock deduction | TPV | [VERIFIED] `shared/saleCompletion.ts:194` (no request key) | P0/P1 |
| S3 | Informes silently uses only the first 3,000 products (of ~9,100) → wrong margins, families, idle stock | TPV | [VERIFIED] `src/lib/informes/load.js:36` `max: 3000` | P1 (quick) |
| S4 | Repair history `events[]` rebuilt from a client copy up to 60 s old → comments/status entries overwritten between PCs | Reparo | [VERIFIED] `src/lib/shop/orders.js:35-62` | P1 |
| S5 | Order number = read max + 1, not atomic → possible duplicate order numbers | Reparo | [VERIFIED] `orders.js:81-83` | P1 |
| S6 | masterTick slowing: avg 45.9 s last 7 days (was 21 s), 0.2 credits/run; shows "completed" even when a job fails | WA Pro | [MEASURED] workflow runs (subagent) | P1 |
| S7 | Catalogue load has no error handling → endless spinner if a request fails | TPV | subagent [VERIFIED] | P1 |
| S8 | Phone search: "+34…" throws (unescaped regex), numbers with spaces not found | TPV | subagent [VERIFIED] | P1 |
| S9 | Silent failures: 2 Reparo status-change paths, passcode save, WhatsApp pre-queue errors; TPV customer lookup in completeSale; WA AI draft failure shows nothing | all | subagents [VERIFIED] | P1/P2 |
| S10 | Failed-send gaps: network errors in `sendMessage`, Meta-reported failures (131026) only logged, several senders not covered | WA Pro | subagent [VERIFIED]; [MEASURED] 131026 failures in logs, some to malformed 10-digit numbers | P2 |
| S11 | Reparo 5-min workflow 65 s/run, mostly platform start-up of the dead HelloClient step | Reparo | [MEASURED] logs | P2 (credits) |
| S12 | Service worker build stamp never applied → "update available" toast can't appear | WA Pro | subagent [VERIFIED] | P3 |

## Console errors observed live
TPV 0 · Reparo 0 · Mostrador 0 · WhatsApp Pro 2 (realtime socket rejected — audit-browser session only).
