// Mirrors the server's public payloads (server/src/adapters/bricked.ts + engine).

export interface BrickedComp {
  id: string;
  address: string;
  adjusted_value: number;
  sale_price: number;
  selected: boolean;
  compType: string;
  source: string;
  distance: number;
  sale_date: string;
  beds: number;
  baths: number;
  squareFeet: number;
  lotAcres: number;
  yearBuilt: number;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
}

export interface BrickedProperty {
  id: string;
  subject: {
    address: string;
    beds: number | null;
    baths: number | null;
    squareFeet: number | null;
    yearBuilt: number | null;
    lotAcres: number | null;
    latitude: number | null;
    longitude: number | null;
    lastSalePrice: number | null;
    lastSaleDate: string | null;
    landUse: string | null;
    occupancy: string | null;
    apn: string | null;
    legalDescription: string | null;
    owner1: string | null;
    owner2: string | null;
    ownerType: string | null;
    openMortgageBalance: number | null;
    estimatedEquity: number | null;
    taxAmount: number | null;
  };
  comps: BrickedComp[];
  cmv: number | null;
  arv: number | null;
  rentEstimate: number | null;
  repairs: { label: string; cost: number }[];
  totalRepairCost: number;
  renovationScore: number;
  mortgages: { amount: number; rate: string; loan: string; recorded: string; lender: string }[];
  saleHistory: { date: string; amount: number; method: string; seller: string; buyer: string }[];
  images: string[];
  shareLink: string;
  dashboardLink: string;
}

export interface PublicSnapshot {
  id: string;
  locationId: string;
  ghlContactId: string | null;
  address: string;
  version: number;
  brickedPropertyId: string | null;
  arv: number | null;
  cmv: number | null;
  totalRepairCost: number | null;
  takenAt: string;
  property: BrickedProperty;
  stale: boolean;
}

export interface LaunchContext {
  locationId: string;
  contactId: string;
  token: string;
  locationName: string;
  contactName: string;
}

export interface SessionInfo {
  location: { id: string; ghlLocationId: string; name: string; status: string };
  contact: { id: string; name: string; address: string; notes: string | null } | null;
}

export interface HistoryItem {
  id: string;
  address: string;
  arv: number | null;
  totalRepairCost: number | null;
  takenAt: string;
  version: number;
  stale: boolean;
  status: 'Snapshot' | 'Refreshed' | 'Stale';
  image: string | null;
}

export type StrategyId =
  | 'wholesale' | 'flip' | 'novation' | 'rental'
  | 'subjectto' | 'sellerfinance' | 'brrrr' | 'hardmoney';

export interface OfferResult {
  strategy: StrategyId;
  label: string;
  offer: number;
  mao: number;
  notes: string;
}

export interface CompFallback {
  ok: false;
  status?: number;
  billingIssue?: boolean;
  fallback?: { kind: string; message: string };
  kind?: string;
  message?: string;
  error?: string;
}
