# B-47 — Mostrador "Hoy" panel + global search (prepared locally, NOT deployed)

**What it does.**
- **Without a session:** Mostrador's home page stays a public launcher. A button "Entrar para ver el panel Hoy y el buscador" is added.
- **With a staff session:** admin, or an email in `MOSTRADOR_STAFF`. It shows:
  - **Search box** (`/` to focus): phone, name, order no., TPV ticket (`T-2026/120` or a number), IMEI/serial → links straight to the record.
    - Reparo: orders and clients.
    - TPV: tickets, customers, units.
    - WhatsApp Pro: chats, opened with the new `?conv=<id>` deep link.
  - **"Hoy" panel**, refreshed every 2 min:
    - Ready to collect (last 90 days, plus the total of open ones; the old backlog is excluded, as in B-41).
    - Chats waiting for a reply.
    - Budgets without an answer.
    - Waiting for parts.
    - TPV Pendientes.
    - Failed WhatsApp sends (48 h).
    - Cash open or closed, today's tickets and total, open deposits.
    - New orders today.
- **Errors:** an app that does not answer shows its error in its own card; the other cards still load.

**Design / security.**
- Mostrador stores nothing. `mostradorData` calls a read-only `mostradorLookup` in each app with the shared key `MOSTRADOR_KEY` (header, constant-time compare). The lookups return only display fields.
- **Mostrador must be invite-only before this goes live (B-35).** `mostradorData` also refuses anyone who is not admin or listed in `MOSTRADOR_STAFF`.

**Files.**
- **New:**
  - `files/mostrador/base44/functions/mostradorData/entry.ts`
  - `files/mostrador/src/components/HoyPanel.jsx` and `hoy.css`
  - `files/reparo/base44/functions/mostradorLookup/*`
  - `files/tpv/base44/functions/mostradorLookup/entry.ts`
- **WhatsApp Pro** (clone commit, patch file): `mostradorLookup` + `?conv=` in `Conversaciones.jsx`.
- **Changed:** `patch_existing_files.py` (Mostrador `Home.jsx`; the tile text no longer promises VeriFactu). Anchors were checked against production.

**Secrets at apply time (not set now).**
- `MOSTRADOR_KEY`: same random value in Mostrador, Reparo, TPV and WhatsApp Pro.
- In Mostrador only:
  - `MOSTRADOR_REPARO_URL`, `MOSTRADOR_TPV_URL`, `MOSTRADOR_WA_URL`: each app's `mostradorLookup` URL;
  - `MOSTRADOR_STAFF`: optional list of staff emails.

**Tests at apply time.**
- Logged out → only the login button.
- Non-staff account → 403 message.
- Search with Joney's number → order, client, chat and TPV customer.
- Panel counts match each app's own screen.
- Search answers in < 1 s (backlog acceptance).
