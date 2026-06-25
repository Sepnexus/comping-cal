import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, ic } from '../lib/icons';
import { adminApi, adminToken } from '../lib/api';

export function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('akshay@sepnexus.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setInvalid(false);
    setLocked(null);
    try {
      const r = await adminApi.login(email, password);
      adminToken.set(r.token);
      nav('/admin', { replace: true });
    } catch (err: any) {
      if (err?.status === 429) setLocked(err?.body?.message ?? 'Too many attempts. Locked for 5:00.');
      else setInvalid(true);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    border: '1px solid var(--border2)',
    background: 'var(--surface)',
    borderRadius: 11,
    padding: '0 14px',
    color: 'var(--text)',
    fontSize: 14.5,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'var(--text)', background: 'var(--bg)', animation: 'fadeUp .35s ease both' }}>
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(160deg,var(--brand) 0%,var(--brand2) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 40,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'repeating-linear-gradient(45deg,#fff,#fff 1px,transparent 1px,transparent 22px)' }} />
        <img src="/assets/closer-control-logo.png" alt="Closer Control" style={{ height: 42, width: 'auto', filter: 'brightness(0) invert(1)', position: 'relative' }} />
        <div style={{ position: 'relative' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,.15)',
              padding: '4px 11px',
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            Admin · internal
          </span>
          <h1 style={{ margin: '0 0 14px', fontSize: 32, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, maxWidth: 380 }}>Comping platform oversight</h1>
          <p style={{ margin: 0, fontSize: 15, opacity: 0.9, maxWidth: 360, lineHeight: 1.5 }}>
            Locations, usage log, API spend vs revenue, and per-location controls — all in one console.
          </p>
        </div>
        <div style={{ position: 'relative', fontSize: 12, opacity: 0.75 }}>Restricted access · Closer Control</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--bg)' }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 370, animation: 'fadeUp .35s ease both' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700 }}>Admin sign in</h2>
          <p style={{ margin: '0 0 24px', color: 'var(--text2)', fontSize: 14 }}>
            For platform admins only. Sub-account users access the tool inside GoHighLevel.
          </p>

          {invalid && (
            <div
              style={{
                background: 'var(--red-soft)',
                color: 'var(--red)',
                borderRadius: 10,
                padding: '11px 13px',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                animation: 'slideDown .3s ease both',
              }}
            >
              <Icon path={ic.info} size={15} width={2.2} />
              Incorrect email or password.
            </div>
          )}
          {locked && (
            <div
              style={{
                background: 'var(--amber-soft)',
                color: 'var(--amber)',
                borderRadius: 10,
                padding: '11px 13px',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon path={ic.lock} size={15} width={2} />
              {locked}
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" style={{ ...inputStyle, marginBottom: 14 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Password</label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)', cursor: 'pointer' }}>Forgot?</span>
          </div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={{ ...inputStyle, marginBottom: 18 }}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 11,
              border: 'none',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontWeight: 700,
              fontSize: 14.5,
              cursor: submitting ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
            }}
          >
            {submitting && (
              <svg width="17" height="17" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            Sign in
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 18,
              padding: '11px 13px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text2)',
            }}
          >
            <Icon path={ic.shield} size={15} stroke="var(--brand)" width={2} />
            Protected by 2FA · all admin actions are audited.
          </div>
        </form>
      </div>
    </div>
  );
}
