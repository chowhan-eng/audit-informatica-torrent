# B-50 — Reparo search fast path (prepared locally, NOT deployed)

In the ticket search box:
- an order number (1–7 digits) is an exact match;
- a phone (9–13 digits, with or without +34 and spaces) is an exact match on the customer phones;
- an IMEI (14–17 digits) is a prefix match on the IMEI field;
- text keeps the existing search.

The "single tab-counts endpoint" part is not done.

File: `patch_existing_files.py` (`listQuery.js`). The anchor was copied from production.
