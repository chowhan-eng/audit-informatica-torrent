import { invokeWithUnlock } from '@/lib/adminLock';

/** Recibe la mercancía de un pedido a proveedor (exige el PIN del encargado, B-55). */
export const receivePurchase = (payload) => invokeWithUnlock('receivePurchase', payload);
