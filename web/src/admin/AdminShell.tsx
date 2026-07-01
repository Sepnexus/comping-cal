import { useState, type CSSProperties } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, ic } from '../lib/icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { adminToken } from '../lib/api';

const NAV: { to: string; icon: string; label: string; end?: boolean }[] = [
  { to: '/admin', icon: ic.grid, label: 'Dashboard', end: true },
  { to: '/admin/locations', icon: ic.users, label: 'Locations' },
  { to: '/admin/usage', icon: ic.list, label: 'Usage Log' },
  { to: '/admin/pnl', icon: ic.pl, label: 'Margin & Spend' },
  { to: '/admin/feedback', icon: ic.bell, label: 'Feedback' },
  { to: '/admin/settings', icon: ic.sliders, label: 'Settings' },
];

export function AdminShell() {
  const nav = useNavigate();
  const [search, setSearch] = useState('');

  // Auth guard: no token → bounce to login.
  if (!adminToken.get()) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    adminToken.clear();
    nav('/admin/login', { replace: true });
  };

  const navStyle = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '9px 10px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: 600,
    textDecoration: 'none',
    width: '100%',
    background: active ? 'var(--brand-soft)' : 'transparent',
    color: active ? 'var(--brand)' : 'var(--text2)',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', color: 'var(--text)', background: 'var(--bg)', fontSize: 14, lineHeight: 1.45 }}>
      <aside
        style={{
          width: 248,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid var(--border)' }}>
          <img src="/assets/closer-control-logo.png" alt="Closer Control" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>Comps</span>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.3px' }}>by Closer Control</span>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', padding: '6px 10px 4px' }}>Admin</span>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} style={({ isActive }) => navStyle(isActive)}>
              {({ isActive }) => (
                <>
                  <Icon path={n.icon} size={18} stroke={isActive ? 'var(--brand)' : 'currentColor'} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'var(--brand)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              AP
            </div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Akshay P. Singh</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Platform admin</div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon path={ic.lock} size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 60,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 22px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
            <Icon path={ic.search} size={16} stroke="var(--muted)" width={2} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations, addresses, charges…"
              style={{
                width: '100%',
                height: 38,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 10,
                padding: '0 12px 0 38px',
                color: 'var(--text)',
                fontSize: 13.5,
              }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <ThemeToggle />
        </header>

        <Outlet />
      </main>
    </div>
  );
}
