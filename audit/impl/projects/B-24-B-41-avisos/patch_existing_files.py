"""B-24 / B-41 / B-42 in Reparo: changes to existing files. Apply AFTER B-40.

    python3 patch_existing_files.py --reparo <root> [--check]

- RepairOrder gets ready_at, status_since and reminders_sent.
- changeStatus stamps status_since on every change and ready_at when the order
  ENTERS a ready status. Existing orders get no ready_at, so the old backlog of
  ready orders never receives reminders.
- The status menu shows 💬 next to statuses that message the customer (D-09).
WhatsApp Pro part: patch 0006. New status «Pieza recibida»: see README.
"""
import argparse
import pathlib
import sys

FIELDS = '''    "ready_at": {
      "description": "Cuándo entró en un estado «listo» (B-41). Sin valor en órdenes anteriores: no reciben recordatorios",
      "format": "date-time",
      "type": "string"
    },
    "reminders_sent": {
      "description": "Recordatorios enviados [{kind, for, at, result}] (B-41/B-42)",
      "items": {
        "type": "object"
      },
      "type": "array"
    },
    "status_since": {
      "description": "Cuándo entró en el estado actual (B-42)",
      "format": "date-time",
      "type": "string"
    },
'''

PATCHES = {
    'base44/entities/RepairOrder.jsonc': [
        ('    "warranty_of": {\n', FIELDS + '    "warranty_of": {\n'),
    ],
    'src/lib/shop/orders.js': [
        ("  const patch = { ...statusPatch(status, me.name), events: [...(order.events || []), ev], hc_updated_at: nowIso() };\n",
         "  const patch = { ...statusPatch(status, me.name), events: [...(order.events || []), ev], hc_updated_at: nowIso() };\n"
         "  // B-41/B-42: reminders count from here. ready_at only when the order ENTERS «listo».\n"
         "  patch.status_since = ev.at;\n"
         "  if (status.group === 'ready' && order.status_group !== 'ready') patch.ready_at = ev.at;\n"),
    ],
    'src/components/shop/ui.jsx': [
        ("import { canSetStatus, ROLE_BLOCKED_TEXT } from '@/lib/shop/rules';\n",
         "import { canSetStatus, ROLE_BLOCKED_TEXT } from '@/lib/shop/rules';\nimport { statusMessagesCustomer } from '@/lib/shop/whatsappStatuses';\n"),
        ('                      <span className="flex-1">{s.name}</span>\n',
         '                      <span className="flex-1">{s.name}</span>\n'
         '                      {statusMessagesCustomer(s) && <span title="Avisa al cliente por WhatsApp" aria-label="Avisa por WhatsApp">💬</span>}\n'),
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    root = pathlib.Path(args.reparo)
    staged = {}
    for rel, pairs in PATCHES.items():
        text = (root / rel).read_text()
        for old, new in pairs:
            n = text.count(old)
            if n != 1:
                sys.exit(f'{rel}: anchor found {n} times (expected 1): {old[:70]!r}')
            text = text.replace(old, new)
        staged[root / rel] = text
    if args.check:
        print(f'anchors OK in {len(staged)} files')
        return
    for path, text in staged.items():
        path.write_text(text)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
