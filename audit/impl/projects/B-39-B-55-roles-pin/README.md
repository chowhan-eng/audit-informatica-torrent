# B-55 TPV PIN in the server + hashed cashier PIN; B-39 permissions (prepared locally, NOT deployed)

**B-55 — TPV.**
- **Before:** the manager PIN was checked by the server, but the "unlocked" state lived only in the browser. Anyone who could edit the browser storage skipped it.
- **Now:** `adminPin` hands out a 30-min **pass**, stored hashed in `AdminUnlock`.
  - `stockAdjust`, `receivePurchase` and `rectifyInvoice` refuse a manager call without a valid pass (HTTP 423). The screen then asks for the PIN again.
  - **Artículos** (prices) moves behind the PIN together with Stock (SEC-14).
- **Cashier PIN:**
  - **Before:** stored in plain text in `User.pin` and compared in the browser, so every cashier could read everyone's PIN.
  - **Now:** new `cashierPin` function and `CashierPin` entity (PBKDF2 + salt, server-only). 5 wrong attempts lock it for 5 min.
  - `CajeroDialog` and the Ajustes users panel use it.
- **Cajero role:** stays the existing non-admin role. Server rules already in place: fixed prices, maximum discount, no free lines, no admin functions. **Who is a cajero is Joney's decision (D-35).**
- **Not covered by the pass:** product edits from the sales screen (quick create), so selling is never blocked. Entity writes from the browser (Settings, Product) still need B-36 (server-only money writes).

**B-39 — permissions.**
- WhatsApp Pro, patch `0007`:
  - `UserProfile` create/update/delete become **admin-only**. A user could approve themselves before. Profiles are created by `saveUserProfile` (service role) and edited only on the admin Usuarios page.
  - Hard deletes of `Messages`, `Customers` and `Conversations` become admin-only. The app soft-deletes.
- Reparo: deleting orders and clients becomes admin-only (it was possible for any staff account).

**Apply steps.**
1. Apply after B-12.
2. Run `patch_existing_files.py --check`, then apply.
3. Copy `files/`.
4. Then, as admin: call `cashierPin {action:'migrate'}` once. It hashes the existing 4-digit PINs and clears `User.pin`.
5. Tests:
   - wrong cashier PIN ×5 → locked;
   - stock adjust without PIN → asks for PIN;
   - a non-admin WhatsApp Pro account cannot change its own approval.

**Tests done locally.** Anchors checked against production. Mock files patched and syntax-checked (9 files). The cashier and unlock logic follows the existing `adminPin` code.
