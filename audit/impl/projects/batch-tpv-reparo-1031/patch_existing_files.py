"""31 Oct batch for TPV and Reparo (B-25, B-26, B-27, B-28, B-29, B-30, B-32, B-59).
Apply after every other project script.

    python3 patch_existing_files.py --tpv <root> --reparo <root> [--check]
"""
import argparse
import pathlib
import sys

PHONE = "(/^[+\\d\\s().-]+$/.test({v}) ? {v}.replace(/\\D/g, '').replace(/^(00)?34(?=\\d{{9}}$)/, '') : {v})"
SIM = "['b3523fe9-5a9a-4dd9-b792-f42f2bce9735', 'c3461f5c-a585-4ce0-8c06-858023bdba37']"

TPV = {
    # B-26: reports read the whole catalogue / period instead of stopping at 3,000 rows.
    'src/lib/informes/load.js': [
        ("export const loadProducts = () => fetchAll(base44.entities.Product, {}, { sort: 'name', max: 3000 });",
         "export const loadProducts = () => fetchAll(base44.entities.Product, {}, { sort: 'name', max: 100000 });"),
        ("    { sort: '-created_date', max: 3000 },", "    { sort: '-created_date', max: 100000 },"),
    ],
    # B-27: «+34 619 48 09 04» finds the customer stored as 619480904.
    'src/components/clientes/ClienteList.jsx': [
        ("            { phone: { $regex: term, $options: 'i' } },",
         "            { phone: { $regex: " + PHONE.format(v='term') + ", $options: 'i' } },"),
    ],
    'src/components/venta/ClienteDialog.jsx': [
        ("            { phone: { $regex: value, $options: 'i' } },",
         "            { phone: { $regex: " + PHONE.format(v='value') + ", $options: 'i' } },"),
    ],
    'src/pages/Venta.jsx': [
        # B-28: the catalogue load retries (4 times) and shows an error instead of spinning forever.
        ("    (async () => {\n      const [productPage, familyPage, settingsPage, sessionPage] = await Promise.all([\n",
         "    const load = async (attempt = 0) => {\n      try {\n      const [productPage, familyPage, settingsPage, sessionPage] = await Promise.all([\n"),
        ("      setSessionReady(true);\n    })();\n    return () => { active = false; };\n",
         "      setSessionReady(true);\n      } catch (error) {\n        // B-28: red caída o límite de lecturas: se reintenta y, si no, se avisa.\n"
         "        if (!active) return;\n        if (attempt < 4) { setTimeout(() => load(attempt + 1), 1500 * (attempt + 1)); return; }\n"
         "        setProducts([]);\n        setSessionReady(true);\n"
         "        setMessage({ text: 'No se pudo cargar el catálogo. Recarga la página.', tone: 'error' });\n      }\n    };\n"
         "    load();\n    return () => { active = false; };\n"),
        # B-32
        ("import VentaStatusBar from '@/components/venta/VentaStatusBar';\n",
         "import VentaStatusBar from '@/components/venta/VentaStatusBar';\nimport CashCloseReminder from '@/components/venta/CashCloseReminder';\n"),
        ("      <VentaStatusBar\n", "      <CashCloseReminder session={session} />\n      <VentaStatusBar\n"),
    ],
    # B-29: no more permanent public copies of customer documents.
    'base44/functions/sendDocument/entry.ts': [
        ("import { copyWhatsappToInbox } from '../../shared/inboxPro.ts';\n",
         "import { copyWhatsappToInbox } from '../../shared/inboxPro.ts';\nimport { expiringDocLink } from '../../shared/docLink.ts';\n"),
        ("""async function publicPdfUrl(service, pdf) {
  try {
    const response = await fetch(pdf.url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return pdf.url;
    const bytes = await response.arrayBuffer();
    const file = new File([bytes], pdf.file_name, { type: 'application/pdf' });
    const uploaded = await service.integrations.Core.UploadFile({ file });
    return uploaded?.file_url || pdf.url;
  } catch {
    return pdf.url;
  }
}""",
         """async function publicPdfUrl(service, pdf) {
  // Auditoría B-29: enlace firmado de 7 días al PDF privado, sin copia pública.
  const link = await expiringDocLink(pdf.file_uri, pdf.file_name).catch(() => '');
  return link || pdf.url;
}"""),
    ],
    # B-59: purchasing, suppliers and units leave the main menu (Phase 5: «hide behind
    # Ajustes»); the screens stay at their address for the manager.
    'src/lib/nav.js': [
        ("  { to: '/compras', label: 'Compras', icon: Truck, bg: 'bg-mosaic-compras', adminOnly: true },\n", ''),
        ("  { to: '/proveedores', label: 'Proveedores', icon: Factory, bg: 'bg-mosaic-proveedores' },\n", ''),
        ("  { to: '/unidades', label: 'Unidades', icon: Smartphone, bg: 'bg-mosaic-unidades', adminOnly: true },\n", ''),
    ],
}

REPARO = {
    # B-30
    'src/lib/shop/config.js': [
        ("export async function nextOrderNumber() {\n  const top = await base44.entities.RepairOrder.list('-number', 1);\n  return (top[0]?.number || parseInt(top[0]?.order_id, 10) || 0) + 1;\n}\n",
         "export async function nextOrderNumber() {\n  // B-30: the server hands out the number atomically (two counters can no longer clash).\n"
         "  try {\n    const r = await base44.functions.invoke('allocateOrderNumber', {});\n    const n = Number((r?.data ?? r)?.number);\n    if (n) return n;\n  } catch { /* fall back below */ }\n"
         "  const top = await base44.entities.RepairOrder.list('-number', 1);\n  return (top[0]?.number || parseInt(top[0]?.order_id, 10) || 0) + 1;\n}\n"),
    ],
    # B-25: SIM card / SIM tray only required for phones and tablets.
    'src/lib/shop/rules.js': [
        ("export function missingRequiredFields(order, cfg) {\n",
         "// B-25: «Tarjeta SIM» and «Bandeja Sim» only matter for phones and tablets.\n"
         "export const SIM_FIELDS = " + SIM + ";\n"
         "const PHONE_WORDS = /iphone|ipad|galaxy|redmi|xiaomi|poco|huawei|honor|oppo|realme|motorola|moto |pixel|oneplus|vivo|zte|alcatel|nokia|tablet|\\btab\\b|smartphone|movil|móvil/i;\n"
         "export function isPhoneLike(fields = {}) {\n"
         "  const text = `${fields['522b98e8-27ab-4129-be75-311364f77c26'] || ''} ${fields['661a36ac-ca74-434b-acfe-9f096f2236f4'] || ''}`;\n"
         "  return PHONE_WORDS.test(text) || /samsung/i.test(text) && !/tv|monitor|portatil|portátil|book/i.test(text);\n"
         "}\n\n"
         "export function missingRequiredFields(order, cfg) {\n"),
        ("    .filter((f) => f.required)\n",
         "    .filter((f) => f.required)\n    .filter((f) => !(SIM_FIELDS.includes(f.hc_id) && !isPhoneLike(order.fields || {})))\n"),
    ],
    'src/components/tickets/NewTicketDrawer.jsx': [
        ("import { useSearchParams } from 'react-router-dom';\n",
         "import { useSearchParams } from 'react-router-dom';\nimport { SIM_FIELDS, isPhoneLike } from '@/lib/shop/rules';\n"),
        ("      if (!f.required) continue;\n",
         "      if (!f.required || (SIM_FIELDS.includes(f.hc_id) && !isPhoneLike(fields))) continue;\n"),
    ],
}


def run(root, table, tag, staged):
    for rel, pairs in table.items():
        text = (root / rel).read_text()
        for old, new in pairs:
            n = text.count(old)
            if n != 1:
                sys.exit(f'{tag}:{rel}: anchor found {n} times (expected 1): {old[:70]!r}')
            text = text.replace(old, new)
        staged[root / rel] = text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    staged = {}
    run(pathlib.Path(a.tpv), TPV, 'tpv', staged)
    run(pathlib.Path(a.reparo), REPARO, 'reparo', staged)
    if a.check:
        print(f'anchors OK in {len(staged)} files')
        return
    for p, t in staged.items():
        p.write_text(t)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
