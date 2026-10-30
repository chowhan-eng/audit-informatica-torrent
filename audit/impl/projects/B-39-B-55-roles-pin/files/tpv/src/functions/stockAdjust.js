import { invokeWithUnlock } from '@/lib/adminLock';

/** Ajusta existencias y deja el movimiento registrado (exige el PIN del encargado, B-55). */
export const stockAdjust = (payload) => invokeWithUnlock('stockAdjust', payload);
