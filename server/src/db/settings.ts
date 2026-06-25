import { db } from './index.js';
import { config } from '../config.js';

/**
 * Editable global settings. Each value falls back to the env config when no DB row
 * exists, so the admin Settings page can manage pricing AND the integration keys
 * (Bricked, GHL endpoints, launch password) at runtime — no redeploy, no SSH/nano.
 * The engine, adapters, and auth read these (not the raw env) so changes take effect
 * immediately. `.env` only needs the bootstrap minimum (server secrets + admin login).
 */
const NUM = {
  perCompPrice: 'default_per_comp_price',
  brickedCost: 'bricked_cost',
  globalCostCeiling: 'global_cost_ceiling',
  compLookback: 'comp_lookback_months',
} as const;

const STR = {
  brickedApiKey: 'bricked_api_key',
  ghlContactUrl: 'ghl_contact_url',
  ghlLocationUrl: 'ghl_location_url',
  ghlChargeUrl: 'ghl_charge_url',
  ghlWritebackUrl: 'ghl_writeback_url',
  ghlApiKey: 'ghl_api_key',
  launchPassword: 'launch_password',
} as const;

const get = db.prepare('SELECT value FROM app_setting WHERE key = ?');
const upsert = db.prepare(
  'INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

function readNum(key: string, fallback: number): number {
  const row = get.get(key) as { value: string } | undefined;
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function readStr(key: string, fallback: string): string {
  const row = get.get(key) as { value: string } | undefined;
  return row != null ? row.value : fallback;
}

export const settings = {
  // ── pricing / limits (numbers) ──
  perCompPrice: () => readNum(NUM.perCompPrice, config.defaultPerCompPrice),
  brickedCost: () => readNum(NUM.brickedCost, config.defaultBrickedCost),
  globalCostCeiling: () => readNum(NUM.globalCostCeiling, config.globalCostCeiling),
  compLookback: () => readNum(NUM.compLookback, 12),

  // ── integrations (strings; env is the initial value) ──
  brickedApiKey: () => readStr(STR.brickedApiKey, config.bricked.apiKey),
  ghlContactUrl: () => readStr(STR.ghlContactUrl, config.ghl.contactUrl),
  ghlLocationUrl: () => readStr(STR.ghlLocationUrl, config.ghl.locationUrl),
  ghlChargeUrl: () => readStr(STR.ghlChargeUrl, config.ghl.chargeUrl),
  ghlWritebackUrl: () => readStr(STR.ghlWritebackUrl, config.ghl.writebackUrl),
  ghlApiKey: () => readStr(STR.ghlApiKey, config.ghl.apiKey),
  launchPassword: () => readStr(STR.launchPassword, config.launchPassword),

  all() {
    return {
      defaultPerCompPrice: this.perCompPrice(),
      brickedCost: this.brickedCost(),
      globalCostCeiling: this.globalCostCeiling(),
      compLookback: this.compLookback(),
    };
  },

  /** Persist a subset of the numeric settings (validated, non-negative). */
  update(patch: Partial<{ defaultPerCompPrice: number; brickedCost: number; globalCostCeiling: number; compLookback: number }>) {
    const map: [number | undefined, string][] = [
      [patch.defaultPerCompPrice, NUM.perCompPrice],
      [patch.brickedCost, NUM.brickedCost],
      [patch.globalCostCeiling, NUM.globalCostCeiling],
      [patch.compLookback, NUM.compLookback],
    ];
    db.transaction(() => {
      for (const [v, key] of map) if (v != null && Number.isFinite(v) && v >= 0) upsert.run(key, String(v));
    })();
    return this.all();
  },

  /**
   * Persist integration settings. Modes/URLs/launch password update whenever a value
   * is provided (URLs may be cleared with ''); secret KEYS only update when a real new
   * value is given, so saving the form without retyping a key never blanks it.
   */
  updateIntegration(patch: {
    brickedApiKey?: string;
    ghlContactUrl?: string;
    ghlLocationUrl?: string;
    ghlChargeUrl?: string;
    ghlWritebackUrl?: string;
    ghlApiKey?: string;
    launchPassword?: string;
  }) {
    const setIf = (key: string, v: unknown) => {
      if (typeof v === 'string') upsert.run(key, v);
    };
    const setSecretIf = (key: string, v: unknown) => {
      if (typeof v === 'string' && v.trim() !== '') upsert.run(key, v.trim());
    };
    db.transaction(() => {
      setIf(STR.ghlContactUrl, patch.ghlContactUrl);
      setIf(STR.ghlLocationUrl, patch.ghlLocationUrl);
      setIf(STR.ghlChargeUrl, patch.ghlChargeUrl);
      setIf(STR.ghlWritebackUrl, patch.ghlWritebackUrl);
      setIf(STR.launchPassword, patch.launchPassword);
      setSecretIf(STR.brickedApiKey, patch.brickedApiKey);
      setSecretIf(STR.ghlApiKey, patch.ghlApiKey);
    })();
  },
};
