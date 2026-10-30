"""B-07, B-08, B-10 for WhatsApp Pro (local clone only; never pushed).

B-07  whatsappWebhook: a message that fails to process makes the webhook answer
      500 so Meta redelivers it; a second copy that slips past the pre-check
      (concurrent redelivery) is detected after insert and skips all side effects.
B-08  Off-hours ack moves from the processAlerts sweep into the webhook: only for a
      message received while closed, once per conversation per closed period,
      as free-form text (the customer just wrote, so the 24 h window is open).
B-10  automations_enabled (existing Ajustes switch) becomes a real global pause:
      sendMessage refuses every internal-key send while it is off (staff replies
      from the inbox still go out), reparoBridge stops customer notices, and the
      inbox shows a red banner.
"""
import pathlib
import sys

REPO = pathlib.Path(sys.argv[1])
FN = REPO / 'base44' / 'functions'


def patch(rel, pairs):
    p = REPO / rel
    t = p.read_text()
    for old, new in pairs:
        n = t.count(old)
        if n != 1:
            raise SystemExit(f'{rel}: expected 1 match, found {n} for {old[:80]!r}')
        t = t.replace(old, new)
    p.write_text(t)


# ---------------------------------------------------------------- B-07 + B-08
patch('base44/functions/whatsappWebhook/entry.ts', [
    # B-07: per-message failure -> 500 (Meta retries); statuses stay 200 because
    # campaign counters are increments and must not be replayed.
    ("""  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = value.contacts ?? [];
        for (const msg of value.messages ?? []) {
          await handleInboundMessage(base44, db, token, msg, contacts);
        }
        for (const st of value.statuses ?? []) {
          await handleStatus(db, st);
        }
      }
    }
  } catch (e) {
    await safeLog(db, 'error', 'whatsappWebhook', 'Unhandled webhook error', String(e));
  }

  return ok();
});""",
     """  // Audit B-07: a message that could not be stored makes the whole delivery fail
  // (HTTP 500) so Meta redelivers it; the meta_message_id check makes the retry
  // safe for messages that did get stored. Status receipts never fail the
  // delivery: their campaign counters are increments and must not be replayed.
  let failedMessages = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      for (const msg of value.messages ?? []) {
        try {
          await handleInboundMessage(base44, db, token, msg, contacts);
        } catch (e) {
          failedMessages++;
          await safeLog(db, 'error', 'whatsappWebhook', `Inbound message failed, asking Meta to redeliver (${msg?.id ?? 'sin id'})`, String((e as any)?.stack || e));
        }
      }
      for (const st of value.statuses ?? []) {
        try {
          await handleStatus(db, st);
        } catch (e) {
          await safeLog(db, 'error', 'whatsappWebhook', 'Status update failed', String(e));
        }
      }
    }
  }

  if (failedMessages > 0) {
    return new Response(JSON.stringify({ ok: false, failed: failedMessages }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return ok();
});"""),
    # B-07: concurrent redelivery that passed the pre-check -> keep the oldest row only.
    ("""    media_caption,
    is_read: false,
  });

  // ── Opt-out keyword detection (GDPR compliance) ──────────────────────────""",
     """    media_caption,
    is_read: false,
  });

  // Audit B-07: two deliveries of the same message can pass the check above at the
  // same time. The oldest row wins; a later copy is removed and skips every side
  // effect (auto-replies, acks, pushes) so the customer never gets them twice.
  if (msgId && savedMsg?.id) {
    const copies = await db.entities.Messages.filter({ meta_message_id: msgId }).catch(() => []);
    const rows = (Array.isArray(copies) ? copies : [])
      .sort((a: any, b: any) => String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id)));
    if (rows.length > 1 && rows[0].id !== savedMsg.id) {
      await db.entities.Messages.delete(savedMsg.id).catch(() => {});
      await safeLog(db, 'info', 'whatsappWebhook', `Duplicate delivery dropped (${msgId})`, '');
      return;
    }
  }

  // ── Opt-out keyword detection (GDPR compliance) ──────────────────────────"""),
    # B-08: event-driven off-hours ack, right after the message is stored.
    ("""  // Phase 5C: NotificationQueue upsert with debounce""",
     """  // Audit B-08: off-hours ack, event-driven (replaces the processAlerts sweep that
  // sent 45 acks in 2 min to old chats on 26 Oct).
  if (type === 'text' || MEDIA_TYPES.includes(type)) {
    runBackground(maybeSendOffHoursAck(base44, db, conversationId, convRecord, normalizedPhone, body).catch(() => {}));
  }

  // Phase 5C: NotificationQueue upsert with debounce"""),
    ("""function shouldAutoDraft(conv: any, type: string, body: string): boolean {""",
     """// =============================================================================
// Off-hours ack (audit B-08). Sent only when the message arrives while the shop
// is closed, at most once per conversation per closed period. Free-form text:
// the customer has just written, so the 24 h window is open and no template is
// used. Goes through sendMessage, so the B-10 pause also stops it.
// =============================================================================
const OPT_OUT_WORDS = ['baja', 'stop', 'no', 'unsubscribe', 'cancelar', 'no mas', 'no más'];

// Start of the closed period that contains `now` (searched in 5-min steps, max 4 days).
function closedPeriodStart(settings: Record<string, string>, now: Date): Date {
  const step = 5 * 60 * 1000;
  let t = now.getTime();
  for (let i = 0; i < (4 * 24 * 60) / 5; i++) {
    const prev = new Date(t - step);
    if (isWithinBusinessHours(settings, prev)) return new Date(t);
    t -= step;
  }
  return new Date(t);
}

async function maybeSendOffHoursAck(base44: any, db: any, conversationId: string, conv: any, phone: string, text: string) {
  const list = await db.entities.SystemSettings.list();
  const settings: Record<string, string> = {};
  (Array.isArray(list) ? list : []).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
  if (settings.offhours_autoack_enabled !== 'true') return;

  const now = new Date();
  if (isWithinBusinessHours(settings, now)) return;
  if (conv?.status === 'spam') return;
  const lower = (text || '').toLowerCase().trim();
  if (OPT_OUT_WORDS.some((kw) => lower === kw || lower.startsWith(kw + ' ') || lower.startsWith(kw + ',') || lower.startsWith(kw + '!'))) return;

  // Once per closed period: re-read the conversation so a burst of messages sends one ack.
  const fresh = await db.entities.Conversations.get(conversationId).catch(() => conv);
  const lastAck = fresh?.last_autoack_at ? new Date(fresh.last_autoack_at).getTime() : 0;
  if (lastAck >= closedPeriodStart(settings, now).getTime()) return;
  await db.entities.Conversations.update(conversationId, { last_autoack_at: now.toISOString() });

  const ackText = settings.offhours_autoack_text || 'Gracias por tu mensaje. Estamos fuera de horario, te responderemos a la mayor brevedad.';
  await base44.functions.invoke('sendMessage', {
    _internal_key: Deno.env.get('INTERNAL_CALL_KEY') || '',
    conversationId,
    customerPhone: phone,
    messageBody: ackText,
    messageKind: 'closed_notice',
  });
}

function shouldAutoDraft(conv: any, type: string, body: string): boolean {"""),
])

# B-08: remove the sweep in processAlerts (section D)
p = FN / 'processAlerts' / 'entry.ts'
t = p.read_text()
start = t.index("    // ── D: Off-hours auto-ack ──")
end = t.index("    // ── E: Follow-up nudge flags ──")
t = t[:start] + ("    // ── D: Off-hours auto-ack ── moved to whatsappWebhook (audit B-08): event-driven,\n"
                 "    // once per closed period, so no more bursts to old chats.\n\n") + t[end:]
p.write_text(t)

# ---------------------------------------------------------------- B-10
patch('base44/functions/sendMessage/entry.ts', [
    ("""  GRAPH = 'https://graph.facebook.com/' + ((settings.meta_graph_version || 'v23.0').trim());
""",
     """  GRAPH = 'https://graph.facebook.com/' + ((settings.meta_graph_version || 'v23.0').trim());

  // Global pause (audit B-10): with Ajustes → Automatizaciones off, nothing automatic
  // reaches a customer. Only a person sending from the inbox (no internal key) gets through.
  if (internal && settings.automations_enabled !== 'true') {
    await log(db, 'info', 'sendMessage', `Pausa global: envío automático (${kind}) no enviado`, '');
    return Response.json({ ok: false, skipped: 'automations_paused' });
  }
"""),
])

patch('base44/functions/reparoBridge/entry.ts', [
    ("""    else if (await recentlySent(sr, t.id, t.status_name)) { action = 'dup_guard_skip'; msgText = null; }""",
     """    else if (flat.automations_enabled !== 'true') { action = 'automations_paused'; msgText = null; } // audit B-10
    else if (await recentlySent(sr, t.id, t.status_name)) { action = 'dup_guard_skip'; msgText = null; }"""),
])

(REPO / 'src' / 'components' / 'AutomationsPausedBanner.jsx').write_text("""import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Red banner while the global pause is on (audit B-10). Same switch as
// Ajustes → Automatizaciones (SystemSettings.automations_enabled).
export default function AutomationsPausedBanner() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const rows = await base44.entities.SystemSettings.filter({ setting_key: 'automations_enabled' });
        if (!cancelled) setPaused((rows?.[0]?.setting_value ?? '') !== 'true');
      } catch { /* keep last state */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!paused) return null;
  return (
    <div role="alert" className="bg-red-600 text-white text-sm font-medium px-4 py-2 text-center">
      Automatizaciones en pausa: no sale ningún WhatsApp automático. Las respuestas manuales sí se envían.
    </div>
  );
}
""")

patch('src/components/Layout.jsx', [
    ("""import SudoCommandBox from '@/components/SudoCommandBox';""",
     """import SudoCommandBox from '@/components/SudoCommandBox';
import AutomationsPausedBanner from '@/components/AutomationsPausedBanner';"""),
    ("""        <Outlet />""",
     """        <AutomationsPausedBanner />
        <Outlet />"""),
])
print('B-07/B-08/B-10 patch applied')
