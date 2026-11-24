// Web Push sender (server only) – VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291),
// using Node's built-in crypto, so no extra package is needed.
// -------------------------------------------------------------------
// Env (generate with `npm run push:keys`):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY – base64url, 65-byte uncompressed P-256 public key
//   VAPID_PRIVATE_KEY            – base64url, 32-byte private key
//   VAPID_SUBJECT                – mailto:you@example.com (optional, falls back to the contact email)
// -------------------------------------------------------------------
import crypto from 'crypto';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number | null; error: string };

const b64u = {
  enc: (b: Buffer) => b.toString('base64url'),
  dec: (s: string) => Buffer.from(s, 'base64url'),
};

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let signingKey: crypto.KeyObject | null = null;
function vapidKey(): crypto.KeyObject {
  if (signingKey) return signingKey;
  const pub = b64u.dec(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not an uncompressed P-256 key');
  signingKey = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY!, x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  return signingKey;
}

function vapidAuthHeader(endpoint: string): string {
  const aud = new URL(endpoint).origin;
  const sub = process.env.VAPID_SUBJECT || 'mailto:support@lostfound.example.com';
  const header = b64u.enc(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u.enc(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: vapidKey(), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${payload}.${b64u.enc(sig)}, k=${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`;
}

/** RFC 8291 aes128gcm encryption of one record. */
function encrypt(sub: PushSubscriptionKeys, plaintext: Buffer): Buffer {
  const uaPublic = b64u.dec(sub.p256dh);
  const authSecret = b64u.dec(sub.auth);
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 = padding delimiter for the last (only) record.
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Send one push message. `gone` = the subscription no longer exists and should be deleted. */
export async function sendPush(sub: PushSubscriptionKeys, payload: unknown, opts: { ttlSeconds?: number; urgency?: 'normal' | 'high' } = {}): Promise<PushResult> {
  if (!pushConfigured()) return { ok: false, gone: false, status: null, error: 'not_configured' };
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthHeader(sub.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttlSeconds ?? 24 * 3600),
        Urgency: opts.urgency ?? 'normal',
      },
      body: new Uint8Array(encrypt(sub, Buffer.from(JSON.stringify(payload)))),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status, error: (await res.text().catch(() => '')).slice(0, 200) };
  } catch (e: any) {
    return { ok: false, gone: false, status: null, error: String(e?.message ?? e) };
  }
}
