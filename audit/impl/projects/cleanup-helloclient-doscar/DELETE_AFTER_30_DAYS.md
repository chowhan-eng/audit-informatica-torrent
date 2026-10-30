# B-62 — Code to delete 30 days after it was hidden

AUDIT rule: hide first, delete later. These files have **no caller and no schedule** once the clean-up patches are applied. Delete them 30 days after go-live, with Joney's OK, as a separate commit per app. Run `grep` for each name first to confirm 0 callers.

| App | Delete | Why it is dead |
|---|---|---|
| WhatsApp Pro | `functions/pollHelloClient`, `helloClientLogin`, `hcImportBatch`, `watchdog`, `libraryShadowReport`, `sendNPS`, `processBroadcasts`, `syncMessages`, `flowExecutor`, `ingest*`, `buildContentSignals` | unscheduled (masterTick B-17) or unused since cut-over |
| WhatsApp Pro | `pages/ImportarHelloClient.jsx` + its route, `pages/Pedidos*`, `Ventas`, `Inventario`, `Tareas` + routes, Dashboard `handleScan` code | hidden (B-18/B-19) |
| WhatsApp Pro | legacy workflow files `pollHelloClient_every_15min`, `watchdog_every_60min`, `Send NPS Surveys`, `Process Broadcast Campaigns` | check in the Base44 Workflows screen that they are inactive; delete the files |
| Reparo | `functions/syncHelloClient`, `components/config/HcSyncCard.jsx`, `pages/config/Importar.jsx`, `pages/config/Cambio.jsx`, `lib/shop/hcImport.js` | cut over; menu entries hidden (B-18) |
| Reparo | secret `HC_SESSION_FULL` (in WhatsApp Pro) | revoke the HelloClient session, then delete the secret (B-18) |
| TPV | `functions/helloClientLookup` + `src/functions/helloClientLookup.js` | replaced by `reparoOrderLookup` (B-40) |
| TPV | `components/doscar/DoscarRestore.jsx`, `RestorePanel`, `BackupPanel`, `ExcelPanel`, `VerifyPanel`, `PlanPreview`, `ImportOptions`, `lib/doscar/*` restore parts | Doscar import finished; Ajustes entry hidden |
| TPV | **Keep:** `HistoricSale`, the «Histórico Doscar» tab and `doscar_codes` search | legal retention of old sales/invoices; barcodes still printed on stock |
