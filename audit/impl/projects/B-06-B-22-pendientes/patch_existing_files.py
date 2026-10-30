"""B-06 / B-22 (TPV 13:00 Pendientes): existing files.

    python3 patch_existing_files.py --tpv <root> [--check]

sendPendingDigest/entry.ts is replaced whole (files/). Here: MessageLog accepts
doc_kind 'pendientes' (today every log of the digest fails silently because the
value is not in the enum), and the workflow runs 13:00 and 13:30 Mon–Sat.
"""
import argparse
import json
import pathlib
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    root = pathlib.Path(args.tpv)
    staged = {}

    p = root / 'base44/entities/MessageLog.jsonc'
    doc = json.loads(p.read_text())
    kinds = doc['properties']['doc_kind']['enum']
    if 'pendientes' not in kinds:
        kinds.append('pendientes')
    staged[p] = json.dumps(doc, indent=2, ensure_ascii=True) + '\n'

    p = root / 'base44/workflows/WhatsappPendientes.jsonc'
    wf = json.loads(p.read_text())
    if wf['trigger']['config']['cron_expression'] != '0 13 * * *':
        sys.exit(f'WhatsappPendientes: unexpected cron {wf["trigger"]["config"]["cron_expression"]!r}')
    wf['trigger']['config']['cron_expression'] = '0,30 13 * * 1-6'
    wf['name'] = 'WhatsApp pendientes (13:00 lun-sáb, reintento 13:30)'
    wf['description'] = ('Cada día de lunes a sábado a las 13:00 (hora de Madrid) manda por WhatsApp a la persona de '
                         'Ajustes → Recordatorios todos los Pendientes sin hacer; a las 13:30 solo reintenta si falló. '
                         'Auditoría B-22.')
    staged[p] = json.dumps(wf, indent=2, ensure_ascii=True) + '\n'

    if args.check:
        print(f'OK: {len(staged)} files')
        return
    for path, text in staged.items():
        path.write_text(text)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
