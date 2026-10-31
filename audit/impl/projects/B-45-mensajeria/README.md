# B-45 — Mail-in repairs (prepared locally, NOT deployed)

**Data steps at deploy (Reparo → Configuración):**
- **New statuses:**
  - «Pendiente de envío (mensajería)», in progress → T-07 instructions;
  - «Recibido por mensajería», in progress → "hemos recibido su equipo";
  - «Enviado al cliente», ready → T-08 with the tracking number.
- **New custom fields:** «Transportista» and «Nº de seguimiento» (text).

**Code:**
- WhatsApp Pro patch `0014`: texts T-07 (approved, D-34) and T-08. T-08 is not sent without a tracking number.
- Reparo: `patch_existing_files.py` sends carrier and tracking to WhatsApp Pro.
- The statuses get 💬 automatically when their names contain «mensajería» or «enviado al cliente» (update `lib/shop/whatsappStatuses.js` on deploy to match).
