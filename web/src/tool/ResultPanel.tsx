import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon, ic, Spinner } from '../lib/icons';
import { money, dateShort } from '../lib/format';
import { useTheme } from '../lib/theme';
import { toolApi } from '../lib/api';
import type { BrickedComp, BrickedProperty, PublicSnapshot, SavedOffer, SessionInfo } from '../lib/types';
import { SOURCE_LABEL } from './util';
import { Lightbox, StrategyModal, CompDetailModal } from './modals';

/** Subject hero image — the satellite tile Bricked returns for the subject. */
function subjectImageOf(p: BrickedProperty): string | null {
  const imgs = (p.images ?? []).filter((u) => typeof u === 'string');
  return imgs.find((u) => /satellite\.jpg/.test(u)) ?? imgs[0] ?? null;
}

// Count-up animation with a setTimeout safety net (so the figure never sticks
// mid-animation when requestAnimationFrame is throttled).
function useCountUp(target: number, deps: unknown[]): number {
  const [val, setVal] = useState(target);
  const raf = useRef<number>();
  useEffect(() => {
    const t0 = performance.now();
    const dur = 800;
    let done = false;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else done = true;
    };
    raf.current = requestAnimationFrame(tick);
    const safety = setTimeout(() => {
      if (!done) setVal(target);
    }, dur + 150);
    return () => {
      cancelAnimationFrame(raf.current!);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return val;
}

type TabId = 'property' | 'land' | 'mortgage' | 'ownership' | 'mls';
type Field = { label: string; value: string };

export function ResultPanel({
  snapshot,
  contact,
  locationName,
  onRefresh,
  onRepairs,
  onWriteback,
  onSnapshot,
}: {
  snapshot: PublicSnapshot;
  contact: SessionInfo['contact'];
  locationName: string;
  onRefresh: () => void;
  onRepairs: (text: string) => Promise<void>;
  onWriteback: (fields: Record<string, number | string>) => Promise<void>;
  onSnapshot: (s: PublicSnapshot) => void;
}) {
  const { theme } = useTheme();
  const p = snapshot.property;
  const subjectImage = useMemo(() => subjectImageOf(p), [p]);
  const [tab, setTab] = useState<TabId>('property');
  const [valMode, setValMode] = useState<'arv' | 'cmv'>('arv');
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [detailComp, setDetailComp] = useState<{ comp: BrickedComp; index: number } | null>(null);
  const [writingBack, setWritingBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // jsPDF is heavy → load it only when the user actually downloads (lazy chunk).
  const download = async () => {
    setDownloading(true);
    try {
      const { downloadReport } = await import('./pdf');
      downloadReport(snapshot, locationName);
    } finally {
      setDownloading(false);
    }
  };

  const valTarget = valMode === 'arv' ? p.arv ?? 0 : p.cmv ?? 0;
  const animVal = useCountUp(valTarget, [valTarget, snapshot.id]);
  const animRepair = useCountUp(p.totalRepairCost ?? 0, [p.totalRepairCost, snapshot.id]);
  const offer = p.savedOffer;

  const base = { arv: p.arv ?? 0, repairs: p.totalRepairCost ?? 0, rent: p.rentEstimate ?? 0 };

  const toggleComp = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const selectedIds = p.comps.filter((c) => (c.id === id ? !c.selected : c.selected)).map((c) => c.id);
    try {
      const res = await toolApi.selectComps({ snapshotId: snapshot.id, selectedIds });
      onSnapshot(res.snapshot);
    } finally {
      setBusy(false);
    }
  };

  const saveOffer = async (o: SavedOffer | null) => {
    setStrategyOpen(false);
    const res = await toolApi.saveOffer({ snapshotId: snapshot.id, offer: o });
    onSnapshot(res.snapshot);
  };

  const doWriteback = async () => {
    setWritingBack(true);
    try {
      await onWriteback({
        arv: Math.round(p.arv ?? 0),
        cmv: Math.round(p.cmv ?? 0),
        repair_total: Math.round(p.totalRepairCost ?? 0),
        offer: offer?.price ?? 0,
      });
    } finally {
      setWritingBack(false);
    }
  };

  const selectedComps = p.comps.filter((c) => c.selected).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 352px', gap: 20, alignItems: 'start' }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', animation: 'fadeUp .45s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <Icon path={ic.pin} size={18} stroke="var(--brand)" width={2} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{snapshot.address}</h2>
            {snapshot.stale && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-soft)', padding: '2px 9px', borderRadius: 20 }}>Stale snapshot</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <Icon path={ic.clock} size={13} width={2} /> Snapshot {dateShort(snapshot.takenAt)}
            </span>
            <button onClick={onRefresh} style={hdrBtn}>
              <Icon path={ic.refresh} size={14} width={2} /> Refresh
            </button>
            <button onClick={download} disabled={downloading} style={hdrBtn}>
              {downloading ? <Spinner size={14} /> : <Icon path={ic.download} size={14} width={2} />} Download
            </button>
          </div>
        </div>

        {snapshot.stale && (
          <div style={{ padding: '10px 13px', borderRadius: 11, background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeUp .4s ease both' }}>
            <Icon path={ic.warn} size={15} width={2} /> Data as of {dateShort(snapshot.takenAt)} — comps may have changed. Refresh to re-pull. We never auto-refresh.
          </div>
        )}

        <AerialImage src={subjectImage} theme={theme} onOpen={() => setLightbox(true)} />

        <PropertyTabs p={p} taxes={p.taxes} tab={tab} setTab={setTab} />

        {/* comps */}
        <div style={{ animation: 'fadeUp .5s ease .15s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>Comparable Properties</h3>
            <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              {selectedComps} of {p.comps.length} in deal · ARV updates with your selection
            </span>
          </div>
          <CompsMap subject={p.subject} comps={p.comps} theme={theme} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {p.comps.map((c, i) => (
              <CompCard
                key={c.id}
                comp={c}
                index={i + 1}
                delay={`${(0.08 + i * 0.04).toFixed(2)}s`}
                busy={busy}
                onToggle={() => toggleComp(c.id)}
                onOpen={() => setDetailComp({ comp: c, index: i + 1 })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT RAIL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, position: 'sticky', top: 8 }}>
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow)', animation: 'fadeUp .5s ease .08s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Deal Analysis</span>
            <div style={{ display: 'flex', background: 'var(--surface3)', borderRadius: 8, padding: 3, gap: 2 }}>
              {(['arv', 'cmv'] as const).map((m) => (
                <button key={m} onClick={() => setValMode(m)} style={segBtn(valMode === m)}>{m.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DealRow icon={ic.home} label={valMode === 'arv' ? 'After Repair Value' : 'Current Market Value'} value={money(valTarget ? animVal : null)} valueColor="var(--brand)" />
            <DealRow icon={ic.building} label="Rent Estimate" value={`${money(p.rentEstimate)}`} suffix="/mo" border />
            {/* offer price row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--text2)' }}>
                <Icon path={ic.dollar} size={16} stroke="var(--muted)" width={1.9} /> Offer Price
              </span>
              {offer ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 15 }}>{money(offer.price)}</span>
                  <button onClick={() => setStrategyOpen(true)} title="Edit offer" style={iconBtn}>
                    <Icon path="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" size={13} stroke="var(--muted)" width={2} />
                  </button>
                </span>
              ) : (
                <button onClick={() => setStrategyOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  <Icon path={ic.sliders} size={13} width={2} /> Configure
                </button>
              )}
            </div>
            <DealRow icon={ic.wrench} label="Repair Cost" value={money(p.totalRepairCost ? animRepair : 0)} border />
          </div>
          {offer && (
            <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 11.5 }}>
              <strong>{offer.label}.</strong> Saved offer based on your inputs. Tap the pencil to adjust.
            </div>
          )}
          {p.cmv == null && (
            <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 10, background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 11.5 }}>
              <strong>Partial data.</strong> ARV is available but CMV is not for this address.
            </div>
          )}
        </div>

        <RepairsChat snapshot={snapshot} onRepairs={onRepairs} />

        <button onClick={doWriteback} disabled={writingBack || !contact} style={{ height: 46, borderRadius: 12, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontWeight: 700, fontSize: 13.5, cursor: contact ? 'pointer' : 'not-allowed', opacity: contact ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: 'var(--shadow)', animation: 'fadeUp .5s ease .2s both' }}>
          {writingBack ? <Spinner size={16} stroke="var(--bg)" /> : <Icon path={ic.send} size={16} width={2} />}
          {contact ? 'Push to CRM' : 'Contact unavailable'}
        </button>
      </div>

      <StrategyModal open={strategyOpen} base={base} initial={offer} onSave={saveOffer} onClose={() => setStrategyOpen(false)} />
      <CompDetailModal comp={detailComp?.comp ?? null} index={detailComp?.index ?? 0} onClose={() => setDetailComp(null)} />
      <Lightbox open={lightbox} address={snapshot.address} images={subjectImage ? [subjectImage] : []} onClose={() => setLightbox(false)} />
    </div>
  );
}

const hdrBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  height: 34,
  padding: '0 13px',
  borderRadius: 9,
  border: '1px solid var(--border2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 600,
  fontSize: 12.5,
  cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  border: '1px solid var(--border2)',
  background: 'var(--surface2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '5px 13px',
    borderRadius: 6,
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--brand)' : 'var(--text2)',
    boxShadow: active ? 'var(--shadow)' : 'none',
  };
}

function DealRow({ icon, label, value, suffix, valueColor, border }: { icon: string; label: string; value: string; suffix?: string; valueColor?: string; border?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: border ? '1px solid var(--border)' : 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--text2)' }}>
        <Icon path={icon} size={16} stroke="var(--muted)" width={1.9} /> {label}
      </span>
      <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 15, color: valueColor }}>
        {value}
        {suffix && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{suffix}</span>}
      </span>
    </div>
  );
}

// ── Property tabs (real mapped data only) ────────────────────────────────────
function PropertyTabs({ p, taxes, tab, setTab }: { p: BrickedProperty; taxes: BrickedProperty['taxes']; tab: TabId; setTab: (t: TabId) => void }) {
  const s = p.subject;
  // Only surface fields that actually have a value — no placeholders, no fakes.
  const F = (label: string, value: string | number | null | undefined): Field | null =>
    value == null || value === '' ? null : { label, value: String(value) };
  const clean = (arr: (Field | null)[]): Field[] => arr.filter((x): x is Field => x != null);

  const ratio = (n: number | null) => (n == null ? null : `${(n * 100).toFixed(1)}%`);

  const sets: Record<TabId, Field[]> = {
    property: clean([
      F('Beds', s.beds), F('Baths', s.baths), F('Sq Ft', s.squareFeet?.toLocaleString()), F('Year Built', s.yearBuilt),
      F('Lot Size', s.lotAcres ? `${s.lotAcres} acres` : null), F('Stories', s.stories), F('Occupancy', s.occupancy),
      F('Heating', s.heatingType), F('Heating Fuel', s.heatingFuelType), F('Air Conditioning', s.airConditioningType),
      F('Exterior Wall', s.exteriorWallType), F('Basement', s.basementType), F('Fireplaces', s.fireplaces),
      F('HOA Present', s.hoaPresent), F('HOA Fee', s.hoaFee ? money(s.hoaFee) : null), F('Market Status', s.marketStatus),
      F('Days on Market', s.daysOnMarket), F('Last Sale Price', s.lastSalePrice ? money(s.lastSalePrice) : null),
      F('Last Sale Date', s.lastSaleDate), F('Legal Description', s.legalDescription),
    ]),
    land: clean([
      F('APN', s.apn), F('Land Use', s.landUse), F('Property Class', s.propertyClass), F('Subdivision', s.subdivision),
      F('Block', s.block), F('Lot Number', s.lotNumber), F('School District', s.schoolDistrict), F('County', s.countyName),
    ]),
    mortgage: clean([
      F('Open Mortgage Balance', s.openMortgageBalance != null ? money(s.openMortgageBalance) : null),
      F('Estimated Equity', s.estimatedEquity != null ? money(s.estimatedEquity) : null),
      F('Purchase Method', s.purchaseMethod), F('LTV Ratio', ratio(s.ltvRatio)), F('ITV Ratio', ratio(s.itvRatio)),
    ]),
    ownership: clean([
      F('Owner 1', s.owner1), F('Owner 2', s.owner2), F('Owner Type', s.ownerType), F('Owner Occupancy', s.ownerOccupancy),
      F('Annual Tax', s.taxAmount != null ? money(s.taxAmount) : null),
    ]),
    mls: clean([
      F('Market Status', s.marketStatus), F('Days on Market', s.daysOnMarket), F('Last Sale Price', s.lastSalePrice ? money(s.lastSalePrice) : null), F('Last Sale Date', s.lastSaleDate),
    ]),
  };
  const tabs: [TabId, string][] = [['property', 'Property'], ['land', 'Land/Location'], ['mortgage', 'Mortgage/Debt'], ['ownership', 'Ownership'], ['mls', 'MLS']];

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow)', overflow: 'hidden', animation: 'fadeUp .5s ease .1s both' }}>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', padding: '0 6px', overflowX: 'auto' }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: `2px solid ${tab === id ? 'var(--brand)' : 'transparent'}`, color: tab === id ? 'var(--brand)' : 'var(--text2)' }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {sets[tab].length === 0 ? (
          <div style={{ padding: '18px 4px', color: 'var(--muted)', fontSize: 13 }}>
            {tab === 'mls' ? 'No active MLS listing for the subject. Per-comp MLS history is on each comparable.' : 'No data available for this section.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
            {sets[tab].map((f) => (
              <div key={f.label} style={{ border: '1px solid var(--border)', background: 'var(--surface2)', borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'ownership' && taxes.length > 0 && (
          <MiniTable title="Assessment & tax history" head={['Year', 'Assessed Value', 'Tax']} rows={taxes.map((t) => [String(t.year ?? '—'), t.assessedValue != null ? money(t.assessedValue) : '—', t.taxAmount != null ? money(t.taxAmount) : '—'])} />
        )}
      </div>
    </div>
  );
}

function MiniTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>
              {head.map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                {r.map((cell, j) => (
                  <td key={j} style={{ padding: '9px 8px', fontFamily: j > 0 ? 'Geist Mono' : 'inherit', fontWeight: j === 0 ? 600 : 500 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Subject hero image (real Bricked satellite, graceful fallback) ────────────
function AerialImage({ src, theme, onOpen }: { src: string | null; theme: string; onOpen: () => void }) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;

  return (
    <div onClick={showImg ? onOpen : undefined} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)', cursor: showImg ? 'zoom-in' : 'default', animation: 'fadeUp .5s ease .05s both' }}>
      {showImg ? (
        <>
          <img src={src!} alt="Property satellite view" onError={() => setErrored(true)} style={{ display: 'block', width: '100%', height: 250, objectFit: 'cover' }} />
          <span style={{ position: 'absolute', left: 10, bottom: 8, fontFamily: 'Geist Mono', fontSize: 9, color: 'rgba(255,255,255,.85)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>Satellite</span>
        </>
      ) : (
        <div style={{ height: 250, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', background: theme === 'dark' ? '#161d12' : '#cdd6c0', backgroundImage: 'repeating-linear-gradient(135deg,rgba(120,140,90,.18),rgba(120,140,90,.18) 14px,transparent 14px,transparent 28px),radial-gradient(circle at 30% 40%,rgba(90,120,70,.25),transparent 60%)' }}>
          <Icon path={ic.imageOff} size={28} stroke="var(--text2)" width={1.6} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>No imagery for this address</div>
          <div style={{ fontSize: 11.5 }}>Valuation is unaffected.</div>
        </div>
      )}
    </div>
  );
}

// ── Comps map (real Leaflet markers) ─────────────────────────────────────────
function CompsMap({ subject, comps, theme }: { subject: BrickedProperty['subject']; comps: BrickedProperty['comps']; theme: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = theme === 'dark';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (subject.latitude == null || subject.longitude == null) return;

    const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

    const pin = (cls: string, label: string) => L.divIcon({ html: `<div class="cc-pin ${cls}">${label}</div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
    const pts: [number, number][] = [];
    const subjPt: [number, number] = [subject.latitude, subject.longitude];
    pts.push(subjPt);
    L.marker(subjPt, { icon: pin('cc-pin-subject', '★') }).addTo(map).bindPopup(`<b>Subject</b><br/>${subject.address}`);

    comps.forEach((c, i) => {
      if (c.latitude == null || c.longitude == null) return;
      const pt: [number, number] = [c.latitude, c.longitude];
      pts.push(pt);
      L.marker(pt, { icon: pin(c.selected ? '' : 'cc-pin-muted', String(i + 1)) }).addTo(map).bindPopup(`<b>#${i + 1} · ${money(c.adjusted_value)}</b><br/>${c.address}<br/>${c.distance} mi away`);
    });

    if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 16 });
    else map.setView(subjPt, 15);
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
    };
  }, [subject, comps]);

  if (subject.latitude == null || subject.longitude == null) {
    return (
      <div style={{ height: 300, borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--surface2)' }}>
        No location coordinates for this property.
      </div>
    );
  }
  return <div ref={ref} className={dark ? 'cc-map-dark' : ''} style={{ height: 300, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 14, zIndex: 0 }} />;
}

function CompThumb({ image, onClick }: { image: string | null; onClick: () => void }) {
  const [errored, setErrored] = useState(false);
  const common: React.CSSProperties = { width: 74, height: 60, borderRadius: 9, border: '1px solid var(--border)', flexShrink: 0, cursor: 'pointer' };
  if (image && !errored) {
    return <img src={image} alt="Comparable" onClick={onClick} onError={() => setErrored(true)} style={{ ...common, objectFit: 'cover' }} />;
  }
  return (
    <div onClick={onClick} style={{ ...common, backgroundImage: 'repeating-linear-gradient(135deg,var(--surface3),var(--surface3) 7px,var(--surface2) 7px,var(--surface2) 14px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon path={ic.image} size={20} stroke="var(--muted)" width={1.7} />
    </div>
  );
}

function CompCard({ comp, index, delay, busy, onToggle, onOpen }: { comp: BrickedComp; index: number; delay: string; busy: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div style={{ border: `1px solid ${comp.selected ? 'var(--brand)' : 'var(--border)'}`, background: 'var(--surface)', borderRadius: 13, padding: 13, boxShadow: 'var(--shadow)', animation: 'fadeUp .4s ease both', animationDelay: delay }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <button onClick={onToggle} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit' }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${comp.selected ? 'var(--brand)' : 'var(--border2)'}`, background: comp.selected ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: comp.selected ? 1 : 0 }}>
              <path d="M5 12l5 5 9-11" />
            </svg>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: comp.selected ? 'var(--text)' : 'var(--text2)' }}>Include in deal</span>
        </button>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-soft)', padding: '2px 7px', borderRadius: 5 }}>{SOURCE_LABEL[comp.source] ?? comp.source}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, cursor: 'pointer' }} onClick={onOpen}>
        <CompThumb image={comp.image} onClick={onOpen} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 15 }}>{money(comp.adjusted_value)}</span>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'Geist Mono' }}>{comp.distance} mi</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist Mono', margin: '1px 0 5px' }}>{comp.sale_date}</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3 }}>{comp.address}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)', fontFamily: 'Geist Mono', marginTop: 3 }}>{comp.beds} bd · {comp.baths} ba · {comp.squareFeet?.toLocaleString()} sqft · {comp.yearBuilt}</div>
        </div>
      </div>
    </div>
  );
}

// ── Repairs chat (charge-on-generate) ────────────────────────────────────────
function RepairsChat({ snapshot, onRepairs }: { snapshot: PublicSnapshot; onRepairs: (text: string) => Promise<void> }) {
  const p = snapshot.property;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const hasRepairs = p.repairs.length > 0;

  const send = async (override?: string) => {
    const msg = (override ?? text).trim();
    if (!msg || busy) return;
    setLastMsg(msg);
    setText('');
    setBusy(true);
    try {
      await onRepairs(msg);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = ['Repairs are $60/sqft', 'Kitchen and bath need updating', 'New roof, driveway & siding'];

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', animation: 'fadeUp .5s ease .14s both', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Icon path={ic.wrench} size={16} stroke="var(--brand)" width={2} /> Repairs Chat
        </span>
      </div>
      <div style={{ padding: '14px 16px', minHeight: 90, maxHeight: 230, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!hasRepairs && !lastMsg && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, padding: '14px 8px' }}>Describe this property's condition to itemize repairs — specific to this comp only.</div>
        )}
        {lastMsg && (
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
            <div style={{ background: 'var(--brand)', color: 'var(--brand-ink)', borderRadius: '13px 4px 13px 13px', padding: '9px 12px', fontSize: 13 }}>{lastMsg}</div>
          </div>
        )}
        {busy && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 13 }}>
            <Spinner size={15} /> Generating estimate…
          </div>
        )}
        {!busy && hasRepairs && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', animation: 'streamIn .4s ease both' }}>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px 13px 13px 13px', padding: '11px 13px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Itemized repair estimate</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {p.repairs.map((r) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text2)' }}>{r.label}</span>
                    <span style={{ fontFamily: 'Geist Mono', fontWeight: 600 }}>{money(r.cost)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border2)', paddingTop: 5, marginTop: 2, fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ fontFamily: 'Geist Mono', color: 'var(--brand)' }}>{money(p.totalRepairCost)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 11 }}>
          {suggestions.map((sug) => (
            <button key={sug} onClick={() => send(sug)} disabled={busy} style={{ padding: '6px 11px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: busy ? 'default' : 'pointer' }}>{sug}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 11, padding: '6px 6px 6px 12px' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Describe condition…" style={{ flex: 1, border: 'none', background: 'none', color: 'var(--text)', fontSize: 13 }} />
          <button onClick={() => send()} disabled={busy || !text.trim()} title="Generate estimate" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', cursor: busy || !text.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.6 : 1 }}>
            <Icon path={ic.send} size={15} width={2} />
          </button>
        </div>
        <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>Describe the condition, then generate an itemized estimate.</p>
      </div>
    </div>
  );
}
