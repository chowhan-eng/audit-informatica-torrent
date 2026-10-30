# B-03 — Remove secret values from SystemSettings; rotate Meta token and import secret (P0)

Status: **PREPARED, NOT APPLIED** — waiting for Joney's OK. Part of it needs Joney in Meta Business Manager.

## Problem [VERIFIED Phase 1/4]
- WhatsApp Pro `SystemSettings` rows still hold values:
  - `meta_access_token` (EAA… shape, last updated 2026-06-08);
  - `import_secret`;
  - `webhook_verify_token`.
- No code reads these rows (grep, Phase 1). Every admin session and every data export can read them.

## Steps

| # | Who | Action | Reversible? |
|---|---|---|---|
| 1 | Claude | Checkpoint of WhatsApp Pro | — |
| 2 | Claude | Overwrite the 3 rows with `setting_value = "(movido a secretos de la plataforma, 2026-10-xx)"`. Values are not read out or printed; a hash of the old values is not kept either. | **No** — once cleared the old values are gone. That is the point: the real values live in platform secrets. |
| 3 | **Joney** | Meta Business Manager → Usuarios del sistema → generate a **new** permanent token for the WhatsApp app (same permissions: `whatsapp_business_messaging`, `whatsapp_business_management`). Paste it **directly** into Base44 → WhatsApp Pro → Secrets → `META_ACCESS_TOKEN` (never in chat). | yes |
| 4 | Claude | Test: send a template to **Joney's test number** + check the next inbound webhook | — |
| 5 | **Joney** | Meta → revoke the old token (only after step 4 passes) | no |
| 6 | Claude | Set a new random `IMPORT_SECRET`. Its only users are the legacy ingest functions, which are being hidden (B-18), so nothing external breaks [VERIFIED: 0 calls in 60 days]. | yes |
| 7 | Claude | Re-query: the 3 rows contain no token-shaped values (regex shape test only, no read-out) | — |

## Risk
- Low. If step 3 is skipped, nothing breaks: only the leaked copy is removed.
- The rotation in steps 3–5 is what actually neutralises the leaked token.

## Needed from Joney
1. OK to clear the 3 rows (step 2).
2. Do steps 3 and 5 in Meta (≈ 10 min). Claude can guide screen by screen.
3. The WhatsApp test number for step 4 (same as B-01).
