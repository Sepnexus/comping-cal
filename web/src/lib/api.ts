import type {
  HistoryItem,
  LaunchContext,
  OfferResult,
  PublicSnapshot,
  SessionInfo,
  StrategyId,
} from './types';

const BASE = '/api';

async function jsonOrThrow(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.message ?? `HTTP ${res.status}`), { status: res.status, body });
  return body;
}

// ── Tool session (HMAC per-location token, FRD §4) ───────────────────────────
let ctx: LaunchContext | null = null;
export function setLaunchContext(c: LaunchContext) {
  ctx = c;
}
export function getLaunchContext(): LaunchContext | null {
  return ctx;
}

/**
 * Read the real launch context from the URL — this is the production path. The GHL
 * contact button / SSO bridge opens the tool with ?locationId=&contactId=&token=,
 * where the token is the per-location secret HMAC(server_secret, locationId). The
 * session is bound to whatever location the URL carries — never a hardcoded one.
 */
export function launchContextFromUrl(): LaunchContext | null {
  const q = new URLSearchParams(window.location.search);
  const locationId = q.get('locationId');
  const token = q.get('token');
  if (!locationId || !token) return null;
  return {
    locationId,
    contactId: q.get('contactId') ?? '',
    token,
    locationName: '', // resolved from the verified session
    contactName: '',
  };
}

/** Dev bootstrap: obtain a valid per-location token (mock mode only). */
export async function devLaunchContext(locationId?: string): Promise<LaunchContext> {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
  const r = await jsonOrThrow(await fetch(`${BASE}/dev/launch-context${q}`));
  return { locationId: r.locationId, contactId: r.contactId, token: r.token, locationName: r.locationName, contactName: r.contactName };
}

export async function devLocations(): Promise<{ ghlLocationId: string; name: string; status: string; token: string }[]> {
  const r = await jsonOrThrow(await fetch(`${BASE}/dev/locations`));
  return r.items;
}

function withAuth(body: Record<string, unknown> = {}) {
  if (!ctx) throw new Error('no launch context');
  return { ...body, locationId: ctx.locationId, token: ctx.token, contactId: body.contactId ?? ctx.contactId };
}

async function post(path: string, body: Record<string, unknown>): Promise<any> {
  return jsonOrThrow(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(withAuth(body)),
    }),
  );
}

export const toolApi = {
  verify(): Promise<SessionInfo & { ok: true }> {
    return post('/session/verify', {});
  },
  async comp(opts: { address: string; refresh?: boolean; overrides?: Record<string, unknown> }): Promise<{
    ok: true;
    charged: boolean;
    chargeStatus: string;
    freeReason?: string;
    snapshot: PublicSnapshot;
  }> {
    return post('/comp', opts);
  },
  repairs(opts: { snapshotId: string; repairsText: string; images?: string }): Promise<{ ok: true; charged: boolean; snapshot: PublicSnapshot }> {
    return post('/repairs', opts);
  },
  offer(opts: { snapshotId: string; strategy: StrategyId }): Promise<{ ok: true; result: OfferResult }> {
    return post('/offer', opts);
  },
  writeback(opts: { contactId?: string; snapshotId: string; fields: Record<string, number | string> }): Promise<{ ok: true; fieldsWritten: Record<string, unknown> }> {
    return post('/writeback', opts);
  },
  async history(q?: string): Promise<{ count: number; items: HistoryItem[] }> {
    if (!ctx) throw new Error('no launch context');
    const params = new URLSearchParams({ locationId: ctx.locationId, token: ctx.token });
    if (q) params.set('q', q);
    return jsonOrThrow(await fetch(`${BASE}/history?${params.toString()}`));
  },
  async property(id: string): Promise<{ ok: true; snapshot: PublicSnapshot }> {
    if (!ctx) throw new Error('no launch context');
    const params = new URLSearchParams({ locationId: ctx.locationId, token: ctx.token });
    return jsonOrThrow(await fetch(`${BASE}/property/${id}?${params.toString()}`));
  },
};

// ── Admin API (JWT bearer) ───────────────────────────────────────────────────
const ADMIN_TOKEN_KEY = 'cc_admin_token';
export const adminToken = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  set: (t: string) => localStorage.setItem(ADMIN_TOKEN_KEY, t),
  clear: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
};

async function adminGet(path: string): Promise<any> {
  return jsonOrThrow(await fetch(`${BASE}/admin${path}`, { headers: { authorization: `Bearer ${adminToken.get() ?? ''}` } }));
}
async function adminSend(path: string, method: string, body?: unknown): Promise<any> {
  return jsonOrThrow(
    await fetch(`${BASE}/admin${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken.get() ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export const adminApi = {
  async login(email: string, password: string): Promise<{ ok: true; token: string; admin: { email: string; role: string } }> {
    return jsonOrThrow(
      await fetch(`${BASE}/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
  },
  dashboard: () => adminGet('/dashboard'),
  locations: () => adminGet('/locations'),
  location: (id: string) => adminGet(`/locations/${id}`),
  updateLocation: (id: string, patch: Record<string, unknown>) => adminSend(`/locations/${id}`, 'PATCH', patch),
  createLocation: (ghlLocationId: string, name?: string) => adminSend('/locations', 'POST', { ghlLocationId, name }),
  usage: () => adminGet('/usage'),
  pnl: () => adminGet('/pnl'),
  settings: () => adminGet('/settings'),
  updateSettings: (patch: Record<string, number>) => adminSend('/settings', 'PATCH', patch),
};
