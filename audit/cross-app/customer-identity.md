# Phase 2 — Customer identity

Privacy: phone numbers were read only to match records; none are reproduced here. Only counts.

## Where customers live [VERIFIED schemas / MEASURED counts]

| App | Entity | Rows | Phone field & format | Other keys |
|---|---|---|---|---|
| Reparo | `Client` | 12,291 | `phone` = `34XXXXXXXXX` (digits, no `+`); `phones[]` 9-digit; `raw_phone` as typed | `dni`, `email`, `hc_client_id` |
| Reparo | `RepairOrder` (snapshot) | 19,516 | `customer_phone`, `client_phones` | `client_id` → Client |
| WhatsApp Pro | `Customers` | 1,000–4,999 | `phone_number` = `34XXXXXXXXX` | `dni`, `hc_client_id`, `marketing_consent`, `opted_out`, `preferred_language` |
| WhatsApp Pro | `Customer` | **0** (unused duplicate entity) | `phone_e164` | — |
| WhatsApp Pro | `Conversations` | 1,500–2,499 | `customer_phone` | `customer_id` |
| WhatsApp Pro | `RepairOrder`, `OrderState` mirrors | 1,000–4,999 each, frozen 29 Oct | `client_phones` | stale copy of Reparo |
| TPV | `Customer` | ~1,250–1,330 | `phone` = `+34XXXXXXXXX` (**E.164 with `+`**) | `nif`, `doscar_code`, `helloclient_id`, `whatsapp_consent`, `email_consent`, `marketing_consent`, `language` |

→ **Three apps, three phone formats** (`+34…`, `34…`, 9-digit), three consent models, three language fields. No shared customer ID.

## Sample of 50 [MEASURED 30 Oct]
Method: 50 most recent TPV customers with a phone → normalised to `34XXXXXXXXX` → looked up in Reparo `Client.phone` (+ `phones[]`, `raw_phone`, `RepairOrder.customer_phone`) and WhatsApp Pro `Customers.phone_number`.

| Result | Count |
|---|---|
| Sample rows | 50 (**49 unique phones — 1 duplicate customer inside TPV**) |
| Found in Reparo | 26 (of which **2 phones have 2 Client rows each** → duplicates in Reparo) |
| Found in WhatsApp Pro | 22 (no duplicates) |
| Found in all three apps | 21 |
| WhatsApp Pro but not Reparo | 1 |
| Only in TPV | 22 (4 of them are landlines — can never receive WhatsApp) |

Reading: matching **by phone works when the number is normalised** — every found match was exact after normalisation, no near-misses. The problems are (a) format differences that every integration must remember, (b) duplicates within an app (≈2–4 % in this sample), (c) about 45 % of TPV customers are counter-only (accessory buyers) and do not exist elsewhere, which is expected. [MEASURED small sample — directionally reliable, not a precise rate]

Not checked (needs full scan, Phase 3/5 candidate): duplicate rate over all 12,291 Reparo clients; consent conflicts (e.g. opted-out in WA Pro but `whatsapp_consent=true` in TPV).

## Order ↔ deposit ↔ ticket [MEASURED]
- TPV `Sale.repair_ref` filled on **0 of 69** live sales (28–30 Oct); `Deposit` = 0 rows; Reparo `Sale` = 0 rows.
- From a Reparo order you **cannot** reach its señal or TPV ticket; from a ticket you cannot reach the order. Warranty claims (6 months) depend on staff memory or searching by phone in two apps.

## Recommendation (to score in Phase 9)
1. **Customer key = phone in E.164 digits `34XXXXXXXXX`** (strip `+`, prepend 34 to 9-digit Spanish numbers), with a shared normaliser copied into each app's `shared/` folder and used on every write and lookup.
2. **Single source of truth:**
   - **Reparo `Client`** = master for identity (name, phones, DNI, email) — it has by far the most customers and is where intake happens.
   - **WhatsApp Pro** = master for messaging consent/opt-out and preferred language (it is where the customer says "stop" or writes in English/Punjabi).
   - **TPV** = master for fiscal data (NIF, address for invoices).
   - Others read through lookups (`waLookup`-style, by phone) instead of keeping copies; retire WA Pro's `Customer` (empty), `RepairOrder`/`OrderState` mirrors (after 30-day hide rule).
3. **Sync rule:** no bulk mirroring. On demand lookup by phone + a small "customer created/updated" event from Reparo to WA Pro (same queue pattern as status events). TPV creates a customer → looks up Reparo by phone first, prefills.
4. **Order link:** TPV `Sale.repair_order_id` (structured, not free text), set automatically by a "Cobrar en TPV" button in Reparo; TPV reports `paid` back → Reparo stores `sale_id` / `deposit_id` on the order.
5. **Duplicates:** one-off report of duplicate phones per app for Joney to merge (no automatic merge).
