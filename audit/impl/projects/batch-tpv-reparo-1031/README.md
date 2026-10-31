# TPV + Reparo batch (31 Oct) — prepared locally, NOT deployed

| Item | Change |
|---|---|
| B-25 | Reparo: «Tarjeta SIM» / «Bandeja Sim» required only when brand/model look like a phone or tablet (`rules.js`, new-ticket form, closing check) |
| B-26 | TPV Informes: 100,000-row limit instead of 3,000 |
| B-27 | TPV customer search: «+34 619 48 09 04» finds 619480904 |
| B-28 | TPV táctil: the catalogue load retries 4 times and shows an error instead of spinning forever |
| B-29 | TPV: no more permanent public PDF copies. Links are signed and last 7 days (`publicDoc`, `shared/docLink.ts`). **New secret `DOC_LINK_SECRET`** (random). Without it, the 1-hour link is used |
| B-30 | Reparo: atomic order numbers (`allocateOrderNumber`, counter in SystemSettings `order_counter`); the old method stays as a fallback |
| B-32 | TPV táctil: banner «Es hora de cerrar la caja» at 20:15 Mon–Fri and 13:45 Sat while the cash session is open |
| B-59 | TPV menu: Compras, Proveedores and Unidades hidden; the screens stay at /compras, /proveedores and /unidades |

Apply: copy `files/`, then run `patch_existing_files.py --check`, then apply. Run this batch **last** of all project scripts. Anchors were checked against production with grep.
