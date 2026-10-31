"""Wizard route in Reparo (/asistente). Apply after the other Reparo scripts.

    python3 patch_existing_files.py --reparo <root> [--check]
"""
import argparse
import pathlib
import sys

PATCHES = {
    'src/App.jsx': [
        ('        <Route path="/panel" element={<Panel />} />\n',
         '        <Route path="/panel" element={<Panel />} />\n        <Route path="/asistente" element={<Asistente />} />\n'),
        ("import Tickets from", "import Asistente from '@/pages/Asistente';\nimport Tickets from"),
    ],
    # B-61: constant-time compare of the shared key.
    'base44/functions/waLookup/entry.ts': [
        ("  if (!expected || req.headers.get('X-Reparo-Key') !== expected) {\n",
         "  const given = req.headers.get('X-Reparo-Key') || '';\n"
         "  let diff = given.length === expected.length ? 0 : 1;\n"
         "  for (let i = 0; i < given.length && i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);\n"
         "  if (!expected || diff !== 0) {\n"),
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    root = pathlib.Path(a.reparo)
    staged = {}
    for rel, pairs in PATCHES.items():
        t = (root / rel).read_text()
        for old, new in pairs:
            if t.count(old) != 1:
                sys.exit(f'{rel}: anchor found {t.count(old)} times: {old[:60]!r}')
            t = t.replace(old, new)
        staged[root / rel] = t
    if a.check:
        print('anchors OK')
        return
    for p, t in staged.items():
        p.write_text(t)
    print(f'patched {len(staged)} files')


if __name__ == '__main__':
    main()
