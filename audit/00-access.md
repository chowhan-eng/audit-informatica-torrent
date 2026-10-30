# Phase 0 — Access & baseline

Date: 2026-10-30 (Europe/Madrid) · Auditor: Claude Code · Mode: **read-only**

## Method
- Base44 MCP connector (owner account `chowhan@gmail.com`): platform API (`GET` only), sandbox file reads, entity queries.
- Builds were run in a **throwaway copy** (`/tmp/auditbuild`, `npm ci && npm run build`) inside each app's sandbox, never in the app tree. `git status` stayed clean in every app afterwards [VERIFIED]. No checkpoints, deploys, settings or entity writes were made.

## Access matrix

| | Mostrador | Reparo | WhatsApp Pro | TPV | Estado |
|---|---|---|---|---|---|
| App ID | 6ae3308edd92d52aa3a656b3 | 6ae22784825ce515812bcab8 | 69f23ccb4284f8588aa5b7a3 | 6acf624e6e89e6f32c43243f | 6ae230ddc401827f75674229 |
| List/read files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Entities (files in `base44/entities`) | 1 (User) | 23 | 53 | 24 | 1 (User) |
| Backend functions (`base44/functions`) | 0 | 10 | 50 | 28 | 0 |
| Workflows/automations (files / live API) | 0 / 0 | 1 / 1 active | 11 / 2 active, 9 inactive | 3 / 3 active | 0 |
| Entity data read (query) | n/a | ✅ | ✅ | ✅ | n/a |
| Source of truth | Base44 git (Cloudflare) | Base44 git | Base44 git **+ GitHub `chowhan-eng/whatsapp-inbox-pro`** (sync active, webhook on) | Base44 git | Base44 git |
| Own `CLAUDE.md` / `AGENTS.md` | yes / yes | yes / yes | no (several `*-BRIEF.md`, `CREDIT-AUDIT.md`, etc.) / no | yes / yes | — |
| App user accounts | — | 3 (all admin) | 5 (3 admin, 2 user) | 3 (all admin) | — |
| Public setting | public_without_login | (not returned, response truncated) | (truncated) | (truncated) | public_without_login |
| Build status | ready | ready | ready | ready | ready |

## Last checkpoint vs deployed [VERIFIED]

| App | HEAD commit | Last checkpoint (UTC) | Last deployed (UTC) | Drift |
|---|---|---|---|---|
| Mostrador | e11abed | 29 Oct 12:48 "Abrir apps en la misma pestaña" | 29 Oct 18:03 (same) | none |
| Reparo | 686fe92 | 29 Oct 19:12 "Optimizar navegación por tabulador…" | 29 Oct 19:12 (same) | none |
| WhatsApp Pro | **21acef8** | 29 Oct 18:01 "Ficha del chat: cliente y pedidos desde Reparo" (b608898) | 29 Oct 18:03 (b608898) | **HEAD is 1 commit ahead**: 21acef8 deletes `base44/functions/tmpReparoPing/entry.ts`. Not checkpointed, not deployed → the temp function is probably still live [ASSUMPTION, verify in Phase 1]. |
| TPV | bf4c563 | 29 Oct 12:48 "Cambio de app: Mostrador en torrent.base44.app" | 29 Oct 18:03 (same) | none |
| Estado | 909512d | — | 28 Oct 17:31 (c3788b5) | HEAD has a package update only |

## Build baseline (`npm ci && npm run build`, Node 24.22, npm 10.9) [MEASURED]

| App | Result | JS total | Largest chunk (raw / gzip) | Notes |
|---|---|---|---|---|
| Mostrador | ✅ pass | 408 KB | index 416 KB / 134 KB | single chunk for one page — mostly unused UI libs |
| Reparo | ✅ pass | 1.6 MB (20 assets) | index 539 KB / 169 KB; Panel 396 KB; printEngine 222 KB | `public/` = 7.2 MB (assets shipped with the site) |
| WhatsApp Pro | ✅ pass | 1.4 MB | **index 1.37 MB / 392 KB — no code-splitting at all** | biggest first-load risk |
| TPV | ✅ pass | 2.3 MB (60 assets) | index 470 KB / 139 KB; xlsx 448 KB; Informes 396 KB | already lazy-loaded routes |

No build errors. Details (top libraries, unused deps) in Phase 3.

## Automations found (live) [VERIFIED]

| App | Name | Schedule (Madrid) | Status | Runs | Early flags |
|---|---|---|---|---|---|
| Reparo | Sincronizar HelloClient y WhatsApp pendientes | every 5 min, Mon–Sat 09:00–21:55 | active | 240 | Still mirroring HelloClient; runs 14:00–16:00 lunch gap too |
| WhatsApp Pro | masterTick (single master scheduler) | every 5 min, Mon–Sat 09:00–20:55 | active | 12,081 | ✅ matches "one master scheduler" rule; includes pollHelloClient job |
| WhatsApp Pro | Build Content Signals | Mon 05:00 | active | 5 | **Outside shop hours** (cheap, weekly) |
| WhatsApp Pro | 9 legacy per-job schedulers (NPS, broadcast, scheduled msgs, retry, watchdog, reviews, alerts, pollHelloClient, autoKBExtract) | 5-min / 3-h intervals, UTC | **inactive** since 28 Jun 2026 | — | ✅ the "8 automations burning credits off-hours" issue appears fixed (paused, folded into masterTick). Candidates to archive. |
| TPV | WhatsApp pendientes de hoy | 13:00 **every day incl. Sunday** | active | 2 | Sunday run while closed (sends nothing if no new pendientes) |
| TPV | Informe semanal de stock | Mon 08:45 | active | 1 | before opening; email only |
| TPV | Informe diario de caja | Mon–Sat 21:35 | active | 6 | after close by design (cash-not-closed alert) |

## Scope note — Estado Informática Torrent
Reparo links to it: `src/lib/shop/config.js:210` `DEFAULT_PUBLIC_BASE = 'https://estado-informatica-torrent-75674229.base44.app'` (customer status / review pages; overridable via setting `shop_public_base`) [VERIFIED]. **But the Estado app contains only auth pages** (Login/Register/…; main page = Register) and no status page [VERIFIED]. Either the setting points elsewhere or customer status links are broken → **included in scope, checked in Phase 1–2.**

## Early findings to carry forward (not yet scored)
1. WhatsApp Pro HEAD ≠ deployed (temp function `tmpReparoPing`).
2. Every Reparo and TPV user is `admin` → no cajero/admin separation yet (Phase 4).
3. HelloClient sync still active in Reparo and WhatsApp Pro (Phase 5), consistent with switch "end Oct 2026".
4. WhatsApp Pro ships one 1.37 MB JS bundle (Phase 3).
5. Possible broken customer status link host (Estado app is empty).

## Access gaps
None blocking. Not yet attempted: live browser measurement (needs Joney logged in, Phase 3) and secrets listing (Phase 1, names only).
