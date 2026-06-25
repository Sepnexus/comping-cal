import { Router } from 'express';
import { config } from '../config.js';
import { locations } from '../db/repos.js';
import { launchTokenFor } from '../util/crypto.js';

/**
 * Dev-only bootstrap. In production the per-location token is baked into the GHL
 * button URL (FRD §4.1); locally we expose it so the embedded tool can launch a
 * verified session without GHL present. Disabled when GHL_MODE=live.
 */
export const devRouter = Router();

devRouter.get('/launch-context', (req, res) => {
  if (config.ghl.mode === 'live') {
    res.status(404).json({ ok: false, error: 'disabled_in_live' });
    return;
  }
  const ghlLocationId = String(req.query.locationId ?? '');
  // Use a specific location if asked; otherwise the first active one (the test
  // location after a clean seed). This route is a local convenience only — in
  // production the token + locationId arrive in the GHL button / SSO launch URL.
  const loc = ghlLocationId
    ? locations.byGhlId(ghlLocationId)
    : locations.all().find((l) => l.status === 'active' && !/failwallet|empty/.test(l.ghl_location_id));
  if (!loc) {
    res.status(404).json({ ok: false, error: 'no_location' });
    return;
  }
  res.json({
    ok: true,
    locationId: loc.ghl_location_id,
    contactId: 'contact_melanie',
    token: launchTokenFor(loc.ghl_location_id),
    locationName: loc.name,
    contactName: 'Melanie Lollies',
  });
});

devRouter.get('/locations', (req, res) => {
  if (config.ghl.mode === 'live') {
    res.status(404).json({ ok: false, error: 'disabled_in_live' });
    return;
  }
  res.json({
    ok: true,
    items: locations.all().map((l) => ({
      ghlLocationId: l.ghl_location_id,
      name: l.name,
      status: l.status,
      token: launchTokenFor(l.ghl_location_id),
    })),
  });
});
