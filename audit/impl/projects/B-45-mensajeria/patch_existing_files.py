"""B-45 mail-in (Reparo side). WhatsApp Pro side: patch 0014.

    python3 patch_existing_files.py --reparo <root> [--check]

notifyWhatsApp sends the carrier and tracking number taken from the custom fields
«Transportista» and «Nº de seguimiento» (create them at deploy, see README).
"""
import argparse
import pathlib
import sys

PATCHES = {
    'base44/functions/notifyWhatsApp/entry.ts': [
        ("const nowIso = () => new Date().toISOString();\n",
         "const nowIso = () => new Date().toISOString();\n\n"
         "// B-45: carrier and tracking number for the «Enviado al cliente» WhatsApp (T-08),\n"
         "// read from the custom fields «Transportista» and «Nº de seguimiento».\n"
         "async function mailInFields(sr: any, o: any) {\n"
         "  try {\n"
         "    const fields = await sr.ShopField.filter({ name: { $in: ['Transportista', 'Nº de seguimiento'] } });\n"
         "    const by = (name: string) => (fields || []).find((f: any) => f.name === name)?.hc_id;\n"
         "    const value = (name: string) => { const id = by(name); return id ? String((o.fields || {})[id] || '') : ''; };\n"
         "    return { carrier: value('Transportista'), tracking: value('Nº de seguimiento') };\n"
         "  } catch { return {}; }\n"
         "}\n"),
        ("      executor_name: o.executor_name,\n    };\n",
         "      executor_name: o.executor_name,\n      ...(await mailInFields(sr, o)),\n    };\n"),
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
