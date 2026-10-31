# Progress handoff — continue from here (31 Oct 2026)

**Golden rule:** zero deploys, zero secret changes, zero restarts in Base44 until Joney says so (D-39). Everything is local.

## Where things are
- **Audit repo:** `audit-informatica-torrent`, branch `claude/fase-4-seguridad-datos-p25zc2`.
  - Docs: `audit/DECISIONS.md` (D-01…D-42), `audit/impl/DEPLOY.md` (order, secrets, data steps, tests), `audit/impl/BACKLOG_STATUS.md`, `audit/INFORME_FINAL_JONEY.md`.
  - Code for Reparo / TPV / Mostrador: `audit/impl/projects/*/files/` (new files) + `patch_existing_files.py` in each project. Each script has anchors checked against production; run with `--check` first.
  - Production snapshots and B-05: `audit/impl/src/`.
- **WhatsApp Pro:** patches `audit/impl/week1/patches/0001…0010` on production main 8d595b9 (`git am`). The local clone `/home/user/whatsapp-inbox-pro` (branch `local/week1-patches`, push disabled) exists only in this session; the patches are the source of truth.
- **Production heads (unchanged):** WhatsApp Pro 8d595b9, Reparo 686fe92, TPV bf4c563.

## Status
- 2 LIVE, 29 READY, 8 WAITING (Joney / gestoría / platform), 25 TODO.
- 31 Oct extras done: D-40 FRP, D-41 tutorials (KB JSON), D-42 voice alert + Asistente page.
- **Not done** in the 31 Oct batch: loading the new KB entries into the production table. A data write takes effect immediately, so it is left for the deploy (file: `projects/extra-wizard-voz-frp/kb/`).

## TODO items (not programmed yet)
B-11, B-25, B-26, B-27, B-28, B-29, B-30, B-31, B-32, B-33, B-36, B-37, B-45, B-46, B-48–B-50, B-51, B-52, B-53, B-56, B-57, B-59, B-63, B-64

How to do each one: see `audit/BACKLOG.csv` (acceptance criteria). Read only the files you need with targeted greps; put the code in `audit/impl/projects/<item>/` (new files + anchored patch script); WhatsApp Pro changes as a new `00NN` patch.

## Next steps when Joney is ready
1. B-03 token (Joney) → test to +34 658 … 734.
2. `audit/impl/DEPLOY.md` step by step (WhatsApp Pro patches 0001–0010; Reparo also gets `projects/extra-wizard-voz-frp`).
3. One week later: `reminders_live=true`, `library_autoreply_mode=live`, `retention_live=true`.
