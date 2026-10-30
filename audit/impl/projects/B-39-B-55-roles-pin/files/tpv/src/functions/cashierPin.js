import { base44 } from '@/api/base44Client';

/** PIN de cajero, comprobado en el servidor (auditoría B-55). */
export const cashierPin = (payload) => base44.functions.invoke('cashierPin', payload);
