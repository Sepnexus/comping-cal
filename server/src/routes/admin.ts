import { Router } from 'express';
import { config } from '../config.js';
import { requireAdmin, signAdminToken } from '../middleware/auth.js';
import { admins, locations, usage } from '../db/repos.js';
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

// ── Dashboard (FRD §7.7.1) ───────────────────────────────────────────────────
adminRouter.get('/dashboard', requireAdmin, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalLocations = (db.prepare('SELECT COUNT(*) c FROM location').get() as any).c;
  const activeLocations = (db.prepare("SELECT COUNT(*) c FROM location WHERE status='active'").get() as any).c;
  const compsToday = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE charge_status='charged' AND substr(created_at,1,10)=?").get(today) as any).c;
  const agg = db.prepare("SELECT COALESCE(SUM(charged_amount),0) rev, COALESCE(SUM(bricked_cost),0) cost FROM usage_event WHERE charge_status='charged'").get() as any;
  const failedCharges = (db.prepare("SELECT COUNT(*) c FROM usage_event WHERE charge_status='charge_failed'").get() as any).c;
  const margin = agg.rev - agg.cost;

  // error rate by bricked status
  const errRows = db
    .prepare("SELECT bricked_status status, COUNT(*) c FROM usage_event WHERE bricked_status IS NOT NULL GROUP BY bricked_status ORDER BY c DESC")
    .all() as { status: number; c: number }[];

  // top locations by charged comps
  const top = db
    .prepare(
      `SELECT l.name, COUNT(*) hits, COALESCE(SUM(ue.charged_amount-ue.bricked_cost),0) margin
       FROM usage_event ue JOIN location l ON l.id=ue.location_id
       WHERE ue.charge_status='charged' GROUP BY l.id ORDER BY hits DESC LIMIT 5`,
    )
    .all() as { name: string; hits: number; margin: number }[];

  // last 12 days revenue vs spend
  const series = db
    .prepare(
      `SELECT substr(created_at,1,10) d, COALESCE(SUM(charged_amount),0) rev, COALESCE(SUM(bricked_cost),0) spend
       FROM usage_event WHERE charge_status='charged' GROUP BY d ORDER BY d DESC LIMIT 12`,
    )
    .all() as { d: string; rev: number; spend: number }[];

  res.json({
    ok: true,
    kpis: { totalLocations, activeLocations, compsToday, margin, failedCharges, brickedSpend: agg.cost, revenue: agg.rev },
    errorRate: errRows,
    topLocations: top,
    series: series.reverse(),
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

// ── Usage log (append-only audit, FRD §7.7.3) ────────────────────────────────
adminRouter.get('/usage', requireAdmin, (_req, res) => {
  const rows = usage.recent(200).map((u) => ({
    id: u.id,
    time: u.created_at,
    location: u.location_name,
    address: u.address,
    type: u.type,
    brickedStatus: u.bricked_status,
    chargedAmount: u.charged_amount,
    chargeStatus: u.charge_status,
    freeReason: u.free_reason,
  }));
  res.json({ ok: true, items: rows });
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
    const fees = +(m.rev * 0.049).toFixed(2); // GHL wallet fees ~4.9%
    const profit = +(m.rev - m.cost - fees).toFixed(2);
    const margin = m.rev > 0 ? (profit / m.rev) * 100 : 0;
    return { month: m.month, revenue: m.rev, brickedCost: m.cost, fees, profit, margin };
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
    brickedMode: settings.brickedMode(),
    brickedKeySet: !!brickedKey,
    brickedKeyMasked: mask(brickedKey),
    // ghl
    ghlMode: settings.ghlMode(),
    ghlContactUrl: settings.ghlContactUrl(),
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
    brickedMode: body.brickedMode,
    brickedApiKey: body.brickedApiKey,
    ghlMode: body.ghlMode,
    ghlContactUrl: body.ghlContactUrl,
    ghlChargeUrl: body.ghlChargeUrl,
    ghlWritebackUrl: body.ghlWritebackUrl,
    ghlApiKey: body.ghlApiKey,
    launchPassword: body.launchPassword,
  });
  res.json({ ok: true, settings: settingsPayload() });
});
