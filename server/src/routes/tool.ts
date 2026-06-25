import { Router } from 'express';
import { requireLocation } from '../middleware/auth.js';
import { fetchContact, writeBackContact } from '../adapters/ghl.js';
import { runComp, generateRepairs, toPublicSnapshot } from '../engine/comp.js';
import { computeOffer, STRATEGIES, type StrategyId } from '../engine/offer.js';
import { locations, snapshots, usage, writebacks } from '../db/repos.js';
import { normalizeAddress } from '../util/crypto.js';

export const toolRouter = Router();

/**
 * POST /lookup — free check whether a saved snapshot already exists for an address
 * on this location (same normalization as the comp dedupe). Used on launch to open
 * an existing comp instead of re-charging. No Bricked call, no usage event.
 */
toolRouter.post('/lookup', requireLocation, (req, res) => {
  const loc = req.location!;
  const address = String(req.body?.address ?? '').trim();
  if (!address) {
    res.json({ ok: true, found: false });
    return;
  }
  const row = snapshots.latestForAddress(loc.id, normalizeAddress(address));
  if (!row) {
    res.json({ ok: true, found: false });
    return;
  }
  res.json({ ok: true, found: true, snapshot: toPublicSnapshot(row) });
});

/**
 * POST /location/name — set/update this location's display name. Lets the user
 * name an auto-provisioned ("Unnamed") location from inside the tool, no admin
 * round-trip. Scoped to the launched location; free, no usage event.
 */
toolRouter.post('/location/name', requireLocation, (req, res) => {
  const loc = req.location!;
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(422).json({ ok: false, error: 'name_required', message: 'Enter a location name.' });
    return;
  }
  const updated = locations.update(loc.id, { name: name.slice(0, 120) });
  res.json({ ok: true, name: updated?.name ?? name });
});

/**
 * POST /session/verify — validate token, bind session to location, resolve the
 * contact's address server-side from GHL (FRD §9, §3.4). Never trust URL data.
 */
toolRouter.post('/session/verify', requireLocation, async (req, res) => {
  const loc = req.location!;
  const contactId: string | undefined = req.body?.contactId;
  let contact = null as Awaited<ReturnType<typeof fetchContact>>;
  if (contactId) contact = await fetchContact(loc.ghl_location_id, contactId);

  res.json({
    ok: true,
    location: { id: loc.id, ghlLocationId: loc.ghl_location_id, name: loc.name, status: loc.status },
    contact: contact ? { id: contact.id, name: contact.name, address: contact.address, notes: contact.notes ?? null } : null,
  });
});

/**
 * POST /comp — run or fetch a comp for an address. Dedup serves a saved snapshot
 * free; a fresh pull charges the wallet on Bricked 200 (§9, §6.2).
 */
toolRouter.post('/comp', requireLocation, async (req, res) => {
  const loc = req.location!;
  const { contactId, address, refresh, overrides } = req.body ?? {};
  if (!address || !String(address).trim()) {
    res.status(422).json({ ok: false, error: 'address_missing', message: 'Enter an address to comp.' });
    return;
  }
  const outcome = await runComp({
    locationId: loc.id,
    ghlContactId: contactId ?? null,
    address: String(address),
    refresh: !!refresh,
    overrides: overrides ?? undefined,
    type: refresh ? 'refresh' : 'comp',
  });

  if (outcome.billingIssue) {
    res.status(402).json({ ok: false, billingIssue: true, ...outcome.fallback });
    return;
  }
  if (!outcome.ok) {
    res.status(outcome.status >= 400 ? outcome.status : 422).json({ ok: false, status: outcome.status, fallback: outcome.fallback });
    return;
  }
  res.json({ ok: true, charged: outcome.charged, chargeStatus: outcome.chargeStatus, freeReason: outcome.freeReason, snapshot: outcome.snapshot });
});

/** POST /repairs — generate a repair estimate (charge-on-generate, §6.3). */
toolRouter.post('/repairs', requireLocation, async (req, res) => {
  const loc = req.location!;
  const { snapshotId, repairsText, images } = req.body ?? {};
  if (!snapshotId || repairsText == null) {
    res.status(422).json({ ok: false, error: 'bad_request' });
    return;
  }
  const outcome = await generateRepairs(loc.id, String(snapshotId), String(repairsText), images ? String(images) : undefined);
  if (outcome.billingIssue) {
    res.status(402).json({ ok: false, billingIssue: true, ...outcome.fallback });
    return;
  }
  if (!outcome.ok) {
    res.status(outcome.status >= 400 ? outcome.status : 422).json({ ok: false, status: outcome.status, fallback: outcome.fallback });
    return;
  }
  res.json({ ok: true, charged: outcome.charged, snapshot: outcome.snapshot });
});

/** GET /history — list snapshots for the location (free, §9). */
toolRouter.get('/history', requireLocation, (req, res) => {
  const loc = req.location!;
  const filter = String(req.query.q ?? '').toLowerCase();
  const rows = snapshots.listForLocation(loc.id).map((r) => {
    const p = toPublicSnapshot(r);
    // Best thumbnail from the subject's image set (0, 1, or many). Prefer the
    // satellite tile; null when the property has no imagery — the UI shows a
    // placeholder rather than a broken image.
    const imgs = (p.property.images ?? []).filter((u): u is string => typeof u === 'string');
    const image = imgs.find((u) => /satellite\.jpg/.test(u)) ?? imgs[0] ?? null;
    return {
      id: p.id,
      address: p.address,
      arv: p.arv,
      totalRepairCost: p.totalRepairCost,
      takenAt: p.takenAt,
      version: p.version,
      stale: p.stale,
      status: p.stale ? 'Stale' : p.version > 1 ? 'Refreshed' : 'Snapshot',
      image,
    };
  });
  const filtered = filter ? rows.filter((r) => r.address.toLowerCase().includes(filter)) : rows;
  res.json({ ok: true, count: filtered.length, items: filtered });
});

/** GET /property/:id — fetch one stored snapshot (free, §9). */
toolRouter.get('/property/:id', requireLocation, (req, res) => {
  const loc = req.location!;
  const row = snapshots.byId(req.params.id);
  if (!row || row.location_id !== loc.id) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }
  // free read — logged as a non-billable view is optional; per §8.2 views create no usage_event
  res.json({ ok: true, snapshot: toPublicSnapshot(row) });
});

/** POST /offer — free MAO math on saved data (§6.3). */
toolRouter.post('/offer', requireLocation, (req, res) => {
  const loc = req.location!;
  const { snapshotId, strategy } = req.body ?? {};
  const row = snapshotId ? snapshots.byId(String(snapshotId)) : undefined;
  if (!row || row.location_id !== loc.id) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }
  if (!STRATEGIES.includes(strategy)) {
    res.status(422).json({ ok: false, error: 'bad_strategy', strategies: STRATEGIES });
    return;
  }
  const p = toPublicSnapshot(row).property;
  const result = computeOffer(strategy as StrategyId, {
    arv: p.arv ?? 0,
    cmv: p.cmv ?? 0,
    repairCost: p.totalRepairCost ?? 0,
    rentEstimate: p.rentEstimate ?? 0,
  });
  res.json({ ok: true, result });
});

/** POST /writeback — push whitelisted fields to the GHL contact (§9, §F-CE-8). */
toolRouter.post('/writeback', requireLocation, async (req, res) => {
  const loc = req.location!;
  const { contactId, snapshotId, fields } = req.body ?? {};
  if (!contactId || !fields) {
    res.status(422).json({ ok: false, error: 'bad_request' });
    return;
  }
  const allow = ['arv', 'cmv', 'repair_total', 'offer'];
  const whitelisted: Record<string, number | string> = {};
  for (const k of allow) if (fields[k] != null) whitelisted[k] = fields[k];

  const result = await writeBackContact(loc.ghl_location_id, String(contactId), whitelisted);
  writebacks.insert({
    location_id: loc.id,
    ghl_contact_id: String(contactId),
    snapshot_id: snapshotId ? String(snapshotId) : null,
    fields_written: JSON.stringify(whitelisted),
    status: result.ok ? 'success' : 'retrying', // failed write-backs are queued for retry (§10.3)
  });
  if (!result.ok) {
    res.status(502).json({ ok: false, error: 'writeback_failed', message: "Couldn’t save to CRM — we’ll retry.", queued: true });
    return;
  }
  res.json({ ok: true, fieldsWritten: whitelisted });
});

export { STRATEGIES };
