import { STOCK_ALERT_UNITS } from '../../shared/stockAlerts.ts';
export default async function () {
  return Response.json({ ok: true, units: STOCK_ALERT_UNITS });
}