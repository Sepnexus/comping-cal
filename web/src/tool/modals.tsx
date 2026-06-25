import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, ic } from '../lib/icons';
import type { StrategyId } from '../lib/types';

// Render overlays at <body> so they're never trapped by an ancestor's transform/
// overflow/stacking context (which is what kept the strategy picker from showing).
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

export function ConfirmModal({ open, address, onCancel, onConfirm }: { open: boolean; address: string; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div style={overlay} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 26, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .28s ease both' }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>
          <Icon path={ic.bolt} size={24} stroke="var(--brand)" width={2} />
        </div>
        <h3 style={{ margin: '0 0 7px', fontSize: 18, fontWeight: 700 }}>This will use 1 comp</h3>
        <p style={{ margin: '0 0 6px', color: 'var(--text2)', fontSize: 14 }}>We'll pull a fresh valuation for:</p>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 20 }}>{address}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1.4, height: 44, borderRadius: 12, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Continue</button>
        </div>
      </div>
    </div>
  );
}

const STRATEGIES: { id: StrategyId; name: string; desc: string }[] = [
  { id: 'wholesale', name: 'Wholesale (Cash)', desc: 'Cash exit strategy. MAO is the max price to offer after repairs, holding and assignment fee.' },
  { id: 'flip', name: 'Fix & Flip', desc: 'Buy, rehab, resell. MAO covers all costs and target profit; % costs applied to ARV.' },
  { id: 'novation', name: 'Novation', desc: 'Retail exit. MAO is the max price you can offer after all resale costs.' },
  { id: 'rental', name: 'Rental (Equity-Based)', desc: 'Buy-and-hold priced by working backwards from a target equity % at purchase.' },
  { id: 'subjectto', name: 'Subject-To', desc: "Investor assumes the seller's existing mortgage. Profit comes from monthly cash flow." },
  { id: 'sellerfinance', name: 'Seller Finance', desc: 'Seller carries the note. Works backwards from rental income and terms.' },
  { id: 'brrrr', name: 'BRRRR', desc: 'Buy, Rehab, Rent, Refinance, Repeat. Target: Cash Left In = $0.' },
  { id: 'hardmoney', name: 'Hard Money Lender', desc: 'Short-term financing. Loan covers purchase + repairs; points paid out of margin.' },
];

export function StrategyModal({ open, onPick, onClose }: { open: boolean; onPick: (id: StrategyId) => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <Portal>
    <div style={{ ...overlay, zIndex: 88 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 660, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 26, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .28s ease both', maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 700 }}>Choose a strategy</h3>
        <p style={{ margin: '0 0 18px', color: 'var(--text2)', fontSize: 13.5 }}>Pick the underwriting approach for this property. All offer math runs on saved data — always free.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {STRATEGIES.map((st) => (
            <button
              key={st.id}
              onClick={() => onPick(st.id)}
              className="strategy-card"
              style={{ textAlign: 'left', border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 13, padding: '14px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{st.name}</span>
                <Icon path={ic.chevR} size={15} stroke="var(--muted)" width={2} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{st.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export function Lightbox({ open, address, images = [], onClose }: { open: boolean; address: string; images?: string[]; onClose: () => void }) {
  // Default to the satellite tile if present, else the first image.
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
        style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,6,.86)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, animation: 'fadeUp .2s ease both', padding: 36 }}
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

          {/* thumbnail strip — only when there's more than one usable image */}
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
