import { Router } from 'express';
import { config } from '../config.js';
import { requireAdmin, signAdminToken } from '../middleware/auth.js';
import { admins, locations, usage, feedback, tickets } from '../db/repos.js';
import { settings } from '../db/settings.js';
import { verifyPassword, launchTokenFor } from '../util/crypto.js';
import { db } from '../db/index.js';

/** The launch token + a ready-to-click test launch URL for a location. */
function launchLinks(ghlLocationId: string) {
  const token = launchTokenFor(ghlLocationId); // shared password if set, else HMAC
  const base = config.toolPublicUrl || config.publicBaseUrl || '';
  return {
    token,
    // The custom-JS button builds this URL from the contact page (contactId is the
    // open contact). Shown here so you can confirm the exact shape.
    buttonUrlTemplate: `${base}/?locationId=${ghlLocationId}&contactId=<CONTACT_ID>&token=${token}`,
    // Works immediately for local testing (mock contact resolves).
    testLaunchUrl: `${base}/?locationId=${ghlLocationId}&contactId=contact_melanie&token=${token}`,
  };
}

export const adminRouter = Router();

// Simple in-memory lockout after N failed attempts (FRD §7.7.1 / login states).
const attempts = new Map<string, { count: number; until: number }>();

adminRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const key = String(email ?? '').toLowerCase();
  const rec = attempts.get(key);
  if (rec && rec.until > Date.now()) {
    res.status(429).json({ ok: false, error: 'locked', message: 'Too many attempts. Try again shortly.' });
    return;
  }
  const admin = admins.byEmail(key);
  if (!admin || !verifyPassword(String(password ?? ''), admin.password_hash)) {
    const next = { count: (rec?.count ?? 0) + 1, until: 0 };
    if (next.count >= 5) next.until = Date.now() + 5 * 60_000;
    attempts.set(key, next);
    res.status(401).json({ ok: false, error: 'invalid', message: 'Incorrect email or password.' });
    return;
  }
  attempts.delete(key);
  const token = signAdminToken({ id: admin.id, email: admin.email, role: admin.role });
  res.json({ ok: true, token, admin: { email: admin.email, role: admin.role } });
});

adminRouter.get('/me', requireAdmin, (req, res) => res.json({ ok: true, admin: req.admin }));

// ── Dashboard (FRD §7.7.1) — with a date-range filter ────────────────────────
adminRouter.get('/dashboard', requireAdmin, (req, res) => {
  // range: number of days back (7 / 30 / 90), or 0 for all time. Default 30.
  const raw = Number(req.query.range);
  const rangeDays = [7, 30, 90].includes(raw) ? raw : raw === 0 ? 0 : 30;
  const cutoff = rangeDays > 0 ? new Date(Date.now() - rangeDays * 86_400_000).toISOString() : '0000-01-01';
  const today = new Date().toISOString().slice(0, 10);

  const totalLocations = (db.prepare('SELECT COUNT(*) c FROM location').get() as any).c;
  const activeLocations = (db.prepare("SELECT COUNT(*) c FROM location WHERE status='active'").get() as any).c;
  const snapshotCount = (db.prepare('SELECT COUNT(*) c FROM property_snapshot').get() as any).c;
  const compsToday = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE charge_status='charged' AND substr(created_at,1,10)=?").get(today) as any).c;

  const agg = db.prepare("SELECT COALESCE(SUM(charged_amount),0) rev, COALESCE(SUM(bricked_cost),0) cost, COUNT(*) comps FROM usage_event WHERE charge_status='charged' AND created_at >= ?").get(cutoff) as any;
  const failedCharges = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE charge_status='charge_failed' AND created_at >= ?").get(cutoff) as any).c;
  const errorCount = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE (charge_status IN ('charge_failed','not_attempted') OR (bricked_status IS NOT NULL AND bricked_status >= 400)) AND created_at >= ?").get(cutoff) as any).c;
  const freeViews = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE charge_status='free' AND created_at >= ?").get(cutoff) as any).c;
  const margin = agg.rev - agg.cost;
  const avgPerComp = agg.comps > 0 ? agg.rev / agg.comps : 0;

  // Previous equal-length window, for window-over-window deltas (null when 'All').
  let prevRevenue: number | null = null;
  let prevComps: number | null = null;
  if (rangeDays > 0) {
    const prevCutoff = new Date(Date.now() - 2 * rangeDays * 86_400_000).toISOString();
    const prev = db.prepare("SELECT COALESCE(SUM(charged_amount),0) rev, COUNT(*) comps FROM usage_event WHERE charge_status='charged' AND created_at >= ? AND created_at < ?").get(prevCutoff, cutoff) as any;
    prevRevenue = prev.rev;
    prevComps = prev.comps;
  }

  // error rate by bricked status (within range)
  const errRows = db
    .prepare("SELECT bricked_status status, COUNT(*) c FROM usage_event WHERE bricked_status IS NOT NULL AND bricked_status >= 400 AND created_at >= ? GROUP BY bricked_status ORDER BY c DESC")
    .all(cutoff) as { status: number; c: number }[];

  const top = db
    .prepare(
      `SELECT l.name, COUNT(*) hits, COALESCE(SUM(ue.charged_amount-ue.bricked_cost),0) margin
       FROM usage_event ue JOIN location l ON l.id=ue.location_id
       WHERE ue.charge_status='charged' AND ue.created_at >= ? GROUP BY l.id ORDER BY hits DESC LIMIT 5`,
    )
    .all(cutoff) as { name: string; hits: number; margin: number }[];

  // daily series — comps count + revenue + spend
  const series = db
    .prepare(
      `SELECT substr(created_at,1,10) d, COUNT(*) comps, COALESCE(SUM(charged_amount),0) rev, COALESCE(SUM(bricked_cost),0) spend
       FROM usage_event WHERE charge_status='charged' AND created_at >= ? GROUP BY d ORDER BY d DESC LIMIT 14`,
    )
    .all(cutoff) as { d: string; comps: number; rev: number; spend: number }[];

  const recent = db
    .prepare(
      `SELECT ue.created_at time, l.name location, ue.address, ue.type, ue.charge_status chargeStatus,
              ue.charged_amount chargedAmount, ue.bricked_status brickedStatus
       FROM usage_event ue JOIN location l ON l.id=ue.location_id
       WHERE ue.created_at >= ? ORDER BY ue.created_at DESC LIMIT 8`,
    )
    .all(cutoff) as any[];

  // recent ERRORS with a human reason — so admins see WHY things failed
  const recentErrors = db
    .prepare(
      `SELECT ue.created_at time, l.name location, ue.address, ue.type, ue.charge_status charge_status,
              ue.bricked_status bricked_status, ue.free_reason free_reason
       FROM usage_event ue JOIN location l ON l.id=ue.location_id
       WHERE ue.created_at >= ? AND (ue.charge_status IN ('charge_failed','not_attempted')
             OR (ue.bricked_status IS NOT NULL AND ue.bricked_status >= 400))
       ORDER BY ue.created_at DESC LIMIT 8`,
    )
    .all(cutoff) as any[];

  res.json({
    ok: true,
    range: rangeDays,
    kpis: { totalLocations, activeLocations, compsToday, margin, failedCharges, errorCount, brickedSpend: agg.cost, revenue: agg.rev, totalComps: agg.comps, avgPerComp, freeViews, snapshotCount, prevRevenue, prevComps },
    errorRate: errRows,
    topLocations: top,
    series: series.reverse(),
    recent,
    recentErrors: recentErrors.map((e) => ({ time: e.time, location: e.location, address: e.address, type: e.type, status: e.bricked_status, reason: usageReason(e) })),
  });
});

// ── Locations table + detail (FRD §7.7.2) ────────────────────────────────────
adminRouter.get('/locations', requireAdmin, (_req, res) => {
  const rows = locations.all().map((l) => {
    const s = usage.statsForLocation(l.id);
    return {
      id: l.id,
      ghlLocationId: l.ghl_location_id,
      name: l.name,
      status: l.status,
      perCompPrice: l.per_comp_price ?? settings.perCompPrice(),
      costCeiling: l.cost_ceiling ?? settings.globalCostCeiling(),
      lifetime: s.lifetime,
      spend: s.spend,
    };
  });
  res.json({ ok: true, items: rows });
});

adminRouter.get('/locations/:id', requireAdmin, (req, res) => {
  const l = locations.byId(req.params.id);
  if (!l) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }
  const s = usage.statsForLocation(l.id);
  const ledger = usage.forLocation(l.id, 8).map((u) => ({
    reason: u.charge_status === 'charged' ? 'paid_hit' : u.charge_status === 'charge_failed' ? 'CHARGE_FAILED · GHL' : u.free_reason ?? 'free',
    time: u.created_at,
    delta: u.charge_status === 'charged' ? `$${u.charged_amount.toFixed(2)}` : u.charge_status === 'charge_failed' ? `$${settings.brickedCost().toFixed(2)}` : '$0.00',
    type: u.type,
    address: u.address,
    status: u.bricked_status,
  }));
  const outstanding = db
    .prepare("SELECT COALESCE(SUM(bricked_cost),0) o FROM usage_event WHERE location_id=? AND charge_status='charge_failed'")
    .get(l.id) as any;
  res.json({
    ok: true,
    location: {
      id: l.id,
      ghlLocationId: l.ghl_location_id,
      name: l.name,
      status: l.status,
      perCompPrice: l.per_comp_price ?? settings.perCompPrice(),
      costCeiling: l.cost_ceiling ?? settings.globalCostCeiling(),
      note: l.note,
      lifetime: s.lifetime,
      spend: s.spend,
      outstanding: outstanding.o,
      createdAt: l.created_at,
      lastSeenAt: l.last_seen_at,
      ...launchLinks(l.ghl_location_id),
    },
    ledger,
  });
});

// Privileged actions are audited in concept; here we apply + return the new row.
adminRouter.patch('/locations/:id', requireAdmin, (req, res) => {
  const { name, status, perCompPrice, costCeiling, note } = req.body ?? {};
  const updated = locations.update(req.params.id, {
    name,
    status,
    per_comp_price: perCompPrice,
    cost_ceiling: costCeiling,
    note,
  });
  if (!updated) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }
  res.json({ ok: true, location: updated });
});

adminRouter.post('/locations', requireAdmin, (req, res) => {
  const { ghlLocationId, name } = req.body ?? {};
  if (!ghlLocationId) {
    res.status(422).json({ ok: false, error: 'bad_request', message: 'ghlLocationId is required' });
    return;
  }
  if (locations.byGhlId(String(ghlLocationId))) {
    res.status(409).json({ ok: false, error: 'exists' });
    return;
  }
  // Name is optional — a location can be registered now and named later.
  const loc = locations.insert({ ghl_location_id: String(ghlLocationId), name: name ? String(name) : '' });
  res.status(201).json({ ok: true, location: loc, ...launchLinks(loc.ghl_location_id) });
});

// Human-readable reason for a usage row — explains why it was charged / free /
// failed / errored, so the log is actionable without decoding status codes.
function usageReason(u: { charge_status: string; bricked_status: number | null; free_reason: string | null }): string {
  if (u.charge_status === 'charged') return 'Comp delivered — charged';
  if (u.charge_status === 'free') return u.free_reason === 'cached_view' ? 'Already comped — free reopen' : u.free_reason ?? 'Free';
  if (u.charge_status === 'charge_failed') return u.free_reason ? `Charge declined — ${u.free_reason}` : 'Wallet charge declined';
  // not_attempted → a Bricked error before any charge
  switch (u.bricked_status) {
    case 400: return 'Invalid address — Bricked couldn’t read it';
    case 401:
    case 402: return 'Bricked auth / subscription issue';
    case 404: return 'No property record for this address';
    case 412: return 'Missing details (sqft / beds) to comp';
    case 500: return 'Bricked error / timeout';
    default: return u.free_reason === 'error_no_charge' ? 'Bricked error — not charged' : u.free_reason ?? 'Not attempted';
  }
}

// ── Usage log (append-only audit, FRD §7.7.3) — paginated + filterable ────────
adminRouter.get('/usage', requireAdmin, (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(String(req.query.pageSize ?? '25'), 10) || 25));
  const type = ['comp', 'refresh', 'repairs'].includes(String(req.query.type)) ? String(req.query.type) : undefined;
  const status = ['charged', 'free', 'charge_failed', 'not_attempted'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
  const q = req.query.q ? String(req.query.q).trim() : undefined;
  const { items, total } = usage.paged({ limit: pageSize, offset: (page - 1) * pageSize, type, status, q });
  res.json({
    ok: true,
    total,
    page,
    pageSize,
    items: items.map((u) => ({
      id: u.id,
      time: u.created_at,
      location: u.location_name,
      address: u.address,
      type: u.type,
      brickedStatus: u.bricked_status,
      chargedAmount: u.charged_amount,
      chargeStatus: u.charge_status,
      freeReason: u.free_reason,
      reason: usageReason(u),
    })),
  });
});

// ── Feedback (thumbs up/down from the tool) ──────────────────────────────────
adminRouter.get('/feedback', requireAdmin, (_req, res) => {
  const items = feedback.recent(300).map((f) => ({
    id: f.id,
    time: f.created_at,
    location: f.location_name,
    address: f.address,
    contactName: f.contact_name,
    rating: f.rating,
    reason: f.reason,
  }));
  res.json({ ok: true, items, counts: feedback.counts() });
});

// ── Support tickets (raised by reps from the tool) ───────────────────────────
adminRouter.get('/tickets', requireAdmin, (_req, res) => {
  const items = tickets.recent(300).map((t) => ({
    id: t.id,
    time: t.created_at,
    location: t.location_name,
    address: t.address,
    contactName: t.contact_name,
    category: t.category,
    message: t.message,
    status: t.status,
  }));
  res.json({ ok: true, items, openCount: tickets.openCount() });
});

adminRouter.patch('/tickets/:id', requireAdmin, (req, res) => {
  const status = req.body?.status;
  if (status !== 'open' && status !== 'resolved') {
    res.status(422).json({ ok: false, error: 'bad_status' });
    return;
  }
  tickets.setStatus(req.params.id, status);
  res.json({ ok: true });
});

// ── Expenses / P&L (margin & spend, FRD §7.7.1 KPIs) ─────────────────────────
adminRouter.get('/pnl', requireAdmin, (_req, res) => {
  const byMonth = db
    .prepare(
      `SELECT substr(created_at,1,7) month,
              COALESCE(SUM(charged_amount),0) rev,
              COALESCE(SUM(bricked_cost),0) cost
       FROM usage_event WHERE charge_status='charged' GROUP BY month ORDER BY month DESC LIMIT 6`,
    )
    .all() as { month: string; rev: number; cost: number }[];
  const rows = byMonth.map((m) => {
    const profit = +(m.rev - m.cost).toFixed(2); // profit = revenue − comp API cost
    const margin = m.rev > 0 ? (profit / m.rev) * 100 : 0;
    return { month: m.month, revenue: m.rev, brickedCost: m.cost, profit, margin };
  });
  const totals = rows.reduce(
    (a, r) => ({ rev: a.rev + r.revenue, cost: a.cost + r.brickedCost, profit: a.profit + r.profit }),
    { rev: 0, cost: 0, profit: 0 },
  );
  const byAccount = db
    .prepare(
      `SELECT l.name, COALESCE(SUM(ue.charged_amount),0) rev, COALESCE(SUM(ue.bricked_cost),0) cost
       FROM usage_event ue JOIN location l ON l.id=ue.location_id
       WHERE ue.charge_status='charged' GROUP BY l.id ORDER BY rev DESC LIMIT 6`,
    )
    .all() as { name: string; rev: number; cost: number }[];
  res.json({ ok: true, rows: rows.reverse(), totals, byAccount });
});

// ── Settings (FRD §7.7.4) — pricing AND integration keys are editable and persisted
//    in app_setting, so they can be managed from the admin UI without SSH/redeploy.
//    Secret values are returned masked (never in full); only the HMAC root secret is
//    env-only (rotating it would invalidate tokens). ───────────────────────────────
function settingsPayload() {
  const mask = (s: string) => (s ? `••••••••${s.slice(-4)}` : '');
  const eff = settings.all();
  const brickedKey = settings.brickedApiKey();
  const ghlKey = settings.ghlApiKey();
  return {
    // pricing / limits
    defaultPerCompPrice: eff.defaultPerCompPrice,
    brickedCost: eff.brickedCost,
    globalCostCeiling: eff.globalCostCeiling,
    compLookback: eff.compLookback,
    // bricked
    brickedKeySet: !!brickedKey,
    brickedKeyMasked: mask(brickedKey),
    // ghl
    ghlContactUrl: settings.ghlContactUrl(),
    ghlLocationUrl: settings.ghlLocationUrl(),
    ghlChargeUrl: settings.ghlChargeUrl(),
    ghlWritebackUrl: settings.ghlWritebackUrl(),
    ghlKeySet: !!ghlKey,
    ghlKeyMasked: mask(ghlKey),
    // launch password (lives in client-side JS anyway → shown in full so admin can copy it)
    launchPassword: settings.launchPassword(),
    // read-only
    hmacSecretMasked: mask(config.hmacSecret),
  };
}

adminRouter.get('/settings', requireAdmin, (_req, res) => {
  res.json({ ok: true, settings: settingsPayload() });
});

adminRouter.patch('/settings', requireAdmin, (req, res) => {
  const body = req.body ?? {};
  const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
  const pricing = {
    defaultPerCompPrice: num(body.defaultPerCompPrice),
    brickedCost: num(body.brickedCost),
    globalCostCeiling: num(body.globalCostCeiling),
    compLookback: num(body.compLookback),
  };
  for (const [k, v] of Object.entries(pricing)) {
    if (v !== undefined && (!Number.isFinite(v) || (v as number) < 0)) {
      res.status(422).json({ ok: false, error: 'invalid', message: `${k} must be a non-negative number` });
      return;
    }
  }
  settings.update(pricing);
  // Integration: modes/URLs/launch password update when provided; API keys only when
  // a real new value is given (so saving without retyping never wipes a key).
  settings.updateIntegration({
    brickedApiKey: body.brickedApiKey,
    ghlContactUrl: body.ghlContactUrl,
    ghlLocationUrl: body.ghlLocationUrl,
    ghlChargeUrl: body.ghlChargeUrl,
    ghlWritebackUrl: body.ghlWritebackUrl,
    ghlApiKey: body.ghlApiKey,
    launchPassword: body.launchPassword,
  });
  res.json({ ok: true, settings: settingsPayload() });
});
