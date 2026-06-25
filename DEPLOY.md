# Deploy the Comping tool to the Hostinger VPS

One Docker container serves the API **and** the React UI on `:8787`. Traefik (already
running on the box) terminates HTTPS and routes your domain to it — same pattern as
the iBuyKC dashboard. SQLite lives on a Docker volume, so data survives rebuilds.

**Assumes** the VPS already runs `root-traefik-1` on the `root_default` network with
certresolver `mytlschallenge` (same setup as your other apps).

---

## Step 1 — DNS

Point a subdomain at the VPS IP (`93.127.194.153`):

```
comps.srv844822.hstgr.cloud   A   93.127.194.153
```

(Use any host you like — just match `PUBLIC_HOST` in Step 3.)

---

## Step 2 — Clone on the VPS

```bash
ssh root@srv844822.hstgr.cloud
cd /root
git clone https://github.com/Sepnexus/comping-cal.git comping-cal
cd comping-cal
```

> Private repo? Use the server's SSH key: `git clone git@github.com:Sepnexus/comping-cal.git comping-cal`.

---

## Step 3 — Create `.env`

```bash
cp .env.vps.example .env
# generate two secrets:
echo "HMAC_SECRET=$(openssl rand -hex 32)"
echo "ADMIN_JWT_SECRET=$(openssl rand -hex 32)"
nano .env
```

Fill in:
- `PUBLIC_HOST` + `TOOL_PUBLIC_URL` — your domain from Step 1.
- `HMAC_SECRET`, `ADMIN_JWT_SECRET` — paste the generated values.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your admin login (created on first boot).
- `BRICKED_API_KEY` — the live Bricked key (`BRICKED_MODE=live`).
- `GHL_CONTACT_URL`, `GHL_CHARGE_URL`, `GHL_WRITEBACK_URL`, `GHL_API_KEY` — your GHL
  endpoints (`GHL_MODE=live`). Leave blank + set `GHL_MODE=mock` to launch without
  GHL wired yet (Bricked still runs live).
- `LAUNCH_PASSWORD` — the shared secret you'll also put in the contact button JS.

Save: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Step 4 — Build & start

```bash
docker compose -f docker-compose.vps.yml up -d --build
docker logs -f comping-cal
```

First build ~2–4 min. You should see:

```
✓ Clean database ready.
  Admin login : <your ADMIN_EMAIL>
▸ Bricked Comping API on http://localhost:8787
  Serving web build from /app/web/dist
  Bricked: live · GHL: live
  Location onboarding: auto-provision (TOFU)
```

`Ctrl+C` stops tailing; the container keeps running.

---

## Step 5 — Verify

Wait ~30s for Traefik to issue the SSL cert, then:

```bash
curl -I https://comps.srv844822.hstgr.cloud/api/health     # → HTTP/2 200
```

Open **https://comps.srv844822.hstgr.cloud/admin/login** and sign in with your admin creds.

---

## Step 6 — Wire the GHL button

Edit [`integrations/ghl-comp-button.js`](integrations/ghl-comp-button.js), set:

```js
var TOOL_URL = 'https://comps.srv844822.hstgr.cloud';
var LAUNCH_PASSWORD = '<the same LAUNCH_PASSWORD from .env>';
```

Paste it into the GHL agency **Custom JS**. A "Get ARV" button appears on contacts;
clicking it opens the tool for that contact. First launch from a sub-account
auto-registers the location (name it later in Admin → Locations).

---

## Updating later

```bash
ssh root@srv844822.hstgr.cloud
cd /root/comping-cal
git pull
docker compose -f docker-compose.vps.yml up -d --build
```

The `comping-data` volume (SQLite) survives — only the app code is rebuilt.

---

## Common problems

**`network root_default not found`** — `docker network ls` to find the real name and
replace `root_default` at the bottom of `docker-compose.vps.yml`.

**Traefik returns 404** — confirm the container is on the right network:
```bash
docker inspect comping-cal --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'   # → root_default
```

**SSL cert never appears** — confirm DNS resolves to the VPS:
```bash
dig comps.srv844822.hstgr.cloud +short    # → 93.127.194.153
```
Wait ~60s for first issuance.

**Container restart loop** — `docker logs --tail 200 comping-cal` and look for a config/env error.

**Reset to a clean DB (wipes saved comps + locations)**
```bash
docker exec comping-cal npm run reset -w server
# or, full wipe incl. volume:
docker compose -f docker-compose.vps.yml down -v && docker compose -f docker-compose.vps.yml up -d --build
```

---

## Remove

```bash
cd /root/comping-cal
docker compose -f docker-compose.vps.yml down      # keeps the data volume
docker compose -f docker-compose.vps.yml down -v    # also wipes the SQLite volume
```

Your other containers (traefik, postgresql, n8n, the iBuyKC dashboards) are untouched.
