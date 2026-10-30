"""B-12 completeSale idempotency (client_request_id). Apply AFTER B-40's patch.

    python3 patch_existing_files.py --tpv <tpv-root> [--check]

Server: runCompleteSale becomes a wrapper. With a client_request_id it
  1. returns the completed sale that already has that id (retry after a network drop),
  2. refuses (409) while another request with the same id is running (double click,
     two Stripe events at once),
  3. otherwise completes the sale, storing client_request_id on it.
Without an id nothing changes. Clients: CobrarDialog, DevolverDialog,
NuevaSenalDialog and VentaRapida send one id per ticket; stripeWebhook uses
"stripe:<parked sale id>" so checkout.session.completed and payment_intent.succeeded
can no longer both create a sale.
"""
import argparse
import pathlib
import sys

WRAPPER = '''

// --- Cobro idempotente (auditoría B-12) ------------------------------------
// Con client_request_id, un mismo cobro solo crea una venta: un reintento
// devuelve la venta ya hecha y una petición simultánea se rechaza.
const IN_FLIGHT_MS = 2 * 60 * 1000;

async function findCompletedByRequest(service, requestId) {
  const page = await service.entities.Sale.filter({ client_request_id: requestId, status: 'completed' }, { limit: 1 });
  return (page.items || [])[0] || null;
}

export async function runCompleteSale(args) {
  const requestId = String(args.body?.client_request_id || '').trim().slice(0, 80);
  if (!requestId) return completeSaleOnce(args);
  const { service } = args;

  const done = await findCompletedByRequest(service, requestId);
  if (done) {
    const cash = (done.payments || []).find((payment) => payment.method === 'cash');
    return { sale: done, change: round2(cash?.change || 0), duplicate: true };
  }

  const mine = await service.entities.SaleRequest.create({ request_id: requestId, state: 'running', actor_email: args.user?.email || '' });
  const recent = new Date(Date.now() - IN_FLIGHT_MS).toISOString();
  const runningPage = await service.entities.SaleRequest.filter(
    { request_id: requestId, state: 'running', created_date: { $gte: recent } },
    { sort: 'created_date', limit: 10 },
  );
  const first = [...(runningPage.items || [])].sort((a, b) =>
    String(a.created_date).localeCompare(String(b.created_date)) || String(a.id).localeCompare(String(b.id)))[0];
  if (first && first.id !== mine.id) {
    await service.entities.SaleRequest.update(mine.id, { state: 'failed', error: 'Cobro duplicado en curso' });
    fail('Este cobro ya se está procesando. Espera unos segundos y revisa la lista de tickets.', 409);
  }

  try {
    const result = await completeSaleOnce({ ...args, body: { ...args.body, client_request_id: requestId } });
    await service.entities.SaleRequest.update(mine.id, { state: 'done', sale_id: result.sale.id });
    return result;
  } catch (error) {
    await service.entities.SaleRequest.update(mine.id, { state: 'failed', error: String(error?.message || error).slice(0, 300) }).catch(() => {});
    // La otra petición pudo terminar mientras tanto: si ya hay venta, se devuelve esa.
    const finished = await findCompletedByRequest(service, requestId).catch(() => null);
    if (finished) return { sale: finished, change: 0, duplicate: true };
    throw error;
  }
}
'''

PATCHES = {
    'base44/entities/Sale.jsonc': [
        ('    "repair_ref": {\n',
         '    "client_request_id": {\n      "type": "string",\n      "description": "Id del intento de cobro (B-12): un reintento no duplica la venta"\n    },\n    "repair_ref": {\n'),
    ],
    'base44/shared/saleCompletion.ts': [
        ('export async function runCompleteSale({ service, user, body, assignNumber }) {\n',
         'async function completeSaleOnce({ service, user, body, assignNumber }) {\n'),
        ('    gift_ticket: !!body.gift_ticket,\n',
         '    gift_ticket: !!body.gift_ticket,\n    client_request_id: String(body.client_request_id || \'\').slice(0, 80),\n'),
        ('__END__', WRAPPER),
    ],
    'base44/functions/stripeWebhook/entry.ts': [
        ("          repair_ref: sale.repair_ref || '',\n",
         "          repair_ref: sale.repair_ref || '',\n          client_request_id: `stripe:${sale.id}`,\n"),
    ],
    'src/components/venta/CobrarDialog.jsx': [
        ('  const [sendChannel, setSendChannel] = useState(null);\n',
         '  const [sendChannel, setSendChannel] = useState(null);\n  // Un id por cobro (B-12): reintentar el mismo cobro no crea dos tickets.\n  const [requestId] = useState(() => crypto.randomUUID());\n'),
        ('        gift_ticket: !!gift,\n', '        gift_ticket: !!gift,\n        client_request_id: requestId,\n'),
    ],
    'src/components/venta/DevolverDialog.jsx': [
        ('  const [saving, setSaving] = useState(false);\n',
         '  const [saving, setSaving] = useState(false);\n  const [requestId] = useState(() => crypto.randomUUID());\n'),
        ('        gift_ticket: !!gift,\n', '        gift_ticket: !!gift,\n        client_request_id: requestId,\n'),
    ],
    'src/components/senales/NuevaSenalDialog.jsx': [
        ('  const [sendChannel, setSendChannel] = useState(null);\n',
         '  const [sendChannel, setSendChannel] = useState(null);\n  const [requestId] = useState(() => crypto.randomUUID());\n'),
        ('      const saleRes = await completeSale({\n        lines: [\n',
         '      const saleRes = await completeSale({\n        client_request_id: requestId,\n        lines: [\n'),
    ],
    'src/pages/VentaRapida.jsx': [
        ('  const entregaRef = useRef(null);\n',
         '  const entregaRef = useRef(null);\n  // Un id por ticket (B-12): se conserva si el cobro falla y se reintenta.\n  const requestIdRef = useRef(null);\n'),
        ('      const res = await completeSale({\n        lines: toSalePayload(saleLines),\n',
         '      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();\n      const res = await completeSale({\n        client_request_id: requestIdRef.current,\n        lines: toSalePayload(saleLines),\n'),
        ('      const sale = res.data.sale;\n', '      const sale = res.data.sale;\n      requestIdRef.current = null;\n'),
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    root = pathlib.Path(args.tpv)
    staged = {}
    for rel, pairs in PATCHES.items():
        text = (root / rel).read_text()
        for old, new in pairs:
            if old == '__END__':
                text = text.rstrip('\n') + new
                continue
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
