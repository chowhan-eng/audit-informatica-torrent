# Week 1 implementation — status board

Rule (D-29): every change is prepared here first. Claude applies it to an app (commit, data write, secret, deploy) **only after Joney's explicit OK in chat**, following AUDIT §7:
1. checkpoint;
2. small themed change;
3. tests;
4. redeploy only the touched functions;
5. checkpoint;
6. report in ≤ 8 lines.

**Zero-deploy rule (30 Oct):** until Joney says otherwise, nothing is deployed, no secret is changed and no app is restarted in Base44. Code is committed locally only. WhatsApp Pro commits are also kept as patch files in `patches/` because the clone lives only in this session.

| Item | What | Status | Needs from Joney |
|---|---|---|---|
| **B-01** | `sendMessage` requires internal key or approved user | **APPLIED 30 Oct** (CHANGELOG #4) — anonymous 401 verified | T3: Joney sends one reply from the inbox |
| **B-03** | Clear 3 secret rows; rotate Meta token and import secret | **Runbook ready** → `B-03-secrets.md` | OK + 10 min in Meta Business Manager |
| **B-13** | Stop raw-text LLM; purge 17 piracy/FRP entries, archive 3 × 24/7 | **APPLIED 30 Oct** (CHANGELOG #3) — content overwritten (delete API unavailable) | — |
| B-02 | Auth on the other public functions (generateDraft, sendPush, logOutboundMessage + TPV header, masterTick + jobs, remove extractMemory) | **Committed locally, NOT deployed** (WA Pro 3c33a09 · TPV 0d9e3e1) → `B-02-B-04-B-05-local.md` | OK to apply + new OUTBOUND_LOG_SECRET in WA Pro and TPV |
| B-04 | Undeploy zz*, cleanupTestData; tmpReparoPing (verify first, D-33) | **Committed locally, NOT deployed** (30ca1c5); no callers found | OK to delete 3 functions in Base44 |
| B-05 | publicStatus phone + order number | **Committed locally, NOT deployed** (d9b5d1b) | OK on the new status-page wording |
| B-06 | sendPendingDigest auth | with B-02 | — |
| B-07 | Webhook 5xx on failure + dedupe | **Committed locally, NOT deployed** (WA Pro 2bc770d) | — |
| B-08 | Off-hours ack event-driven | **Committed locally, NOT deployed** (WA Pro 2bc770d) | — |
| B-10 | Global pause switch | **Committed locally, NOT deployed** (WA Pro 2bc770d); Reparo/TPV direct senders still to cover | Decide: staff replies still allowed while paused? (proposed: yes) |
| B-14 | Reparo card in chat (waLookup) | Diagnosis needs a live chat opened by Joney (D-33) | 2 min with Joney |
| B-15 | Invoice clash F 2600408–411 | Joney + gestoría (D-35) | gestoría answer |
| B-35 | Invite-only registration on all apps | Next — platform auth setting | OK |
| B-09 | Daily data export + restore test | Design after B-01/B-02 | — |
