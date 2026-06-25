import {
  createHmac,
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { config } from '../config.js';
import { settings } from '../db/settings.js';

export const uuid = (): string => randomUUID();

/**
 * Per-location, non-transferable token (FRD §4.2):
 *   token = HMAC_SHA256(server_secret, locationId)
 * Binding the token to the exact locationId means a link for location A can't be
 * replayed for location B.
 */
export function locationToken(ghlLocationId: string): string {
  return createHmac('sha256', config.hmacSecret).update(ghlLocationId).digest('hex');
}

function constantTimeEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(actual ?? ''), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Constant-time check that token === HMAC(secret, locationId) (FRD §4.3). */
export function verifyLocationToken(ghlLocationId: string, token: string): boolean {
  return constantTimeEqual(locationToken(ghlLocationId), token);
}

/**
 * Shared launch password (the secret baked into the GHL custom-JS button). It is
 * admin-managed (settings, env as fallback). When set, a launch is valid if its
 * token equals this password. Constant-time.
 */
export function verifyLaunchPassword(token: string): boolean {
  const pw = settings.launchPassword();
  if (!pw) return false;
  return constantTimeEqual(pw, token);
}

/** The token to put in a launch URL: the shared password if set, else the HMAC. */
export function launchTokenFor(ghlLocationId: string): string {
  return settings.launchPassword() || locationToken(ghlLocationId);
}

// ── Admin password hashing (scrypt; salt stored alongside the hash) ───────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Stable idempotency key for a logical comp attempt (FRD §8.2 invariant). */
export function deriveIdempotencyKey(parts: (string | number | undefined)[]): string {
  return createHmac('sha256', config.hmacSecret)
    .update(parts.map((p) => String(p ?? '')).join('|'))
    .digest('hex')
    .slice(0, 32);
}

/** Normalised address used as the per-location dedupe key (FRD §8.1.2). */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}
