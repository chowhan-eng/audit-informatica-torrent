import { base44 } from '@/api/base44Client';

/** Busca en Reparo una orden de reparación para cobrarla (auditoría B-40). */
export const reparoOrderLookup = (payload) => base44.functions.invoke('reparoOrderLookup', payload);
