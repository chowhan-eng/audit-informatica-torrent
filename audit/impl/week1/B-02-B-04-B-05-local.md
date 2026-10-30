# B-02 / B-04 / B-05: prepared locally, NOT deployed

Rule (Joney, 30 Oct): zero deploys, zero secret changes, zero restarts in Base44 until further notice.
Nothing below has touched Base44. Production heads are unchanged: WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563.

| Item | Where the code is | Commit |
|---|---|---|
| B-02 WhatsApp Pro (internalAuth gate on 15 jobs, sendPush, generateDraft, logOutboundMessage secret, masterTick 200 s guard, extractMemory removed) | `/home/user/whatsapp-inbox-pro`, branch `local/week1-patches` (push disabled) | 3c33a09 |
| B-02 TPV side (`x-outbound-log-secret` header in `shared/inboxPro.ts`) | `audit/impl/src/tpv` | 0d9e3e1 |
| B-04 TPV: remove zzImportTest, zzPbkdf2Test, cleanupTestData (no callers, checked with grep) | `audit/impl/src/tpv` | 30ca1c5 |
| B-05 Reparo: publicStatus needs phone **and** order number; no IP → 429; 10/IP and 200 total per 10 min; estado.html gets an order-number field | `audit/impl/src/reparo` | (this commit) |

Base snapshot of the originals: ddc35b4.

## Order at apply time (only after Joney's explicit OK)
1. Checkpoint each app.
2. Create a new random OUTBOUND_LOG_SECRET and set it in **both** WhatsApp Pro and TPV in the same window. Each secret change redeploys every function of that app from main.
3. WhatsApp Pro: apply 3c33a09 → test 401 for anonymous calls + one inbox reply + one scheduled send to +34 658 … 734.
4. TPV: apply 0d9e3e1 and delete the 3 functions (30ca1c5) → send one document by WhatsApp and check it appears in the Inbox.
5. Reparo: apply publicStatus + public/estado.html → QR link (`#uuid`) still works; phone + wrong number → "no encontramos"; 11th try → 429.
6. Checkpoint again and write the CHANGELOG entries.

The status-page wording is new: Joney checks the texts before step 5. The receipt shows the order number.
