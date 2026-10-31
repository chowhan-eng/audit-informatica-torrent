"""B-51 (Reparo history not lost on concurrent edits) and B-53 (audit logs not editable).
Apply after every other Reparo/TPV script.

    python3 patch_existing_files.py --reparo <root> --tpv <root> [--check]
"""
import argparse
import json
import pathlib
import sys

HELPER = """const E = () => base44.entities.RepairOrder;

// B-51: re-read the history right before writing, so two people changing the same
// ticket at once do not lose each other's events.
async function freshEvents(order) {
  try {
    const cur = await E().get(order.id);
    return Array.isArray(cur?.events) ? cur.events : (order.events || []);
  } catch {
    return order.events || [];
  }
}
"""

ORDERS = [
    ("const E = () => base44.entities.RepairOrder;\n", HELPER),
    ("  const patch = { ...statusPatch(status, me.name), events: [...(order.events || []), ev], hc_updated_at: nowIso() };\n",
     "  const patch = { ...statusPatch(status, me.name), events: [...(await freshEvents(order)), ev], hc_updated_at: nowIso() };\n"),
    ("  const events = [...(order.events || []), ev];\n  await E().update(order.id, { events, hc_updated_at: nowIso() });\n",
     "  const events = [...(await freshEvents(order)), ev];\n  await E().update(order.id, { events, hc_updated_at: nowIso() });\n"),
    ("  const events = [...(order.events || [])];\n", "  const events = [...(await freshEvents(order))];\n"),
    ("  const events = [...(order.events || []), event];\n", "  const events = [...(await freshEvents(order)), event];\n"),
]
SERVER_ONLY = {"created_by_id": {"$in": ["__solo_servidor__"]}}
ADMIN = {"user_condition": {"role": "admin"}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    reparo, tpv = pathlib.Path(a.reparo), pathlib.Path(a.tpv)
    staged = {}
    p = reparo / 'src/lib/shop/orders.js'
    t = p.read_text()
    for old, new in ORDERS:
        if old == "  const events = [...(order.events || [])];\n":
            if t.count(old) != 3:
                sys.exit(f'orders.js: expected 3 copies of the updateOrder-style history line, found {t.count(old)}')
            t = t.replace(old, new)
            continue
        if t.count(old) != 1:
            sys.exit(f'orders.js: anchor found {t.count(old)} times: {old[:60]!r}')
        t = t.replace(old, new)
    staged[p] = t
    # B-53: history logs can be added by staff but never edited or deleted from the browser.
    p = reparo / 'base44/entities/ActionLog.jsonc'
    d = json.loads(p.read_text())
    d['rls']['update'] = SERVER_ONLY
    d['rls']['delete'] = SERVER_ONLY
    staged[p] = json.dumps(d, indent=2, ensure_ascii=True) + '\n'
    # B-53: TPV AuditLog rows can never be edited or deleted from the browser. Creating
    # stays open for now: Compras (OrderDialog) and Pendientes still write from the browser
    # (moving them to the server is part of B-36).
    p = tpv / 'base44/entities/AuditLog.jsonc'
    d = json.loads(p.read_text())
    for k in ('update', 'delete'):
        d['rls'][k] = SERVER_ONLY
    d['rls']['read'] = ADMIN
    staged[p] = json.dumps(d, indent=2, ensure_ascii=True) + '\n'
    if a.check:
        print(f'OK: {len(staged)} files')
        return
    for p, t in staged.items():
        p.write_text(t)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
