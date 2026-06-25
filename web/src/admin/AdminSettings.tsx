import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';

interface Settings {
  defaultPerCompPrice: number;
  brickedCost: number;
  globalCostCeiling: number;
  compLookback: number;
  brickedMode: 'mock' | 'live';
  brickedKeySet: boolean;
  brickedKeyMasked: string;
  ghlMode: 'mock' | 'live';
  ghlContactUrl: string;
  ghlLocationUrl: string;
  ghlChargeUrl: string;
  ghlWritebackUrl: string;
  ghlKeySet: boolean;
  ghlKeyMasked: string;
  launchPassword: string;
  hmacSecretMasked: string;
}

interface Form {
  defaultPerCompPrice: string;
  brickedCost: string;
  globalCostCeiling: string;
  compLookback: string;
  brickedMode: 'mock' | 'live';
  brickedApiKey: string; // empty = keep existing
  ghlMode: 'mock' | 'live';
  ghlContactUrl: string;
  ghlLocationUrl: string;
  ghlChargeUrl: string;
  ghlWritebackUrl: string;
  ghlApiKey: string; // empty = keep existing
  launchPassword: string;
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 760, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow)', marginBottom: 16 };

export function AdminSettings() {
  const nav = useNavigate();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  async function doPurge() {
    const ok = window.confirm(
      'Delete ALL locations (except the Sandbox test location), every snapshot, and the entire usage/charge log?\n\nSettings, integration keys and admin accounts are kept. This cannot be undone.',
    );
    if (!ok || purging) return;
    setPurging(true);
    setPurgeMsg(null);
    try {
      const r = await adminApi.purge();
      setPurgeMsg(`Done — removed ${r.removed.locationsDeleted} locations, ${r.removed.snapshots} snapshots, ${r.removed.usageEvents} usage events. Test location kept.`);
    } catch (err: any) {
      if (err?.status === 401) {
        adminToken.clear();
        nav('/admin/login', { replace: true });
        return;
      }
      setPurgeMsg(err?.body?.message ?? 'Could not reset data.');
    } finally {
      setPurging(false);
    }
  }

  function hydrate(r: { settings: Settings }) {
    setS(r.settings);
    setForm({
      defaultPerCompPrice: String(r.settings.defaultPerCompPrice),
      brickedCost: String(r.settings.brickedCost),
      globalCostCeiling: String(r.settings.globalCostCeiling),
      compLookback: String(r.settings.compLookback ?? 12),
      brickedMode: r.settings.brickedMode,
      brickedApiKey: '', // never prefilled — masked on the server
      ghlMode: r.settings.ghlMode,
      ghlContactUrl: r.settings.ghlContactUrl ?? '',
      ghlLocationUrl: r.settings.ghlLocationUrl ?? '',
      ghlChargeUrl: r.settings.ghlChargeUrl ?? '',
      ghlWritebackUrl: r.settings.ghlWritebackUrl ?? '',
      ghlApiKey: '',
      launchPassword: r.settings.launchPassword ?? '',
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

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!form || saving) return;
    const nums = {
      defaultPerCompPrice: Number(form.defaultPerCompPrice),
      brickedCost: Number(form.brickedCost),
      globalCostCeiling: Number(form.globalCostCeiling),
      compLookback: Number(form.compLookback),
    };
    if (Object.values(nums).some((n) => !Number.isFinite(n) || n < 0)) {
      setError('Pricing values must be non-negative numbers.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await adminApi.updateSettings({
        ...nums,
        brickedMode: form.brickedMode,
        brickedApiKey: form.brickedApiKey, // empty → server keeps existing
        ghlMode: form.ghlMode,
        ghlContactUrl: form.ghlContactUrl,
        ghlLocationUrl: form.ghlLocationUrl,
        ghlChargeUrl: form.ghlChargeUrl,
        ghlWritebackUrl: form.ghlWritebackUrl,
        ghlApiKey: form.ghlApiKey, // empty → server keeps existing
        launchPassword: form.launchPassword,
      });
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

  function generatePassword() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const pw = 'cc_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    set('launchPassword', pw);
  }

  return (
    <div style={page}>
      <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Settings</h1>
      <p style={{ margin: '0 0 20px', color: 'var(--text2)', fontSize: 13.5 }}>
        Integration keys, endpoints, the launch password, and pricing — all managed here, no redeploy. Changes apply
        on the next comp. Secret keys are stored server-side and shown masked.
      </p>

      {loading || !form || !s ? (
        <div className="sk" style={{ height: 420, width: '100%' }} />
      ) : (
        <>
          {/* Bricked */}
          <div style={cardBase}>
            <CardHead title="Bricked (valuation API)" mode={form.brickedMode} onMode={(m) => set('brickedMode', m)} />
            <SecretField
              label="Bricked API key"
              isSet={s.brickedKeySet}
              masked={s.brickedKeyMasked}
              value={form.brickedApiKey}
              onChange={(v) => set('brickedApiKey', v)}
            />
            <Hint>Live mode requires a key. Leave blank to keep the current one.</Hint>
          </div>

          {/* GHL */}
          <div style={cardBase}>
            <CardHead title="GoHighLevel endpoints" mode={form.ghlMode} onMode={(m) => set('ghlMode', m)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TextField label="Contact endpoint (GET)" placeholder="https://…/contact" value={form.ghlContactUrl} onChange={(v) => set('ghlContactUrl', v)} />
              <TextField label="Location-name endpoint (GET) — authorization gate" placeholder="https://…/webhook/location" value={form.ghlLocationUrl} onChange={(v) => set('ghlLocationUrl', v)} />
              <TextField label="Charge endpoint (POST)" placeholder="https://…/webhook/payment" value={form.ghlChargeUrl} onChange={(v) => set('ghlChargeUrl', v)} />
              <TextField label="Write-back endpoint (POST)" placeholder="https://…/writeback" value={form.ghlWritebackUrl} onChange={(v) => set('ghlWritebackUrl', v)} />
              <SecretField label="GHL API key (x-api-key)" isSet={s.ghlKeySet} masked={s.ghlKeyMasked} value={form.ghlApiKey} onChange={(v) => set('ghlApiKey', v)} />
            </div>
            <Hint>Live mode uses these. Empty endpoints fall back to mock so the tool still runs. The location-name endpoint authorizes new locations: it must return a <code style={{ fontFamily: 'Geist Mono' }}>name</code> for entitled locations and a non-200 for everyone else.</Hint>
          </div>

          {/* Launch password */}
          <div style={cardBase}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Launch password</div>
            <Hint>The shared secret in the GHL contact button (<code style={{ fontFamily: 'Geist Mono' }}>integrations/ghl-comp-button.js</code>). Put the same value in that file.</Hint>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={form.launchPassword}
                onChange={(e) => set('launchPassword', e.target.value)}
                placeholder="set a shared launch secret"
                style={{ flex: 1, height: 42, border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 10, padding: '0 13px', color: 'var(--text)', fontSize: 13.5, fontFamily: 'Geist Mono' }}
              />
              <SmallBtn onClick={() => form.launchPassword && navigator.clipboard?.writeText(form.launchPassword)}>Copy</SmallBtn>
              <SmallBtn onClick={generatePassword}>Generate</SmallBtn>
            </div>
          </div>

          {/* Pricing & limits */}
          <div style={cardBase}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Pricing &amp; limits</div>
            <Hint>Global defaults. A location can override its own per-comp price.</Hint>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
              <PriceField label="Default per-comp price" prefix="$" value={form.defaultPerCompPrice} onChange={(v) => set('defaultPerCompPrice', v)} step="0.01" />
              <PriceField label="API cost / call" prefix="$" value={form.brickedCost} onChange={(v) => set('brickedCost', v)} step="0.01" />
              <PriceField label="Global cost ceiling / location" prefix="$" suffix="/mo" value={form.globalCostCeiling} onChange={(v) => set('globalCostCeiling', v)} step="1" />
              <PriceField label="Comp lookback (months)" suffix="mo" value={form.compLookback} onChange={(v) => set('compLookback', v)} step="1" />
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ ...cardBase, border: '1px solid var(--red, #c0392b)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--red, #c0392b)' }}>Danger zone — reset data</div>
            <Hint>Permanently deletes every location except the Sandbox test location, all property snapshots, and the entire usage/charge log. Settings, integration keys and admin accounts are kept.</Hint>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                onClick={doPurge}
                disabled={purging}
                style={{ height: 42, padding: '0 18px', borderRadius: 11, border: '1px solid var(--red, #c0392b)', background: 'transparent', color: 'var(--red, #c0392b)', fontWeight: 700, fontSize: 13, cursor: purging ? 'default' : 'pointer', opacity: purging ? 0.6 : 1 }}
              >
                {purging ? 'Resetting…' : 'Reset data (keep test location)'}
              </button>
              {purgeMsg && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{purgeMsg}</span>}
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 16 }}>
            HMAC server secret (read-only, set in env): <span style={{ fontFamily: 'Geist Mono' }}>{s.hmacSecretMasked || 'not set'}</span>
          </div>

          {error && (
            <div style={{ marginBottom: 14, background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, fontWeight: 500 }}>{error}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ height: 44, padding: '0 22px', borderRadius: 11, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand)' }}>✓ Saved</span>}
          </div>
        </>
      )}
    </div>
  );
}

function CardHead({ title, mode, onMode }: { title: string; mode: 'mock' | 'live'; onMode: (m: 'mock' | 'live') => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ display: 'flex', background: 'var(--surface3)', borderRadius: 8, padding: 3, gap: 2 }}>
        {(['mock', 'live'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            style={{
              padding: '5px 13px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: mode === m ? 'var(--surface)' : 'transparent',
              color: mode === m ? (m === 'live' ? 'var(--brand)' : 'var(--text)') : 'var(--text2)',
              boxShadow: mode === m ? 'var(--shadow)' : 'none',
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function SecretField({ label, isSet, masked, value, onChange }: { label: string; isSet: boolean; masked: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
        {label}
        {isSet ? (
          <span style={{ fontFamily: 'Geist Mono', fontSize: 10.5, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '1px 7px', borderRadius: 20 }}>set · {masked}</span>
        ) : (
          <span style={{ fontFamily: 'Geist Mono', fontSize: 10.5, color: 'var(--amber)', background: 'var(--amber-soft)', padding: '1px 7px', borderRadius: 20 }}>not set</span>
        )}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? 'leave blank to keep current' : 'paste key'}
        style={{ width: '100%', height: 42, border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 10, padding: '0 13px', color: 'var(--text)', fontSize: 13.5, fontFamily: 'Geist Mono' }}
      />
    </label>
  );
}

function TextField({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', height: 42, border: '1px solid var(--border2)', background: 'var(--surface2)', borderRadius: 10, padding: '0 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist Mono' }}
      />
    </label>
  );
}

function SmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 42, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface2)', fontWeight: 600, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text2)' }}>{children}</p>;
}

function PriceField({ label, value, onChange, prefix, suffix, step }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; step?: string }) {
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
