# B-51, B-53, B-31 (prepared locally, NOT deployed)

- **B-51.** Reparo `orders.js` re-reads the ticket history just before every write (status change, comment, edit, file). Two people editing the same ticket no longer lose each other's events. A fully separate append-only log entity is left for later.
- **B-53.**
  - Reparo `ActionLog`: staff can add rows but not edit or delete them.
  - TPV `AuditLog`: rows can never be edited or deleted from the browser; only admins read it. Creating stays open because Compras and Pendientes still write from the browser (B-36).
- **B-31 (partial).** `estado-for-Estado-app.html` is the B-05 status page, ready to commit into the Estado app source as `public/estado.html`, so a rebuild of Estado cannot wipe it. `resena.html` must first be downloaded from the live Estado host (it is not in any source) and added next to it.
