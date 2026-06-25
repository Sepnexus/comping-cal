# Bricked Comping Tool for GoHighLevel

An embedded GHL tool that pulls AI property comps, ARV, CMV and repair estimates
from Bricked.ai, **scoped per sub-account and billed to the GHL wallet**. Built to
the FRD (`Bricked_GHL_Tool_FRD.docx`) and the Closer Control design system.

This is a working full-stack implementation:

- **Backend** — Node + Express + TypeScript, SQLite (schema mirrors the FRD's
  Postgres tables 1:1), HMAC per-location auth, the free-vs-paid billing engine,
  idempotency, and the admin oversight API.
- **Frontend** — Vite + React + TypeScript, pixel-faithful to the design comp
  (Hanken Grotesk + Geist Mono, sage-green brand, light/dark themes).
- **Bricked + GHL** live behind swappable adapters. They run in **mock mode** by
  default (realistic data, no network, deterministic error injection for QA), and
  flip to **live mode** by setting two env vars + your real keys.

> The unit of identity is the **location** (GHL sub-account). No end user ever
> sees a wallet balance or a price — billing is invisible and charged to the
> prepaid GHL wallet.

---

## Quick start

```bash
# from the repo root
cp .env.example .env          # defaults work out of the box (mock mode)
npm install                   # installs root + server + web workspaces
npm run seed                  # clean DB: one admin + one active test location
npm run dev                   # starts API (:8787) and web (:5273) together
```

`npm run seed` creates a **clean, production-shaped** database: one admin user and a
single active test location (`Sandbox`, `loc_test01`) — no demo snapshots or usage.
The seed prints a ready-to-open **launch URL** for it. (Want the rich demo dataset
for screenshots? `npm run seed:demo`. To wipe + reseed clean any time: `npm run reset`.)

Then open **http://localhost:5273**.

- **Embedded tool** — lands on the comping workspace as a launched GHL session.
  Use the header contact pill (top-left) to switch which seeded location you're
  "launched as" (this stands in for the GHL button context in dev).
- **Admin panel** — http://localhost:5273/admin/login
  Sign in with **`akshay@sepnexus.com` / `password`**.

Run the two servers separately if you prefer: `npm run dev:server` and
`npm run dev:web`.

### Or run it in Docker

One image runs the whole thing — the API server also serves the built React UI,
so it's a single container on one port. SQLite is persisted in a named volume and
seeded automatically on first boot.

```bash
docker compose up -d --build        # build + start
# open http://localhost:8088
docker compose logs -f              # follow logs
docker compose down                 # stop (keeps the data volume)
docker compose down -v              # stop and wipe the seeded database
```

Host **8088** maps to the container's 8787 so it won't clash with a local
`npm run dev`. Admin panel: http://localhost:8088/admin/login. Configuration
(secrets, `BRICKED_MODE` / `GHL_MODE`, pricing) is set via the `environment:`
block in `docker-compose.yml` — flip the modes to `live` and add keys there to run
against real Bricked / GHL.

---

## Launch model & per-location onboarding

The tool is **scoped per GHL sub-account ("location")** — never to a hardcoded
default. How a session is bound to a location:

- **Production (GHL button / SSO):** the contact button opens the tool with
  `/?locationId=<id>&contactId={{contact.id}}&token=<token>`. The `token` is the
  per-location secret — `HMAC_SHA256(server_secret, locationId)` — so it can only be
  minted with our server secret and a link for location A can't be replayed for B
  (FRD §4.2). The backend re-verifies it on every call and binds the session to that
  `locationId`; the contact's address is fetched server-side from GHL, never trusted
  from the URL. Get a location's button URL + token from **Admin → Locations →
  (row) → Launch link**.
- **Local testing:** open the test launch URL the seed prints (or copy it from the
  admin drawer). Opening `localhost` with no params falls back to a dev bootstrap so
  you can still click around.

**Auto-provisioning (onboarding).** With `AUTO_PROVISION_LOCATIONS=true` (default), a
request bearing a *valid* token for a `locationId` we haven't seen **auto-registers
that sub-account** (active, unnamed) and starts working immediately — so a freshly
installed location just works. You name it later in **Admin → Locations** (it shows
as "Unnamed location" until then). A forged/invalid token is rejected and provisions
nothing. Set `AUTO_PROVISION_LOCATIONS=false` to require every location be added to
the allowlist first (strict FRD §4.3 behaviour). When real GHL SSO is wired up, the
SSO payload becomes the provisioning proof in place of the HMAC token.

---

## Try the whole product

**Happy path (paid comp):** launched as *First Glance Homes* → "Comp this
property" → confirm the 1-use charge → result screen (ARV/CMV, comps map + cards,
property tabs, repairs chat). Re-open the same address later → it loads from the
saved snapshot **free**.

**Repairs (charge-on-generate):** in the result's Repairs Chat, type a condition
or tap a suggestion → one Bricked call, one charge, itemised costs stream in and
the Deal Analysis repair total updates.

**Offer math (free):** Deal Analysis → "Choose strategy" → pick one of 8
underwriting strategies. Runs on saved data, never charges.

**Every billing / error state is reachable:**

| State | How to trigger |
|---|---|
| Billing-issue gate | Switch location to *Riverside Holdings (wallet declined)* and run a comp |
| Access denied | Switch to *Test Location* (suspended) |
| 400 invalid address | Comp an address containing `fail400` |
| 404 not found | …containing `fail404` |
| 412 missing sqft → inline override | …containing `nosqft` (then add sqft and resubmit — charges only on success) |
| 401/402/500 service errors | …containing `fail401` / `fail402` / `fail500` |
| Address missing | Switch to a contact with no address (`contact_noaddress`) |

---

## How the FRD maps to the code

| FRD section | Where |
|---|---|
| §4 Auth — `token = HMAC_SHA256(secret, locationId)` | `server/src/util/crypto.ts`, enforced in `server/src/middleware/auth.ts` |
| §5 Bricked integration + §5.3 error table | `server/src/adapters/bricked.ts` |
| §6 Billing — charge sequence, free-vs-paid, R1–R5 | `server/src/engine/comp.ts` |
| §6.4 Offer/MAO math (free) | `server/src/engine/offer.ts` |
| §8 Database (5 tables, append-only usage_event, invariants) | `server/src/db/schema.ts`, `repos.ts` |
| §9 API endpoints | `server/src/routes/tool.ts` |
| §7.1–7.6 Tool screens + all states | `web/src/tool/` |
| §7.7 Admin panel | `web/src/admin/` |
| GHL contact fetch / wallet charge / write-back | `server/src/adapters/ghl.ts` |

### The five core rules, enforced literally

- **R1 — location is identity.** Every query is scoped by `location_id`; auth binds
  the session to one location and never trusts URL data.
- **R2 — API call = charge, DB read = free.** Viewing a snapshot, filtering,
  copying, and offer math create no charge (and no `usage_event` for pure views).
- **R3 — snapshot by default, refresh on demand.** A dedupe hit returns the latest
  snapshot free; only an explicit refresh re-pulls and bumps the version.
- **R4 — charge only after HTTP 200.** Any Bricked error logs a no-charge event and
  leaves the idempotency key unclaimed so a retry is free until it succeeds once.
- **R5 — prepaid wallet self-gates.** A 200 from Bricked followed by a failed wallet
  charge withholds the fresh result, flips to the billing-issue state, and never
  double-charges (we absorb at most one in-flight Bricked call).

---

## GHL integration (custom-JS button model)

No marketplace app, OAuth, or SSO. A **custom JS** added to the GHL agency account
injects a **"Get ARV" button** on the contact record (alongside the Zillow/Google
buttons). Clicking it opens this tool for the open contact, carrying
`locationId` + `contactId` + a **shared launch password**. Contact fetch, the
per-comp charge, and write-back all hit the agency's own endpoints.

**1. Add the button.** Paste [`integrations/ghl-comp-button.js`](integrations/ghl-comp-button.js)
into your GHL agency Custom JS and set the two constants at the top:

```js
var TOOL_URL = 'https://comps.yourdomain.com';      // where this tool is hosted
var LAUNCH_PASSWORD = 'your-shared-launch-secret';  // must match the server
```

It parses `locationId` + `contactId` from the GHL URL and opens
`TOOL_URL/?locationId=…&contactId=…&token=<password>` (new tab, or set
`OPEN_MODE='modal'` for an in-page iframe).

**2. Point the server at your endpoints.** Edit `.env`:

```bash
BRICKED_MODE=live
BRICKED_API_KEY=...                  # x-api-key, server-side only

GHL_MODE=live
GHL_CONTACT_URL=https://your-api/...    # GET  contact by ?locationId=&contactId=
GHL_CHARGE_URL=https://your-api/...     # POST per-comp charge → {status, reason}
GHL_WRITEBACK_URL=https://your-api/...  # POST {locationId, contactId, fields}
GHL_API_KEY=...                          # sent as x-api-key on the three calls
LAUNCH_PASSWORD=your-shared-launch-secret
TOOL_PUBLIC_URL=https://comps.yourdomain.com
```

**Endpoint contract** (assumed — adjust the mappers in `server/src/adapters/ghl.ts`
if your shapes differ):
- **Contact** → returns `{ name, address, … }` (or `{contact:{…}}`); the mapper
  also accepts `firstName/lastName` + `address1/city/state/postalCode`.
- **Charge** ← `{ locationId, contactId, amount, currency, idempotencyKey, type }`
  → `{ status: "success" | "failed", reason?, transactionId? }`. A `failed`
  flips the account to the **billing-issue** state and shows your `reason`; no
  Bricked credit is wasted on a blocked retry.
- **Write-back** ← `{ locationId, contactId, fields:{arv,cmv,repair_total,offer} }`.

**Auth.** A launch is valid when its `token` equals `LAUNCH_PASSWORD`. A new
sub-account that launches with a valid password **auto-registers** (active,
unnamed) — name it later in Admin → Locations. (The per-location HMAC token still
works too, if you ever want a stronger per-location secret instead of a shared one.)

> Security note: a shared password lives in client-side JS, so anyone viewing the
> GHL page source can read it. That's an accepted trade-off for this model (access
> still gates per-location data, and billing is enforced by your charge endpoint).
> For stronger isolation, switch the custom JS to fetch a per-location HMAC token at
> load instead of embedding a shared password.

### Moving off SQLite to Postgres

The schema in `server/src/db/schema.ts` is written to mirror the FRD's Postgres
tables (uuid/jsonb/numeric/timestamptz). Swapping `better-sqlite3` for `pg` is a

### Moving off SQLite to Postgres

The schema in `server/src/db/schema.ts` is written to mirror the FRD's Postgres
tables (uuid/jsonb/numeric/timestamptz). Swapping `better-sqlite3` for `pg` is a
contained change in `server/src/db/` — the repositories, engine, and routes are
unaffected.

---

## Project layout

```
server/
  src/
    config.ts                 env + pricing defaults
    db/        schema.ts repos.ts seed.ts index.ts
    adapters/  bricked.ts ghl.ts        (mock | live)
    engine/    comp.ts offer.ts         (billing core + offer math)
    middleware/auth.ts                  (HMAC tool auth, admin JWT)
    routes/    tool.ts admin.ts dev.ts
web/
  src/
    lib/       api.ts types.ts icons.tsx format.ts theme.tsx
    components/ ThemeToggle.tsx
    tool/      ToolApp.tsx WorkspaceStates.tsx ResultPanel.tsx History.tsx modals.tsx
    admin/     AdminShell/Login/Dashboard/Locations/UsageLog/Pnl/Settings.tsx
    styles/    tokens.css                (design tokens, verbatim from the comp)
```

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | API + web together |
| `npm run dev:server` / `npm run dev:web` | run one side |
| `npm run seed` | (re)create and seed the SQLite DB |
| `npm run build` | production web build |

## Notes / open items (from the FRD appendix)

- Per-comp price and Bricked cost are configurable (`.env` defaults: $0.65 charged,
  $0.33 cost) and surfaced in the admin settings + P&L. Final pricing depends on
  Bricked's reseller per-call cost (Appendix A1).
- v1 deliberately stores no per-user identity; anyone with a valid location link
  sees that location's shared CRM data (FRD §4.4).
