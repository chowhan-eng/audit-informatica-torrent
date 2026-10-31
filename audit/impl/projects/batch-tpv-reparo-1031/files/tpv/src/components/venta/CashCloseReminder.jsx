import React, { useEffect, useState } from 'react';

/** Aviso discreto para cerrar la caja (auditoría B-32): 20:15 de lunes a viernes y 13:45 el sábado, si sigue abierta. */
function closingTime(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(now).map((part) => [part.type, part.value]));
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  if (parts.weekday === 'Sun') return false;
  return parts.weekday === 'Sat' ? minutes >= 13 * 60 + 45 : minutes >= 20 * 60 + 15;
}

export default function CashCloseReminder({ session }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!session || !closingTime(now)) return null;
  return (
    <div className="shrink-0 bg-amber-100 px-3 py-1.5 text-center text-sm font-bold text-amber-900">
      Es hora de cerrar la caja: Caja → Cierre (Z).
    </div>
  );
}
