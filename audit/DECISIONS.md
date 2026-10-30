# Decisions by Joney (recorded during the audit)

Decisions are recorded here as they are taken. Nothing below has been executed yet: per AUDIT.md §4 rule 1 the apps stay read-only until Joney approves the final report (Phase 9); each item then goes into an implementation batch (AUDIT.md §7). Hidden features stay hidden 30 days before code removal; data is archived, never deleted.

## 2026-10-30 — Phase 5 answers

| # | Question | Decision (Joney, in chat) | Backlog items affected | Action after approval |
|---|---|---|---|---|
| D-01 | HelloClient and Doscar migration finished? | **Yes, finished. Importers can be hidden.** | U-07, U-17, U-31, U-42 | Hide HC importers (Reparo `/configuracion/importar`, cutover screens; WA Pro `/importar-helloclient`, `/importar`, Dashboard "Escanear HelloClient"), Doscar restore tab in TPV Ajustes; remove HC jobs from schedulers; revoke `HC_SESSION_FULL`. Remove code after 30 days. |
| D-02 | TPV purchasing and buy-from-customer used? | **Not used for now. Hide them (behind Ajustes).** | U-45, U-46 | Hide `/compras`, `/proveedores`, `/unidades` from the menu; reachable only from Ajustes (admin + PIN). Keep code and data (Supplier rows). |
| D-03 | Voice alerts and weekly website content feed needed? | **No. Disable the voice queue and the weekly AI summary.** | U-15, U-16 | Stop writing `VoiceQueue` and the voice translation in `processAlerts`; pause workflow "Build Content Signals" (keep `exportContentSignals` returning the last cached feed until removal). |
| D-04 | Which WhatsApp topics may auto-reply? | **Only "Horario" and "Ubicación / Cómo llegar", with reviewed and approved texts. Everything else: draft only, staff reviews and sends.** | U-11 (+ Phase 7/8) | Enable live only for the two topics; all other topics `draft_only`. **Blocking:** the two texts must be drafted by the auditor from approved data and approved by Joney before go-live (business data is not invented — AUDIT §4 rule 4). Note the hours mismatch found in Phase 1 (configured 09:30–14 / 17–20:30 vs stated 09–14 / 16–21) must be resolved first, because the "Horario" reply would publish it. |
| D-05 | Archive inactive apps? | **Yes, archive the 7 inactive apps. "Inventario Visual Torrent" is not used either.** | U-52 | Archive (not delete) 8 apps: RepairTrack Pro, SyncRepair, App Hub, Informática Torrent Companion, Informática Torrent Portal, InventoryPro, SUDO Command Center, Inventario Visual Torrent. **TorrentConnect** (1 event) was in the "activity" group, not the 7, so it stays until Joney confirms. Before archiving, check each app's published URL is not linked from the website or Mostrador. |

### Open from D-04 (for Joney)
- Confirm the real opening hours (Mon–Fri 09–14 / 16–21? Saturday hours?) so the "Horario" text and `shop_hours` can be fixed in one go.
- Confirm the "Cómo llegar" content (address is known: C/ Germanies 74 bajo, 46900 Torrent; parking/transport details only if Joney provides them).
