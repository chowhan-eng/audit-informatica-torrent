import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Bloqueo por PIN de las zonas de encargado (Artículos, Compras, Proveedores,
 * Unidades, Informes, Ajustes y Stock). El PIN se comprueba en el servidor
 * (función adminPin), que entrega un pase de 30 min (auditoría B-55). Aquí se
 * guarda el pase en esta pestaña y hasta cuándo sigue desbloqueado; se vuelve a
 * bloquear tras unos minutos sin usar esas zonas. Stock, compras y facturas
 * rectificativas exigen el pase también en el servidor.
 */
export const LOCKED_ROUTES = ['/articulos', '/compras', '/proveedores', '/unidades', '/informes', '/ajustes', '/stock'];
export const UNLOCK_MINUTES = 5;
const KEY = 'tpv_admin_unlocked_until';
const TOKEN_KEY = 'tpv_admin_unlock_token';

export const adminPin = (payload) => base44.functions.invoke('adminPin', payload).then((res) => res.data);

const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

const readUntil = () => {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};

export const isUnlocked = () => readUntil() > Date.now() && !!getUnlockToken();

/** Pase del servidor para las funciones protegidas ('' si no hay). */
export function getUnlockToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Desbloquea (o alarga el desbloqueo) durante UNLOCK_MINUTES; con pase nuevo, lo guarda. */
export function touchUnlock(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(KEY, String(Date.now() + UNLOCK_MINUTES * 60000));
  } catch {
    // Sin sessionStorage hay que meter el PIN cada vez: es lo más seguro.
  }
  emit();
}

export function lockNow() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // nada
  }
  emit();
}

/**
 * Llama a una función protegida con el pase. Si el servidor responde 423 (pase
 * caducado o ausente), se vuelve a pedir el PIN.
 */
export function invokeWithUnlock(name, payload) {
  return base44.functions.invoke(name, { ...(payload || {}), _unlock: getUnlockToken() }).catch((error) => {
    if (error?.response?.status === 423 || error?.status === 423) lockNow();
    throw error;
  });
}

/** Estado reactivo del bloqueo; se re-evalúa cada 15 s para que caduque solo. */
export function useAdminLock() {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  useEffect(() => {
    const update = () => setUnlocked(isUnlocked());
    listeners.add(update);
    const timer = setInterval(update, 15000);
    return () => {
      listeners.delete(update);
      clearInterval(timer);
    };
  }, []);
  return unlocked;
}
