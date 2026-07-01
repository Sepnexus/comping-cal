import { bricked, type BrickedProperty, type CreatePropertyParams } from '../adapters/bricked.js';
import { chargeWallet } from '../adapters/ghl.js';
import { locations, snapshots, usage, writebacks, type LocationRow, type SnapshotRow } from '../db/repos.js';
import { settings } from '../db/settings.js';
import { deriveIdempotencyKey, normalizeAddress } from '../util/crypto.js';

/**
 * Comp engine — enforces the FRD's five core rules:
 *   R1 location is identity · R2 API call = charge, DB read = free
 *   R3 snapshot by default, refresh on demand · R4 charge only after HTTP 200
 *   R5 prepaid wallet self-gates.
 * Charge sequence is implemented literally per §6.2; invariants per §8.2.
 */

export interface CompOutcome {
  ok: boolean;
  status: number; // Bricked HTTP status (or 0 for pre-Bricked blocks)
  snapshot?: PublicSnapshot;
  charged: boolean;
  chargeStatus: 'charged' | 'free' | 'charge_failed' | 'not_attempted';
  freeReason?: string;
  /** typed fallback for the frontend (FRD §10) */
  fallback?: { kind: string; message: string; reason?: string };
  billingIssue?: boolean;
}

export interface PublicSnapshot {
  id: string;
  locationId: string;
  ghlContactId: string | null;
  contactName: string | null;
  address: string;
  version: number;
  brickedPropertyId: string | null;
  arv: number | null;
  cmv: number | null;
  totalRepairCost: number | null;
  takenAt: string;
  property: BrickedProperty;
  stale: boolean;
  pushedToCrm: boolean;
}

const STALE_AFTER_DAYS = 30;

export function toPublicSnapshot(row: SnapshotRow): PublicSnapshot {
  const property = JSON.parse(row.raw_json) as BrickedProperty;
  // Backfill fields added after a snapshot was stored, so pre-upgrade snapshots
  // render in the current UI without crashing on missing arrays/objects.
  if (!Array.isArray(property.taxes)) property.taxes = [];
  if (property.savedOffer === undefined) property.savedOffer = null;
  property.comps = (property.comps ?? []).map((c) => ({
    ...c,
    images: Array.isArray(c.images) ? c.images : [],
    priceHistory: Array.isArray(c.priceHistory) ? c.priceHistory : [],
  }));
  const ageMs = Date.now() - new Date(row.taken_at).getTime();
  return {
    id: row.id,
    locationId: row.location_id,
    ghlContactId: row.ghl_contact_id,
    contactName: row.ghl_contact_name ?? null,
    address: property.subject.address,
    version: row.version,
    brickedPropertyId: row.bricked_property_id,
    arv: row.arv,
    cmv: row.cmv,
    totalRepairCost: row.total_repair_cost,
    takenAt: row.taken_at,
    property,
    stale: ageMs > STALE_AFTER_DAYS * 86_400_000,
    pushedToCrm: writebacks.hasSuccessForSnapshot(row.id),
  };
}

/** ARV from the currently-selected comps: the mean of their adjusted values
 *  (each already normalised to the subject). Free, deterministic, transparent —
 *  toggling which comps are "in the deal" re-derives the headline ARV. */
export function arvFromComps(comps: BrickedProperty['comps']): number | null {
  const sel = comps.filter((c) => c.selected && c.adjusted_value > 0);
  if (sel.length === 0) return null;
  const mean = sel.reduce((s, c) => s + c.adjusted_value, 0) / sel.length;
  return Math.round(mean);
}

function perCompPrice(loc: LocationRow): number {
  // Per-location override wins; otherwise the (editable) global default.
  return loc.per_comp_price ?? settings.perCompPrice();
}

/** Map a Bricked non-200 to the typed fallback the UI renders (FRD §5.3 / §10.1). */
function fallbackFor(status: number): { kind: string; message: string } {
  switch (status) {
    case 400:
      return { kind: 'invalid_address', message: 'We couldn’t read that address — check and retry.' };
    case 401:
    case 402:
      return { kind: 'service_unavailable', message: 'Temporarily unavailable. Please try again shortly.' };
    case 404:
      return { kind: 'not_found', message: 'No property record found for this address. Add details to comp it.' };
    case 412:
      return { kind: 'missing_sqft', message: 'Add a few details (sqft, beds, baths) to comp this one.' };
    default:
      return { kind: 'temporary_error', message: 'The valuation service is taking too long — try again.' };
  }
}

export interface RunCompInput {
  locationId: string; // internal location.id
  ghlContactId?: string | null;
  ghlContactName?: string | null;
  address: string;
  refresh?: boolean;
  overrides?: Partial<CreatePropertyParams>;
  type?: 'comp' | 'refresh';
}

/**
 * Run or fetch a comp. Implements the §6.2 sequence:
 *   pre-check active → dedupe (free) → call Bricked → on 200 charge wallet →
 *   store snapshot + log usage. Failed Bricked = no charge. Empty wallet = blocked.
 */
export async function runComp(input: RunCompInput): Promise<CompOutcome> {
  const loc = locations.byId(input.locationId);
  // Pre-check: location active in our DB (allowlist, R1/§6.2 step 1).
  if (!loc || loc.status !== 'active') {
    return { ok: false, status: 0, charged: false, chargeStatus: 'not_attempted', fallback: { kind: 'inactive_location', message: 'This location is not active.' } };
  }

  const normalized = normalizeAddress(input.address);
  const isRefresh = !!input.refresh || input.type === 'refresh';

  // Dedupe (R3): existing snapshot + no refresh requested → serve free, log cached_view.
  if (!isRefresh) {
    const existing = snapshots.latestForAddress(loc.id, normalized);
    if (existing) {
      usage.insert({
        location_id: loc.id,
        snapshot_id: existing.id,
        type: 'comp',
        bricked_status: null,
        bricked_cost: null,
        charged_amount: 0,
        charge_status: 'free',
        free_reason: 'cached_view',
        address: input.address,
        idempotency_key: null,
      });
      return { ok: true, status: 200, snapshot: toPublicSnapshot(existing), charged: false, chargeStatus: 'free', freeReason: 'cached_view' };
    }
  }

  // Idempotency: a retry with the same logical key returns the prior result (§8.2).
  const version = isRefresh
    ? (snapshots.latestForAddress(loc.id, normalized)?.version ?? 0) + 1
    : 1;
  const idemKey = deriveIdempotencyKey([loc.id, normalized, isRefresh ? 'refresh' : 'comp', version]);
  const prior = usage.byIdempotencyKey(idemKey);
  if (prior && prior.charge_status !== 'free' && prior.snapshot_id) {
    const snap = snapshots.byId(prior.snapshot_id);
    if (snap)
      return {
        ok: true,
        status: prior.bricked_status ?? 200,
        snapshot: toPublicSnapshot(snap),
        charged: prior.charge_status === 'charged',
        chargeStatus: prior.charge_status,
      };
  }

  // 1) Call Bricked FIRST. We only ever charge for a comp we can actually deliver,
  //    so a Bricked failure (401/404/412/timeout) never touches the wallet.
  const params: CreatePropertyParams = { address: input.address, timeframe: settings.compLookback(), ...input.overrides };
  const result = await bricked.createProperty(params);

  if (!result.ok) {
    usage.insert({
      location_id: loc.id,
      snapshot_id: null,
      type: isRefresh ? 'refresh' : 'comp',
      bricked_status: result.status,
      bricked_cost: null,
      charged_amount: 0,
      charge_status: 'not_attempted',
      free_reason: 'error_no_charge',
      address: input.address,
      idempotency_key: null, // nothing charged → free retry until it succeeds once
    });
    return { ok: false, status: result.status, charged: false, chargeStatus: 'not_attempted', fallback: fallbackFor(result.status) };
  }

  // 2) Bricked returned data → now charge the wallet. We wait for the charge result;
  //    only an explicit HTTP 200 from the billing endpoint counts as charged.
  const price = perCompPrice(loc);
  const charge = await chargeWallet(loc.ghl_location_id, price, idemKey, input.ghlContactId ?? undefined);

  if (!charge.ok) {
    // Declined (insufficient balance, billing not set up, etc.) → no comp delivered,
    // no snapshot. We absorbed one Bricked lookup; the customer is NOT charged.
    usage.insert({
      location_id: loc.id,
      snapshot_id: null,
      type: isRefresh ? 'refresh' : 'comp',
      bricked_status: 200,
      bricked_cost: settings.brickedCost(),
      charged_amount: 0,
      charge_status: 'charge_failed',
      free_reason: charge.reason,
      address: input.address,
      idempotency_key: null, // no charge → free retry once billing is resolved
    });
    return { ok: false, status: 402, charged: false, chargeStatus: 'charge_failed', billingIssue: true, fallback: { kind: 'billing_issue', message: 'Insufficient wallet balance — please top up to run a comp.', reason: charge.reason } };
  }

  // 3) Bricked + charge both succeeded → store the snapshot and log the charge. A row
  //    is only ever marked "charged" here, after a delivered comp.
  const p = result.property;
  const snap = snapshots.insert({
    location_id: loc.id,
    ghl_contact_id: input.ghlContactId ?? null,
    ghl_contact_name: input.ghlContactName ?? null,
    normalized_address: normalized,
    version,
    bricked_property_id: p.id,
    raw_json: JSON.stringify(p),
    arv: p.arv,
    cmv: p.cmv,
    total_repair_cost: p.totalRepairCost,
  });
  usage.insert({
    location_id: loc.id,
    snapshot_id: snap.id,
    type: isRefresh ? 'refresh' : 'comp',
    bricked_status: 200,
    bricked_cost: settings.brickedCost(),
    charged_amount: price,
    charge_status: 'charged',
    free_reason: null,
    address: input.address,
    idempotency_key: idemKey,
  });
  locations.touch(loc.id);

  return { ok: true, status: 200, snapshot: toPublicSnapshot(snap), charged: true, chargeStatus: 'charged' };
}

/**
 * Generate / update a repair estimate (§5.1 repairs param, §6.3 charge-on-generate).
 * Editing repair text is free; this billable call re-runs Bricked with the repairs
 * string and writes the itemised costs back into the snapshot.
 */
export async function generateRepairs(
  locationId: string,
  snapshotId: string,
  repairsText: string,
  images?: string,
): Promise<CompOutcome> {
  const loc = locations.byId(locationId);
  const snap = snapshots.byId(snapshotId);
  if (!loc || loc.status !== 'active' || !snap || snap.location_id !== loc.id) {
    return { ok: false, status: 0, charged: false, chargeStatus: 'not_attempted', fallback: { kind: 'not_found', message: 'Snapshot not found for this location.' } };
  }

  const property = JSON.parse(snap.raw_json) as BrickedProperty;
  const idemKey = deriveIdempotencyKey([loc.id, snap.id, 'repairs', repairsText]);
  const prior = usage.byIdempotencyKey(idemKey);
  if (prior && prior.charge_status === 'charged') {
    return { ok: true, status: 200, snapshot: toPublicSnapshot(snapshots.byId(snap.id)!), charged: true, chargeStatus: 'charged' };
  }

  // Bricked first — only charge for an estimate we can actually deliver.
  const result = await bricked.createProperty({
    address: property.subject.address,
    squareFeet: property.subject.squareFeet ?? undefined,
    repairs: repairsText,
    images,
  });

  if (!result.ok) {
    usage.insert({
      location_id: loc.id,
      snapshot_id: snap.id,
      type: 'repairs',
      bricked_status: result.status,
      bricked_cost: null,
      charged_amount: 0,
      charge_status: 'not_attempted',
      free_reason: 'error_no_charge',
      address: property.subject.address,
      idempotency_key: null,
    });
    return { ok: false, status: result.status, charged: false, chargeStatus: 'not_attempted', fallback: fallbackFor(result.status) };
  }

  // Estimate generated → now charge. Only an HTTP 200 from billing counts as charged.
  const price = perCompPrice(loc);
  const charge = await chargeWallet(loc.ghl_location_id, price, idemKey, snap.ghl_contact_id ?? undefined);
  if (!charge.ok) {
    usage.insert({
      location_id: loc.id,
      snapshot_id: snap.id,
      type: 'repairs',
      bricked_status: 200,
      bricked_cost: settings.brickedCost(),
      charged_amount: 0,
      charge_status: 'charge_failed',
      free_reason: charge.reason,
      address: property.subject.address,
      idempotency_key: null, // no charge occurred — retry allowed after resolve
    });
    return { ok: false, status: 402, charged: false, chargeStatus: 'charge_failed', billingIssue: true, fallback: { kind: 'billing_issue', message: 'Insufficient wallet balance — please top up to generate an estimate.', reason: charge.reason } };
  }

  // merge repairs into the existing snapshot (same version — repairs enrich it)
  property.repairs = result.property.repairs;
  property.totalRepairCost = result.property.totalRepairCost;
  property.renovationScore = result.property.renovationScore;
  const updated = snapshots.updateRepairs(snap.id, JSON.stringify(property), property.totalRepairCost)!;
  usage.insert({
    location_id: loc.id,
    snapshot_id: snap.id,
    type: 'repairs',
    bricked_status: 200,
    bricked_cost: settings.brickedCost(),
    charged_amount: price,
    charge_status: 'charged',
    free_reason: null,
    address: property.subject.address,
    idempotency_key: idemKey,
  });
  return { ok: true, status: 200, snapshot: toPublicSnapshot(updated), charged: true, chargeStatus: 'charged' };
}
