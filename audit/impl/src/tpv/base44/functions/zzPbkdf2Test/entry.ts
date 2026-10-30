export default async function () {
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('1234'), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('abc'), iterations: 100000 }, key, 256);
    return Response.json({ ok: true, len: bits.byteLength });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
}