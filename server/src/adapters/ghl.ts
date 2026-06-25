import { settings } from '../db/settings.js';

/**
 * GHL integration — custom-JS button model (no marketplace app / OAuth / SSO).
 * Live only: every call hits the agency's own endpoints (Closer Control's n8n /
 * GHL backend). An endpoint is used when its URL is configured in Admin → Settings.
 *
 *   • fetchContact       GET  GHL_CONTACT_URL    → contact name + address by id
 *   • fetchLocationName  GET  GHL_LOCATION_URL   → location name (authorization gate)
 *   • chargeWallet       POST GHL_CHARGE_URL     → 200 charged · 402 declined (+message)
 *   • writeBackContact   POST GHL_WRITEBACK_URL  → push values onto the contact
 *
 * All send `x-api-key: GHL_API_KEY` when a key is set.
 */

export interface GhlContact {
  id: string;
  name: string;
  address: string;
  notes?: string;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = settings.ghlApiKey();
  return { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}), ...extra };
}

// ── Contact fetch ────────────────────────────────────────────────────────────
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

/** Resolve the contact by id. Returns null when no endpoint is configured or the
 *  lookup fails — the tool then falls back to the address passed on the launch URL. */
export async function fetchContact(ghlLocationId: string, contactId: string): Promise<GhlContact | null> {
  if (!settings.ghlContactUrl()) return null;
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

// ── Location authorization (name lookup) ─────────────────────────────────────
/**
 * Resolve a location's display name from the agency's GHL backend (n8n webhook),
 * keyed by `locationId`. This doubles as the authorization gate: only locations
 * the backend recognises (app installed → OAuth on file) return a name.
 *   • a non-empty name  → authorized; provision the location under that name
 *   • null              → explicitly NOT authorized (endpoint answered "no")
 *   • undefined         → no opinion (endpoint not configured, or transient error)
 *                          → caller provisions the location unnamed
 */
export async function fetchLocationName(ghlLocationId: string): Promise<string | null | undefined> {
  const endpoint = settings.ghlLocationUrl();
  if (!endpoint) return undefined; // gate not configured → don't block
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
 * Anything else (incl. no endpoint configured or unreachable) fails CLOSED, so a
 * misconfiguration can never hand out a free paid comp.
 */
export async function chargeWallet(
  ghlLocationId: string,
  _amount: number,
  idempotencyKey: string,
  contactId?: string,
): Promise<WalletChargeResult> {
  const chargeUrl = settings.ghlChargeUrl();
  if (!chargeUrl) {
    return { ok: false, reason: 'Billing isn’t set up yet. Please contact your administrator.' };
  }
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
    return { ok: false, reason: 'Billing service is temporarily unreachable. Please try again.' };
  }
}

// ── Write-back ───────────────────────────────────────────────────────────────
export type WritebackResult = { ok: true } | { ok: false; reason: string };

/** Push whitelisted values (ARV, CMV, repair total, offer) onto the GHL contact. */
export async function writeBackContact(
  ghlLocationId: string,
  contactId: string,
  fields: Record<string, number | string>,
): Promise<WritebackResult> {
  if (!settings.ghlWritebackUrl()) return { ok: false, reason: 'writeback_not_configured' };
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
