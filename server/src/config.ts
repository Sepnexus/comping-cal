import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load the repo-root .env (server runs with cwd=server/, so resolve up two levels).
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env') });
loadEnv(); // also honour a server-local .env / real env vars if present

function num(v: string | undefined, fallback: number): number {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 8787),

  // Auth (FRD §4)
  hmacSecret: process.env.HMAC_SECRET ?? 'dev-hmac-secret-change-me',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? 'dev-admin-jwt-secret-change-me',

  // Bricked adapter (FRD §5)
  bricked: {
    mode: (process.env.BRICKED_MODE ?? 'mock') as 'mock' | 'live',
    apiKey: process.env.BRICKED_API_KEY ?? '',
    baseUrl: process.env.BRICKED_BASE_URL ?? 'https://api.bricked.ai',
  },

  // GHL integration (custom-JS button model — no marketplace app / OAuth / SSO).
  // The tool is launched from a contact button carrying locationId + contactId +
  // a shared launch password. Contact fetch, the per-comp charge, and write-back
  // all hit the agency's own endpoints (these return success/failed + reason).
  ghl: {
    mode: (process.env.GHL_MODE ?? 'mock') as 'mock' | 'live',
    // Endpoints supplied by Closer Control / their GHL+KNL backend:
    contactUrl: process.env.GHL_CONTACT_URL ?? '', // GET contact (name, address, …) by contactId
    locationUrl: process.env.GHL_LOCATION_URL ?? '', // GET location name by locationId → authorization gate
    chargeUrl: process.env.GHL_CHARGE_URL ?? '', //   POST per-comp charge → {status, reason}
    writebackUrl: process.env.GHL_WRITEBACK_URL ?? '', // POST values back to the contact
    apiKey: process.env.GHL_API_KEY ?? '', //         auth for the three endpoints above
  },

  // Shared launch password baked into the GHL custom-JS button. A launch is valid
  // when its token equals this password (or the per-location HMAC). Empty disables
  // the password path (HMAC only).
  launchPassword: process.env.LAUNCH_PASSWORD ?? '',

  // Public origin where this tool is hosted (used in the custom-JS button + admin
  // launch links). Empty → admin UI derives it from the browser origin.
  toolPublicUrl: process.env.TOOL_PUBLIC_URL ?? process.env.PUBLIC_BASE_URL ?? '',

  // Pricing defaults (FRD §6.4 / §8.1.1)
  defaultPerCompPrice: num(process.env.DEFAULT_PER_COMP_PRICE, 0.65),
  defaultBrickedCost: num(process.env.DEFAULT_BRICKED_COST, 0.33),
  globalCostCeiling: num(process.env.GLOBAL_COST_CEILING, 300),

  // Trust-on-first-use onboarding: when true, a request bearing a VALID per-location
  // token for a locationId we haven't seen auto-registers that location (active,
  // unnamed) so a freshly-installed sub-account works immediately. The token is the
  // proof — it can only be minted with the server secret (FRD §4.2). Admin names it
  // later. Set false to fall back to the strict allowlist (FRD §4.3).
  autoProvision: (process.env.AUTO_PROVISION_LOCATIONS ?? 'true').toLowerCase() !== 'false',

  // Public origin used to build per-location launch URLs (the GHL button target).
  // Empty → the admin UI derives it from the current window origin.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
};

export type Config = typeof config;
