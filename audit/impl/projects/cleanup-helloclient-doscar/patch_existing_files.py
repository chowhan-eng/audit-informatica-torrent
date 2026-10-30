"""HelloClient / Doscar clean-up (B-16, B-18; deletions staged for B-62).

    python3 patch_existing_files.py --reparo <root> --tpv <root> [--check]

Hides and unschedules now; nothing is deleted (AUDIT rule: hide 30 days, then
remove — see DELETE_AFTER_30_DAYS.md). WhatsApp Pro part is patch 0005.
"""
import argparse
import json
import pathlib
import sys

REPARO_WORKFLOW = 'base44/workflows/Sincronizar HelloClient.jsonc'


def reparo_workflow(text):
    """B-16: the 5-minute workflow no longer mirrors HelloClient (cut over); only the
    WhatsApp queue sweep remains, every 15 minutes in shop hours."""
    wf = json.loads(text)
    steps = wf['definition']['do']
    names = [next(iter(step)) for step in steps]
    if names != ['sync_tickets', 'whatsapp_pendientes']:
        sys.exit(f'reparo:{REPARO_WORKFLOW}: unexpected steps {names}')
    wf['definition']['do'] = [steps[1]]
    wf['name'] = 'WhatsApp pendientes (cada 15 min)'
    wf['description'] = 'Cada 15 min (lun-sáb, horario de tienda): envía los avisos de WhatsApp en cola que no salieron al minuto. Auditoría B-16: ya no se sincroniza HelloClient.'
    wf['trigger']['config']['cron_expression'] = '*/15 9-20 * * 1-6'
    return json.dumps(wf, indent=2, ensure_ascii=True) + '\n'

PATCHES = {
    'reparo': {
        'src/pages/Configuracion.jsx': [
            ("  ['Integraciones', [['whatsapp', 'WhatsApp'], ['importar', 'Importar HelloClient'], ['datos', 'Estado de los datos'], ['cambio', 'Paso a Reparo']]],\n",
             "  // B-18: «Importar HelloClient» and «Paso a Reparo» hidden (cut over done).\n  ['Integraciones', [['whatsapp', 'WhatsApp'], ['datos', 'Estado de los datos']]],\n"),
        ],
        'src/pages/config/Datos.jsx': [
            ("import HcSyncCard from '@/components/config/HcSyncCard';\n", ''),
            ('        <HcSyncCard state={c.syncState} cutover={c.cutover} onDone={() => counts.refetch()} />\n', ''),
        ],
    },
    'tpv': {
        # B-18: Doscar restore hidden; the «Histórico Doscar» tab stays (old sales and
        # invoices must remain readable for the legal retention period).
        'src/pages/Ajustes.jsx': [
            ("const DoscarRestore = lazy(() => import('@/components/doscar/DoscarRestore'));\n", ''),
            ("  { key: 'doscar', label: 'Restaurar desde Doscar', Panel: DoscarRestore },\n", ''),
        ],
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    roots = {'reparo': pathlib.Path(args.reparo), 'tpv': pathlib.Path(args.tpv)}
    staged = {}
    wf_path = roots['reparo'] / REPARO_WORKFLOW
    staged[wf_path] = reparo_workflow(wf_path.read_text())
    for app, files in PATCHES.items():
        for rel, pairs in files.items():
            text = (roots[app] / rel).read_text()
            for old, new in pairs:
                n = text.count(old)
                if n != 1:
                    sys.exit(f'{app}:{rel}: anchor found {n} times (expected 1): {old[:70]!r}')
                text = text.replace(old, new)
            staged[roots[app] / rel] = text
    if args.check:
        print(f'anchors OK in {len(staged)} files')
        return
    for path, text in staged.items():
        path.write_text(text)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
