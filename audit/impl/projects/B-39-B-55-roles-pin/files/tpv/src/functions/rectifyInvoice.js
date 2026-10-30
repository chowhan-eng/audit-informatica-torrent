import { invokeWithUnlock } from '@/lib/adminLock';

/** Emite una factura rectificativa (exige el PIN del encargado, B-55). */
export const rectifyInvoice = (payload) => invokeWithUnlock('rectifyInvoice', payload);
