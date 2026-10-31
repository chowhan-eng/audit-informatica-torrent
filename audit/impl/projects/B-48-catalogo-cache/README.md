# B-48 — TPV catalogue cache (prepared locally, NOT deployed)

- The catalogue is stored in IndexedDB.
- On return visits only products changed since the last sync are downloaded.
- A full reload happens every 12 h or after an error.
- Expected: `/venta` and `/tpv` ready in < 1 s on a repeat visit, instead of 2.8–3.8 s.
- Deleted products stay cached until the next full reload. Products are archived with `active`, not deleted.
- Files: `files/tpv/src/lib/venta/catalogCache.js` and `patch_existing_files.py`.
