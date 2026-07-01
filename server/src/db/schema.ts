import type Database from 'better-sqlite3';

/**
 * Schema mirrors FRD §8 (Postgres-assumed) on SQLite. Notes on the mapping:
 *   uuid        -> TEXT (we generate v4 uuids in app code)
 *   jsonb       -> TEXT (JSON.stringify; tolerates Bricked schema drift, §8.1.2)
 *   numeric     -> REAL
 *   timestamptz -> TEXT (ISO-8601, UTC)
 *   enum        -> TEXT + CHECK constraint
 *
 * The usage_event table is append-only and is the billing audit source of truth.
 * All property/history data is scoped by location_id (R1 — location is identity).
 */
export function applySchema(db: Database.Database): void {
  db.exec(`
  -- 8.1.1 location — one row per GHL sub-account we serve (the allowlist).
  CREATE TABLE IF NOT EXISTS location (
    id              TEXT PRIMARY KEY,
    ghl_location_id TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','suspended')),
    per_comp_price  REAL,                 -- nullable -> use global default
    cost_ceiling    REAL,                 -- optional spend cap / alert threshold
    note            TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_seen_at    TEXT
  );

  -- 8.1.2 property_snapshot — frozen result of a Bricked call. Immutable per
  -- version; a refresh inserts a new version.
  CREATE TABLE IF NOT EXISTS property_snapshot (
    id                 TEXT PRIMARY KEY,
    location_id        TEXT NOT NULL REFERENCES location(id),
    ghl_contact_id     TEXT,
    normalized_address TEXT NOT NULL,
    version            INTEGER NOT NULL DEFAULT 1,
    bricked_property_id TEXT,
    raw_json           TEXT NOT NULL,      -- full Bricked response
    arv                REAL,
    cmv                REAL,
    total_repair_cost  REAL,
    taken_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  -- fast dedupe and "latest snapshot" lookup (FRD §8.1.2 Index)
  CREATE INDEX IF NOT EXISTS idx_snapshot_dedupe
    ON property_snapshot (location_id, normalized_address, version);

  -- 8.1.3 usage_event — one row per billable attempt. Never updated, only inserted.
  CREATE TABLE IF NOT EXISTS usage_event (
    id              TEXT PRIMARY KEY,
    location_id     TEXT NOT NULL REFERENCES location(id),
    snapshot_id     TEXT REFERENCES property_snapshot(id),
    type            TEXT NOT NULL CHECK (type IN ('comp','refresh','repairs')),
    bricked_status  INTEGER,
    bricked_cost    REAL,
    charged_amount  REAL NOT NULL DEFAULT 0,
    charge_status   TEXT NOT NULL
                      CHECK (charge_status IN ('charged','free','charge_failed','not_attempted')),
    free_reason     TEXT,                  -- cached_view | failed_retry | error_no_charge | ...
    address         TEXT,                  -- denormalised for the admin usage log
    idempotency_key TEXT UNIQUE,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- 8.1.4 writeback_log — audit of values pushed back to GHL contacts.
  CREATE TABLE IF NOT EXISTS writeback_log (
    id             TEXT PRIMARY KEY,
    location_id    TEXT NOT NULL REFERENCES location(id),
    ghl_contact_id TEXT NOT NULL,
    snapshot_id    TEXT REFERENCES property_snapshot(id),
    fields_written TEXT NOT NULL,          -- {arv,cmv,repair_total,offer}
    status         TEXT NOT NULL CHECK (status IN ('success','failed','retrying')),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- app_setting — editable global defaults (pricing, ceilings, comp lookback).
  -- Key/value over the env config: a row here overrides the env default at runtime,
  -- so the admin Settings page can change pricing without a redeploy.
  CREATE TABLE IF NOT EXISTS app_setting (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- feedback — thumbs up/down on a comp, with an optional reason on a thumbs-down.
  CREATE TABLE IF NOT EXISTS feedback (
    id             TEXT PRIMARY KEY,
    location_id    TEXT NOT NULL REFERENCES location(id),
    snapshot_id    TEXT REFERENCES property_snapshot(id),
    address        TEXT,
    contact_name   TEXT,
    rating         TEXT NOT NULL CHECK (rating IN ('up','down')),
    reason         TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- ticket — a support ticket a rep raised from the tool when a comp errored.
  CREATE TABLE IF NOT EXISTS ticket (
    id             TEXT PRIMARY KEY,
    location_id    TEXT NOT NULL REFERENCES location(id),
    snapshot_id    TEXT REFERENCES property_snapshot(id),
    address        TEXT,
    contact_name   TEXT,
    category       TEXT,
    message        TEXT,
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- 8.1.5 admin_user — for the oversight panel only (not end users).
  CREATE TABLE IF NOT EXISTS admin_user (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin','admin')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `);

  // ── Idempotent migrations for columns added after the initial release ──
  const snapCols = db.prepare('PRAGMA table_info(property_snapshot)').all() as { name: string }[];
  if (!snapCols.some((c) => c.name === 'ghl_contact_name')) {
    db.exec('ALTER TABLE property_snapshot ADD COLUMN ghl_contact_name TEXT');
  }
}
