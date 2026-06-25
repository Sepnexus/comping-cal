import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { applySchema } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH ?? resolve(dataDir, 'comping.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

applySchema(db);

export type DB = typeof db;
