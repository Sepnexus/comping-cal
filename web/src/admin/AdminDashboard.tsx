import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { money2, initials } from '../lib/format';

interface Dashboard {
  kpis: {
    totalLocations: number;
    activeLocations: number;
    compsToday: number;
    margin: number;
    failedCharges: number;
    brickedSpend: number;
    revenue: number;
  };
  errorRate: { status: number; c: number }[];
  topLocations: { name: string; hits: number; margin: number }[];
  series: { d: string; rev: number; spend: number }[];
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1180, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)' };

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--brand)';
  if (status >= 500 || status === 402) return 'var(--red)';
  return 'var(--amber)';
}

export function AdminDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .dashboard()
      .then((r) => setData(r))
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav]);

  const k = data?.kpis;
  const kpiCards = [
    { label: 'Total locations', value: k ? k.totalLocations.toLocaleString() : '—', delta: 'on allowlist', deltaColor: 'var(--brand)', color: 'var(--text)' },
    {
      label: 'Active locations',
      value: k ? k.activeLocations.toLocaleString() : '—',
      delta: k && k.totalLocations ? `${Math.round((k.activeLocations / k.totalLocations) * 100)}% of base` : '—',
      deltaColor: 'var(--brand)',
      color: 'var(--text)',
    },
    { label: 'Comps today', value: k ? k.compsToday.toLocaleString() : '—', delta: 'today', deltaColor: 'var(--brand)', color: 'var(--text)' },
    { label: 'Margin (30d)', value: k ? money2(k.margin) : '—', delta: 'net revenue', deltaColor: 'var(--brand)', color: 'var(--brand)' },
    { label: 'Failed charges', value: k ? String(k.failedCharges) : '—', delta: 'wallet declines', deltaColor: 'var(--red)', color: 'var(--red)' },
    { label: 'API spend (30d)', value: k ? money2(k.brickedSpend) : '—', delta: 'API cost', deltaColor: 'var(--text2)', color: 'var(--text)' },
  ];

  const series = data?.series ?? [];
  const maxSeries = Math.max(1, ...series.map((s) => Math.max(s.rev, s.spend)));
  const errors = data?.errorRate ?? [];
  const maxErr = Math.max(1, ...errors.map((e) => e.c));

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>Platform health, margin and usage at a glance.</p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>Live · updated just now</span>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
        {kpiCards.map((c, i) => (
          <div
            key={c.label}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              borderRadius: 14,
              padding: 15,
              boxShadow: 'var(--shadow)',
              animation: 'fadeUp .5s ease both',
              animationDelay: `${(i * 0.05).toFixed(2)}s`,
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase', lineHeight: 1.3, minHeight: 26 }}>
              {c.label}
            </div>
            {loading ? (
              <div className="sk" style={{ height: 26, width: '70%', marginTop: 8 }} />
            ) : (
              <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 23, letterSpacing: '-.5px', marginTop: 8, color: c.color }}>{c.value}</div>
            )}
            <div style={{ fontSize: 11.5, color: c.deltaColor, marginTop: 3, fontWeight: 600 }}>{c.delta}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...cardBase, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Daily comps · revenue vs API spend</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--brand)' }} />
                Revenue
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--border2)' }} />
                Spend
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 9, height: 150 }}>
            {loading ? (
              <div className="sk" style={{ height: '100%', width: '100%' }} />
            ) : series.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center', margin: '0 auto' }}>No usage yet.</div>
            ) : (
              series.map((b, i) => {
                const day = new Date(b.d).toLocaleDateString('en-US', { weekday: 'narrow' });
                return (
                  <div key={b.d + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'end' }}>
                    <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'end', height: '100%' }}>
                      <div
                        style={{
                          flex: 1,
                          height: `${(b.rev / maxSeries) * 100}%`,
                          background: 'var(--brand)',
                          borderRadius: '3px 3px 0 0',
                          transformOrigin: 'bottom',
                          animation: 'barGrow .7s cubic-bezier(.2,.8,.2,1) both',
                          animationDelay: `${(i * 0.04).toFixed(2)}s`,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          height: `${(b.spend / maxSeries) * 100}%`,
                          background: 'var(--border2)',
                          borderRadius: '3px 3px 0 0',
                          transformOrigin: 'bottom',
                          animation: 'barGrow .7s cubic-bezier(.2,.8,.2,1) both',
                          animationDelay: `${(i * 0.04).toFixed(2)}s`,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{day}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ ...cardBase, padding: '18px 20px' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Error rate by API status</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 18 }}>
            {loading ? (
              <div className="sk" style={{ height: 100, width: '100%' }} />
            ) : errors.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No errors recorded.</div>
            ) : (
              errors.map((e, i) => (
                <div key={e.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{e.status}</span>
                    <span style={{ fontFamily: 'Geist Mono', fontWeight: 600 }}>{e.c.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(e.c / maxErr) * 100}%`,
                        background: statusColor(e.status),
                        borderRadius: 4,
                        transformOrigin: 'left',
                        animation: 'growW .8s cubic-bezier(.2,.8,.2,1) both',
                        animationDelay: `${(i * 0.05).toFixed(2)}s`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top locations */}
      <div style={{ ...cardBase, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Top locations by usage</div>
        {loading ? (
          <div style={{ padding: 18 }}>
            <div className="sk" style={{ height: 80, width: '100%' }} />
          </div>
        ) : (data?.topLocations ?? []).length === 0 ? (
          <div style={{ padding: 18, color: 'var(--muted)', fontSize: 13 }}>No usage yet.</div>
        ) : (
          (data?.topLocations ?? []).map((a) => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                {initials(a.name)}
              </div>
              <span style={{ flex: 1, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontFamily: 'Geist Mono', color: 'var(--text2)', width: 90, textAlign: 'right' }}>{a.hits.toLocaleString()} comps</span>
              <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, width: 90, textAlign: 'right', color: 'var(--brand)' }}>+{money2(a.margin)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
