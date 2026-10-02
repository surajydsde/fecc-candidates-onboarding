import { createHmac, timingSafeEqual } from 'crypto';

// Owner login: the passcode lives only in the OWNER_PASSCODE environment variable.
// A correct passcode returns a signed token that expires; uploads require that token.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function passcode() {
  const value = process.env.OWNER_PASSCODE;
  return value && value.trim().length > 0 ? value : null;
}

export function isOwnerLoginConfigured() {
  return passcode() !== null;
}

function sign(payload, secret) {
  return createHmac('sha256', `fecc-owner:${secret}`).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPasscode(input) {
  const secret = passcode();
  if (!secret || typeof input !== 'string') return false;
  return safeEqual(input.trim(), secret.trim());
}

export function issueToken(now = Date.now()) {
  const secret = passcode();
  if (!secret) throw new Error('OWNER_NOT_CONFIGURED');
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

export function verifyToken(token, now = Date.now()) {
  const secret = passcode();
  if (!secret || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export function tokenFromHeader(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
