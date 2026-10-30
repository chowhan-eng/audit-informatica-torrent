# B-02 / B-04 / B-05 / B-07 / B-08 / B-10: prepared locally, NOT deployed

Rule (Joney, 30 Oct): zero deploys, zero secret changes, zero restarts in Base44 until further notice.
Nothing below has touched Base44. Production heads are unchanged: WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563.

| Item | Where the code is | Commit |
|---|---|---|
| B-02 WhatsApp Pro (internalAuth gate on 15 jobs, sendPush, generateDraft, logOutboundMessage secret, masterTick 200 s guard, extractMemory removed) | `/home/user/whatsapp-inbox-pro`, branch `local/week1-patches` (push disabled) | 3c33a09 |
| B-02 TPV side (`x-outbound-log-secret` header in `shared/inboxPro.ts`) | `audit/impl/src/tpv` | 0d9e3e1 |
| B-04 TPV: remove zzImportTest, zzPbkdf2Test, cleanupTestData (no callers, checked with grep) | `audit/impl/src/tpv` | 30ca1c5 |
| B-05 Reparo: publicStatus needs phone **and** order number; no IP → 429; 10/IP and 200 total per 10 min; estado.html gets an order-number field | `audit/impl/src/reparo` | d9b5d1b |
| B-07 webhook: failed inbound message → 500 so Meta redelivers; duplicate copy dropped after insert, no side effects; statuses never fail the delivery | WhatsApp Pro clone | 2bc770d |
| B-08 off-hours ack in the webhook: only for messages received while closed, once per closed period (Sat 14:00 → Mon 09:30 = one period), free-form text; processAlerts sweep removed | WhatsApp Pro clone | 2bc770d |
| B-10 global pause = existing `automations_enabled` switch: sendMessage refuses every internal-key send, reparoBridge stops notices, red banner in the inbox; staff replies still go out | WhatsApp Pro clone | 2bc770d |

WhatsApp Pro patch files: `patches/0001-…` (B-02) and `patches/0002-…` (B-07/B-08/B-10), base 8d595b9.

Base snapshot of the originals: ddc35b4.

## Order at apply time (only after Joney's explicit OK)
1. Checkpoint each app.
2. Create a new random OUTBOUND_LOG_SECRET and set it in **both** WhatsApp Pro and TPV in the same window. Each secret change redeploys every function of that app from main.
3. WhatsApp Pro: apply 3c33a09 → test 401 for anonymous calls + one inbox reply + one scheduled send to +34 658 … 734.
4. TPV: apply 0d9e3e1 and delete the 3 functions (30ca1c5) → send one document by WhatsApp and check it appears in the Inbox.
5. WhatsApp Pro B-07/08/10 (same deploy as step 3): forced-failure test → Meta redelivers, one Messages row; one message from +34 658 … 734 out of hours → one ack, a second message → no ack; switch off → scheduled send refused, inbox reply still sent, banner visible.
6. Reparo: apply publicStatus + public/estado.html → QR link (`#uuid`) still works; phone + wrong number → "no encontramos"; 11th try → 429.
7. Checkpoint again and write the CHANGELOG entries.

Decisions recorded: D-36 (B-10 staff manual sends allowed during the pause), D-37 (B-08 ack is instant), D-38 (B-05 phone + order number). The code in `patches/0002-…` and `audit/impl/src/reparo` already implements them; no further code change is needed.

**Gate:** nothing is applied before the Meta token change (B-03) is finished and Joney gives the deploy OK (D-39).

## Known limits
- B-07: a message that fails after the conversation was updated but before the message row was saved can bump the unread counter twice on redelivery. Harmless.
- B-10 (D-36): a person replying from the inbox is never blocked by the pause. Reparo and TPV functions that call Meta directly (TPV sendPendingDigest, tpvWhatsappRelay for documents) are not covered yet; staff-initiated documents are treated like manual replies.
