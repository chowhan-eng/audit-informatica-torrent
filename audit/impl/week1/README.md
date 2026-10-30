# Week 1 implementation — status board

Rule (D-29): every change is prepared here first. Claude applies it to an app (commit, data write, secret, deploy) **only after Joney's explicit OK in chat**, following AUDIT §7:
1. checkpoint;
2. small themed change;
3. tests;
4. redeploy only the touched functions;
5. checkpoint;
6. report in ≤ 8 lines.

| Item | What | Status | Needs from Joney |
|---|---|---|---|
| **B-01** | `sendMessage` requires internal key or approved user | **Patch ready** → `B-01-sendMessage-auth.md` | OK + WhatsApp test number |
| **B-03** | Clear 3 secret rows; rotate Meta token and import secret | **Runbook ready** → `B-03-secrets.md` | OK + 10 min in Meta Business Manager |
| **B-13** | Stop raw-text LLM; delete 17 piracy/FRP entries, archive 3 × 24/7 | **List ready** → `B-13-kb-purge-and-llm.md` | OK to delete (irreversible) |
| B-02 | Auth on the other public functions (generateDraft, sendPush, logOutboundMessage + TPV header, masterTick + jobs, remove extractMemory) | Next — same `internalAuth` block as B-01 | after B-01 is live |
| B-04 | Undeploy zz*, cleanupTestData; tmpReparoPing (verify first, D-33) | Next | OK to delete 3–4 functions |
| B-05 | publicStatus phone + order number | Next | OK on the new status-page wording |
| B-06 | sendPendingDigest auth | with B-02 | — |
| B-07 | Webhook 5xx on failure + dedupe | Next (needs careful test) | — |
| B-08 | Off-hours ack event-driven | Next | — |
| B-10 | Global pause switch | Next | — |
| B-14 | Reparo card in chat (waLookup) | Diagnosis needs a live chat opened by Joney (D-33) | 2 min with Joney |
| B-15 | Invoice clash F 2600408–411 | Joney + gestoría (D-35) | gestoría answer |
| B-35 | Invite-only registration on all apps | Next — platform auth setting | OK |
| B-09 | Daily data export + restore test | Design after B-01/B-02 | — |
