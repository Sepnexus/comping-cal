import { useState } from 'react';
import { Icon, ic } from '../lib/icons';
import { moneyK, relative } from '../lib/format';
import type { HistoryItem, SessionInfo } from '../lib/types';
import type { Fallback } from './ToolApp';
import { Thumb } from '../components/Thumb';

const card: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: 18,
  boxShadow: 'var(--shadow-lg)',
};

export function VerifyingCard() {
  return (
    <div style={{ maxWidth: 440, margin: '60px auto', textAlign: 'center', animation: 'fadeUp .4s ease both' }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ margin: '0 auto 18px', display: 'block' }}>
        <circle cx="26" cy="26" r="21" fill="none" stroke="var(--border2)" strokeWidth="4" />
        <circle cx="26" cy="26" r="21" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeDasharray="132" strokeDashoffset="90" style={{ transformOrigin: 'center', animation: 'spin 1s linear infinite' }} />
      </svg>
      <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>Verifying access…</h2>
      <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Checking your secure GoHighLevel link.</p>
    </div>
  );
}

export function AccessDeniedCard() {
  return (
    <div style={{ ...card, maxWidth: 460, margin: '50px auto', padding: 34, textAlign: 'center', animation: 'scaleIn .35s ease both' }}>
      <div style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon path={ic.lock} size={26} stroke="var(--text2)" />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>This link isn't valid</h2>
      <p style={{ margin: '0 auto', maxWidth: 340, color: 'var(--text2)', fontSize: 14 }}>
        Open the comping tool from the property button on a GoHighLevel contact. If this keeps happening, contact your account admin.
      </p>
    </div>
  );
}

export function BillingIssueCard({ onViewSaved, reason }: { onViewSaved: () => void; reason?: string | null }) {
  return (
    <div style={{ ...card, maxWidth: 520, margin: '40px auto', padding: 32, border: '1px solid var(--amber)', animation: 'scaleIn .35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon path={ic.warn} size={24} stroke="var(--amber)" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>There's a billing issue on this account</h2>
          <div style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 600, fontFamily: 'Geist Mono' }}>
            charge declined{reason ? ` · ${reason}` : ''}
          </div>
        </div>
      </div>
      <p style={{ margin: '0 0 16px', color: 'var(--text2)', fontSize: 14 }}>
        New comps are paused because your sub-account's GoHighLevel wallet couldn't be charged.{' '}
        <strong style={{ color: 'var(--text)' }}>Every saved property stays fully viewable</strong> — please top up the wallet or contact your agency admin.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Top up wallet in GHL
        </button>
        <button onClick={onViewSaved} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          View saved properties
        </button>
      </div>
    </div>
  );
}

export function ErrorCard({ fallback, onRetry }: { fallback: Fallback | null; onRetry: (overrides?: Record<string, unknown>) => void }) {
  const needsDetails = fallback?.kind === 'missing_sqft' || fallback?.kind === 'not_found';
  const [sqft, setSqft] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');

  return (
    <div style={{ ...card, maxWidth: 480, margin: '50px auto', padding: 34, textAlign: 'center', animation: 'scaleIn .35s ease both' }}>
      <div style={{ width: 56, height: 56, borderRadius: 15, background: needsDetails ? 'var(--amber-soft)' : 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon path={needsDetails ? ic.warn : ic.refresh} size={26} stroke={needsDetails ? 'var(--amber)' : 'var(--text2)'} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>{needsDetails ? 'Add a few details to comp this one' : 'Temporarily unavailable'}</h2>
      <p style={{ margin: '0 auto 20px', maxWidth: 360, color: 'var(--text2)', fontSize: 14 }}>
        {fallback?.message ?? "We couldn't reach the valuation service. You weren't charged. Saved properties are still viewable."}
      </p>
      {needsDetails ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { v: sqft, set: setSqft, ph: 'Sq Ft' },
              { v: beds, set: setBeds, ph: 'Beds' },
              { v: baths, set: setBaths, ph: 'Baths' },
            ].map((f) => (
              <input
                key={f.ph}
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                style={{ flex: 1, height: 44, border: '1.5px solid var(--border2)', background: 'var(--surface2)', borderRadius: 11, padding: '0 12px', fontSize: 14, color: 'var(--text)', textAlign: 'center' }}
              />
            ))}
          </div>
          <button
            onClick={() =>
              onRetry({
                squareFeet: sqft ? Number(sqft) : undefined,
                bedrooms: beds ? Number(beds) : undefined,
                bathrooms: baths ? Number(baths) : undefined,
              })
            }
            style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Resubmit · charge only on success
          </button>
        </>
      ) : (
        <button onClick={() => onRetry()} style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Try again
        </button>
      )}
    </div>
  );
}

export function AddressMissingCard({ value, onChange, onContinue }: { value: string; onChange: (v: string) => void; onContinue: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', animation: 'fadeUp .4s ease both' }}>
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 18, padding: 28, boxShadow: 'var(--shadow)' }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>
          <Icon path={ic.pin} size={24} stroke="var(--amber)" />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>This contact has no address</h2>
        <p style={{ margin: '0 0 18px', color: 'var(--text2)', fontSize: 14 }}>Enter the property address to comp it. We'll never run a valuation on an empty address.</p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Street, city, state ZIP"
          style={{ width: '100%', height: 48, border: '1.5px solid var(--border2)', background: 'var(--surface2)', borderRadius: 12, padding: '0 14px', fontSize: 15, color: 'var(--text)', marginBottom: 14 }}
        />
        <button onClick={onContinue} disabled={!value.trim()} style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14.5, cursor: value.trim() ? 'pointer' : 'not-allowed', opacity: value.trim() ? 1 : 0.6 }}>
          Continue
        </button>
      </div>
    </div>
  );
}

export function RunningSkeleton({ count }: { count: number }) {
  return (
    <div style={{ animation: 'fadeUp .3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18, color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border2)" strokeWidth="3" />
          <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Pulling comps… analyzing {count} nearby sales
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="sk" style={{ height: 92 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk" style={{ height: 78 }} />
            ))}
          </div>
          <div className="sk" style={{ height: 230 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="sk" style={{ height: 200 }} />
          <div className="sk" style={{ height: 150 }} />
        </div>
      </div>
    </div>
  );
}

export function ConfirmScreen({
  address,
  subject,
  recent,
  onAddressChange,
  onComp,
  onOpenRecent,
  onViewAll,
}: {
  address: string;
  subject: SessionInfo['contact'];
  recent: HistoryItem[];
  onAddressChange: (v: string) => void;
  onComp: () => void;
  onOpenRecent: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', animation: 'fadeUp .45s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', animation: 'glow 3s ease infinite' }}>
          <Icon path={ic.home} size={27} stroke="var(--brand)" width={1.8} />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-.3px' }}>Comp this property</h2>
        <p style={{ margin: '0 auto', maxWidth: 400, color: 'var(--text2)', fontSize: 14 }}>
          Confirm the address below, then pull AI comps, ARV, CMV and a repair estimate.
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Subject address</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Icon path={ic.pin} size={20} stroke="var(--brand)" width={2} />
          <input value={address} onChange={(e) => onAddressChange(e.target.value)} style={{ flex: 1, border: 'none', background: 'none', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>from contact</span>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12.5, fontFamily: 'Geist Mono' }}>
          <span><span style={{ color: 'var(--muted)' }}>Beds</span> 2</span>
          <span><span style={{ color: 'var(--muted)' }}>Baths</span> 2</span>
          <span><span style={{ color: 'var(--muted)' }}>Sq Ft</span> 1,225</span>
          <span><span style={{ color: 'var(--muted)' }}>Built</span> 1950</span>
        </div>
      </div>

      <button onClick={onComp} style={{ width: '100%', height: 52, borderRadius: 13, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: 'var(--shadow)' }}>
        <Icon path={ic.bolt} size={18} width={2.1} />
        Comp this property
      </button>

      {recent.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '30px 2px 12px' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Recent on this location</span>
            <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recent.map((r) => (
              <div key={r.id} onClick={() => onOpenRecent(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
                <Thumb image={r.image} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{relative(r.takenAt)} · free to view</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}>{moneyK(r.arv)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>ARV</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
