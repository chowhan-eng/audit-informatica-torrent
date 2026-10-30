"""B-40 «Cobrar en TPV»: changes to files that already exist in Reparo and TPV.

Usage (at apply time, on a fresh checkout of each app; nothing is deployed by this):
    python3 patch_existing_files.py --reparo <reparo-root> --tpv <tpv-root> [--check]

Every anchor is text copied from production (Reparo 686fe92, TPV bf4c563). If any
anchor does not match exactly once, the script stops before writing anything.
The new files (functions, entities, workflows, components) are in files/ and are
copied as they are.
"""
import argparse
import pathlib
import sys

REPAIR_ORDER_FIELDS = '''    "tpv_sale_id": {
      "description": "Último ticket del TPV que cobró esta orden (B-40)",
      "type": "string"
    },
    "tpv_sale_ids": {
      "description": "Todos los tickets del TPV de esta orden; evita duplicar un aviso de cobro",
      "items": {
        "type": "string"
      },
      "type": "array"
    },
    "tpv_sale_ref": {
      "description": "Serie/número del ticket, p. ej. T-2026/120",
      "type": "string"
    },
    "tpv_paid_total": {
      "type": "number"
    },
    "tpv_paid_at": {
      "format": "date-time",
      "type": "string"
    },
'''

FIND_OR_CREATE = '''// Cliente de la orden de Reparo → cliente del TPV (auditoría B-40): se busca por
// móvil y, si no existe, se crea con nombre, móvil y correo.
async function findOrCreateCustomer({ name, phone, email }) {
  const digits = String(phone || '').replace(/\\D/g, '');
  const local = digits.startsWith('34') && digits.length === 11 ? digits.slice(2) : digits;
  if (local) {
    for (const value of [...new Set([local, digits, `+${digits}`, `+34${local}`])]) {
      const page = await base44.entities.Customer.filter({ phone: value }, { limit: 1 });
      if ((page.items || [])[0]) return page.items[0];
    }
  }
  if (!name) return null;
  return base44.entities.Customer.create({ name, phone: local, email: email || '' });
}

'''

URL_EFFECT = '''  // «Cobrar en TPV» desde Reparo (auditoría B-40): /venta?orden=39358 abre el
  // cobro de esa reparación con los datos de la orden.
  useEffect(() => {
    if (!products) return;
    const params = new URLSearchParams(window.location.search);
    const orden = (params.get('orden') || '').replace(/\\D/g, '');
    if (!orden) return;
    params.delete('orden');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    setOrdenInicial(orden);
    setDialog('reparacion');
  }, [products]);

'''

OLD_REPARACION = '''      {dialog === 'reparacion' && (
        <ReparacionDialog
          onClose={closeDialog}
          onAdd={({ product, orden, description, price }) => {
            pushLine(baseLine(product, {
              description: `${orden} · ${description}`,
              unit_price: price,
            }));
            setRepairRef(orden);
            setDialog(null);
          }}
        />
      )}'''

NEW_REPARACION = '''      {dialog === 'reparacion' && (
        <ReparacionDialog
          initialOrden={ordenInicial}
          onClose={() => { setOrdenInicial(''); closeDialog(); }}
          onAdd={async ({ product, orden, description, price, customer: fromReparo }) => {
            pushLine(baseLine(product, {
              description: `${orden} · ${description}`,
              unit_price: price,
            }));
            setRepairRef(orden);
            setOrdenInicial('');
            setDialog(null);
            // El cliente de la orden pasa al ticket (se busca por móvil o se crea).
            if (fromReparo && !customer) {
              const found = await findOrCreateCustomer(fromReparo).catch(() => null);
              if (found) setCustomer(found);
            }
          }}
        />
      )}'''

OLD_DEPOSITS = '''  useEffect(() => {
    if (!customer?.id) return;
    base44.entities.Deposit.filter({ customer_id: customer.id, status: 'open' }, { limit: 10 })
      .then((page) => setDeposits(page.items || []));
  }, [customer?.id]);'''

NEW_DEPOSITS = '''  // La señal de esta misma reparación va primera y se aplica sola (auditoría B-40).
  const sameRepair = (deposit) => !!repairRef && String(deposit.repair_ref || '').replace(/\\D/g, '') === String(repairRef);
  useEffect(() => {
    if (!customer?.id) return;
    base44.entities.Deposit.filter({ customer_id: customer.id, status: 'open' }, { limit: 10 })
      .then((page) => {
        const list = [...(page.items || [])].sort((a, b) => Number(sameRepair(b)) - Number(sameRepair(a)));
        setDeposits(list);
        if (list[0] && sameRepair(list[0])) {
          setAmounts((current) => ({ ...current, deposit: String(Math.min(round2(list[0].amount), round2(total))) }));
        }
      });
  }, [customer?.id]);'''

SALE_NOTIFY = '''  // --- Reparo (auditoría B-40): la orden queda cobrada y pasa a «Entregado».
  // Un fallo aquí nunca deshace la venta: queda en ReparoSync y se reintenta.
  if (!isRefund && sale.repair_order_id) {
    await Promise.allSettled([notifyReparoPaid(service, sale, user.full_name || user.email)]);
  }

  return { sale, change };'''

PATCHES = {
    'reparo': {
        'base44/entities/RepairOrder.jsonc': [
            ('    "warranty_of": {\n', REPAIR_ORDER_FIELDS + '    "warranty_of": {\n'),
        ],
        'src/components/tickets/detail/TicketHeader.jsx': [
            ("import TicketMoreMenu from './TicketMoreMenu';\n",
             "import TicketMoreMenu from './TicketMoreMenu';\nimport CobrarEnTpv from './CobrarEnTpv';\n"),
            ('      <WarrantyLinks order={order} />\n',
             '      <WarrantyLinks order={order} />\n      <CobrarEnTpv order={order} />\n'),
        ],
    },
    'tpv': {
        'base44/entities/Sale.jsonc': [
            ('    "repair_ref": {\n',
             '    "repair_order_id": {\n      "type": "string",\n      "description": "Orden de Reparo cobrada en este ticket (B-40)"\n    },\n    "repair_ref": {\n'),
        ],
        'base44/shared/saleCompletion.ts': [
            ("import { sendLowStockAlert } from './stockAlerts.ts';\n",
             "import { sendLowStockAlert } from './stockAlerts.ts';\nimport { notifyReparoPaid, repairOrderId } from './reparo.ts';\n"),
            ("    repair_ref: String(body.repair_ref || '').slice(0, 60),\n",
             "    repair_ref: String(body.repair_ref || '').slice(0, 60),\n    repair_order_id: isRefund ? '' : repairOrderId(body.repair_order_id),\n"),
            ('  return { sale, change };', SALE_NOTIFY),
        ],
        'src/pages/Venta.jsx': [
            ('const toSaleLine = (line, index) => {\n', FIND_OR_CREATE + 'const toSaleLine = (line, index) => {\n'),
            ("  const [repairRef, setRepairRef] = useState('');\n",
             "  const [repairRef, setRepairRef] = useState('');\n  const [ordenInicial, setOrdenInicial] = useState('');\n"),
            ('  const totals = useMemo(() => computeTotals(lines), [lines]);\n',
             URL_EFFECT + '  const totals = useMemo(() => computeTotals(lines), [lines]);\n'),
            (OLD_REPARACION, NEW_REPARACION),
        ],
        'src/components/venta/CobrarDialog.jsx': [
            (OLD_DEPOSITS, NEW_DEPOSITS),
            ("        repair_ref: repairRef || '',\n",
             "        repair_ref: repairRef || '',\n        repair_order_id: repairRef || '',\n"),
        ],
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true', help='only verify the anchors')
    args = ap.parse_args()
    roots = {'reparo': pathlib.Path(args.reparo), 'tpv': pathlib.Path(args.tpv)}

    staged = {}
    for app, files in PATCHES.items():
        for rel, pairs in files.items():
            path = roots[app] / rel
            text = path.read_text()
            for old, new in pairs:
                n = text.count(old)
                if n != 1:
                    sys.exit(f'{app}:{rel}: anchor found {n} times (expected 1): {old[:70]!r}')
                text = text.replace(old, new)
            staged[path] = text
    if args.check:
        print(f'anchors OK in {len(staged)} files')
        return
    for path, text in staged.items():
        path.write_text(text)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
