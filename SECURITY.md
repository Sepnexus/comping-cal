# Security

## Secrets & configuration

No secrets are committed to this repository. All credentials live in a local,
git-ignored `.env` (see `.env.example` for the full list):

- `BRICKED_API_KEY` — Bricked.ai API key (server-side only; never sent to the browser)
- `GHL_API_KEY`, `GHL_CONTACT_URL`, `GHL_CHARGE_URL`, `GHL_WRITEBACK_URL` — agency endpoints
- `LAUNCH_PASSWORD` — shared launch secret in the GHL custom-JS button
- `HMAC_SECRET`, `ADMIN_JWT_SECRET` — server-side auth secrets

When deploying, supply these via your platform's secret manager (or the
`docker-compose.yml` `environment:` block, which reads them from `.env` via
substitution). Rotate any key that may have been exposed.

### Notes specific to this app

- **Launch password is client-visible.** It's embedded in the GHL custom JS, so it
  is readable by anyone who can view the contact page source. This is an accepted
  trade-off of the button model — access still scopes data per `location_id`, and
  the per-comp charge is enforced by your billing endpoint. For stronger isolation,
  switch the custom JS to fetch a per-location HMAC token at load instead.
- **All external calls are server-side.** The Bricked key and GHL endpoints are
  never exposed to the browser; the frontend only talks to this app's `/api`.
- **Tenant isolation.** Every query is scoped by `location_id`; one sub-account
  cannot read another's snapshots, history, or usage.
- **Admin** is JWT-protected behind a separate login.

## Reporting a vulnerability

Email **akshay@sepnexus.com** with details and reproduction steps. Please do not
open a public issue for security reports.
