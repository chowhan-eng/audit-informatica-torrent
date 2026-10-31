import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * cashierPin (auditoría B-55): PIN de 4 cifras para cambiar de cajero en Venta.
 * Antes se guardaba en claro en User.pin y se comparaba en el navegador.
 *   { action: 'list' }                → personas y si tienen PIN (sin el PIN)
 *   { action: 'verify', user_id, pin } → { ok, user } (5 fallos = 5 min bloqueado)
 *   { action: 'set', user_id, pin }    → crea o cambia el PIN (solo el encargado)
 *   { action: 'migrate' }              → pasa los PIN antiguos a hash y borra User.pin (encargado, una vez)
 */
const MAX_FAILS = 5;
const LOCK_MINUTES = 5;
const PIN_RE = /^\d{4}$/;

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 },
    key,
    256,
  );
  return hex(bits);
}

function sameHash(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const itemsOf = (page) => (Array.isArray(page) ? page : page?.items || []);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    const isAdmin = user.role === 'admin';

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const service = base44.asServiceRole;
    const action = String(body.action || 'list');
    const pinsByUser = async () => new Map(itemsOf(await service.entities.CashierPin.filter({}, { limit: 500 })).map((row) => [row.user_id, row]));
    const publicUser = (person) => ({ id: person.id, full_name: person.full_name || '', email: person.email || '', role: person.role || 'user' });
    const audit = (summary, entityId = '') => service.entities.AuditLog.create({
      actor_email: user.email, action: 'cashier_pin', entity: 'CashierPin', entity_id: entityId, summary,
    }).catch(() => null);

    const savePin = async (person, pin, pins, by) => {
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      const data = { user_id: person.id, user_email: person.email || '', pin_hash: await hashPin(pin, salt), salt, failed_attempts: 0, locked_until: '', updated_by: by };
      const existing = pins.get(person.id);
      if (existing) await service.entities.CashierPin.update(existing.id, data);
      else await service.entities.CashierPin.create(data);
    };
    // Old plain-text PINs (User.pin) move to CashierPin the first time the list is opened,
    // so cashiers keep their PIN after the change; the plain copy is then cleared.
    const migrateOld = async (users, pins) => {
      let moved = 0;
      for (const person of users) {
        const old = String(person.pin || '');
        if (!old) continue;
        if (PIN_RE.test(old) && !pins.get(person.id)?.pin_hash) { await savePin(person, old, pins, 'migracion'); moved += 1; }
        await service.entities.User.update(person.id, { pin: '' });
      }
      return moved;
    };

    if (action === 'list') {
      const users = itemsOf(await service.entities.User.list());
      if (users.some((person) => person.pin)) {
        const moved = await migrateOld(users, await pinsByUser());
        if (moved) await audit(`PIN de cajero pasados a hash: ${moved}`);
      }
      const pins = await pinsByUser();
      return Response.json({ users: users.map((person) => ({ ...publicUser(person), has_pin: !!pins.get(person.id)?.pin_hash })) });
    }

    const userId = String(body.user_id || '');

    if (action === 'verify') {
      const person = itemsOf(await service.entities.User.list()).find((item) => item.id === userId);
      const record = (await pinsByUser()).get(userId);
      if (!person || !record?.pin_hash) return Response.json({ ok: false, error: 'Ese cajero todavía no tiene PIN, avisa al encargado' });
      const lockedUntil = record.locked_until ? Date.parse(record.locked_until) : 0;
      if (lockedUntil > Date.now()) {
        return Response.json({ ok: false, error: `Demasiados intentos. Espera ${Math.ceil((lockedUntil - Date.now()) / 60000)} min.` });
      }
      const pin = String(body.pin || '');
      if (PIN_RE.test(pin) && sameHash(await hashPin(pin, record.salt), record.pin_hash)) {
        if (record.failed_attempts) await service.entities.CashierPin.update(record.id, { failed_attempts: 0, locked_until: '' });
        return Response.json({ ok: true, user: publicUser(person) });
      }
      const fails = (Number(record.failed_attempts) || 0) + 1;
      const locked = fails >= MAX_FAILS;
      await service.entities.CashierPin.update(record.id, locked
        ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
        : { failed_attempts: fails });
      if (locked) await audit(`PIN de cajero de ${person.email} bloqueado ${LOCK_MINUTES} min`, record.id);
      return Response.json({ ok: false, error: locked ? `PIN incorrecto. Bloqueado ${LOCK_MINUTES} min.` : 'PIN incorrecto' });
    }

    if (!isAdmin) return Response.json({ error: 'Sólo el encargado' }, { status: 403 });

    if (action === 'set') {
      const pin = String(body.pin || '');
      if (!PIN_RE.test(pin)) return Response.json({ error: 'El PIN tiene 4 cifras' }, { status: 400 });
      const person = itemsOf(await service.entities.User.list()).find((item) => item.id === userId);
      if (!person) return Response.json({ error: 'Esa persona no existe' }, { status: 404 });
      await savePin(person, pin, await pinsByUser(), user.email);
      await audit(`PIN de cajero de ${person.email} guardado`);
      return Response.json({ ok: true });
    }

    if (action === 'migrate') {
      const moved = await migrateOld(itemsOf(await service.entities.User.list()), await pinsByUser());
      await audit(`PIN de cajero pasados a hash: ${moved}`);
      return Response.json({ ok: true, moved });
    }

    return Response.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
