# B-01 — Authenticate WhatsApp Pro `sendMessage` (P0)

Status: **PREPARED, NOT APPLIED** — waiting for Joney's OK (D-29). Nothing has been written to the app.

## Problem [VERIFIED]
- `sendMessage/entry.ts:166-170` checks approval only `if (x-caller !== 'internal' && user)`.
- Without a session there is **no check at all**, and the function then sends with the service-role Meta token.
- Anyone sending header `x-caller: internal` also skips the check.
- No real caller uses that header. The 8 internal callers invoke through the SDK (`functions.invoke`), which cannot set custom headers.

## Design
- New platform secret **`INTERNAL_CALL_KEY`** (random, ≥ 48 chars). It is created at apply time and never printed or stored in entities or code.
- `sendMessage` accepts a call only if:
  1. the body carries `_internal_key` equal to the secret (constant-time compare), **or**
  2. there is a logged-in user who passes the existing `checkApproved` (admin, or `UserProfile.approval_status = 'approved'`).
- Anything else gets **401**. A logged-in but unapproved user still gets **403**, as today.
- The `x-caller` header is no longer trusted.
- `_internal_key` is removed from the body before any other use, so it is never logged or forwarded.
- The 8 internal callers add `_internal_key` to their payload.
- The frontend is unchanged: staff sends go through a user session.

## Edits (exact, applied with `edit_file` after approval)

### 1. `base44/functions/sendMessage/entry.ts` — helper (insert before `async function checkApproved`)
```ts
// <shared:internalAuth> — same block in sendMessage, generateDraft, sendPush and the
// masterTick jobs (Base44 Deno functions can't share imports). Keep them in sync.
// Internal callers put INTERNAL_CALL_KEY in the body as _internal_key: the SDK's
// functions.invoke() cannot set custom headers.
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function hasInternalKey(body) {
  const expected = (Deno.env.get('INTERNAL_CALL_KEY') || '').trim();
  return safeEqual(String(body?._internal_key || ''), expected);
}
// </shared:internalAuth>

```

### 2. `sendMessage/entry.ts` — replace the gate and body parsing (lines 162-174)
Old:
```ts
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }

  // Approval gate (skip for internal service-role callers like processAlerts)
  const callerHeader = req.headers.get('x-caller') || '';
  if (callerHeader !== 'internal' && user) {
    const approved = await checkApproved(base44, db);
    if (!approved) return Response.json({ ok: false, error: 'Acceso no autorizado' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  if (body && typeof body === 'object' && 'data' in body && body.data) body = body.data;
```
New:
```ts
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  if (body && typeof body === 'object' && 'data' in body && body.data) body = body.data;

  // Caller gate: internal functions prove themselves with INTERNAL_CALL_KEY;
  // everyone else needs an approved user session. Anonymous calls are refused.
  const internal = hasInternalKey(body);
  if (body && typeof body === 'object') delete body._internal_key;
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!internal) {
    if (!user) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    const approved = await checkApproved(base44, db);
    if (!approved) return Response.json({ ok: false, error: 'Acceso no autorizado' }, { status: 403 });
  }
```
`user` stays at the outer scope because line 457 uses `user?.full_name` for the sender name [VERIFIED grep]. For internal calls it can be null, as today.

### 3. The 8 internal callers — one-line change each
In each file, replace the unique string `invoke('sendMessage', {` with
`invoke('sendMessage', { _internal_key: Deno.env.get('INTERNAL_CALL_KEY') || '',`

| File | Line | Called from |
|---|---|---|
| `evaluateAutoReply/entry.ts` | 213 | generateDraft (auto-reply mode is `off`) |
| `flowExecutor/entry.ts` | 70 | webhook (flows disabled; to be hidden, U-10) |
| `libraryAutoReply/entry.ts` | 246 | webhook (live mode) |
| `processAlerts/entry.ts` | 206 | masterTick |
| `retryFailedSends/entry.ts` | 127 | masterTick |
| `sendNPS/entry.ts` | 68 | paused (CHANGELOG #2) |
| `sendScheduledMessages/entry.ts` | 32 | masterTick |
| `serviceRecoverySweep/entry.ts` | 92 | admin button in Ajustes |

## Apply order
1. Checkpoint (`create_checkpoint`) of WhatsApp Pro, to have a rollback point.
2. Set secret `INTERNAL_CALL_KEY` on WhatsApp Pro.
3. Edit the 8 callers first and redeploy them. They then send a key that the old `sendMessage` simply ignores, so this step is harmless.
4. Edit `sendMessage` and redeploy only that function.
5. Checkpoint again.

## Tests (no customer is messaged)
| # | Test | Expected |
|---|---|---|
| T1 | Anonymous POST to `sendMessage` **with an invalid phone and no key** (fails before any Meta call) | **401** |
| T2 | Same with header `x-caller: internal` | **401** |
| T3 | Joney sends a reply from the inbox to **his own test number** | delivered |
| T4 | One `sendScheduledMessages` run with a test row to Joney's test number | delivered, `_internal_key` absent from WebhookLogs |
| T5 | WebhookLogs after 1 hour | no new 401 from internal callers |

## Rollback
Restore the checkpoint from step 1, or revert the two edits and redeploy `sendMessage`. The caller edits are harmless either way.

## Needed from Joney
- OK to apply.
- **A WhatsApp test number** for T3/T4 (AUDIT §4 rule 2). This should be his own phone, not the shop number.
