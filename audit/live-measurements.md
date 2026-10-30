# Phase 3 — Live measurements (Chrome, owner logged in) · 30 Oct 2026 ~11:40–11:50 Madrid

Method: Claude in Chrome on Joney's PC (not the counter PC), new tab, Navigation/Resource Timing + in-page timers. Read-only: no sale completed, no status changed, no message sent. One product was added to the local cart to time a barcode scan and removed again (cart total back to 0,00 €).

| Screen | Measure | Result | Target | Verdict |
|---|---|---|---|---|
| Mostrador home | load event / last API | 1.03 s / 1.16 s, 152 KB, 6 requests | < 2 s | ✅ |
| TPV `/venta` (1st visit) | screen visible / catalogue ready | 0.89 s / **3.8 s** (two sequential catalogue downloads 158 KB + 133 KB, 1.7 s + 0.8 s) | < 2 s | ⚠️ catalogue late |
| TPV `/venta` (2nd visit) | JS from cache; catalogue | catalogue downloaded again every visit, ready at **2.8 s**; no IndexedDB cache | < 2 s | ⚠️ |
| TPV product search ("funda") | keystroke → results | **19 ms** (local filter) | < 300 ms | ✅ |
| TPV barcode scan → line in cart | Enter → total updated | **12 ms** | < 150 ms | ✅ |
| TPV console errors | | 0 | 0 | ✅ |
| Reparo `/tickets` | list usable (last API) | **2.16 s**, **31 API calls** on load, 50 rows/page | < 2 s | ⚠️ |
| Reparo search by order number | last keystroke → result | **0.90 s**; 1 server call per keystroke (~230–300 ms each) | < 300 ms | ❌ |
| Reparo open order (cold) | last API | **1.93 s**, 24 API calls | — | ⚠️ |
| Reparo console errors | | 0 | 0 | ✅ |
| Reparo change status | not measured live (write) → from function logs | — | < 500 ms | pending |
| WhatsApp Pro inbox | — | not measured: audit browser session returns 0 rows (works on counter PC). See note below | — | pending |
| WhatsApp Pro console errors | | **2**: realtime socket `connect_error: Connection rejected by server` | 0 | ❌ |

Note: TPV scan/search timings assume the catalogue has finished loading; a scan in the first ~3 s after opening `/venta` may not find the product [ASSUMPTION, to verify in code report].

## WhatsApp Pro shows no data in the audit browser [MEASURED 11:48 Madrid]
**Update 30 Oct:** Joney confirms WhatsApp Pro works normally on the counter PC → **not an outage**; the problem is limited to the session in the auditor's Chrome profile (cause still unknown: stale/odd session for this app). WhatsApp Pro live timings still to be taken once that session works (log out/in). Low priority finding: when a session is in this state the app shows "No hay conversaciones" instead of an error — a silent failure that could mislead staff [VERIFIED observed].
- Logged in as owner, role `admin` (`User/me` 200).
- Every entity read returns **HTTP 200 with 0 rows**: Conversations, Messages, Customers, KnowledgeBase, SystemSettings, UserPreferences. `POST UserPreferences` → **403**. Realtime socket rejected.
- The database itself is fine: via the Base44 admin API, Conversations has rows, latest customer message 10:34 UTC (11:34 Madrid); masterTick runs normally.
- **Last human (agent) reply in Messages: 08:54 UTC = 09:54 Madrid**; customers kept writing after that.
- Reparo and TPV in the same browser load data normally → problem specific to WhatsApp Pro (app config, auth/session for that app, or Base44 platform) [ASSUMPTION, cause unknown].
- No changes were made by the auditor to WhatsApp Pro (no deploy, no settings).
