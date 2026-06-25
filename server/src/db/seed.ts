/**
 * Clean seed — production-shaped starting state. Wipes every table and creates:
 *   • one admin user (for the oversight panel)
 *   • exactly one active test location you can launch from the UI
 * No snapshots, no usage events, no demo locations. New sub-accounts onboard
 * themselves on first valid launch (auto-provision, see middleware/auth.ts).
 *
 * Run with `npm run seed` (or `npm run reset` to wipe + reseed an existing DB).
 * For the rich demo dataset used in screenshots, run `npm run seed:demo`.
 */
import { db } from './index.js';
import { locations, admins } from './repos.js';
import { hashPassword, locationToken } from '../util/crypto.js';

function wipe() {
  db.exec(
    'DELETE FROM writeback_log; DELETE FROM usage_event; DELETE FROM property_snapshot; DELETE FROM location; DELETE FROM admin_user;',
  );
}

// The single test location. In production each sub-account gets its own row (and
// its own token); this one exists so you can launch the tool locally end-to-end.
const TEST_LOCATION = { ghl: 'loc_test01', name: 'Sandbox (test location)' };

function seed() {
  wipe();

  // Admin credentials are configurable for production (set ADMIN_EMAIL/ADMIN_PASSWORD
  // in .env); they default to the dev login for local use.
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'akshay@sepnexus.com';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'password';
  admins.insert(adminEmail, hashPassword(adminPassword), 'super_admin');

  const loc = locations.insert({
    ghl_location_id: TEST_LOCATION.ghl,
    name: TEST_LOCATION.name,
    status: 'active',
  });

  console.log('✓ Clean database ready.');
  console.log(`  Admin login : ${adminEmail}${process.env.ADMIN_PASSWORD ? '' : ' / password'}`);
  console.log(`  Test location: ${loc.name} [${loc.ghl_location_id}]`);
  console.log(`  Launch URL  : /?locationId=${loc.ghl_location_id}&contactId=contact_melanie&token=${locationToken(loc.ghl_location_id)}`);
}

seed();
process.exit(0);
