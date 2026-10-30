"""B-38 Reparo side: /tickets/nuevo?phone=…&name=… (from the WhatsApp chat button).

    python3 patch_existing_files.py --reparo <root> [--check]

WhatsApp Pro side (button, B-21, B-23) is patch 0008.
"""
import argparse
import pathlib
import sys

OLD = "    if (cid) base44.entities.Client.get(cid).then(linkClient).catch(() => {});\n"
NEW = OLD + """    // B-38: «Crear reparación» from a WhatsApp chat: phone (+ name) prefilled and an
    // existing client with that phone linked, so nothing is typed twice.
    const phoneParam = sp.get('phone'); const nameParam = sp.get('name');
    if (!cid && phoneParam) {
      const digits = phoneParam.replace(/\\D/g, '');
      const local = digits.startsWith('34') && digits.length === 11 ? digits.slice(2) : digits;
      setC((x) => ({ ...x, phone: x.phone || local, name: x.name || nameParam || '' }));
      const variants = [...new Set([digits, local, `34${local}`, `+34${local}`])];
      base44.entities.Client.filter({ $or: [{ phone: { $in: variants } }, { phones: { $in: variants } }] })
        .then((rows) => { if (rows?.[0]) linkClient(rows[0]); }).catch(() => {});
    }
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    path = pathlib.Path(args.reparo) / 'src/components/tickets/NewTicketDrawer.jsx'
    text = path.read_text()
    if text.count(OLD) != 1:
        sys.exit(f'NewTicketDrawer.jsx: anchor found {text.count(OLD)} times (expected 1)')
    if args.check:
        print('anchors OK in 1 file')
        return
    path.write_text(text.replace(OLD, NEW))
    print('patched 1 file')


if __name__ == '__main__':
    main()
