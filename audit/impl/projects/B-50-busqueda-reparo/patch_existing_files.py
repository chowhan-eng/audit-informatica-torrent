"""B-50 Reparo search fast path (numbers and phones use exact, indexed matches).

    python3 patch_existing_files.py --reparo <root> [--check]
"""
import argparse
import pathlib
import sys

OLD = """    const rx = { $regex: esc(s), $options: 'i' };
    const or = [
      { customer_name: rx }, { device_brand: rx }, { device_model: rx }, { averia: rx },
      { client_dni: rx }, { order_id: s },
      { [`fields.${FIELD_IMEI}`]: rx }, { [`fields.${FIELD_MODELO}`]: rx },
    ];
    const digits = s.replace(/\\D/g, '');
    if (digits.length >= 4) or.push({ customer_phone: { $regex: digits } });
    and.push({ $or: or });
"""
NEW = """    const digits = s.replace(/\\D/g, '');
    const onlyDigits = /^[\\d\\s+().-]+$/.test(s);
    // B-50 fast path: an order number, a phone or an IMEI is an exact lookup instead
    // of a regex over eight fields (≈ 0.9 s → well under that).
    if (onlyDigits && digits.length >= 1 && digits.length <= 7) {
      and.push({ order_id: digits });
    } else if (onlyDigits && digits.length >= 9 && digits.length <= 13) {
      const local = digits.startsWith('34') && digits.length === 11 ? digits.slice(2) : digits;
      const variants = [...new Set([digits, local, `34${local}`, `+34${local}`])];
      and.push({ $or: [{ customer_phone: { $in: variants } }, { client_phones: { $in: variants } }] });
    } else if (onlyDigits && digits.length >= 14 && digits.length <= 17) {
      and.push({ [`fields.${FIELD_IMEI}`]: { $regex: `^\\\\s*${digits}` } });
    } else {
      const rx = { $regex: esc(s), $options: 'i' };
      const or = [
        { customer_name: rx }, { device_brand: rx }, { device_model: rx }, { averia: rx },
        { client_dni: rx }, { order_id: s },
        { [`fields.${FIELD_IMEI}`]: rx }, { [`fields.${FIELD_MODELO}`]: rx },
      ];
      if (digits.length >= 4) or.push({ customer_phone: { $regex: digits } });
      and.push({ $or: or });
    }
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reparo', required=True)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    p = pathlib.Path(a.reparo) / 'src/lib/shop/listQuery.js'
    t = p.read_text()
    if t.count(OLD) != 1:
        sys.exit(f'listQuery.js: anchor found {t.count(OLD)} times')
    if a.check:
        print('anchors OK')
        return
    p.write_text(t.replace(OLD, NEW))
    print('patched 1 file')


if __name__ == '__main__':
    main()
