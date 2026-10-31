# Progress handoff — continue from here (31 Oct 2026)

**Golden rule:** zero deploys, zero secret changes, zero restarts in Base44 until Joney says so (D-39). Everything is local.

## Where things are
- **Audit repo:** `audit-informatica-torrent`, branch `claude/fase-4-seguridad-datos-p25zc2`.
  - Docs: `audit/DECISIONS.md` (D-01…D-42), `audit/impl/DEPLOY.md` (order, secrets, data steps, tests), `audit/impl/BACKLOG_STATUS.md`, `audit/INFORME_FINAL_JONEY.md`.
  - Code for Reparo / TPV / Mostrador: `audit/impl/projects/*/files/` (new files) + `patch_existing_files.py` in each project. Each script has anchors checked against production; run with `--check` first.
  - Production snapshots and B-05: `audit/impl/src/`.
- **WhatsApp Pro:** patches `audit/impl/week1/patches/0001…0015` on production main 8d595b9 (`git am`). The local clone `/home/user/whatsapp-inbox-pro` (branch `local/week1-patches`, push disabled) exists only in this session; the patches are the source of truth.
- **Production heads (unchanged):** WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563.

## Status
- 2 LIVE, 51 READY, 8 WAITING (Joney / gestoría / platform), 2 TODO, 1 SKIPPED (B-63, D-06).
- 31 Oct extras done: D-40 FRP, D-41 tutorials (KB JSON), D-42 voice alert + Asistente page.
- **Not done** in the 31 Oct batch: loading the new KB entries into the production table. A data write takes effect immediately, so it is left for the deploy (file: `projects/extra-wizard-voz-frp/kb/`).

## TODO items (not programmed yet)
B-36, B-52

- **B-36 (money/numbering server-only in the TPV)** — large. Move these writes to functions and then lock the entities: `Voucher` create (VoucherDialog), `Deposit` create (NuevaSenalDialog, ideally inside completeSale), `Invoice`/`Counter` create, `Product` price/stock updates (via `updateProduct`/`stockAdjust` only), `AuditLog` create (OrderDialog, PendientesPanel).
- **B-52 (shared helpers)** — refactor with no behaviour change: one shop-hours helper, one LLM call and one phone normaliser per app (≥ 8 copies today). Do it after the deploy is stable, so that it is not mixed with real changes.

How to do each one: see `audit/BACKLOG.csv` (acceptance criteria). Read only the files you need with targeted greps; put the code in `audit/impl/projects/<item>/` (new files + anchored patch script); WhatsApp Pro changes as a new `00NN` patch.

## Next steps when Joney is ready
1. B-03 token (Joney) → test to +34 658 … 734.
2. `audit/impl/DEPLOY.md` step by step. Reparo/TPV extra projects, run last and in this order: extra-wizard-voz-frp, batch-tpv-reparo-1031, B-45-mensajeria, B-48-catalogo-cache, B-50-busqueda-reparo, B-51-B-53-B-31 (WhatsApp Pro patches 0001–0015; Reparo also gets `projects/extra-wizard-voz-frp`).
3. One week later: `reminders_live=true`, `library_autoreply_mode=live`, `retention_live=true`.

- New secret for batch-tpv-reparo-1031: `DOC_LINK_SECRET` (TPV). Add it to DEPLOY.md §2 at deploy time.
