import { config } from '../config.js';
import { settings } from '../db/settings.js';

/**
 * Bricked.ai integration (FRD §5). Auth is x-api-key, server-side only — the key
 * never reaches the browser. GET /v1/property/create is the only call that costs
 * money. We store the full raw response (schema-drift tolerant).
 */

export interface CompPriceEvent {
  date: string;
  status: string;
  amount: number;
  pricePerSqft: number | null;
}

export interface BrickedComp {
  id: string;
  address: string;
  adjusted_value: number;
  sale_price: number;
  selected: boolean;
  compType: string;
  source: string; // mls_sold | public_record | mls_active | mls_pending
  distance: number; // miles
  sale_date: string;
  beds: number;
  baths: number;
  squareFeet: number;
  lotAcres: number;
  yearBuilt: number;
  latitude: number | null;
  longitude: number | null;
  image: string | null; // best single photo for the card
  images: string[]; // full photo set for the detail modal gallery
  // Detail-modal extras (all optional — surfaced when Bricked provides them)
  pricePerSqft: number | null;
  occupancy: string | null;
  stories: number | null;
  heatingType: string | null;
  acType: string | null;
  exteriorWallType: string | null;
  garageType: string | null;
  hoaPresent: string | null;
  mlsStatus: string | null;
  mlsNumber: string | null;
  mlsName: string | null;
  agentName: string | null;
  daysOnMarket: number | null;
  priceHistory: CompPriceEvent[];
}

export interface BrickedRepair {
  label: string;
  cost: number;
}

export interface TaxYear {
  year: number | null;
  assessedValue: number | null;
  taxAmount: number | null;
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
    // details
    occupancy: string | null;
    stories: number | null;
    basementType: string | null;
    basementSquareFeet: number | null;
    airConditioningType: string | null;
    heatingType: string | null;
    heatingFuelType: string | null;
    hoaPresent: string | null;
    hoaFee: number | null;
    hoaFeeFrequency: string | null;
    fireplaces: number | null;
    exteriorWallType: string | null;
    daysOnMarket: number | null;
    marketStatus: string | null;
    legalDescription: string | null;
    // land / location
    landUse: string | null;
    apn: string | null;
    propertyClass: string | null;
    lotNumber: string | null;
    block: string | null;
    schoolDistrict: string | null;
    subdivision: string | null;
    countyName: string | null;
    // mortgage / debt
    openMortgageBalance: number | null;
    estimatedEquity: number | null;
    purchaseMethod: string | null;
    ltvRatio: number | null;
    itvRatio: number | null;
    // ownership
    owner1: string | null;
    owner2: string | null;
    ownerType: string | null;
    ownerOccupancy: string | null;
    taxAmount: number | null;
  };
  taxes: TaxYear[];
  comps: BrickedComp[];
  cmv: number | null;
  arv: number | null;
  rentEstimate: number | null;
  repairs: BrickedRepair[];
  totalRepairCost: number;
  renovationScore: number | null; // 0..1 confidence, null when Bricked has no score
  images: string[];
  shareLink: string;
  dashboardLink: string;
  /** Persisted underwriting offer (client-saved, free math). Null until chosen. */
  savedOffer: SavedOffer | null;
}

export interface SavedOffer {
  strategy: string;
  label: string;
  price: number;
  inputs: Record<string, number>;
  savedAt: string;
}

export interface CreatePropertyParams {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  landUse?: string;
  images?: string; // comma-separated URLs
  repairs?: string; // natural-language repairs
  propertyStatus?: string;
  timeframe?: number;
  searchRadiusMiles?: number;
}

export type BrickedResult =
  | { ok: true; status: 200; property: BrickedProperty }
  | { ok: false; status: 400 | 401 | 402 | 404 | 412 | 500; error: string };

// ── Mock data builder (BRICKED_MODE=mock) ────────────────────────────────────
// Values mirror the design-comp reference property at 115 Orangeview Ave.
function mockProperty(params: CreatePropertyParams): BrickedProperty {
  const repairsText = (params.repairs ?? '').toLowerCase();
  const hasRepairs = repairsText.length > 0;
  const repairs: BrickedRepair[] = hasRepairs
    ? [
        { label: 'Kitchen refresh', cost: 9500 },
        { label: 'Bath update', cost: 6200 },
        { label: `Flooring · ${params.squareFeet ?? 1225} sqft`, cost: 5800 },
        { label: 'Interior paint', cost: 3500 },
      ]
    : [];
  const totalRepairCost = repairs.reduce((s, r) => s + r.cost, 0);
  const id = 'bp_' + Math.abs(hashStr(params.address)).toString(36).slice(0, 10);
  // Vary valuations deterministically by address so history/comps look realistic
  // (±18% around the reference figures) without changing the integration shape.
  const k = 0.82 + (Math.abs(hashStr(params.address)) % 360) / 1000; // 0.82..1.18
  const r2 = (n: number) => Math.round((n * k) / 500) * 500;

  return {
    id,
    subject: {
      address: params.address,
      beds: params.bedrooms ?? 2,
      baths: params.bathrooms ?? 2,
      squareFeet: params.squareFeet ?? 1225,
      yearBuilt: params.yearBuilt ?? 1950,
      lotAcres: 0.23,
      latitude: 27.967423,
      longitude: -82.778087,
      lastSalePrice: 250000,
      lastSaleDate: '5/15/2026',
      occupancy: 'Non-Owner Occupied',
      stories: 1,
      basementType: 'None',
      basementSquareFeet: null,
      airConditioningType: 'Central',
      heatingType: 'Forced Air',
      heatingFuelType: 'Gas',
      hoaPresent: 'No',
      hoaFee: null,
      hoaFeeFrequency: null,
      fireplaces: 1,
      exteriorWallType: 'Wood',
      daysOnMarket: 34,
      marketStatus: 'Off Market',
      legalDescription: 'RUSSELLS SUB BLK 1, LOT 3',
      landUse: params.landUse ?? 'Single Family Residential',
      apn: '14-29-15-77598-001-0030',
      propertyClass: 'Residential',
      lotNumber: '3',
      block: '1',
      schoolDistrict: 'Pinellas County School District',
      subdivision: 'RUSSELLS SUB',
      countyName: 'Pinellas',
      openMortgageBalance: 297000,
      estimatedEquity: -24000,
      purchaseMethod: 'Financed',
      ltvRatio: 0.88,
      itvRatio: 0.81,
      owner1: 'JAE ENTERPRISES LLC',
      owner2: null,
      ownerType: 'CORPORATE',
      ownerOccupancy: 'Non-Owner Occupied',
      taxAmount: 4478,
    },
    taxes: [
      { year: 2025, assessedValue: 312000, taxAmount: 4478 },
      { year: 2024, assessedValue: 298000, taxAmount: 4201 },
      { year: 2023, assessedValue: 281000, taxAmount: 3998 },
    ],
    comps: [
      mkComp('1', '111 Orangeview Ave, Clearwater, FL 33755-5229', 382000, '5/26/2026', 0.01, 3, 2, 1248, 0.2, 1950, true, 27.967217, -82.778086),
      mkComp('2', '119 N Hillcrest Ave, Clearwater, FL 33755-5143', 357000, '10/24/2025', 0.06, 2, 2, 1140, 0.2, 1951, true, 27.967636, -82.779104),
      mkComp('3', '31 N Fredrica Ave, Clearwater, FL 33755-5137', 348000, '2/11/2026', 0.29, 3, 2, 1318, 0.1, 1947, true, 27.966824, -82.782798),
      mkComp('4', '1473 Maple St, Clearwater, FL 33755-5034', 289000, '4/3/2026', 0.32, 2, 2, 1262, 0.2, 1952, false, 27.971, -82.7745),
    ],
    cmv: r2(338500),
    arv: r2(363035),
    rentEstimate: r2(2579),
    repairs,
    totalRepairCost,
    renovationScore: hasRepairs ? 0.82 : null,
    images: [], // mock has no real imagery → aerial shows the styled placeholder
    shareLink: `https://app.bricked.ai/share/${id}`,
    dashboardLink: `https://app.bricked.ai/dashboard/${id}`,
    savedOffer: null,
  };
}

function mkComp(
  n: string,
  address: string,
  price: number,
  date: string,
  dist: number,
  beds: number,
  baths: number,
  sqft: number,
  lot: number,
  year: number,
  selected: boolean,
  lat: number,
  lng: number,
): BrickedComp {
  return {
    id: 'comp_' + n,
    address,
    adjusted_value: price,
    sale_price: price,
    selected,
    compType: 'sold',
    source: 'mls_sold',
    distance: dist,
    sale_date: date,
    beds,
    baths,
    squareFeet: sqft,
    lotAcres: lot,
    yearBuilt: year,
    latitude: lat,
    longitude: lng,
    image: null, // mock has no real photos → card shows the styled placeholder
    images: [],
    pricePerSqft: sqft ? Math.round((price / sqft) * 100) / 100 : null,
    occupancy: 'Owner Occupied',
    stories: 1,
    heatingType: 'Forced Air',
    acType: 'Central',
    exteriorWallType: 'Wood',
    garageType: 'Attached',
    hoaPresent: 'No',
    mlsStatus: 'Sold',
    mlsNumber: 'MLS' + n + '00' + n,
    mlsName: 'Stellar MLS',
    agentName: 'Jane Agent',
    daysOnMarket: 21,
    priceHistory: [
      { date, status: 'Sold', amount: price, pricePerSqft: sqft ? Math.round((price / sqft) * 100) / 100 : null },
      { date, status: 'Pending', amount: Math.round(price * 1.02), pricePerSqft: null },
    ],
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Deterministic error injection for QA (FRD §5.3 / §10). Address keywords let the
 * frontend exercise every fallback without a live Bricked account:
 *   "fail400"/"invalid" -> 400, "fail404"/"notfound" -> 404, "fail412"/"nosqft" -> 412
 *   "fail401" -> 401, "fail402" -> 402, "fail500"/"timeout" -> 500
 * A 412 is suppressed once squareFeet override is supplied (charge only on success).
 */
function injectedError(params: CreatePropertyParams): BrickedResult | null {
  const a = params.address.toLowerCase();
  if (/fail400|invalid address/.test(a)) return { ok: false, status: 400, error: 'Invalid address' };
  if (/fail401/.test(a)) return { ok: false, status: 401, error: 'API key failure' };
  if (/fail402/.test(a)) return { ok: false, status: 402, error: 'Bricked subscription inactive' };
  if (/fail404|notfound/.test(a)) return { ok: false, status: 404, error: 'Property not found' };
  if (/fail412|nosqft|missing sqft/.test(a) && !params.squareFeet)
    return { ok: false, status: 412, error: 'Missing squareFeet' };
  if (/fail500|timeout/.test(a)) return { ok: false, status: 500, error: 'Bricked error' };
  return null;
}

async function createMock(params: CreatePropertyParams): Promise<BrickedResult> {
  const err = injectedError(params);
  if (err) return err;
  if (!params.address || !params.address.trim())
    return { ok: false, status: 400, error: 'Empty address' };
  return { ok: true, status: 200, property: mockProperty(params) };
}

// ── Live response mapping (BRICKED_MODE=live) ────────────────────────────────
// The real Bricked response (docs.bricked.ai) is deeply nested with ms-epoch
// timestamps and lat/long. We normalise it into the flat internal BrickedProperty
// the engine/UI already consume — so nothing downstream changes.
function msToDate(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US');
}

function pct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  // Bricked reports rates as a fraction (0.063 = 6.30%).
  return (rate * 100).toFixed(2) + '%';
}

function haversineMiles(aLat?: number, aLng?: number, bLat?: number, bLng?: number): number {
  if ([aLat, aLng, bLat, bLng].some((n) => n == null || !Number.isFinite(n as number))) return 0;
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad((bLat as number) - (aLat as number));
  const dLng = toRad((bLng as number) - (aLng as number));
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat as number)) * Math.cos(toRad(bLat as number)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
}

function ownerName(o: { firstName?: string; lastName?: string } | undefined): string | null {
  if (!o) return null;
  const n = [o.firstName, o.lastName].filter(Boolean).join(' ').trim();
  return n || null;
}

/** Pick the best single display photo from a Bricked images array. Comps return a
 *  thumbnail, a realtor (rdcpix) photo, a long street-view sequence, then a
 *  satellite — prefer the real listing photo, fall back to satellite, then first. */
function pickImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls = images.filter((u): u is string => typeof u === 'string');
  return (
    urls.find((u) => /rdcpix/.test(u)) ??
    urls.find((u) => /satellite\.jpg/.test(u)) ??
    urls.find((u) => /\.jpg|\.png/.test(u)) ??
    urls[0] ??
    null
  );
}

/** Subject hero image — prefer the satellite tile, else any real photo. */
function pickSatellite(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls = images.filter((u): u is string => typeof u === 'string');
  return urls.find((u) => /satellite\.jpg/.test(u)) ?? pickImage(urls);
}

export function mapLiveResponse(raw: any, requestedAddress: string): BrickedProperty {
  const p = raw.property ?? {};
  const det = p.details ?? {};
  const land = p.landLocation ?? {};
  const debt = p.mortgageDebt ?? {};
  const own = p.ownership ?? {};
  const sLat = p.latitude;
  const sLng = p.longitude;
  const reno = det.renovationScore ?? {};

  const repairs: BrickedRepair[] = Array.isArray(raw.repairs)
    ? raw.repairs.map((r: any) => ({ label: r.repair ?? r.description ?? 'Repair', cost: Number(r.cost) || 0 }))
    : [];
  const totalRepairCost =
    raw.totalRepairCost != null ? Number(raw.totalRepairCost) : repairs.reduce((s, r) => s + r.cost, 0);

  const acres = (sqft: number | null | undefined): number | null =>
    sqft ? Math.round((sqft / 43560) * 100) / 100 : null;
  const photos = (images: unknown): string[] =>
    Array.isArray(images) ? images.filter((u): u is string => typeof u === 'string') : [];

  const comps: BrickedComp[] = (Array.isArray(raw.comps) ? raw.comps : []).map((c: any, i: number) => {
    const cd = c.details ?? {};
    const m = c.mls ?? {};
    const imgs = photos(c.images);
    const history: CompPriceEvent[] = Array.isArray(m.historicListings)
      ? m.historicListings.slice(0, 12).map((h: any) => ({
          date: msToDate(h.listingDate) ?? '—',
          status: h.status ?? '—',
          amount: Number(h.amount) || 0,
          pricePerSqft: h.pricePerSquareFoot != null ? Number(h.pricePerSquareFoot) : null,
        }))
      : [];
    const sqft = Number(cd.squareFeet) || 0;
    return {
      id: m.mlsNumber ?? c.address?.fullAddress ?? `comp_${i}`,
      address: c.address?.fullAddress ?? '',
      adjusted_value: Number(c.adjusted_value) || 0,
      sale_price: Number(cd.lastSaleAmount ?? m.amount ?? c.adjusted_value) || 0,
      selected: !!c.selected,
      compType: c.compType ?? '',
      source: c.listingType ?? m.status ?? 'comp',
      distance: haversineMiles(sLat, sLng, c.latitude, c.longitude),
      sale_date: msToDate(cd.lastSaleDate ?? m.listingDate) ?? '',
      beds: Number(cd.bedrooms) || 0,
      baths: Number(cd.bathrooms) || 0,
      squareFeet: sqft,
      lotAcres: acres(cd.lotSquareFeet) ?? 0,
      yearBuilt: Number(cd.yearBuilt) || 0,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      image: pickImage(c.images),
      images: imgs,
      pricePerSqft:
        cd.lastSaleAmount && sqft ? Math.round((cd.lastSaleAmount / sqft) * 100) / 100 : null,
      occupancy: cd.occupancy ?? null,
      stories: cd.stories ?? null,
      heatingType: cd.heatingType ?? null,
      acType: cd.airConditioningType ?? null,
      exteriorWallType: cd.exteriorWallType ?? null,
      garageType: cd.garageType ?? null,
      hoaPresent: cd.hoaPresent != null ? (cd.hoaPresent ? 'Yes' : 'No') : null,
      mlsStatus: m.status ?? null,
      mlsNumber: m.mlsNumber ?? null,
      mlsName: m.mlsName ?? null,
      agentName: m.agent?.agentName ?? null,
      daysOnMarket: m.daysOnMarket ?? cd.daysOnMarket ?? null,
      priceHistory: history,
    };
  });

  const taxes: TaxYear[] = Array.isArray(own.taxes)
    ? own.taxes.slice(0, 6).map((t: any) => ({
        year: t.year ?? null,
        assessedValue: t.assessedValue ?? null,
        taxAmount: t.taxAmount ?? t.amount ?? null,
      }))
    : [];

  return {
    id: raw.id,
    subject: {
      address: p.address?.fullAddress ?? requestedAddress,
      beds: det.bedrooms ?? null,
      baths: det.bathrooms ?? null,
      squareFeet: det.squareFeet ?? null,
      yearBuilt: det.yearBuilt ?? null,
      lotAcres: acres(det.lotSquareFeet),
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      lastSalePrice: det.lastSaleAmount ?? null,
      lastSaleDate: msToDate(det.lastSaleDate),
      occupancy: det.occupancy ?? null,
      stories: det.stories ?? null,
      basementType: det.basementType ?? null,
      basementSquareFeet: det.basementSquareFeet ?? null,
      airConditioningType: det.airConditioningType ?? null,
      heatingType: det.heatingType ?? null,
      heatingFuelType: det.heatingFuelType ?? null,
      hoaPresent: det.hoaPresent != null ? (det.hoaPresent ? 'Yes' : 'No') : null,
      hoaFee: det.hoa1Fee ?? null,
      hoaFeeFrequency: det.hoa1FeeFrequency ?? null,
      fireplaces: det.fireplaces ?? null,
      exteriorWallType: det.exteriorWallType ?? null,
      daysOnMarket: det.daysOnMarket ?? null,
      marketStatus: det.marketStatus ?? null,
      legalDescription: det.legalDescription ?? null,
      landUse: land.landUse ?? null,
      apn: land.apn ?? null,
      propertyClass: land.propertyClass ?? null,
      lotNumber: land.lotNumber ?? null,
      block: land.block ?? null,
      schoolDistrict: land.schoolDistrict ?? null,
      subdivision: land.subdivision ?? null,
      countyName: land.countyName ?? null,
      openMortgageBalance: debt.openMortgageBalance ?? null,
      estimatedEquity: debt.estimatedEquity ?? null,
      purchaseMethod: debt.purchaseMethod ?? null,
      ltvRatio: debt.ltvRatio ?? null,
      itvRatio: debt.itvRatio ?? null,
      owner1: ownerName(own.owners?.[0]),
      owner2: ownerName(own.owners?.[1]),
      ownerType: own.ownerType ?? null,
      ownerOccupancy: own.ownerOccupancy ?? null,
      taxAmount: own.taxAmount ?? null,
    },
    taxes,
    comps,
    cmv: raw.cmv ?? null,
    arv: raw.arv ?? null,
    rentEstimate: det.rentEstimate ?? null,
    repairs,
    totalRepairCost,
    renovationScore: reno.hasScore ? (reno.confidence ?? reno.score ?? null) : null,
    images: photos(p.images),
    shareLink: raw.shareLink ?? '',
    dashboardLink: raw.dashboardLink ?? '',
    savedOffer: null,
  };
}

async function createLive(params: CreatePropertyParams): Promise<BrickedResult> {
  const url = new URL('/v1/property/create', config.bricked.baseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url, { headers: { 'x-api-key': settings.brickedApiKey() } });
    if (res.status === 200) {
      const raw = await res.json();
      return { ok: true, status: 200, property: mapLiveResponse(raw, params.address) };
    }
    const status = res.status as 400 | 401 | 402 | 404 | 412 | 500;
    return { ok: false, status: [400, 401, 402, 404, 412].includes(status) ? status : 500, error: `Bricked ${res.status}` };
  } catch {
    return { ok: false, status: 500, error: 'Bricked timeout/network error' };
  }
}

export const bricked = {
  /** GET /v1/property/create — the only billable call (FRD §5.1). Mode + key are
   *  admin-managed (settings) so they can be changed without a redeploy. */
  createProperty(params: CreatePropertyParams): Promise<BrickedResult> {
    return settings.brickedMode() === 'live' ? createLive(params) : createMock(params);
  },
};
