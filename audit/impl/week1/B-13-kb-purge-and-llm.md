# B-13 — Stop raw-text LLM extraction; purge/archive unsafe KB entries (P0)

Status: **PREPARED, NOT APPLIED** — waiting for Joney's OK.
- Deleting entries is irreversible.
- D-31 authorises it for these topics.
- Only `id`, title and date of the deleted entries are kept as a record (below), not their text.

## Part A — switch off `liveKBCheck` (raw customer text → LLM, 24/7)
1. Setting `autokb_live` = `false` in WhatsApp Pro SystemSettings. This is the switch `liveKBCheck` already honours.
2. Remove the two invocations so the function is not even called:
   - `whatsappWebhook/entry.ts:437`: `runBackground(base44.functions.invoke('liveKBCheck', …))`
   - `sendMessage/entry.ts:486`: `base44.functions.invoke('liveKBCheck', …)`
   → Both lines become a comment: `// liveKBCheck disabled 2026-10 (audit B-13): raw text must not reach the LLM; daily anonymised batch replaces it (B-46).`
3. Redeploy `whatsappWebhook` and `sendMessage`. Bundle with B-01, since sendMessage is touched anyway.
- Saving: ≈ 480 credits/month.
- Function: nothing lost; the October output was 300 unreviewed candidates.

## Part B — KnowledgeBase entries [VERIFIED query, 30 Oct; regex on ROM/descarga/pirat/VPN/Google/FRP/24-7 → 27 hits]

### B1. DELETE (D-31: ROM/download/piracy, or account bypass without requirements) — 17
| # | id | Status | Title |
|---|---|---|---|
| 1 | 6ae4934ec11efed2a5032389 | pending | Recurso externo recomendado (download site + VPN) |
| 2 | 6ae31936da6658a96d945ae1 | pending | Eliminación de cuenta de Google (sin credenciales) |
| 3 | 6ad8e80a8452e0120f42b613 | pending | Desbloqueo de cuenta Google (FRP) — no requirements stated |
| 4 | 6abb93fdf615c36334d87027 | pending | Desbloqueo FRP Motorola Edge 30 Neo (price, no requirements) |
| 5 | 6ad6e5dad0a65ed0e35827e8 | pending | Instalación de juegos (descargados) en consolas modificadas |
| 6 | 6ad2ddb69be3498da5de57d3 | pending | Funcionamiento de sistemas en Switch modificada ("pirata") |
| 7 | 6a6091802a36f634736e08f4 | pending | Sitios recomendados para archivos de Nintendo Switch (ROM sites) |
| 8 | 6a6085791a9c95cc73f02458 | pending | Páginas recomendadas para Nintendo Switch (download sites) |
| 9 | 6a57a94b265628a7841954f8 | pending | Compatibilidad de tarjeta SD (sistema "pirata") |
| 10 | 6a578e068af648b14cc5655c | pending | Servicio de modificación digital (pirateo) |
| 11 | 6a5687b5a4bd16a8d2b0736a | pending | Instalación de juegos — tutoriales para descargarlos |
| 12 | 6a2d7acc5534ef894209cde9 | **approved** | Precio de pirateo de PS4 |
| 13 | 6a2a9c743d30082f3e65c1a1 | **approved** | FAQs sobre descarga de juegos |
| 14 | 6a2a91a2b6c01ffb50a1a01e | **approved** | Limitación de servicios de Nintendo tras pirateo |
| 15 | 6a2a80bfde9501a2bc2164ca | **approved** | Funcionamiento del chip instalado (ROMs) |
| 16 | 6a27e0888f9c533989f93fdf | **approved** | Preguntas frecuentes sobre emuladores (juegos piratas) |
| 17 | 6a27e0814b595b23dd53bec5 | **approved** | Coste adicional para partición (jugar online con juegos pirata) |

### B2. ARCHIVE (D-22: no 24/7 service) — 3
`review_status` → `rejected`, with a note. They stay readable for traceability; drafts never read rejected entries [to verify in `generateDraft` at apply time].

| id | Title |
|---|---|
| 6a2bb8cda1b7b791cf3cd3d2 | Servicio 24/7 |
| 6a2ad5e03f23210c838bbb24 | Servicio 24/7 |
| 6a2ad274920e1fe0beffbbe6 | Servicios de Emergencia |

### B3. KEEP (false positives or compliant) — 7, listed so Joney can see nothing was missed
| id | Title | Why kept |
|---|---|---|
| 6ae38978853be73342a4a57b | Desbloqueo de iCloud | Says the shop does **not** do it |
| 6ad35ff602d03c81b10e31f9 | Comportamiento de carga tras descarga total | Battery "descarga" (discharge) |
| 6a859e9f08aa60b055d70f79 | Cambio de pantalla Google Pixel 7a | "Google" = phone brand |
| 6a5f6a723137097c0dd613a2 | Pantalla negra con led azul en 3DS | Diagnosis; mentions software cause only (review wording later) |
| 6ad258359887a29068352019 | Problemas de conexión desde Andorra (VPN) | Remote-access one-off; candidate for normal review queue |
| 6a27e080fe7fc718d035242f | Política sobre juegos en línea | Recommends original games only |
| 6a27e07d9cd75254cba91d72 | Política de configuración para jugar online | States pirated games are **not** allowed |

### B4. Also covered
- **AI blocklist** (drafts, auto-replies, future extraction, B-46): ROM, roms, descargar juegos, piratear/pirateo/pirata, nsp/xci, nombres de webs de descarga, VPN para descargas, FRP, quitar cuenta Google, saltar cuenta, bypass.
  - Matching message → no draft text on that topic + staff note "Tema sensible: responde una persona" (D-30/D-31).
- **AnswerLibrary `switch_soporte`** already says "No incluir nunca webs de descarga" ✅. Its keywords include `dbi` (a homebrew installer) → remove that keyword.
- Other entities (Messages history, CustomerInsights) are **not** touched. They are customer conversations, not KB, and D-31 is about the knowledge base.

## Apply order
1. Checkpoint.
2. JSON export of `id`, `title`, `created_date` of B1 + B2 into `audit/impl/week1/kb-purge-record.json`.
3. Delete B1 (17).
4. Archive B2 (3).
5. Part A.
6. Re-run the regex query: 7 remain (B3), 0 of B1.

## Rollback
- Part A: set `autokb_live=true` and restore the 2 lines.
- B2: set status back.
- **B1 cannot be undone (intended, D-31).**
