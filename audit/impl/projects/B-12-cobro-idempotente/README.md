# B-12 — completeSale idempotency (prepared locally, NOT deployed)

**Problem (Phase 3 S2).** A retry after a network drop, a double click, or Stripe sending both `checkout.session.completed` and `payment_intent.succeeded` created two sales, two numbers and two stock movements.

**Fix.** `runCompleteSale` becomes a wrapper that uses a `client_request_id`:
- **Retry:** if a completed sale with that id already exists, it is returned (`duplicate: true`).
- **Concurrent:** while another request with the same id is running (< 2 min), the second one gets **409** "Este cobro ya se está procesando".
- **Failure:** a failed attempt marks its row `failed`, so the next retry is allowed.
- **New entity** `SaleRequest`, admin-only.

**Who sends the id.**
- One id per payment: `CobrarDialog`, `DevolverDialog`, `NuevaSenalDialog`.
- `VentaRapida`: one id per ticket, kept while retrying and reset after success.
- `stripeWebhook`: `stripe:<parked sale id>`.
- Callers without an id behave exactly as before.

**Tests done locally (mocks).**
- Retry → same sale.
- 3 concurrent → 1 sale and two 409s.
- Validation error, then retry → new sale.
- No id → unchanged behaviour.
- All 7 anchors were checked against production.

**Apply order:** after B-40 (both touch `saleCompletion.ts`, `Sale.jsonc` and `CobrarDialog.jsx`; the anchors do not overlap).

**Known limit:** in `NuevaSenalDialog` the Deposit row is created after the sale in a second call. B-36 moves it to the server.
