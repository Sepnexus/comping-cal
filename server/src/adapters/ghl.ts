import { settings } from '../db/settings.js';

/**
 * GHL integration — custom-JS button model (no marketplace app / OAuth / SSO).
 *
 * Three things hit the agency's own endpoints (Closer Control's GHL+KNL backend):
 *   • fetchContact      GET  GHL_CONTACT_URL    → contact name + address by id
 *   • chargeWallet      POST GHL_CHARGE_URL     → { status: success|failed, reason }
 *   • writeBackContact  POST GHL_WRITEBACK_URL  → push values onto the contact
 *
 * All three send `x-api-key: GHL_API_KEY`. When GHL_MODE=mock (or a URL is unset)
 * the call is simulated so the tool runs end-to-end locally. The request/response
 * shapes below are the assumed contract — adjust the small mapping helpers when the
 * real formats are confirmed.
 */

export interface GhlContact {
  id: string;
  name: string;
  address: string;
  notes?: string;
}

/** The Sandbox test location — the only location allowed to run comps for free
 *  when no real billing endpoint is configured. Every other location must charge. */
export const TEST_SANDBOX_GHL_ID = 'loc_test01';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = settings.ghlApiKey();
  return { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}), ...extra };
}

// ── Contact fetch ────────────────────────────────────────────────────────────
const MOCK_CONTACTS: Record<string, GhlContact> = {
  contact_melanie: {
    id: 'contact_melanie',
    name: 'Melanie Lollies',
    address: '115 Orangeview Ave, Clearwater, FL 33755-5229',
    notes: 'Dated 1950 build; seller motivated.',
  },
  contact_noaddress: { id: 'contact_noaddress', name: 'Unlinked Contact', address: '' },
};

/** Map the contact endpoint's response into our shape (tolerates a few layouts). */
function mapContact(raw: any, contactId: string): GhlContact {
  const c = raw?.contact ?? raw?.data ?? raw ?? {};
  const name =
    c.name ??
    [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ??
    c.contactName ??
    'Contact';
  const address =
    c.address ??
    c.fullAddress ??
    [c.address1, c.city, c.state, c.postalCode ?? c.zip].filter(Boolean).join(', ');
  return { id: c.id ?? contactId, name: name || 'Contact', address: address || '', notes: c.notes ?? undefined };
}

export async function fetchContact(ghlLocationId: string, contactId: string): Promise<GhlContact | null> {
  if (settings.ghlContactUrl()) {
    try {
      const url = new URL(settings.ghlContactUrl());
      url.searchParams.set('locationId', ghlLocationId);
      url.searchParams.set('contactId', contactId);
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return null;
      return mapContact(await res.json(), contactId);
    } catch {
      return null;
    }
  }
  // mock
  if (MOCK_CONTACTS[contactId]) return MOCK_CONTACTS[contactId];
  if (/noaddress/.test(contactId)) return { id: contactId, name: 'Contact', address: '' };
  return {
    id: contactId,
    name: 'Melanie Lollies',
    address: '115 Orangeview Ave, Clearwater, FL 33755-5229',
    notes: 'Dated 1950 build — kitchen and bath need updating.',
  };
}

// ── Location authorization (name lookup) ─────────────────────────────────────
/**
 * Resolve a location's display name from the agency's GHL backend (n8n webhook),
 * keyed by `locationId`. This doubles as the authorization gate: only locations
 * the backend recognises (app installed → OAuth on file) return a name.
 *   • a non-empty name  → authorized; we provision the location under that name
 *   • null              → explicitly NOT authorized (endpoint answered "no")
 *   • undefined         → no opinion (endpoint not configured or transient error)
 *                          → caller falls back to legacy behaviour (provision unnamed)
 */
export async function fetchLocationName(ghlLocationId: string): Promise<string | null | undefined> {
  const endpoint = settings.ghlLocationUrl();
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('locationId', ghlLocationId);
      const res = await fetch(url, { method: 'GET', headers: authHeaders() });
      if (res.status !== 200) return null; // 404/4xx → not a known/authorized location
      const body: any = await res.json().catch(() => ({}));
      const name = body?.name ?? body?.location?.name ?? body?.locationName ?? body?.data?.name;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    } catch {
      return undefined; // network/transient → don't lock the user out
    }
  }
  // No endpoint configured → dev/mock fallback. Lets local testing exercise the deny
  // path (ids containing "unauth"/"deny") without standing up the real webhook.
  if (/unauth|deny|notfound/i.test(ghlLocationId)) return null;
  return undefined;
}

// ── Per-comp charge ──────────────────────────────────────────────────────────
export type WalletChargeResult =
  | { ok: true; transactionId?: string }
  | { ok: false; reason: string };

/**
 * Charge one comp via the agency's n8n billing webhook (GHL_CHARGE_URL). The webhook
 * reads `locationId` + `contactId` from the query string, looks up the location's GHL
 * OAuth token, and posts a 1-unit charge to GHL marketplace billing. It answers:
 *   • HTTP 200  → charge succeeded
 *   • HTTP 402  → declined (e.g. insufficient wallet balance); the human-readable
 *                  reason is returned in the `message` response header.
 * A failure flips the account to the billing-issue gate so we never call Bricked.
 *
 * Mock injection: a ghlLocationId containing "failwallet"/"empty" → declined.
 */
export async function chargeWallet(
  ghlLocationId: string,
  _amount: number,
  idempotencyKey: string,
  contactId?: string,
): Promise<WalletChargeResult> {
  const chargeUrl = settings.ghlChargeUrl();
  if (chargeUrl) {
    try {
      const url = new URL(chargeUrl);
      url.searchParams.set('locationId', ghlLocationId);
      if (contactId) url.searchParams.set('contactId', contactId);
      const res = await fetch(url, { method: 'POST', headers: authHeaders({ 'idempotency-key': idempotencyKey }) });
      if (res.status === 200) {
        await res.text().catch(() => '');
        return { ok: true, transactionId: idempotencyKey.slice(0, 16) };
      }
      // n8n returns the failure detail in the `message` header; fall back to the body.
      const headerMsg = res.headers.get('message');
      const body = await res.text().catch(() => '');
      const reason = headerMsg || body || (res.status === 402 ? 'Insufficient wallet balance' : `charge_failed_${res.status}`);
      return { ok: false, reason };
    } catch (e) {
      // Endpoint unreachable → fail CLOSED (never hand out a free paid comp).
      return { ok: false, reason: 'Billing service is temporarily unreachable. Please try again.' };
    }
  }
  // No charge endpoint configured. The Sandbox test location runs free; every other
  // location is blocked so a misconfiguration can never give away free comps.
  if (ghlLocationId === TEST_SANDBOX_GHL_ID) return { ok: true, transactionId: 'sandbox_' + idempotencyKey.slice(0, 10) };
  return { ok: false, reason: 'Billing isn’t set up for this location yet. Please contact your administrator.' };
}

// ── Write-back ───────────────────────────────────────────────────────────────
export type WritebackResult = { ok: true } | { ok: false; reason: string };

/** Push whitelisted values (ARV, CMV, repair total, offer) onto the GHL contact. */
export async function writeBackContact(
  ghlLocationId: string,
  contactId: string,
  fields: Record<string, number | string>,
): Promise<WritebackResult> {
  if (settings.ghlWritebackUrl()) {
    try {
      const res = await fetch(settings.ghlWritebackUrl(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ locationId: ghlLocationId, contactId, fields }),
      });
      const body: any = await res.json().catch(() => ({}));
      const status = String(body.status ?? (res.ok ? 'success' : 'failed')).toLowerCase();
      return res.ok && status !== 'failed' ? { ok: true } : { ok: false, reason: body.reason ?? `writeback_failed_${res.status}` };
    } catch {
      return { ok: false, reason: 'writeback_endpoint_unreachable' };
    }
  }
  // mock
  if (/failwriteback/.test(contactId)) return { ok: false, reason: 'GHL API error' };
  return { ok: true };
}
