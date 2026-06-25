# syntax=docker/dockerfile:1

# ── Build stage: install all workspace deps (compiles better-sqlite3 for linux)
#    and produce the static React build. ───────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install

# Copy sources (node_modules / dist / data excluded via .dockerignore) and build UI.
COPY . .
RUN npm run build -w web

# ── Runtime stage: same base (ABI-compatible native modules), no build tools. ──
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /app/server/data
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8787
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
