# B-21, B-23, B-38 — WhatsApp Pro quick wins (prepared locally, NOT deployed)

- **B-21 (D-04/D-13).** Automatic replies are allowed only for opening hours and location, enforced in code. The setting `autoreply_topics` defaults to `horario,ubicacion,como_llegar,direccion`. Every other library topic stays a draft, whatever its `automation_level`. The mode stays `shadow` for one week, then `library_autoreply_mode=live` (Joney's OK).
  - **Data step at apply time:** update the `AnswerLibrary` answers for horario (T-09) and ubicación (T-10). Joney gave the Maps link `https://maps.google.com/?q=Calle+Germanies+74+Torrent` and the parking text "Parking público Metro Torrent Avinguda o zona azul cercana".
- **B-23 (D-26).** One escalation level to the admin mobile. Level 2 (60 min) only runs if `escalation_level2_enabled=true`.
- **B-38.**
  - The chat customer panel gets a **Crear reparación** button. It opens Reparo `/tickets/nuevo` with the Reparo client if there is one, or with phone + name.
  - Reparo's new-ticket form reads `?phone=` and `?name=` and links an existing client with that phone (`patch_existing_files.py`; anchor checked against production).
- **WhatsApp Pro code:** patch `0008`.
