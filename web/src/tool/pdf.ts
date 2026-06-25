import { jsPDF } from 'jspdf';
import { money } from '../lib/format';
import type { PublicSnapshot } from '../lib/types';

// Build a branded, text-based PDF of the full comp report and trigger a download.
// Pure client-side (no server round-trip, no remote-image CORS issues) — it reads
// the saved snapshot the user is already viewing.
export function downloadReport(snapshot: PublicSnapshot, locationName: string) {
  const p = snapshot.property;
  const s = p.subject;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 42;
  const bottom = doc.internal.pageSize.getHeight() - 48;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = M;
    }
  };
  const text = (str: string, x: number, size = 10, style: 'normal' | 'bold' = 'normal', color = '#1a1f17') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(str, x, y);
  };
  const section = (title: string) => {
    ensure(34);
    y += 12;
    doc.setDrawColor('#dfe6d6');
    doc.line(M, y - 6, W - M, y - 6);
    text(title.toUpperCase(), M, 9, 'bold', '#5b7a3c');
    y += 16;
  };
  const row = (label: string, value: string) => {
    if (value == null || value === '' || value === 'Unknown') return;
    ensure(16);
    text(label, M, 9.5, 'normal', '#6b7563');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor('#1a1f17');
    doc.text(value, W - M, y, { align: 'right' });
    y += 15;
  };

  // ── header ──
  doc.setFillColor('#4C7A3C');
  doc.rect(0, 0, W, 6, 'F');
  y = M + 6;
  text('Comping Report', M, 19, 'bold', '#1a1f17');
  y += 18;
  text(s.address, M, 12, 'bold', '#4C7A3C');
  y += 15;
  text(`${locationName} · Snapshot ${new Date(snapshot.takenAt).toLocaleDateString('en-US')}`, M, 9, 'normal', '#6b7563');
  y += 6;

  // ── valuations ──
  section('Valuation');
  row('After Repair Value (ARV)', money(p.arv));
  row('Current Market Value (CMV)', money(p.cmv));
  row('Rent Estimate', p.rentEstimate ? `${money(p.rentEstimate)}/mo` : '');
  row('Total Repair Cost', money(p.totalRepairCost ?? 0));
  if (p.savedOffer) {
    row(`Offer Price — ${p.savedOffer.label}`, money(p.savedOffer.price));
  }

  // ── property ──
  section('Property');
  row('Beds', s.beds != null ? String(s.beds) : '');
  row('Baths', s.baths != null ? String(s.baths) : '');
  row('Square Feet', s.squareFeet ? s.squareFeet.toLocaleString() : '');
  row('Year Built', s.yearBuilt != null ? String(s.yearBuilt) : '');
  row('Lot Size', s.lotAcres ? `${s.lotAcres} acres` : '');
  row('Stories', s.stories != null ? String(s.stories) : '');
  row('Occupancy', s.occupancy ?? '');
  row('Heating', s.heatingType ?? '');
  row('Heating Fuel', s.heatingFuelType ?? '');
  row('Air Conditioning', s.airConditioningType ?? '');
  row('Exterior Wall', s.exteriorWallType ?? '');
  row('Fireplaces', s.fireplaces != null ? String(s.fireplaces) : '');
  row('HOA Present', s.hoaPresent ?? '');
  row('Legal Description', s.legalDescription ?? '');

  // ── land / location ──
  section('Land / Location');
  row('APN', s.apn ?? '');
  row('Land Use', s.landUse ?? '');
  row('Property Class', s.propertyClass ?? '');
  row('Subdivision', s.subdivision ?? '');
  row('Block / Lot', [s.block, s.lotNumber].filter(Boolean).join(' / '));
  row('School District', s.schoolDistrict ?? '');
  row('County', s.countyName ?? '');

  // ── mortgage / debt ──
  section('Mortgage / Debt');
  row('Open Mortgage Balance', s.openMortgageBalance != null ? money(s.openMortgageBalance) : '');
  row('Estimated Equity', s.estimatedEquity != null ? money(s.estimatedEquity) : '');
  row('Purchase Method', s.purchaseMethod ?? '');
  row('LTV Ratio', s.ltvRatio != null ? `${(s.ltvRatio * 100).toFixed(1)}%` : '');

  // ── ownership ──
  section('Ownership');
  row('Owner', s.owner1 ?? '');
  row('Owner Type', s.ownerType ?? '');
  row('Owner Occupancy', s.ownerOccupancy ?? '');
  row('Annual Tax', s.taxAmount != null ? money(s.taxAmount) : '');

  // ── comps ──
  const selected = p.comps.filter((c) => c.selected);
  const comps = selected.length ? selected : p.comps;
  section(`Comparable Properties (${selected.length} selected of ${p.comps.length})`);
  for (const c of comps) {
    ensure(30);
    text(c.address, M, 9.5, 'bold', '#1a1f17');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor('#1a1f17');
    doc.text(money(c.adjusted_value), W - M, y, { align: 'right' });
    y += 13;
    text(`${c.beds} bd · ${c.baths} ba · ${c.squareFeet?.toLocaleString()} sqft · ${c.yearBuilt} · ${c.distance} mi · ${c.sale_date}`, M, 8.5, 'normal', '#8a9480');
    y += 17;
  }

  doc.save(`comp-${s.address.replace(/[^a-z0-9]+/gi, '-').slice(0, 50)}.pdf`);
}
