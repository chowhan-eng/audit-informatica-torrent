# Resumen para Joney (auditoría, 30 oct 2026)

1. **Funciona:** las 4 apps se usan a diario. El WhatsApp de estado sale al minuto, el escáner del TPV va al instante y las ventas no se pueden manipular.
2. **Qué va lento:** el TPV tarda 3–4 s en estar listo (recarga 9.100 artículos cada vez). Buscar en Reparo tarda ~1 s. WhatsApp Pro carga todo de golpe.
3. **Qué falla (urgente):** desde fuera, sin iniciar sesión, se puede enviar WhatsApp con el número de la tienda. El token de Meta está guardado en una tabla. La página de estado enseña las reparaciones de cualquier teléfono.
4. **Qué más falla:** en octubre se perdieron ~220 mensajes de clientes. Una venta reintentada se duplica. El 26 oct salieron 45 avisos "le responderemos al abrir" a chats viejos. No hay copia de seguridad comprobada.
5. **Qué quitar:** restos de HelloClient y Doscar, el segundo sistema de pedidos y la mini-tienda de WhatsApp Pro, la voz, el resumen web por IA, encuestas NPS, chatbot y 8 apps sin uso (TorrentConnect se queda).
6. **Qué añadir:** botón "Cobrar en TPV" desde Reparo, "Crear reparación" desde el chat, y un buscador con panel "Hoy" en Mostrador. Ahorro estimado: 20–35 minutos al día.
7. **Mensajes a clientes:** avisos de "esperando pieza" y "pieza recibida", recordatorio de presupuesto, avisos de "sin recoger" a los 3, 7 y 15 días (solo equipos nuevos), y textos para envíos. Contestación automática solo de horario y ubicación.
8. **Base de conocimiento:** limpiar las respuestas falsas o peligrosas (24/7, descargas), dejar una sola lista de precios y no mandar nunca datos de clientes sin anonimizar a la IA.
9. **Qué hacer primero (semana 1):** cerrar los accesos sin login, cambiar el token, arreglar la pérdida de mensajes, poner un interruptor para pausar todos los avisos y empezar la copia de seguridad diaria.
10. **Después:** semana 2, arreglos rápidos y limpieza. Semana 3, avisos nuevos (una semana en prueba antes). Semana 4, "Cobrar en TPV", resumen de la mañana por email y control de salud.
11. **Cuánto cuesta al mes:** créditos de Base44 de ~2.980 a ~900 (−70 %). WhatsApp de Meta de ~6 € a ~10 € por los avisos nuevos. Sigue dentro del plan actual de 50 USD.
12. **Lo que necesito de ti:** confirmar FRP/ROMs (redacción ambigua); decisión de la gestoría sobre las facturas F 2600408–411 y la cláusula de custodia; quién es cajero; los precios de los 10 modelos; el OK al texto de envíos.
13. **Durante la auditoría solo se hicieron 2 cambios**, los dos aprobados por ti (contador de facturas y parar las encuestas NPS). No se ha escrito a ningún cliente.
14. Detalle técnico en `audit/REPORT.md` y la lista de tareas (64) en `audit/BACKLOG.csv`.
15. **Espero tu aprobación para empezar por la semana 1.**
