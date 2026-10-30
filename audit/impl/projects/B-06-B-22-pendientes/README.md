# B-06 + B-22 — 13:00 Pendientes WhatsApp (prepared locally, NOT deployed)

- **B-06 (security).** `modo:'auto'` could be called by anyone at any time and sent Japji a WhatsApp with customer names and phones. Now `auto` only works:
  - Monday to Saturday;
  - between 12:55 and 15:00;
  - with the digest switched on;
  - **at most once per day** after a successful send.
  Preview/manual stay admin-only.
- **B-22.**
  - It sends **all open Pendientes**, marking today's as "[nuevo]". Before, it sent only today's.
  - No more Sundays.
  - The workflow runs at 13:00 and 13:30. The 13:30 run sends only if 13:00 failed.
- **Bug found while doing this:** `MessageLog` rejected `doc_kind:'pendientes'` (not in the enum). Every digest log was silently lost, so a "sent today" check was impossible. The enum is fixed.
- **Files:** `files/tpv/base44/functions/sendPendingDigest/entry.ts` (whole file, based on production) + `patch_existing_files.py` (MessageLog enum, workflow cron, JSON edits).
- **Apply test:** Ajustes → Recordatorios → preview. A manual send to +34 601 … 837 is only done with Joney's OK.
