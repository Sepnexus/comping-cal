import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { config } from './config.js';
import './db/index.js'; // applies schema on import
import { settings } from './db/settings.js';
import { toolRouter } from './routes/tool.js';
import { adminRouter } from './routes/admin.js';
import { devRouter } from './routes/dev.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'bricked-comping', brickedMode: settings.brickedMode(), ghlMode: settings.ghlMode() }),
);

app.use('/api', toolRouter); // tool endpoints (FRD §9)
app.use('/api/admin', adminRouter); // admin oversight (FRD §7.7)
app.use('/api/dev', devRouter); // local launch bootstrap (mock mode only)

// Unmatched API routes → neutral JSON 404 (scoped to /api so the SPA fallback below
// can own every other path).
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// Serve the built React SPA when present (production / Docker). In dev the Vite
// server handles the UI and proxies /api here, so this block is simply skipped.
const webDist = process.env.WEB_DIST ?? resolve(here, '../../web/dist');
if (existsSync(join(webDist, 'index.html'))) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html'))); // SPA history fallback
  console.log(`  Serving web build from ${webDist}`);
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'server_error' });
});

app.listen(config.port, () => {
  console.log(`▸ Bricked Comping API on http://localhost:${config.port}`);
  console.log(`  Bricked: ${settings.brickedMode()} · GHL: ${settings.ghlMode()}`);
});
