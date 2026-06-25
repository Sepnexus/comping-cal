/**
 * Seed realistic Closer Control data so every screen and admin chart has content.
 * Idempotent: clears the five tables and re-inserts. Run with `npm run seed`.
 */
import { db } from './index.js';
import { locations, snapshots, usage, admins } from './repos.js';
import { bricked } from '../adapters/bricked.js';
import { hashPassword, normalizeAddress, uuid } from '../util/crypto.js';
import { config } from '../config.js';

function reset() {
  db.exec(`DELETE FROM writeback_log; DELETE FROM usage_event; DELETE FROM property_snapshot; DELETE FROM location; DELETE FROM admin_user;`);
}

const LOCATIONS = [
  { ghl: 'loc_8f21a3', name: 'First Glance Homes', status: 'active', price: 0.65, ceiling: 300 },
  { ghl: 'loc_2c90fe', name: 'Blue Wing Capital', status: 'active', price: 0.65, ceiling: 300 },
  { ghl: 'loc_7b14d2', name: 'Akron Rentals LLC', status: 'active', price: 0.6, ceiling: 300 },
  { ghl: 'loc_55e1a8', name: 'Koval Properties', status: 'active', price: 0.65, ceiling: 300 },
  { ghl: 'loc_9a32bb', name: 'Dana Mills RE', status: 'active', price: 0.7, ceiling: 150 },
  { ghl: 'loc_41ccf0', name: 'Safety Harbor Group', status: 'active', price: 0.65, ceiling: 300 },
  { ghl: 'loc_6d77e9', name: 'Clearwater Capital', status: 'active', price: 0.6, ceiling: 500 },
  // a location whose wallet always declines — demoes the billing-issue gate (§7.5)
  { ghl: 'loc_failwallet1', name: 'Riverside Holdings (wallet declined)', status: 'active', price: 0.65, ceiling: 300 },
  { ghl: 'loc_00ffaa', name: 'Test Location', status: 'suspended', price: 0.65, ceiling: 50 },
] as const;

// Addresses to pre-seed as history for the PRIMARY location (First Glance). The
// reference contact (Melanie @ 115 Orangeview) is deliberately NOT seeded so the
// embedded happy-path runs a fresh, billable comp.
const FG_HISTORY = [
  { address: '1473 Maple St, Clearwater, FL 33755-5034', daysAgo: 3 },
  { address: '31 N Fredrica Ave, Clearwater, FL 33755-5137', daysAgo: 5, refreshed: true },
  { address: '119 N Hillcrest Ave, Clearwater, FL 33755-5143', daysAgo: 7 },
  { address: '604 Pennsylvania Ave, Dunedin, FL 34698', daysAgo: 40 }, // stale (>30d)
  { address: '88 Bayview Dr, Safety Harbor, FL 34695', daysAgo: 13 },
  { address: '2204 Druid Rd E, Clearwater, FL 33756', daysAgo: 16 },
];

function isoDaysAgo(days: number, hour = 9, min = 10): string {
  const d = new Date('2026-06-25T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, min, Math.floor((days * 7) % 60), 0);
  return d.toISOString();
}

async function seed() {
  reset();

  // admin user (matches the design-comp login)
  admins.insert('akshay@sepnexus.com', hashPassword('password'), 'super_admin');

  const locRows = LOCATIONS.map((l) =>
    locations.insert({
      ghl_location_id: l.ghl,
      name: l.name,
      status: l.status,
      per_comp_price: l.price,
      cost_ceiling: l.ceiling,
    }),
  );
  const fg = locRows[0];

  // First Glance history snapshots + their charged usage events
  for (const h of FG_HISTORY) {
    const r = await bricked.createProperty({ address: h.address });
    if (!r.ok) continue;
    const snap = snapshots.insert({
      location_id: fg.id,
      ghl_contact_id: null,
      normalized_address: normalizeAddress(h.address),
      version: h.refreshed ? 2 : 1,
      bricked_property_id: r.property.id,
      raw_json: JSON.stringify(r.property),
      arv: r.property.arv,
      cmv: r.property.cmv,
      total_repair_cost: h.refreshed ? 22100 : null,
      taken_at: isoDaysAgo(h.daysAgo),
    });
    usage.insert({
      location_id: fg.id,
      snapshot_id: snap.id,
      type: h.refreshed ? 'refresh' : 'comp',
      bricked_status: 200,
      bricked_cost: config.defaultBrickedCost,
      charged_amount: fg.per_comp_price ?? 0.65,
      charge_status: 'charged',
      free_reason: null,
      address: h.address,
      idempotency_key: uuid(),
      created_at: isoDaysAgo(h.daysAgo),
    });
  }

  // Spread historical charged usage across all active locations & months so the
  // dashboard, error-rate and P&L charts have real shape (Jan–Jun 2026).
  const sampleAddrs = ['115 Orangeview Ave', '88 Bayview Dr', '31 N Fredrica Ave', '1473 Maple St', '604 Pennsylvania Ave', '2204 Druid Rd E'];
  const monthly = [180, 200, 230, 250, 270, 300]; // comps per month, Jan..Jun
  let monthIdx = 0;
  // Anchor each batch near mid-month and spread strictly backward (no future dates).
  for (const monthDay of [160, 130, 100, 70, 40, 8]) {
    const count = monthly[monthIdx++];
    for (let i = 0; i < count; i++) {
      const loc = locRows[i % 7]; // active, non-failwallet, non-suspended
      const isFail = i % 90 === 0; // a few charge failures
      const isFreeCached = i % 25 === 0;
      const errStatus = i % 40 === 0 ? 412 : i % 70 === 0 ? 404 : i % 130 === 0 ? 500 : 200;
      const day = monthDay + (i % 8); // only older, stays within the month window
      if (errStatus !== 200) {
        usage.insert({
          location_id: loc.id, snapshot_id: null, type: 'comp', bricked_status: errStatus,
          bricked_cost: null, charged_amount: 0, charge_status: 'not_attempted', free_reason: 'error_no_charge',
          address: sampleAddrs[i % sampleAddrs.length], idempotency_key: uuid(), created_at: isoDaysAgo(day, 8 + (i % 9), i % 60),
        });
        continue;
      }
      usage.insert({
        location_id: loc.id, snapshot_id: null,
        type: i % 11 === 0 ? 'repairs' : i % 7 === 0 ? 'refresh' : 'comp',
        bricked_status: 200, bricked_cost: config.defaultBrickedCost,
        charged_amount: isFail || isFreeCached ? 0 : loc.per_comp_price ?? 0.65,
        charge_status: isFail ? 'charge_failed' : isFreeCached ? 'free' : 'charged',
        free_reason: isFreeCached ? 'cached_view' : isFail ? 'empty_wallet' : null,
        address: sampleAddrs[i % sampleAddrs.length], idempotency_key: uuid(),
        created_at: isoDaysAgo(day, 8 + (i % 10), i % 60),
      });
    }
  }

  const totalUsage = (db.prepare('SELECT COUNT(*) c FROM usage_event').get() as any).c;
  const totalSnaps = (db.prepare('SELECT COUNT(*) c FROM property_snapshot').get() as any).c;
  console.log(`✓ Seeded ${locRows.length} locations, ${totalSnaps} snapshots, ${totalUsage} usage events.`);
  console.log(`  Admin login: akshay@sepnexus.com / password`);
  console.log(`  Primary location (embedded demo): ${fg.name} [${fg.ghl_location_id}]`);
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
