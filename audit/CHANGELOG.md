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

## Implementation — Week 1 (after approval D-29)

| # | Date (UTC) | App | Change | Before → After | Approved by | Verification |
|---|---|---|---|---|---|---|
| 3 | 2026-10-30 | WhatsApp Pro | **B-13** KnowledgeBase: 17 entries about ROM/game downloads, piracy and FRP without requirements were **purged** (title → "[purgado D-31]", content replaced, `review_status=rejected`, `is_active=false`). The Base44 delete API returned "not found"/`deleted: 0` for this app (older runtime), so the content was overwritten instead: the forbidden text is gone irreversibly, an empty record shell remains. 3 × "Servicio 24/7" → `rejected`, `is_active=false` (D-22). AnswerLibrary `switch_soporte`: keyword `dbi` removed. SystemSettings `autokb_live` → `false` (liveKBCheck stops calling the LLM at once; the function already honours this switch). | 17 + 3 entries visible to AI → 0; liveKBCheck LLM calls ≈ 16/day → 0 | Joney in chat: "OK a B-13 … ejecutar el borrado definitivo de las 17 entradas" | Checkpoint before: `6ae4d937619c4da0dfbce515`. Regex re-query: only the 7 kept entries + 3 rejected 24/7 remain; 0 forbidden texts. `generateDraft` reads only `approved` entries [VERIFIED `generateDraft:178`]. Record: `impl/week1/kb-purge-record.json`. Rollback: data checkpoint restore (content of the 17 is intentionally not kept). |
| 4 | 2026-10-30 18:00–18:10 | WhatsApp Pro | **B-01** `sendMessage` requires `INTERNAL_CALL_KEY` (in the body, constant-time compare) **or** an approved user session; anonymous → 401; `x-caller: internal` no longer trusted; `_internal_key` stripped before use. 8 internal callers send the key (evaluateAutoReply, flowExecutor, libraryAutoReply, processAlerts, retryFailedSends, sendNPS, sendScheduledMessages, serviceRecoverySweep). `liveKBCheck` invocation removed from `sendMessage` (B-13). New platform secret `INTERNAL_CALL_KEY` (value only in Base44 secrets). App published. | Anonymous send possible → refused | Joney in chat: "OK a B-01 … luz verde para aplicar los cambios de código" | Checkpoints: before `6ae4dbb95d14f3652e71aa35`, after `6ae4dcc0d83dd77128516629` (commit 8d595b9), deployed. T1 anonymous → **401**, T2 `x-caller: internal` → **401**, T2b wrong key → **401** (tested against the published URL from the app sandbox). T4 internal send: see below. Rollback: deploy checkpoint `6ae4dbb95d14f3652e71aa35`. The publish also shipped the already-approved commits 21acef8 (tmpReparoPing source removed) and b466dcd (sendNPS paused). |
