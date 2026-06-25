import { db } from './index.js';
import { uuid } from '../util/crypto.js';

export interface LocationRow {
  id: string;
  ghl_location_id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  per_comp_price: number | null;
  cost_ceiling: number | null;
  note: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface SnapshotRow {
  id: string;
  location_id: string;
  ghl_contact_id: string | null;
  normalized_address: string;
  version: number;
  bricked_property_id: string | null;
  raw_json: string;
  arv: number | null;
  cmv: number | null;
  total_repair_cost: number | null;
  taken_at: string;
}

export interface UsageEventRow {
  id: string;
  location_id: string;
  snapshot_id: string | null;
  type: 'comp' | 'refresh' | 'repairs';
  bricked_status: number | null;
  bricked_cost: number | null;
  charged_amount: number;
  charge_status: 'charged' | 'free' | 'charge_failed' | 'not_attempted';
  free_reason: string | null;
  address: string | null;
  idempotency_key: string | null;
  created_at: string;
}

// ── locations ────────────────────────────────────────────────────────────────
export const locations = {
  byGhlId(ghlLocationId: string): LocationRow | undefined {
    return db.prepare('SELECT * FROM location WHERE ghl_location_id = ?').get(ghlLocationId) as
      | LocationRow
      | undefined;
  },
  byId(id: string): LocationRow | undefined {
    return db.prepare('SELECT * FROM location WHERE id = ?').get(id) as LocationRow | undefined;
  },
  all(): LocationRow[] {
    return db.prepare('SELECT * FROM location ORDER BY created_at DESC').all() as LocationRow[];
  },
  touch(id: string): void {
    db.prepare("UPDATE location SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
  },
  insert(row: Partial<LocationRow> & { ghl_location_id: string; name: string }): LocationRow {
    const id = row.id ?? uuid();
    db.prepare(
      `INSERT INTO location (id, ghl_location_id, name, status, per_comp_price, cost_ceiling, note, created_at, last_seen_at)
       VALUES (@id, @ghl_location_id, @name, @status, @per_comp_price, @cost_ceiling, @note,
               COALESCE(@created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')), @last_seen_at)`,
    ).run({
      id,
      ghl_location_id: row.ghl_location_id,
      name: row.name,
      status: row.status ?? 'active',
      per_comp_price: row.per_comp_price ?? null,
      cost_ceiling: row.cost_ceiling ?? null,
      note: row.note ?? null,
      created_at: row.created_at ?? null,
      last_seen_at: row.last_seen_at ?? null,
    });
    return locations.byId(id)!;
  },
  update(
    id: string,
    patch: Partial<Pick<LocationRow, 'name' | 'status' | 'per_comp_price' | 'cost_ceiling' | 'note'>>,
  ): LocationRow | undefined {
    const cur = locations.byId(id);
    if (!cur) return undefined;
    db.prepare('UPDATE location SET name=@name, status=@status, per_comp_price=@per_comp_price, cost_ceiling=@cost_ceiling, note=@note WHERE id=@id').run({
      id,
      name: patch.name ?? cur.name,
      status: patch.status ?? cur.status,
      per_comp_price: patch.per_comp_price ?? cur.per_comp_price,
      cost_ceiling: patch.cost_ceiling ?? cur.cost_ceiling,
      note: patch.note ?? cur.note,
    });
    return locations.byId(id);
  },
};

// ── snapshots ────────────────────────────────────────────────────────────────
export const snapshots = {
  byId(id: string): SnapshotRow | undefined {
    return db.prepare('SELECT * FROM property_snapshot WHERE id = ?').get(id) as SnapshotRow | undefined;
  },
  /** Latest version of a snapshot for (location, normalized_address) — the dedupe key. */
  latestForAddress(locationId: string, normalizedAddress: string): SnapshotRow | undefined {
    return db
      .prepare(
        `SELECT * FROM property_snapshot WHERE location_id = ? AND normalized_address = ?
         ORDER BY version DESC LIMIT 1`,
      )
      .get(locationId, normalizedAddress) as SnapshotRow | undefined;
  },
  listForLocation(locationId: string): SnapshotRow[] {
    // one row per address (latest version), newest first
    return db
      .prepare(
        `SELECT ps.* FROM property_snapshot ps
         JOIN (SELECT normalized_address, MAX(version) AS v FROM property_snapshot
               WHERE location_id = ? GROUP BY normalized_address) latest
           ON ps.normalized_address = latest.normalized_address AND ps.version = latest.v
         WHERE ps.location_id = ?
         ORDER BY ps.taken_at DESC`,
      )
      .all(locationId, locationId) as SnapshotRow[];
  },
  insert(row: Omit<SnapshotRow, 'id' | 'taken_at'> & { id?: string; taken_at?: string }): SnapshotRow {
    const id = row.id ?? uuid();
    db.prepare(
      `INSERT INTO property_snapshot
        (id, location_id, ghl_contact_id, normalized_address, version, bricked_property_id, raw_json, arv, cmv, total_repair_cost, taken_at)
       VALUES (@id, @location_id, @ghl_contact_id, @normalized_address, @version, @bricked_property_id, @raw_json, @arv, @cmv, @total_repair_cost,
               COALESCE(@taken_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    ).run({ ...row, id, taken_at: row.taken_at ?? null });
    return snapshots.byId(id)!;
  },
  updateRepairs(id: string, raw_json: string, total_repair_cost: number): SnapshotRow | undefined {
    db.prepare('UPDATE property_snapshot SET raw_json=?, total_repair_cost=? WHERE id=?').run(
      raw_json,
      total_repair_cost,
      id,
    );
    return snapshots.byId(id);
  },
};

// ── usage events (append-only) ───────────────────────────────────────────────
export const usage = {
  byIdempotencyKey(key: string): UsageEventRow | undefined {
    return db.prepare('SELECT * FROM usage_event WHERE idempotency_key = ?').get(key) as
      | UsageEventRow
      | undefined;
  },
  insert(row: Omit<UsageEventRow, 'id' | 'created_at'> & { id?: string; created_at?: string }): UsageEventRow {
    const id = row.id ?? uuid();
    db.prepare(
      `INSERT INTO usage_event
        (id, location_id, snapshot_id, type, bricked_status, bricked_cost, charged_amount, charge_status, free_reason, address, idempotency_key, created_at)
       VALUES (@id, @location_id, @snapshot_id, @type, @bricked_status, @bricked_cost, @charged_amount, @charge_status, @free_reason, @address, @idempotency_key,
               COALESCE(@created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    ).run({ ...row, id, created_at: row.created_at ?? null });
    return db.prepare('SELECT * FROM usage_event WHERE id = ?').get(id) as UsageEventRow;
  },
  recent(limit = 200): (UsageEventRow & { location_name: string })[] {
    return db
      .prepare(
        `SELECT ue.*, l.name AS location_name FROM usage_event ue
         JOIN location l ON l.id = ue.location_id
         ORDER BY ue.created_at DESC LIMIT ?`,
      )
      .all(limit) as (UsageEventRow & { location_name: string })[];
  },
  forLocation(locationId: string, limit = 50): UsageEventRow[] {
    return db
      .prepare('SELECT * FROM usage_event WHERE location_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(locationId, limit) as UsageEventRow[];
  },
  /** Lifetime billable comps + spend for a location (admin aggregates). */
  statsForLocation(locationId: string): { lifetime: number; spend: number; brickedCost: number } {
    const r = db
      .prepare(
        `SELECT COUNT(*) AS lifetime, COALESCE(SUM(charged_amount),0) AS spend, COALESCE(SUM(bricked_cost),0) AS cost
         FROM usage_event WHERE location_id = ? AND charge_status = 'charged'`,
      )
      .get(locationId) as { lifetime: number; spend: number; cost: number };
    return { lifetime: r.lifetime, spend: r.spend, brickedCost: r.cost };
  },
};

// ── writeback log ────────────────────────────────────────────────────────────
export const writebacks = {
  insert(row: {
    location_id: string;
    ghl_contact_id: string;
    snapshot_id: string | null;
    fields_written: string;
    status: 'success' | 'failed' | 'retrying';
  }): void {
    db.prepare(
      `INSERT INTO writeback_log (id, location_id, ghl_contact_id, snapshot_id, fields_written, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(uuid(), row.location_id, row.ghl_contact_id, row.snapshot_id, row.fields_written, row.status);
  },
};

// ── admin users ──────────────────────────────────────────────────────────────
export const admins = {
  byEmail(email: string): { id: string; email: string; password_hash: string; role: string } | undefined {
    return db.prepare('SELECT * FROM admin_user WHERE email = ?').get(email.toLowerCase()) as any;
  },
  insert(email: string, passwordHash: string, role: 'super_admin' | 'admin'): void {
    db.prepare('INSERT INTO admin_user (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      uuid(),
      email.toLowerCase(),
      passwordHash,
      role,
    );
  },
};
