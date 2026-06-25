#!/bin/sh
set -e

DB="${DB_PATH:-/app/server/data/comping.db}"

# Seed once on first boot (idempotent if you delete the volume to reset).
if [ ! -f "$DB" ]; then
  echo "[entrypoint] no database found — seeding demo data…"
  npm run seed -w server
else
  echo "[entrypoint] existing database found at $DB — skipping seed."
fi

echo "[entrypoint] starting Bricked Comping (API + web) on :${PORT:-8787}"
exec npm run start -w server
