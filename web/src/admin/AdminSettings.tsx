import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';

interface Settings {
  brickedKeyMasked: string;
  ghlClientMasked: string;
  hmacSecretMasked: string;
  defaultPerCompPrice: number;
  brickedCost: number;
  globalCostCeiling: number;
  compLookback: number;
  brickedMode: string;
  ghlMode: string;
}

// Editable pricing/limit fields (kept as strings while typing).
interface PricingForm {
  defaultPerCompPrice: string;
  brickedCost: string;
  globalCostCeiling: string;
  compLookback: string;
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 760, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow)' };

const credInput: React.CSSProperties = {
  width: '100%',
  height: 42,
  border: '1px solid var(--border2)',
  background: 'var(--surface2)',
  borderRadius: 10,
  padding: '0 13px',
  color: 'var(--text)',
  fontSize: 13.5,
  fontFamily: 'Geist Mono',
};

const priceInput: React.CSSProperties = {
  height: 42,
  border: '1px solid var(--border2)',
  background: 'var(--surface2)',
  borderRadius: 10,
  padding: '0 13px',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'Geist Mono',
};

function dollars(n: number): string {
  return '$' + n.toFixed(2);
}

export function AdminSettings() {
  const nav = useNavigate();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PricingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function hydrate(r: { settings: Settings }) {
    setS(r.settings);
    setForm({
      defaultPerCompPrice: String(r.settings.defaultPerCompPrice),
      brickedCost: String(r.settings.brickedCost),
      globalCostCeiling: String(r.settings.globalCostCeiling),
      compLookback: String(r.settings.compLookback ?? 12),
    });
  }

  useEffect(() => {
    adminApi
      .settings()
      .then(hydrate)
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav]);

  function setField(key: keyof PricingForm, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!form || saving) return;
    const patch = {
      defaultPerCompPrice: Number(form.defaultPerCompPrice),
      brickedCost: Number(form.brickedCost),
      globalCostCeiling: Number(form.globalCostCeiling),
      compLookback: Number(form.compLookback),
    };
    if (Object.values(patch).some((n) => !Number.isFinite(n) || n < 0)) {
      setError('All values must be non-negative numbers.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await adminApi.updateSettings(patch);
      hydrate(r);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      if (err?.status === 401) {
        adminToken.clear();
        nav('/admin/login', { replace: true });
        return;
      }
      setError(err?.body?.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Settings</h1>
      <p style={{ margin: '0 0 20px', color: 'var(--text2)', fontSize: 13.5 }}>
        Server-side secrets and global defaults. Keys are stored in backend secrets and shown masked.
      </p>

      {/* Credentials */}
      <div style={{ ...cardBase, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Credentials &amp; secrets</div>
        {loading ? (
          <div className="sk" style={{ height: 160, width: '100%' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Valuation API key
                {s && (
                  <span style={{ marginLeft: 8, fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 10.5, color: 'var(--text2)', background: 'var(--surface3)', padding: '1px 7px', borderRadius: 20 }}>
                    {s.brickedMode}
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={s?.brickedKeyMasked ?? ''} readOnly style={{ ...credInput, flex: 1 }} />
                <button style={{ height: 42, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface2)', fontWeight: 600, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
                  Rotate
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                GHL app credentials (client ID / secret)
                {s && (
                  <span style={{ marginLeft: 8, fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 10.5, color: 'var(--text2)', background: 'var(--surface3)', padding: '1px 7px', borderRadius: 20 }}>
                    {s.ghlMode}
                  </span>
                )}
              </label>
              <input value={s?.ghlClientMasked ?? ''} readOnly style={credInput} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>HMAC server secret</label>
              <input value={s?.hmacSecretMasked ?? ''} readOnly style={credInput} />
            </div>
          </div>
        )}
      </div>

      {/* Pricing & limits — editable + persisted */}
      <div style={cardBase}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Pricing &amp; limits</div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text2)' }}>
          Global defaults. A location can override its own per-comp price; changes apply to the next comp.
        </p>
        {loading || !form ? (
          <div className="sk" style={{ height: 110, width: '100%' }} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <PriceField label="Default per-comp price" prefix="$" value={form.defaultPerCompPrice} onChange={(v) => setField('defaultPerCompPrice', v)} step="0.01" />
              <PriceField label="API cost / call" prefix="$" value={form.brickedCost} onChange={(v) => setField('brickedCost', v)} step="0.01" />
              <PriceField label="Global cost ceiling / location" prefix="$" suffix="/mo" value={form.globalCostCeiling} onChange={(v) => setField('globalCostCeiling', v)} step="1" />
              <PriceField label="Comp lookback (months)" suffix="mo" value={form.compLookback} onChange={(v) => setField('compLookback', v)} step="1" />
            </div>

            {error && (
              <div style={{ marginTop: 14, background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, fontWeight: 500 }}>{error}</div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ height: 42, padding: '0 18px', borderRadius: 11, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {saved && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand)' }}>✓ Saved</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
      {label}
      <div style={{ display: 'flex', alignItems: 'center', height: 42, border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 10, padding: '0 12px', gap: 6 }}>
        {prefix && <span style={{ color: 'var(--muted)', fontFamily: 'Geist Mono', fontSize: 14 }}>{prefix}</span>}
        <input
          type="number"
          min="0"
          step={step ?? 'any'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 14, fontFamily: 'Geist Mono' }}
        />
        {suffix && <span style={{ color: 'var(--muted)', fontFamily: 'Geist Mono', fontSize: 13 }}>{suffix}</span>}
      </div>
    </label>
  );
}
