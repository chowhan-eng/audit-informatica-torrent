"""B-02 patch for WhatsApp Pro (local clone only; never pushed).

Adds the shared internalAuth block to every service-role function that today
answers anonymous callers, adds INTERNAL_CALL_KEY to every internal invoke,
and gates logOutboundMessage with OUTBOUND_LOG_SECRET (header from TPV).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(sys.argv[1]) / 'base44' / 'functions'
KEY_EXPR = "_internal_key: Deno.env.get('INTERNAL_CALL_KEY') || '',"

AUTH_BLOCK = """
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
const INTERNAL_AUTH_ADMIN_EMAIL = 'chowhan@gmail.com';
async function isApprovedUser(base44) {
  try {
    const user = await base44.auth.me();
    if (!user) return false;
    if (user.role === 'admin' || user.email === INTERNAL_AUTH_ADMIN_EMAIL) return true;
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
    return (Array.isArray(profiles) ? profiles : [])[0]?.approval_status === 'approved';
  } catch { return false; }
}
async function isAllowedCaller(req, base44) {
  const raw = await req.clone().json().catch(() => ({}));
  const data = raw && typeof raw === 'object' && raw.data ? raw.data : raw;
  return hasInternalKey(data) || hasInternalKey(raw) || await isApprovedUser(base44);
}
// </shared:internalAuth>
"""

KEY_ONLY_BLOCK = """
// <shared:internalAuth> — key part only (this function already has checkApproved).
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
"""

GATE = """
  // Caller gate (audit B-02): internal callers send INTERNAL_CALL_KEY, staff need an approved session.
  if (!(await isAllowedCaller(req, base44))) {
    return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
"""


def read(name):
    return (ROOT / name / 'entry.ts').read_text()


def write(name, text):
    (ROOT / name / 'entry.ts').write_text(text)


def replace_once(text, old, new, where):
    if text.count(old) != 1:
        raise SystemExit(f'{where}: expected 1 match for {old!r}, found {text.count(old)}')
    return text.replace(old, new)


def insert_after_imports(text, block, where):
    lines = text.split('\n')
    last = max((i for i, l in enumerate(lines[:60]) if l.startswith('import ')), default=None)
    if last is None:
        raise SystemExit(f'{where}: no import line')
    lines.insert(last + 1, block.rstrip('\n'))
    return '\n'.join(lines)


def add_key(text, fn, where):
    old = f"invoke('{fn}', {{"
    n = text.count(old)
    if n == 0:
        raise SystemExit(f'{where}: no invoke of {fn}')
    return text.replace(old, f"invoke('{fn}', {{ {KEY_EXPR}")


# 1. Jobs and webhook fan-out targets: full gate after `const base44 = createClientFromRequest(req);`
GATED = ['sendScheduledMessages', 'processAlerts', 'escalateWaiting', 'processBroadcasts',
         'retryFailedSends', 'sendDueReviews', 'sendNPS', 'autoKBExtract', 'watchdog',
         'libraryShadowReport', 'libraryAutoReply', 'flowExecutor', 'liveKBCheck',
         'evaluateAutoReply', 'pollHelloClient']
for name in GATED:
    t = read(name)
    t = insert_after_imports(t, AUTH_BLOCK, name)
    serve = t.index('Deno.serve(')
    anchor = 'const base44 = createClientFromRequest(req);'
    pos = t.index(anchor, serve) + len(anchor)
    t = t[:pos] + GATE.rstrip('\n') + t[pos:]
    write(name, t)

# 2. sendPush: gate before the body is read
t = read('sendPush')
t = insert_after_imports(t, AUTH_BLOCK, 'sendPush')
t = replace_once(t, "Deno.serve(async (req) => {\n  try {\n",
                 "Deno.serve(async (req) => {\n  // Caller gate (audit B-02): internal callers send INTERNAL_CALL_KEY, staff need an approved session.\n"
                 "  if (!(await isAllowedCaller(req, createClientFromRequest(req)))) {\n"
                 "    return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });\n  }\n  try {\n", 'sendPush')
write('sendPush', t)

# 3. generateDraft: replace the x-caller bypass with the key
t = read('generateDraft')
t = insert_after_imports(t, KEY_ONLY_BLOCK, 'generateDraft')
t = replace_once(t,
    "    // Approval gate — processAlerts & webhooks are service-role callers, skip check for them\n"
    "    const callerHeader = req.headers.get('x-caller') || '';\n"
    "    if (callerHeader !== 'internal' && !await checkApproved(base44, db)) {",
    "    // Caller gate (audit B-02): internal callers send INTERNAL_CALL_KEY, staff need an approved session.\n"
    "    if (!hasInternalKey(body) && !await checkApproved(base44, db)) {", 'generateDraft')
t = add_key(t, 'evaluateAutoReply', 'generateDraft')
write('generateDraft', t)

# 4. logOutboundMessage: shared secret header (caller = TPV shared/inboxPro.ts)
t = read('logOutboundMessage')
t = replace_once(t,
    '  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });\n',
    '  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });\n\n'
    '  // Caller gate (audit B-02): only the TPV, which sends OUTBOUND_LOG_SECRET in a header.\n'
    "  const expectedLogKey = (Deno.env.get('OUTBOUND_LOG_SECRET') || '').trim();\n"
    "  const givenLogKey = req.headers.get('x-outbound-log-secret') || '';\n"
    '  let diff = givenLogKey.length === expectedLogKey.length && expectedLogKey ? 0 : 1;\n'
    '  for (let i = 0; i < givenLogKey.length && i < expectedLogKey.length; i++) diff |= givenLogKey.charCodeAt(i) ^ expectedLogKey.charCodeAt(i);\n'
    '  if (diff !== 0) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });\n',
    'logOutboundMessage')
write('logOutboundMessage', t)

# 5. Internal invokes that must now carry the key
for name, fns in {'whatsappWebhook': ['sendPush', 'flowExecutor', 'libraryAutoReply'],
                  'reparoBridge': ['sendPush'], 'pollHelloClient': ['sendPush'],
                  'processAlerts': ['generateDraft']}.items():
    t = read(name)
    for fn in fns:
        t = add_key(t, fn, name)
    write(name, t)

# 6. whatsappWebhook: liveKBCheck no longer invoked (B-13, raw text must not reach the LLM)
t = read('whatsappWebhook')
t = replace_once(t,
    "    runBackground(base44.functions.invoke('liveKBCheck', { conversationId, messageText: body }).catch(() => {}));",
    "    // liveKBCheck disabled 2026-10 (audit B-13): raw text must not reach the LLM; daily anonymised batch replaces it (B-46).",
    'whatsappWebhook')
write('whatsappWebhook', t)

# 7. masterTick: pass the key to every job; refuse back-to-back triggers (anonymous amplification)
t = read('masterTick')
t = replace_once(t, "      await base44.asServiceRole.functions.invoke(name, {});",
                 f"      await base44.asServiceRole.functions.invoke(name, {{ {KEY_EXPR.rstrip(',')} }});", 'masterTick')
t = replace_once(t, "  const tick = await bumpCounter(sr, settings);",
    "  // Min-interval guard (audit B-02): the cron fires every 5 min; any extra trigger within\n"
    "  // 200 s (e.g. an anonymous POST to the public URL) is ignored instead of re-running jobs.\n"
    "  const lastStart = Date.parse(flat[LAST_START_KEY] || '') || 0;\n"
    "  if (Date.now() - lastStart < 200_000) {\n"
    "    return Response.json({ status: 'skipped_too_soon' });\n"
    "  }\n"
    "  if (settings[LAST_START_KEY]) {\n"
    "    await sr.SystemSettings.update(settings[LAST_START_KEY].id, { setting_value: new Date().toISOString() });\n"
    "  } else {\n"
    "    await sr.SystemSettings.create({ setting_key: LAST_START_KEY, setting_value: new Date().toISOString() });\n"
    "  }\n\n"
    "  const tick = await bumpCounter(sr, settings);", 'masterTick')
t = replace_once(t, "async function bumpCounter(",
                 "const LAST_START_KEY = 'mastertick_last_started_at';\n\nasync function bumpCounter(", 'masterTick')
write('masterTick', t)

# 8. extractMemory: no caller anywhere (Phase 5 U-09) -> removed
import shutil
shutil.rmtree(ROOT / 'extractMemory')
print('B-02 patch applied')
