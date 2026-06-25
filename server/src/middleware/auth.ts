import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { verifyLocationToken, verifyLaunchPassword } from '../util/crypto.js';
import { locations, type LocationRow } from '../db/repos.js';

console.log(`  Location onboarding: ${config.autoProvision ? 'auto-provision (TOFU)' : 'strict allowlist'}`);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      location?: LocationRow;
      admin?: { id: string; email: string; role: string };
    }
  }
}

/**
 * Tool auth (FRD §4.3): every tool endpoint re-verifies token == HMAC(secret,
 * locationId) AND that the location is present + active in the allowlist. On any
 * failure we return a neutral message — never leak which check failed (§7.6).
 */
export function requireLocation(req: Request, res: Response, next: NextFunction): void {
  const ghlLocationId: string = req.body?.locationId ?? req.query?.locationId;
  const token: string = req.body?.token ?? req.query?.token;
  const neutral = (): void => {
    res.status(401).json({ ok: false, error: 'invalid_link', message: "This link isn't valid." });
  };

  if (!ghlLocationId || !token) return neutral();
  // A launch is valid if the token is either the shared launch password (the secret
  // baked into the GHL custom-JS button) or the per-location HMAC. Either proves the
  // link is legitimate, so it gates access and first-use provisioning.
  if (!verifyLaunchPassword(token) && !verifyLocationToken(ghlLocationId, token)) return neutral();

  let loc = locations.byGhlId(ghlLocationId);
  if (!loc) {
    if (!config.autoProvision) return neutral(); // strict allowlist — don't reveal why
    // First contact from a new sub-account → register it (active, unnamed) and track.
    loc = locations.insert({ ghl_location_id: ghlLocationId, name: '' });
    console.log(`  ✚ auto-provisioned location ${ghlLocationId} (${loc.id})`);
  }
  if (loc.status === 'suspended' || loc.status === 'inactive') {
    res.status(403).json({ ok: false, error: 'inactive', message: 'This location is not active.' });
    return;
  }
  req.location = loc;
  locations.touch(loc.id);
  next();
}

// ── Admin JWT ────────────────────────────────────────────────────────────────
export function signAdminToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, config.adminJwtSecret, { expiresIn: '12h' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  try {
    req.admin = jwt.verify(token, config.adminJwtSecret) as any;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'unauthorized' });
  }
}
