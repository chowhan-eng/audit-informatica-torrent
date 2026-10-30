"""B-55 (TPV PIN server-side, cashier PIN hashed) and B-39 (RLS) — existing files.

    python3 patch_existing_files.py --tpv <root> --reparo <root> [--check]

Apply AFTER B-12 (no shared anchors, but keep the global order of DEPLOY.md).
WhatsApp Pro RLS changes are in patch 0007.
"""
import argparse
import json
import pathlib
import sys

WRAP = '''

// Pase del PIN del encargado exigido en el servidor (auditoría B-55).
export default async function (req) {
  const denied = await requireAdminUnlock(req.clone());
  if (denied) return denied;
  return handler(req);
}
'''


def protected(import_line):
    """stockAdjust / receivePurchase / rectifyInvoice: the handler only runs with a valid pass."""
    return [
        (import_line, import_line + "import { requireAdminUnlock } from '../../shared/adminUnlock.ts';\n"),
        ('export default async function (req) {\n', 'async function handler(req) {\n'),
        ('__END__', WRAP),
    ]


TPV = {
    'base44/functions/adminPin/entry.ts': [
        ("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';\n",
         "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';\nimport { issueUnlock } from '../../shared/adminUnlock.ts';\n"),
        ("        if (record.failed_attempts) await service.entities.AdminPin.update(record.id, { failed_attempts: 0, locked_until: '' });\n        return Response.json({ ok: true });\n",
         "        if (record.failed_attempts) await service.entities.AdminPin.update(record.id, { failed_attempts: 0, locked_until: '' });\n        return Response.json({ ok: true, unlock_token: await issueUnlock(service, user.email) });\n"),
        ("      await audit(record?.pin_hash ? 'PIN del encargado cambiado' : 'PIN del encargado creado');\n      return Response.json({ ok: true });\n",
         "      await audit(record?.pin_hash ? 'PIN del encargado cambiado' : 'PIN del encargado creado');\n      return Response.json({ ok: true, unlock_token: await issueUnlock(service, user.email) });\n"),
    ],
    'base44/functions/stockAdjust/entry.ts': protected("import { sendLowStockAlert, sendStockChangeEmail } from '../../shared/stockAlerts.ts';\n"),
    'base44/functions/receivePurchase/entry.ts': protected("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';\n"),
    'base44/functions/rectifyInvoice/entry.ts': protected("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';\n"),
    'src/components/PinGate.jsx': [
        ("        await adminPin({ action: 'set', pin });\n        touchUnlock();\n",
         "        const created = await adminPin({ action: 'set', pin });\n        touchUnlock(created.unlock_token);\n"),
        ("      if (data.ok) touchUnlock();\n", "      if (data.ok) touchUnlock(data.unlock_token);\n"),
        ("    create: 'De 4 a 8 números. Se pedirá para entrar en Compras, Proveedores, Unidades, Informes, Ajustes y Stock.',\n",
         "    create: 'De 4 a 8 números. Se pedirá para entrar en Artículos, Compras, Proveedores, Unidades, Informes, Ajustes y Stock.',\n"),
    ],
    'src/App.jsx': [
        ('          <Route path="/articulos" element={<Articulos />} />\n', ''),
        ('            <Route path="/stock" element={<Stock />} />\n',
         '            <Route path="/articulos" element={<Articulos />} />\n            <Route path="/stock" element={<Stock />} />\n'),
    ],
    'src/components/ajustes/UsuariosPanel.jsx': [
        ("import AdminPinCard from '@/components/ajustes/AdminPinCard';\n",
         "import AdminPinCard from '@/components/ajustes/AdminPinCard';\nimport { cashierPin } from '@/functions/cashierPin';\n"),
        ('  const [message, setMessage] = useState(null);\n',
         '  const [message, setMessage] = useState(null);\n  const [withPin, setWithPin] = useState({});\n'),
        ('  useEffect(() => { load(); }, []);\n',
         '  // B-55: the PIN lives hashed on the server; here we only know who has one.\n'
         '  const loadPins = () => cashierPin({ action: \'list\' })\n'
         '    .then((res) => setWithPin(Object.fromEntries((res.data?.users || []).map((person) => [person.id, person.has_pin]))))\n'
         '    .catch(() => {});\n\n'
         '  useEffect(() => { load(); loadPins(); }, []);\n'),
        ("    patch(person, { pin: value }, `PIN de ${person.full_name || person.email} guardado`)\n      .then(() => setPin((current) => ({ ...current, [person.id]: '' })));\n",
         "    setBusy(person.id);\n    setMessage(null);\n    cashierPin({ action: 'set', user_id: person.id, pin: value })\n"
         "      .then((res) => {\n        if (res.data?.error) throw new Error(res.data.error);\n"
         "        setPin((current) => ({ ...current, [person.id]: '' }));\n"
         "        setMessage({ tone: 'ok', text: `PIN de ${person.full_name || person.email} guardado` });\n"
         "        loadPins();\n      })\n"
         "      .catch((error) => setMessage({ tone: 'error', text: error.response?.data?.error || error.message }))\n"
         "      .finally(() => setBusy(''));\n"),
        ("                  placeholder={person.pin ? '••••' : 'sin PIN'}\n",
         "                  placeholder={withPin[person.id] ? '••••' : 'sin PIN'}\n"),
    ],
}

ADMIN = {'user_condition': {'role': 'admin'}}
# B-39 (Reparo): deleting orders and clients becomes admin-only (they used to be
# deletable by any staff account, without a trace).
REPARO_DELETE_ADMIN_ONLY = ['base44/entities/RepairOrder.jsonc', 'base44/entities/Client.jsonc']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    tpv, reparo = pathlib.Path(args.tpv), pathlib.Path(args.reparo)
    staged = {}
    for rel, pairs in TPV.items():
        text = (tpv / rel).read_text()
        for old, new in pairs:
            if old == '__END__':
                text = text.rstrip('\n') + new
                continue
            n = text.count(old)
            if n != 1:
                sys.exit(f'tpv:{rel}: anchor found {n} times (expected 1): {old[:70]!r}')
            text = text.replace(old, new)
        staged[tpv / rel] = text
    for rel in REPARO_DELETE_ADMIN_ONLY:
        doc = json.loads((reparo / rel).read_text())
        doc['rls']['delete'] = ADMIN
        staged[reparo / rel] = json.dumps(doc, indent=2, ensure_ascii=True) + '\n'
    if args.check:
        print(f'anchors OK in {len(staged)} files')
        return
    for path, text in staged.items():
        path.write_text(text)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
