"""B-47 Mostrador «Hoy» + global search: changes to existing files.

Usage at apply time (fresh checkouts; nothing is deployed by this):
    python3 patch_existing_files.py --mostrador <root> [--check]
WhatsApp Pro changes (mostradorLookup, ?conv= deep link) are in the local clone
commit / patch file. New files are in files/.
"""
import argparse
import pathlib
import sys

PATCHES = {
    'src/pages/Home.jsx': [
        ("import './mostrador.css';\n", "import './mostrador.css';\nimport HoyPanel from '@/components/HoyPanel';\n"),
        ('        <section className="mo-wrap mo-keys" aria-label="Aplicaciones">\n',
         '        <HoyPanel />\n\n        <section className="mo-wrap mo-keys" aria-label="Aplicaciones">\n'),
    ],
    'src/lib/destinations.js': [
        # Phase 1 finding 2: Verifactu is off until 2027, the tile must not promise it.
        ("    summary: 'Venta en mostrador, caja del día, tickets, stock y facturación VeriFactu.',\n",
         "    summary: 'Venta en mostrador, caja del día, tickets, stock y facturas.',\n"),
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mostrador', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    root = pathlib.Path(args.mostrador)
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
