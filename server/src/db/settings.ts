import { db } from './index.js';
import { config } from '../config.js';

/**
 * Editable global defaults. Each value falls back to the env config when no row
 * exists, so the admin Settings page can override pricing/limits at runtime without
 * a redeploy. The comp engine reads these (not the raw env) so changes take effect
 * on the next comp.
 */
const KEYS = {
  perCompPrice: 'default_per_comp_price',
  brickedCost: 'bricked_cost',
  globalCostCeiling: 'global_cost_ceiling',
  compLookback: 'comp_lookback_months',
} as const;

function readNum(key: string, fallback: number): number {
  const row = db.prepare('SELECT value FROM app_setting WHERE key = ?').get(key) as { value: string } | undefined;
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function write(key: string, value: number): void {
  db.prepare(
    'INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(value));
}

export const settings = {
  perCompPrice: () => readNum(KEYS.perCompPrice, config.defaultPerCompPrice),
  brickedCost: () => readNum(KEYS.brickedCost, config.defaultBrickedCost),
  globalCostCeiling: () => readNum(KEYS.globalCostCeiling, config.globalCostCeiling),
  compLookback: () => readNum(KEYS.compLookback, 12),

  all() {
    return {
      defaultPerCompPrice: this.perCompPrice(),
      brickedCost: this.brickedCost(),
      globalCostCeiling: this.globalCostCeiling(),
      compLookback: this.compLookback(),
    };
  },

  /** Persist any subset of the editable settings (validated numbers only). */
  update(patch: Partial<{ defaultPerCompPrice: number; brickedCost: number; globalCostCeiling: number; compLookback: number }>) {
    const map: [number | undefined, string][] = [
      [patch.defaultPerCompPrice, KEYS.perCompPrice],
      [patch.brickedCost, KEYS.brickedCost],
      [patch.globalCostCeiling, KEYS.globalCostCeiling],
      [patch.compLookback, KEYS.compLookback],
    ];
    const tx = db.transaction(() => {
      for (const [v, key] of map) {
        if (v != null && Number.isFinite(v) && v >= 0) write(key, v);
      }
    });
    tx();
    return this.all();
  },
};
