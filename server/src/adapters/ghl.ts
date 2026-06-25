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

const live = () => settings.ghlMode() === 'live';
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
  if (live() && settings.ghlContactUrl()) {
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

// ── Per-comp charge ──────────────────────────────────────────────────────────
export type WalletChargeResult =
  | { ok: true; transactionId?: string }
  | { ok: false; reason: string };

/**
 * Charge one comp via the agency's billing endpoint. The endpoint performs the
 * actual deduction and returns success/failed + a reason — we just relay it. A
 * failure flips the account to the billing-issue gate (FRD §7.5).
 *
 * Mock injection: a ghlLocationId containing "failwallet"/"empty" → declined.
 */
export async function chargeWallet(
  ghlLocationId: string,
  amount: number,
  idempotencyKey: string,
  contactId?: string,
): Promise<WalletChargeResult> {
  if (live() && settings.ghlChargeUrl()) {
    try {
      const res = await fetch(settings.ghlChargeUrl(), {
        method: 'POST',
        headers: authHeaders({ 'idempotency-key': idempotencyKey }),
        body: JSON.stringify({ locationId: ghlLocationId, contactId, amount, currency: 'USD', idempotencyKey, type: 'comp' }),
      });
      const body: any = await res.json().catch(() => ({}));
      const status = String(body.status ?? (res.ok ? 'success' : 'failed')).toLowerCase();
      if (res.ok && (status === 'success' || status === 'succeeded' || status === 'ok')) {
        return { ok: true, transactionId: body.transactionId ?? body.id };
      }
      return { ok: false, reason: body.reason ?? body.message ?? `charge_failed_${res.status}` };
    } catch (e) {
      return { ok: false, reason: 'charge_endpoint_unreachable' };
    }
  }
  // mock
  if (/failwallet|empty/.test(ghlLocationId)) return { ok: false, reason: 'Insufficient wallet balance' };
  return { ok: true, transactionId: 'wtx_' + idempotencyKey.slice(0, 12) };
}

// ── Write-back ───────────────────────────────────────────────────────────────
export type WritebackResult = { ok: true } | { ok: false; reason: string };

/** Push whitelisted values (ARV, CMV, repair total, offer) onto the GHL contact. */
export async function writeBackContact(
  ghlLocationId: string,
  contactId: string,
  fields: Record<string, number | string>,
): Promise<WritebackResult> {
  if (live() && settings.ghlWritebackUrl()) {
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
