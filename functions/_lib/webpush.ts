/**
 * Web Push (RFC 8291 aes128gcm payload encryption + RFC 8292 VAPID) implemented
 * with the Web Crypto API, so it runs on the Cloudflare Workers runtime.
 *
 * The `web-push` npm package relies on Node's `https`/`crypto` and does NOT run
 * on Workers; this module is the standard-compliant replacement.
 */

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  /** base64url, uncompressed P-256 public point (65 bytes, 0x04 || X || Y) */
  publicKey: string;
  /** base64url, raw P-256 private scalar (32 bytes) */
  privateKey: string;
  /** e.g. "mailto:moneymate@example.com" */
  subject: string;
}

// ---- base64url helpers ----
function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// ---- HKDF via HMAC-SHA256 (single-block expand, len <= 32) ----
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, data);
  return new Uint8Array(sig);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);                       // extract
  const t = await hmacSha256(prk, concat(info, new Uint8Array([1]))); // expand (1 block)
  return t.slice(0, length);
}

// ---- VAPID JWT (ES256) ----
async function buildVapidJwt(audience: string, vapid: VapidKeys): Promise<string> {
  const pub = b64urlToBytes(vapid.publicKey); // 65 bytes
  const d = vapid.privateKey;
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = bytesToB64url(utf8(JSON.stringify({ aud: audience, exp, sub: vapid.subject })));
  const signingInput = `${header}.${payload}`;

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput));
  // Web Crypto returns raw r||s (64 bytes) — exactly the JWS ES256 format.
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ---- aes128gcm payload encryption (RFC 8291) ----
async function encryptPayload(
  payload: Uint8Array,
  uaPublicB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(uaPublicB64);   // 65 bytes
  const authSecret = b64urlToBytes(authSecretB64); // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Ephemeral (application server) ECDH keypair
  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey)); // 65 bytes

  // ECDH shared secret (X coordinate, 32 bytes)
  const uaPublicKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeyPair.privateKey, 256);
  const ecdhSecret = new Uint8Array(ecdhBits);

  // Combine: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0"||ua_public||as_public, 32)
  const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // Content encryption key + nonce (RFC 8188)
  const cek = await hkdf(salt, ikm, concat(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(utf8('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  // Single record: plaintext || 0x02 delimiter (last record)
  const padded = concat(payload, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // aes128gcm content-coding header: salt(16) | rs(4) | idlen(1) | keyid(=as_public, 65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concat(header, ct);
}

export interface SendResult {
  ok: boolean;
  statusCode: number;
  /** true when the subscription is gone (404/410) and should be deleted */
  expired: boolean;
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidKeys,
  ttl = 86400,
): Promise<SendResult> {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;

  const jwt = await buildVapidJwt(audience, vapid);
  const body = await encryptPayload(utf8(payload), subscription.keys.p256dh, subscription.keys.auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
    },
    body,
  });

  return {
    ok: res.ok,
    statusCode: res.status,
    expired: res.status === 404 || res.status === 410,
  };
}
