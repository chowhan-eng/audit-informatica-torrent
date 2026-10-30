# B-40 — "Cobrar en TPV" from Reparo (prepared locally, NOT deployed)

**Flow.**
1. Reparo order → button **Cobrar en TPV** opens `tpvtorrent…/venta?orden=39358`.
2. The TPV opens "Cobrar reparación" with the order already looked up in Reparo: description, price, customer. A warning appears if the order is already paid or closed.
3. The line is added. The customer is found by mobile, or created with name, mobile and email. A deposit (señal) for that order is applied automatically.
4. When the sale completes:
   - `Sale.repair_order_id` is stored (structured; before, only a free-text `repair_ref` existed);
   - the TPV calls Reparo `tpvBridge` with `paid`;
   - Reparo stores the ticket on the order (`tpv_sale_ref`, `tpv_paid_total`, `tpv_paid_at`), adds "Cobrado en TPV" to the history and moves an open order to **Entregado** (not "Entregado + Reseña": no review without consent, SEC-06). The "Entregado" event goes through the existing WhatsAppQueue.
5. If Reparo does not answer within 5 s, the sale is still completed. The notice stays in `ReparoSync` and `reparoSyncSweep` retries it every 10 min (2/10/30/120/480 min, then `failed`). `paid` is idempotent by `sale_id`.
6. The Reparo header shows "Cobrado: T-2026/120" afterwards.

**Files.**
- **New:** everything in `files/`.
- **Changed:** `patch_existing_files.py`:
  - Reparo: `RepairOrder.jsonc`, `TicketHeader.jsx`;
  - TPV: `Sale.jsonc`, `shared/saleCompletion.ts`, `pages/Venta.jsx`, `venta/CobrarDialog.jsx`.
- **Replaced:** `venta/ReparacionDialog.jsx` (it used HelloClient).

**Anchors.** Every single-line anchor was checked against production (Reparo 686fe92, TPV bf4c563). The script was run on mock copies and the results pass the syntax check. Run `--check` first at apply time.

**Secrets at apply time (not set now).**
- Reparo `TPV_BRIDGE_KEY` = TPV `REPARO_TPV_KEY` (same new random value).
- TPV `REPARO_TPV_URL` = Reparo `tpvBridge` URL.
- Without them the TPV works exactly as today (manual line).

**Tests at apply time.**
- Order → button → TPV opens with line and customer.
- Pay → Reparo shows the ticket and "Entregado".
- Block Reparo (wrong key) → sale still completes and a ReparoSync row is pending → fix the key → the sweep delivers it.
- Pay the same order twice → warning in the dialog.
