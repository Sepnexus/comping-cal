import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, ic } from '../lib/icons';
import { money } from '../lib/format';
import type { BrickedComp, SavedOffer } from '../lib/types';
import { STRATEGIES, strategyById, defaultValues, type StratBase } from './strategies';

// Render overlays at <body> so they're never trapped by an ancestor's transform/
// overflow/stacking context.
function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,14,8,.55)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 86,
  animation: 'fadeUp .2s ease both',
  padding: 24,
};

const STRAT_DESC: Record<string, string> = {
  wholesale: 'Cash exit. Max offer after repairs, holding, closing and your assignment fee.',
  flip: 'Buy, rehab, resell. Covers all costs and your target profit on resale.',
  novation: 'Retail exit on an agreement. Max offer after commission and resale costs.',
  rental: 'Buy-and-hold priced back from a target equity cushion at purchase.',
  subjectto: 'Take over the seller’s existing mortgage; value from monthly cash flow.',
};

// ── Offer calculator (strategy picker → calculator) ──────────────────────────
export function StrategyModal({
  open,
  base,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  base: StratBase;
  initial?: SavedOffer | null;
  onSave: (offer: SavedOffer) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'pick' | 'calc'>('pick');
  const [stratId, setStratId] = useState(STRATEGIES[0].id);
  const [vals, setVals] = useState<Record<string, number>>({});

  // On open: if a strategy is already selected (saved offer), go straight to its
  // calculator; otherwise show the picker so the user chooses a strategy first.
  useEffect(() => {
    if (!open) return;
    const saved = initial && strategyById(initial.strategy);
    if (saved) {
      setStratId(saved.id);
      setVals({ ...defaultValues(saved, base), ...initial!.inputs });
      setView('calc');
    } else {
      setView('pick');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const def = strategyById(stratId) ?? STRATEGIES[0];
  const result = useMemo(() => def.compute(base, vals), [def, base, vals]);

  if (!open) return null;

  const pickStrategy = (id: string) => {
    const d = strategyById(id)!;
    setStratId(id);
    setVals(defaultValues(d, base));
    setView('calc');
  };

  const autoRows = [
    { label: def.valueLabel, value: money(base.arv) },
    { label: 'Repairs', value: money(base.repairs) },
  ];

  // ── Strategy picker: shown first, before any calculator ──
  if (view === 'pick') {
    return (
      <Portal>
        <div style={{ ...overlay, zIndex: 88 }} onClick={onClose}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .26s ease both', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 700, letterSpacing: '-.3px' }}>Choose a strategy</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text2)', fontSize: 13 }}>Pick how you want to underwrite this deal. All offer math runs on the saved comp — always free.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStrategy(s.id)}
                  className="strategy-card"
                  style={{ textAlign: 'left', border: `1px solid ${s.id === initial?.strategy ? 'var(--brand)' : 'var(--border2)'}`, background: s.id === initial?.strategy ? 'var(--brand-soft)' : 'var(--surface2)', borderRadius: 13, padding: '14px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.label}</span>
                    <Icon path={ic.chevR} size={15} stroke="var(--muted)" width={2} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{STRAT_DESC[s.id] ?? ''}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div style={{ ...overlay, zIndex: 88 }} onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .26s ease both', maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 24px 0' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>{def.label}</h3>
              <button onClick={() => setView('pick')} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                <Icon path={ic.refresh} size={13} stroke="var(--muted)" width={2} /> Switch strategy
              </button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Offer Price</div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px', fontFamily: 'Geist Mono' }}>{money(result.price)}</div>
            </div>
          </div>

          {/* inputs + breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, padding: '18px 24px 4px' }}>
            <div>
              <div style={colHead}>INPUTS</div>
              {autoRows.map((a) => (
                <div key={a.label} style={inputRow}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)', fontSize: 13 }}>
                    {a.label} <span style={autoBadge}>Auto</span>
                  </span>
                  <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 13.5 }}>{a.value}</span>
                </div>
              ))}
              {def.inputs.map((inp) => {
                const v = vals[inp.key] ?? 0;
                const computed = inp.kind === 'pct' ? Math.round((base.arv * v) / 100) : null;
                return (
                  <div key={inp.key} style={{ ...inputRow, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)', fontSize: 13, minWidth: 0 }}>
                      <span title={inp.help} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: inp.help ? 'help' : 'default' }}>
                        {inp.label}
                        {inp.help && <span style={helpDot}>?</span>}
                      </span>
                      {computed != null && <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'Geist Mono' }}>= {money(computed)}</span>}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border2)', borderRadius: 9, padding: '5px 9px', background: 'var(--surface2)' }}>
                      <input
                        type="number"
                        value={Number.isFinite(v) ? v : 0}
                        onChange={(e) => setVals((m) => ({ ...m, [inp.key]: Number(e.target.value) }))}
                        style={{ width: 64, border: 'none', background: 'none', color: 'var(--text)', fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 13.5, textAlign: 'right', outline: 'none' }}
                      />
                      <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{inp.kind === 'pct' ? '%' : '$'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div>
              <div style={colHead}>BREAKDOWN</div>
              {result.breakdown.map((b, i) => (
                <div key={i} style={{ ...inputRow, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>{b.label}</span>
                  <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 13.5, color: b.amount < 0 ? 'var(--red, #c0392b)' : 'var(--text)' }}>
                    {b.amount < 0 ? `-${money(Math.abs(b.amount))}` : b.amount > 0 ? money(b.amount) : money(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* footer stats */}
          {result.footer && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', padding: '12px 24px', borderTop: '1px solid var(--border)', margin: '8px 0 0' }}>
              {result.footer.map((f) => (
                <span key={f.label} style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                  {f.label} <strong style={{ color: 'var(--text)', fontFamily: 'Geist Mono', marginLeft: 4 }}>{f.value}</strong>
                </span>
              ))}
            </div>
          )}

          {/* actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 24px 22px' }}>
            <button onClick={onClose} style={{ height: 42, padding: '0 20px', borderRadius: 999, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => onSave({ strategy: def.id, label: def.label, price: result.price, inputs: vals, savedAt: '' })}
              style={{ height: 42, padding: '0 26px', borderRadius: 999, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

const colHead: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--muted)', marginBottom: 8 };
const inputRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0' };
const autoBadge: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface3)', padding: '1px 6px', borderRadius: 5 };
const helpDot: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border2)', color: 'var(--muted)', fontSize: 9, fontWeight: 700 };

// ── Comp detail modal ────────────────────────────────────────────────────────
export function CompDetailModal({ comp, index, onClose }: { comp: BrickedComp | null; index: number; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setIdx(0);
    setBroken({});
  }, [comp]);
  if (!comp) return null;

  const imgs = (comp.images ?? []).filter((u) => typeof u === 'string');
  const current = imgs[idx] && !broken[idx] ? imgs[idx] : null;
  const stats: [string, string][] = [
    ['Adjusted Value', money(comp.adjusted_value)],
    ['Sale Price', money(comp.sale_price)],
    comp.pricePerSqft ? ['Price / Sq Ft', `$${comp.pricePerSqft}`] : ['Price / Sq Ft', '—'],
    ['Beds', String(comp.beds || '—')],
    ['Baths', String(comp.baths || '—')],
    ['Sq Ft', comp.squareFeet ? comp.squareFeet.toLocaleString() : '—'],
    ['Year Built', String(comp.yearBuilt || '—')],
    ['Lot Size', comp.lotAcres ? `${comp.lotAcres} acres` : '—'],
    ['Distance', `${comp.distance} mi`],
    ['Sale Date', comp.sale_date || '—'],
    ['Occupancy', comp.occupancy || '—'],
    ['Heating', comp.heatingType || '—'],
    ['A/C', comp.acType || '—'],
    ['Garage', comp.garageType || '—'],
    ['MLS Status', comp.mlsStatus || '—'],
    ['MLS #', comp.mlsNumber || '—'],
  ];

  return (
    <Portal>
      <div style={{ ...overlay, zIndex: 90 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .26s ease both', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 22px 0' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700 }}>Comp #{index} · {comp.source}</div>
              <h3 style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>{comp.address}</h3>
            </div>
            <button onClick={onClose} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={ic.close} size={17} width={2} />
            </button>
          </div>

          {/* gallery */}
          <div style={{ padding: '14px 22px 0' }}>
            {current ? (
              <img src={current} alt={comp.address} onError={() => setBroken((b) => ({ ...b, [idx]: true }))} style={{ display: 'block', width: '100%', height: 280, objectFit: 'cover', borderRadius: 13, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ height: 200, borderRadius: 13, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', background: 'var(--surface2)' }}>
                <Icon path={ic.imageOff} size={26} stroke="var(--text2)" width={1.6} />
                <span style={{ fontSize: 12.5 }}>No photos for this comp</span>
              </div>
            )}
            {imgs.length > 1 && (
              <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                {imgs.slice(0, 12).map((src, i) =>
                  broken[i] ? null : (
                    <img key={i} src={src} alt="" onClick={() => setIdx(i)} onError={() => setBroken((b) => ({ ...b, [i]: true }))} style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 7, cursor: 'pointer', border: i === idx ? '2px solid var(--brand)' : '1px solid var(--border)', opacity: i === idx ? 1 : 0.75 }} />
                  ),
                )}
              </div>
            )}
          </div>

          {/* stats */}
          <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 9 }}>
            {stats.map(([k, val]) => (
              <div key={k} style={{ border: '1px solid var(--border)', background: 'var(--surface2)', borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: val === '—' ? 'var(--muted)' : 'var(--text)' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* price history */}
          {comp.priceHistory.length > 0 && (
            <div style={{ padding: '0 22px 22px' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Listing history</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      {['Date', 'Status', 'Price', '$/sqft'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comp.priceHistory.map((h, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontFamily: 'Geist Mono' }}>{h.date}</td>
                        <td style={{ padding: '8px', color: 'var(--text2)' }}>{h.status}</td>
                        <td style={{ padding: '8px', fontFamily: 'Geist Mono', fontWeight: 600 }}>{money(h.amount)}</td>
                        <td style={{ padding: '8px', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{h.pricePerSqft != null ? `$${h.pricePerSqft}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── Lightbox (image gallery) ─────────────────────────────────────────────────
export function Lightbox({ open, address, images = [], onClose }: { open: boolean; address: string; images?: string[]; onClose: () => void }) {
  const initialIdx = Math.max(0, images.findIndex((u) => /satellite\.jpg/.test(u)));
  const [idx, setIdx] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (open) {
      setIdx(initialIdx);
      setBroken({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const usable = images.filter((_, i) => !broken[i]);
  const current = images[idx] && !broken[idx] ? images[idx] : usable[0] ?? null;

  return (
    <Portal>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,6,.86)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 92, animation: 'fadeUp .2s ease both', padding: 36 }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, width: 40, height: 40, borderRadius: 11, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={ic.close} size={20} stroke="#fff" width={2} />
        </button>
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 960, width: '100%', animation: 'scaleIn .3s ease both' }}>
          {current ? (
            <img src={current} alt={address} onError={() => setBroken((b) => ({ ...b, [idx]: true }))} style={{ display: 'block', width: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', background: '#0d110b' }} />
          ) : (
            <div
              style={{
                aspectRatio: '16/10',
                borderRadius: 16,
                overflow: 'hidden',
                background: '#1c2516',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                color: 'rgba(255,255,255,.7)',
                backgroundImage:
                  'repeating-linear-gradient(135deg,rgba(120,140,90,.22),rgba(120,140,90,.22) 18px,rgba(70,100,60,.12) 18px,rgba(70,100,60,.12) 36px),radial-gradient(circle at 35% 45%,rgba(120,150,90,.35),transparent 55%)',
                boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)',
              }}
            >
              <Icon path={ic.imageOff} size={34} stroke="rgba(255,255,255,.7)" width={1.6} />
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>No imagery available for this property</div>
            </div>
          )}

          {usable.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {images.map((src, i) =>
                broken[i] ? null : (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    onClick={() => setIdx(i)}
                    onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                    style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: i === idx ? '2px solid #fff' : '1px solid rgba(255,255,255,.3)', opacity: i === idx ? 1 : 0.7 }}
                  />
                ),
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, color: '#fff' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{address}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', fontFamily: 'Geist Mono' }}>
                {usable.length > 1 ? `Image ${usable.indexOf(current as string) + 1} of ${usable.length} · from snapshot` : 'From snapshot'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
