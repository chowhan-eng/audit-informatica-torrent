# Changes made to production during the audit

Every write to a live app is listed here with its approval.

| # | Date (UTC) | App | Change | Before → After | Approved by | Verification |
|---|---|---|---|---|---|---|
| 1 | 2026-10-30 10:34 | TPV `6acf624e6e89e6f32c43243f` | Entity `Counter` id `6adb49938ee1874baca4a4a1` (key `F-2026`), field `last_number`, conditional update (only if still 2600411) | 2600411 → **2600430** | Joney in chat: "Sí, corrígelo ya" | Re-read: `last_number` = 2600430; no invoice created in between (last Invoice = F 2600411). Next invoice will be F 2600431 (`base44/shared/counters.ts`: next = last_number + 1). |

| 2 | 2026-10-30 11:05 | WhatsApp Pro `69f23ccb4284f8588aa5b7a3` | `base44/functions/masterTick/entry.ts`: removed `run('sendNPS')` from the every-6th-tick block; `sendNPS` always listed in `skipped` (comment explains why). Function `masterTick` redeployed (only this function). | sendNPS ran every 30 min → **paused** | Joney in chat: "Sí, páralo ya" | Checkpoint before `6ae479935901fa035da98d95`; after `6ae47a03d9e79c2f5a39fd17` (commit b466dcd). Deployed source == repo file (git diff: only trailing newline). Post-deploy check: tick 12090 at 11:10 UTC (a 6th-tick slot where sendNPS used to run) completed in **9.8 s** (previous runs 42–65 s), 0 WebhookLogs errors since 11:00 UTC [MEASURED]. Keep watching webhook errors over the next days. |

### Notes for #2
- Why: `sendNPS` loops up to 200 sequential reads; every run failed with HTTP 500 for 7 days and coincided with ~220 "Unhandled webhook error" rows in October (minutes :11/:13/:41/:43) — Meta webhooks acknowledged 200 and never retried.
- NPS surveys were not being sent anyway (every run failed). No customer-facing feature lost.
- The after-checkpoint also contains the earlier, not-yet-checkpointed commit 21acef8 (deletes repo file of temp function `tmpReparoPing`; the deployed function itself was not touched).
- Root-cause fixes still in backlog: webhook must not return 200 on processing failure (with dedupe on Meta message id); rewrite `sendNPS` to batch reads before re-enabling.
- Rollback: restore checkpoint `6ae479935901fa035da98d95` or re-add `await run('sendNPS');` and redeploy masterTick.

## Still open for #1 (Joney + gestoría decide)
- TPV invoices with numbers already used by Doscar (HistoricSale `doscar_type=factura`): **F 2600408** (23 Oct, test period), **F 2600409** (29 Oct), **F 2600410** and **F 2600411** (30 Oct). Options: keep, cancel or rectify — legal/accounting decision, not taken by the auditor.
- Root cause remains: `cleanupTestData` function is still present and resets counters R-2026/F-2026 if run with `confirm:true` → backlog item (hide/remove after approval).
- Rollback, if ever needed: set `last_number` back to 2600411 (not recommended: it would reissue numbers 2600412–2600430 already used by Doscar).
