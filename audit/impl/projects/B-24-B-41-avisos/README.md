# B-24, B-41, B-42 — New customer WhatsApp notices (prepared locally, NOT deployed)

All texts were approved by Joney in Phase 7 (T-01…T-05). They go out from WhatsApp Pro. Outside the 24 h window, the approved utility template `actualizacion_taller2` is used.

| Notice | When | Text |
|---|---|---|
| **Esperando material** (B-24) | the order changes to "Esperando Material" (1 min debounce, as today) | T-01 |
| **Pieza recibida** (B-24) | the order changes to the new status "Pieza recibida" | T-02 |
| **Sin recoger, day 3** (B-41) | 10:30 Mon–Sat, 3 days after the order became "listo" | T-04 (address and hours) |
| **Sin recoger, days 7 and 15** (B-41) | same run | T-05 |
| **Presupuesto sin respuesta** (B-42) | 10:30, budget sent > 24 h and < 7 days ago, with an amount, customer has not written since | T-03 |

**Safety.**
- **Old backlog excluded:** only orders that become "listo" after go-live get `ready_at`. The 1,500–3,000 old ready orders never receive reminders.
- **No duplicates:** each reminder is recorded on the order (kind + reference date). A missed day never sends two reminders at once.
- **Shadow week:** until WhatsApp Pro setting `reminders_live = true`, reminders are only logged ("prueba (no enviado)"). Joney reviews the list, then switches it on (AUDIT §6.5).
- **Pause:** the global pause (B-10) stops all of them.
- **Status menu:** shows 💬 next to every status that messages the customer (D-09).
- **Not included:** the final custody notice T-06 waits for the gestoría's legal text (D-14).

**Files.**
- **New (Reparo):** `customerReminders` function + workflow 10:30 Mon–Sat; `lib/shop/whatsappStatuses.js`.
- **Changed (Reparo):** `patch_existing_files.py` (`RepairOrder` fields, `changeStatus`, status menu). Apply after B-40.
- **WhatsApp Pro:** patch `0006` (`reparoBridge`: T-01/T-02 and the `reminder` action).

**Data step at apply time.** Create the status in Reparo → Configuración → Estados:
- name: **Pieza recibida**
- group: in progress
- colour: teal
- position after "Esperando Material"

**Tests done locally (mocks).**
- Day 2: nothing. Day 3: T-04. Day 8: T-05. Day 20: T-05 (day 15).
- Old order without `ready_at`: nothing.
- Budget without an amount: nothing.
- Shadow mode: not recorded as sent.
- Second run the same day: nothing. Anonymous call: skipped.
- Status classification checked for all 14 statuses.
