"""B-48 TPV catalogue cache: Venta.jsx and VentaRapida.jsx read the catalogue through
lib/venta/catalogCache.js. Apply after batch-tpv-reparo-1031.

    python3 patch_existing_files.py --tpv <root> [--check]
"""
import argparse
import pathlib
import sys

LINE = "        fetchAllPages(base44.entities.Product, {}, { fields: PRODUCT_FIELDS }).then((items) => ({ items })),\n"
NEW = "        loadCatalog(PRODUCT_FIELDS).then((items) => ({ items })),\n"
IMP = "import { fetchAllPages } from '@/lib/fetchAll';\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tpv', required=True)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    staged = {}
    for rel in ['src/pages/Venta.jsx', 'src/pages/VentaRapida.jsx']:
        p = pathlib.Path(a.tpv) / rel
        t = p.read_text()
        for old in (LINE, IMP):
            if t.count(old) != 1:
                sys.exit(f'{rel}: anchor found {t.count(old)} times: {old[:60]!r}')
        t = t.replace(LINE, NEW).replace(IMP, IMP + "import { loadCatalog } from '@/lib/venta/catalogCache';\n")
        staged[p] = t
    if a.check:
        print('anchors OK in 2 files')
        return
    for p, t in staged.items():
        p.write_text(t)
    print('patched 2 files')


if __name__ == '__main__':
    main()
