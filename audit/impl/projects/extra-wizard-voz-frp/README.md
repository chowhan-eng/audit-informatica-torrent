# 31 Oct batch — prepared locally, NOT deployed

| What | Files |
|---|---|
| D-40/D-41 FRP + YouTube tutorials: two KB entries, draft-only | `kb/kb-entries-D40-D41.json` (load into WhatsApp Pro AnswerLibrary at deploy) |
| Voice alert 2×/day (D-42) | Reparo `voiceDigest` + workflows 11:05/18:05 (Sat 11:05); WhatsApp Pro patch 0009 (`voice` action) |
| Asistente page (D-42) | Reparo `src/pages/Asistente.jsx`, `wizardNotify`; route via `patch_existing_files.py`; the Mostrador "Listos" card opens it |
| B-43 morning brief e-mail 09:20 | Mostrador `morningBrief`, `shared/sources.ts`, workflow; secret `BRIEF_EMAILS` (default chowhan@gmail.com) |
| B-44 health check hourly | Mostrador `healthCheck`, entity `HealthCheck`, workflow (e-mail max 1 every 3 h) |
| B-54 retention (part) | Reparo `retentionSweep`: unlock codes 30 days after delivery, public lookup log 7 days; trial mode until `retention_live=true` |
| B-61 constant-time key compare | WhatsApp Pro patch 0010; Reparo `waLookup` in `patch_existing_files.py` |
