# Clean-up: HelloClient and Doscar (B-16, B-17, B-18, B-19, B-20; B-62 staged)

| App | Change | Where |
|---|---|---|
| Reparo | The 5-min workflow no longer runs `syncHelloClient`; WhatsApp sweep only, every 15 min Mon–Sat 9–20 (B-16, ≈ −1,050 credits/month) | `patch_existing_files.py` (JSON edit) |
| Reparo | Configuración hides «Importar HelloClient» and «Paso a Reparo»; Datos drops the HelloClient sync card (B-18) | same |
| TPV | Ajustes hides «Restaurar desde Doscar» (B-18). Doscar history stays (legal retention) | same |
| WhatsApp Pro | masterTick every 10 min. pollHelloClient, watchdog, libraryShadowReport, sendNPS and processBroadcasts are no longer run (B-17) | patch `0005` |
| WhatsApp Pro | Hidden: «Importar HelloClient», «Escanear HelloClient», Pedidos/Ventas/Inventario/Tareas (B-18, B-19) | patch `0005` |
| WhatsApp Pro | Voice queue behind `voice_enabled`; weekly content-signals workflow removed (B-20) | patch `0005` |

**Deletion.** Nothing is deleted now. `DELETE_AFTER_30_DAYS.md` lists what B-62 removes after 30 days hidden.

**Apply check.** In each app's Base44 Workflows screen, confirm that no legacy HelloClient/NPS/broadcast workflow is still active.
