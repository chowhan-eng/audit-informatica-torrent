# Mostrador (+ Estado) — Inventory (Phase 1)

## Mostrador — `6ae3308edd92d52aa3a656b3` · https://torrent.base44.app [VERIFIED published-url]

**What it is:** a static launcher. No entities besides built-in User, no backend functions, no automations, no secrets. Access `public_without_login` (no login needed to see the launcher; each app keeps its own sign-in) — `src/App.jsx:10-11` [VERIFIED].

### Pages/routes [VERIFIED `src/App.jsx`]
| Route | Component | Who |
|---|---|---|
| `/` | `Home` — clock, greeting, 3 app tiles with deep links, "Abierto hace poco" (localStorage `mostrador.recent`), extras | public |
| `*` | PageNotFound | public |
| Login / Register / ForgotPassword / ResetPassword / OAuthConsent | template auth pages (files present, not routed in App.jsx) | — |

### Destinations [VERIFIED `src/lib/destinations.js`]
| Tile | URL (matches Base44 published URL) | Deep links |
|---|---|---|
| 1 Reparo | reparo-812bcab8.base44.app/tickets | tickets, panel, clientes, informes, configuración |
| 2 WhatsApp Pro | whats-app-pro.base44.app/ | conversaciones, esperando, triaje, pedidos, campañas, plantillas, conocimiento |
| 3 TPV | tpvtorrent.base44.app/ | tpv, venta, caja, tickets, artículos, stock, señales, vales, documentos |
| Extra: Web pública | informaticatorrent.com | — |
| Extra: Estado de reparación | estado-informatica-torrent-75674229.base44.app | **points to an empty app (see below)** |

Keyboard shortcuts 1/2/3 open the apps (`Home.jsx:52-62`). Links open in the same tab (`window.location.href`, plain `<a>`) ✅ matches requirement.

### App-switch icons back to Mostrador [VERIFIED]
Reparo, WhatsApp Pro and TPV each have `src/lib/appSwitcher.js:8` with `HOME.url = 'https://torrent.base44.app'` ✅. (Same file copied in three apps → a change must be made three times.)

### Findings
1. ~~Broken link~~ **Corrected:** the "Estado de reparación" extra (`destinations.js:73`) works — the live Estado host serves a status page at `/` and `/estado.html` [VERIFIED by fetch 30 Oct]. See Estado section: that page is not in the Estado source repo.
2. [VERIFIED] Tile copy says TPV does "facturación VeriFactu" (`destinations.js:44`) while Verifactu is intentionally off until 2027 — misleading wording.
3. [VERIFIED] Dead code: `search()` / `ALL` haystack in `destinations.js:80-128` is unused since checkpoint "Eliminar buscador principal" (29 Oct). Relevant to the future "global search" idea (Phase 6) — it only searched screen names, not customers/orders.
4. [MEASURED] Bundle 416 KB raw / 134 KB gzip for a single static page: ships the full shadcn/Radix + react-query + Base44 SDK/auth stack that the page does not use (AuthProvider still calls `getPublicSettings` on load — one unnecessary network request). Phase 3.
5. [VERIFIED] Auth config allows username/password sign-up and Google login on an app with no data — harmless now, but turn off Register if Mostrador later shows live data ("Hoy" panel).
6. No "Hoy" panel, no global customer/order search yet (both are Phase 6 ideas).

---

## Estado Informática Torrent — `6ae230ddc401827f75674229` · https://estado-informatica-torrent-75674229.base44.app

[VERIFIED] Untouched Base44 starter template: `src/App.jsx` has only the `*` → PageNotFound route ("Add your page Route elements here"), no entities besides User, no functions, last deploy 28 Oct 17:31. `public_without_login`, username/password + Google sign-up enabled.

**Who links to it:**
- Reparo `src/lib/shop/config.js:210` `DEFAULT_PUBLIC_BASE` (customer status & review pages; overridable via Reparo setting `shop_public_base`).
- Mostrador "Estado de reparación" extra.
- WhatsApp Pro: no reference [VERIFIED grep].

**Resolved (30 Oct):** Reparo has no `shop_public_base` row, so customer links/QRs use this default host. The **live** host does serve working pages: `/` and `/estado.html` show "Estado del ticket", and `/resena.html` returns 200. They load data from Reparo's public functions `publicStatus` / `publicReview` [VERIFIED by fetch; Reparo inventory].

**Risk [VERIFIED]:** these pages exist only in the deployed site (probably uploaded as a prebuilt site), **not in the Estado app's source** (repo = empty starter). A normal redeploy or builder edit of Estado would replace them with the empty template and **break every QR code and WhatsApp link already sent to customers**. Mitigation for later: put the pages into the Estado repo (or freeze the app) — Phase 9 backlog.
