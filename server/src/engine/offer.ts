/**
 * Offer / MAO math — runs entirely on saved snapshot data, so it is always free
 * (FRD R2 / §6.3). Eight underwriting strategies from the design spec.
 */
export type StrategyId =
  | 'wholesale'
  | 'flip'
  | 'novation'
  | 'rental'
  | 'subjectto'
  | 'sellerfinance'
  | 'brrrr'
  | 'hardmoney';

export interface OfferInputs {
  arv: number;
  cmv: number;
  repairCost: number;
  rentEstimate: number;
}

export interface OfferResult {
  strategy: StrategyId;
  label: string;
  offer: number;
  mao: number;
  notes: string;
}

const STRATEGY_LABELS: Record<StrategyId, string> = {
  wholesale: 'Wholesale (Cash)',
  flip: 'Fix & Flip',
  novation: 'Novation',
  rental: 'Rental (Equity-Based)',
  subjectto: 'Subject-To',
  sellerfinance: 'Seller Finance',
  brrrr: 'BRRRR',
  hardmoney: 'Hard Money Lender',
};

export function computeOffer(strategy: StrategyId, i: OfferInputs): OfferResult {
  const { arv, repairCost, rentEstimate } = i;
  let offer = 0;
  let notes = '';
  switch (strategy) {
    case 'wholesale': {
      // MAO = ARV*0.70 - repairs - assignment fee
      const mao = arv * 0.7 - repairCost - 12000;
      offer = mao;
      notes = '70% rule less repairs and a $12k assignment fee.';
      break;
    }
    case 'flip': {
      const mao = arv * 0.75 - repairCost - arv * 0.1; // resale + holding costs ~10%
      offer = mao;
      notes = 'Covers rehab, ~10% resale/holding costs and target profit.';
      break;
    }
    case 'novation': {
      offer = arv * 0.85 - repairCost - arv * 0.08;
      notes = 'Retail exit; max offer after ~8% resale costs.';
      break;
    }
    case 'rental': {
      // work back from 20% target equity at purchase
      offer = arv * 0.8 - repairCost * 0.5;
      notes = 'Priced to a 20% equity cushion at purchase.';
      break;
    }
    case 'subjectto': {
      offer = arv * 0.62;
      notes = 'Assume existing financing; value from monthly cash flow.';
      break;
    }
    case 'sellerfinance': {
      offer = Math.min(arv, rentEstimate * 12 * 11);
      notes = 'Backed out from rent at an ~11x gross multiple.';
      break;
    }
    case 'brrrr': {
      offer = arv * 0.75 - repairCost; // refi at 75% LTV, cash-left-in = 0 target
      notes = 'Refi at 75% LTV targeting $0 cash left in.';
      break;
    }
    case 'hardmoney': {
      offer = arv * 0.7 - repairCost - arv * 0.04; // points ~4%
      notes = 'Loan covers purchase + repairs; ~4% points from margin.';
      break;
    }
  }
  const mao = Math.max(0, Math.round(offer));
  return { strategy, label: STRATEGY_LABELS[strategy], offer: mao, mao, notes };
}

export const STRATEGIES = Object.keys(STRATEGY_LABELS) as StrategyId[];
