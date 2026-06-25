// Underwriting calculators — pure offer math on saved snapshot data (always free).
// Each strategy mirrors the Bricked deal calculators: editable %/$ inputs, a live
// breakdown, and (for rental/sub-to) a footer of derived metrics.
import { money } from '../lib/format';

export type InputKind = 'pct' | 'usd';

export interface StratInput {
  key: string;
  label: string;
  kind: InputKind;
  def: number; // default value; if `dyn` set, the dynamic default overrides it
  basis?: 'arv'; // pct inputs resolve against this dollar basis
  dyn?: 'rent'; // seed the default from the snapshot's rent estimate
  help?: string;
}

export interface BreakdownRow {
  label: string;
  amount: number; // >0 shown as a credit (value), <0 as a deduction
}

export interface FooterStat {
  label: string;
  value: string;
}

export interface StratResult {
  price: number;
  breakdown: BreakdownRow[];
  footer?: FooterStat[];
}

export interface StratBase {
  arv: number;
  repairs: number;
  rent: number;
}

export interface StratDef {
  id: string;
  label: string;
  /** label for the auto valuation row (ARV / Property Value / List Price). */
  valueLabel: string;
  inputs: StratInput[];
  compute: (base: StratBase, v: Record<string, number>) => StratResult;
}

/** Resolve one input to a dollar amount (pct of basis, or a flat $). */
export function dollarOf(input: StratInput, base: StratBase, value: number): number {
  if (input.kind === 'pct') return Math.round((base.arv * value) / 100);
  return Math.round(value);
}

const r = (n: number) => Math.round(n);

export const STRATEGIES: StratDef[] = [
  {
    id: 'wholesale',
    label: 'Wholesale (Cash)',
    valueLabel: 'ARV / CMV',
    inputs: [
      { key: 'holding', label: 'Holding Costs', kind: 'pct', def: 5, basis: 'arv', help: 'Carrying costs while you hold the contract.' },
      { key: 'closing', label: 'Closing Costs', kind: 'pct', def: 7, basis: 'arv', help: 'Title, escrow and closing fees.' },
      { key: 'profit', label: 'Buyer Profit', kind: 'pct', def: 15, basis: 'arv', help: 'Margin you leave for the end cash buyer.' },
      { key: 'fee', label: 'Wholesale Fee', kind: 'usd', def: 10000, help: 'Your assignment fee on the deal.' },
    ],
    compute(base, v) {
      const holding = r((base.arv * v.holding) / 100);
      const closing = r((base.arv * v.closing) / 100);
      const profit = r((base.arv * v.profit) / 100);
      const fee = r(v.fee);
      const price = r(base.arv - base.repairs - holding - closing - profit - fee);
      return {
        price,
        breakdown: [
          { label: 'After Repair Value', amount: base.arv },
          { label: 'Repairs', amount: -base.repairs },
          { label: 'Holding', amount: -holding },
          { label: 'Closing', amount: -closing },
          { label: 'Wholesale Fee', amount: -fee },
          { label: 'Buyer Profit', amount: -profit },
        ],
      };
    },
  },
  {
    id: 'flip',
    label: 'Fix & Flip',
    valueLabel: 'ARV',
    inputs: [
      { key: 'closing', label: 'Closing Costs', kind: 'pct', def: 2, basis: 'arv', help: 'Purchase-side closing fees.' },
      { key: 'holding', label: 'Holding Costs', kind: 'pct', def: 5, basis: 'arv', help: 'Carry costs during the rehab.' },
      { key: 'selling', label: 'Selling Costs', kind: 'pct', def: 8, basis: 'arv', help: 'Agent commission + closing on resale.' },
      { key: 'profit', label: 'Target Profit', kind: 'pct', def: 15, basis: 'arv', help: 'Your profit target on the flip.' },
    ],
    compute(base, v) {
      const closing = r((base.arv * v.closing) / 100);
      const holding = r((base.arv * v.holding) / 100);
      const selling = r((base.arv * v.selling) / 100);
      const profit = r((base.arv * v.profit) / 100);
      const price = r(base.arv - base.repairs - closing - holding - selling - profit);
      return {
        price,
        breakdown: [
          { label: 'ARV', amount: base.arv },
          { label: 'Repairs', amount: -base.repairs },
          { label: 'Closing', amount: -closing },
          { label: 'Holding', amount: -holding },
          { label: 'Selling', amount: -selling },
          { label: 'Target Profit', amount: -profit },
        ],
      };
    },
  },
  {
    id: 'novation',
    label: 'Novation',
    valueLabel: 'Property Value',
    inputs: [
      { key: 'commission', label: 'Agent Commission', kind: 'pct', def: 6, basis: 'arv', help: 'Listing + buyer agent commission.' },
      { key: 'sellerClosing', label: 'Seller Closing Costs', kind: 'pct', def: 2, basis: 'arv', help: 'Seller-side closing fees.' },
      { key: 'concessions', label: 'Seller Concessions', kind: 'usd', def: 0, help: 'Credits given to the buyer at closing.' },
      { key: 'novationFee', label: 'Novation Fee', kind: 'pct', def: 5, basis: 'arv', help: 'Your fee for the novation agreement.' },
    ],
    compute(base, v) {
      const commission = r((base.arv * v.commission) / 100);
      const sellerClosing = r((base.arv * v.sellerClosing) / 100);
      const concessions = r(v.concessions);
      const novationFee = r((base.arv * v.novationFee) / 100);
      const price = r(base.arv - base.repairs - commission - sellerClosing - concessions - novationFee);
      return {
        price,
        breakdown: [
          { label: 'Property Value', amount: base.arv },
          { label: 'Repairs', amount: -base.repairs },
          { label: 'Commission', amount: -commission },
          { label: 'Seller Closing', amount: -sellerClosing },
          { label: 'Seller Concessions', amount: -concessions },
          { label: 'Novation Fee', amount: -novationFee },
        ],
      };
    },
  },
  {
    id: 'rental',
    label: 'Rental (Equity-Based)',
    valueLabel: 'ARV / CMV',
    inputs: [
      { key: 'rent', label: 'Monthly Rent', kind: 'usd', def: 0, dyn: 'rent', help: 'Estimated monthly rent.' },
      { key: 'closing', label: 'Closing Costs', kind: 'pct', def: 1, basis: 'arv', help: 'Purchase closing fees.' },
      { key: 'holding', label: 'Holding Costs', kind: 'pct', def: 1, basis: 'arv', help: 'Carry costs to stabilize.' },
      { key: 'equity', label: 'Target Equity', kind: 'pct', def: 20, basis: 'arv', help: 'Equity cushion to keep at purchase.' },
      { key: 'fee', label: 'Wholesale Fee', kind: 'usd', def: 5000, help: 'Acquisition / wholesale fee.' },
    ],
    compute(base, v) {
      const closing = r((base.arv * v.closing) / 100);
      const holding = r((base.arv * v.holding) / 100);
      const equity = r((base.arv * v.equity) / 100);
      const fee = r(v.fee);
      const price = r(base.arv - base.repairs - closing - holding - fee - equity);
      const allIn = price + base.repairs + closing + holding + fee;
      const rentPct = allIn > 0 ? (v.rent / allIn) * 100 : 0;
      return {
        price,
        breakdown: [
          { label: 'ARV / CMV', amount: base.arv },
          { label: 'Repairs', amount: -base.repairs },
          { label: 'Closing', amount: -closing },
          { label: 'Holding', amount: -holding },
          { label: 'Wholesale Fee', amount: -fee },
          { label: 'Target Equity', amount: -equity },
        ],
        footer: [
          { label: 'All-In Cost', value: money(allIn) },
          { label: 'Equity %', value: `${v.equity.toFixed(2)}%` },
          { label: 'Rent %', value: `${rentPct.toFixed(2)}%` },
        ],
      };
    },
  },
  {
    id: 'subjectto',
    label: 'Subject-To',
    valueLabel: 'List Price',
    inputs: [
      { key: 'mortgage', label: 'Mortgage Balance', kind: 'usd', def: 0, help: 'Existing loan you take over.' },
      { key: 'payment', label: 'Monthly Payment', kind: 'usd', def: 0, help: 'PITI on the existing loan.' },
      { key: 'rent', label: 'Monthly Rent', kind: 'usd', def: 0, dyn: 'rent', help: 'Estimated monthly rent.' },
      { key: 'cash', label: 'Cash to Seller', kind: 'usd', def: 0, help: 'Cash you bring to the seller.' },
    ],
    compute(base, v) {
      const mortgage = r(v.mortgage);
      const cash = r(v.cash);
      const price = cash; // cash needed to acquire (you assume the mortgage)
      const sellerEquity = r(base.arv - mortgage);
      const yourEquity = r(base.arv - mortgage - base.repairs - cash);
      const monthlySpread = r(v.rent - v.payment);
      const annualSpread = monthlySpread * 12;
      const cashInvested = cash;
      const coc = cashInvested > 0 ? `${((annualSpread / cashInvested) * 100).toFixed(1)}%` : 'N/A';
      const months = monthlySpread > 0 && cashInvested > 0 ? String(Math.ceil(cashInvested / monthlySpread)) : 'N/A';
      return {
        price,
        breakdown: [
          { label: 'Mortgage Balance', amount: -mortgage },
          { label: 'Cash to Seller', amount: cash },
        ],
        footer: [
          { label: 'Seller Equity', value: money(sellerEquity) },
          { label: 'Repairs', value: money(base.repairs) },
          { label: 'Your Equity', value: money(yourEquity) },
          { label: 'Monthly Spread', value: money(monthlySpread) },
          { label: 'Annual Spread', value: money(annualSpread) },
          { label: 'Cash Invested', value: money(cashInvested) },
          { label: 'Cash-on-Cash Return', value: coc },
          { label: 'Months to Profitability', value: months },
        ],
      };
    },
  },
];

export function strategyById(id: string): StratDef | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

/** Seed input values from a strategy's defaults (and dynamic rent default). */
export function defaultValues(def: StratDef, base: StratBase): Record<string, number> {
  const v: Record<string, number> = {};
  for (const inp of def.inputs) v[inp.key] = inp.dyn === 'rent' ? Math.round(base.rent) : inp.def;
  return v;
}
