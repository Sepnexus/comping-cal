import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { money2, initials } from '../lib/format';

interface RecentEvent {
  time: string;
  location: string;
  address: string | null;
  type: string;
  chargeStatus: string;
  chargedAmount: number;
  brickedStatus: number | null;
}

interface Dashboard {
  kpis: {
    totalLocations: number;
    activeLocations: number;
    compsToday: number;
    margin: number;
    failedCharges: number;
    brickedSpend: number;
    revenue: number;
    totalComps: number;
    avgPerComp: number;
    freeViews: number;
    snapshotCount: number;
    errorCount: number;
    prevRevenue: number | null;
    prevComps: number | null;
  };
  errorRate: { status: number; c: number }[];
  topLocations: { name: string; hits: number; margin: number }[];
  series: { d: string; comps: number; rev: number; spend: number }[];
  recent: RecentEvent[];
  recentErrors: { time: string; location: string; address: string | null; type: string; status: number | null; reason: string }[];
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1680, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)' };

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--brand)';
  if (status >= 500 || status === 402) return 'var(--red)';
  return 'var(--amber)';
}

const RANGES: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 0 },
];

export function AdminDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    setLoading(true);
    adminApi
      .dashboard(range)
      .then((r) => setData(r))
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav, range]);

  const k = data?.kpis;
  // window-over-window delta label (▲/▼ %), null when no previous window (All time)
  const deltaOf = (cur: number, prev: number | null | undefined): { text: string; color: string } | null => {
    if (prev == null) return null;
    if (prev === 0) return cur > 0 ? { text: '▲ new', color: 'var(--brand)' } : null;
    const pct = ((cur - prev) / prev) * 100;
    const up = pct >= 0;
    return { text: `${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs prev`, color: up ? 'var(--brand)' : 'var(--red, #c0392b)' };
  };
  const revDelta = k ? deltaOf(k.revenue, k.prevRevenue) : null;
  const compsDelta = k ? deltaOf(k.totalComps, k.prevComps) : null;
  const kpiCards = [
    { label: 'Revenue', value: k ? money2(k.revenue) : '—', delta: revDelta?.text ?? 'collected', deltaColor: revDelta?.color ?? 'var(--brand)', color: 'var(--brand)' },
    { label: 'Profit / margin', value: k ? money2(k.margin) : '—', delta: k && k.revenue ? `${((k.margin / k.revenue) * 100).toFixed(0)}% margin` : 'rev − API cost', deltaColor: 'var(--brand)', color: 'var(--brand)' },
    { label: 'API spend', value: k ? money2(k.brickedSpend) : '—', delta: 'comp API cost', deltaColor: 'var(--text2)', color: 'var(--text)' },
    { label: 'Comps run', value: k ? k.totalComps.toLocaleString() : '—', delta: compsDelta?.text ?? (k ? `${k.compsToday} today` : '—'), deltaColor: compsDelta?.color ?? 'var(--brand)', color: 'var(--text)' },
    {
      label: 'Active locations',
      value: k ? k.activeLocations.toLocaleString() : '—',
      delta: k ? `${k.activeLocations} of ${k.totalLocations}` : '—',
      deltaColor: 'var(--brand)',
      color: 'var(--text)',
    },
    { label: 'Failed charges', value: k ? String(k.failedCharges) : '—', delta: 'wallet declines', deltaColor: k && k.failedCharges ? 'var(--red)' : 'var(--text2)', color: k && k.failedCharges ? 'var(--red)' : 'var(--text)' },
  ];

  const miniStats = [
    { label: 'Avg / comp', value: k ? money2(k.avgPerComp) : '—' },
    { label: 'Free opens (cached)', value: k ? k.freeViews.toLocaleString() : '—' },
    { label: 'Snapshots stored', value: k ? k.snapshotCount.toLocaleString() : '—' },
  ];

  const series = data?.series ?? [];
  const maxComps = Math.max(1, ...series.map((s) => s.comps));
  const errors = data?.errorRate ?? [];
  const recent = data?.recent ?? [];
  const recentErrors = data?.recentErrors ?? [];
  const timeShort = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const outcomeStyle = (s: string): [string, string] =>
    s === 'charged' ? ['var(--brand)', 'var(--brand-soft)'] : s === 'charge_failed' ? ['var(--red)', 'var(--red-soft)'] : ['var(--text2)', 'var(--surface3)'];

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>Platform health, margin and usage — filtered to the selected window.</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              style={{ padding: '6px 13px', borderRadius: 7, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: range === r.days ? 'var(--surface)' : 'transparent', color: range === r.days ? 'var(--brand)' : 'var(--text2)', boxShadow: range === r.days ? 'var(--shadow)' : 'none' }}
            >
              {r.label}
            </button>
          ))}
        </div>
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

      {/* Mini stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {miniStats.map((s) => (
          <div key={s.label} style={{ ...cardBase, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 15 }}>{loading ? '—' : s.value}</span>
          </div>
        ))}
      </div>

      {/* Daily comps — full-width volume chart */}
      <div style={{ ...cardBase, padding: '18px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Daily comps</span>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'Geist Mono' }}>{k ? `${k.totalComps.toLocaleString()} comps · ${money2(k.revenue)} rev` : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', gap: 8, height: 190 }}>
          {loading ? (
            <div className="sk" style={{ height: '100%', width: '100%' }} />
          ) : series.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center', margin: '0 auto' }}>No comps in this window yet.</div>
          ) : (
            series.map((b, i) => {
              const label = new Date(b.d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
              return (
                <div key={b.d + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'end' }} title={`${b.d}: ${b.comps} comps · ${money2(b.rev)}`}>
                  <span style={{ fontSize: 11, fontFamily: 'Geist Mono', fontWeight: 700, color: 'var(--brand)' }}>{b.comps}</span>
                  <div style={{ width: '100%', maxWidth: 46, height: `${Math.max(4, (b.comps / maxComps) * 100)}%`, background: 'linear-gradient(var(--brand), color-mix(in srgb, var(--brand) 70%, transparent))', borderRadius: '5px 5px 0 0', transformOrigin: 'bottom', animation: 'barGrow .7s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${(i * 0.04).toFixed(2)}s` }} />
                  <span style={{ fontSize: 9.5, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Errors — compact summary; full detail lives in the Usage Log */}
      {!loading && (data?.kpis?.errorCount ?? 0) > 0 && (
        <div style={{ ...cardBase, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--red, #c0392b)' }}>{data?.kpis?.errorCount} errors in this window</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {errors.map((e) => (
                <span key={e.status} style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'Geist Mono', color: statusColor(e.status), background: 'var(--surface3)', padding: '2px 7px', borderRadius: 20 }}>{e.status}·{e.c}</span>
              ))}
            </div>
            {recentErrors[0] && <span style={{ fontSize: 12, color: 'var(--text2)' }}>latest: {recentErrors[0].reason}</span>}
          </div>
          <button onClick={() => nav('/admin/usage')} style={{ height: 32, padding: '0 13px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>View in Usage Log →</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
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

      {/* Recent activity */}
      <div style={{ ...cardBase, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Recent activity</div>
        {loading ? (
          <div style={{ padding: 18 }}><div className="sk" style={{ height: 80, width: '100%' }} /></div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--muted)', fontSize: 13 }}>No activity yet.</div>
        ) : (
          recent.map((e, i) => {
            const [c, bg] = outcomeStyle(e.chargeStatus);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 18px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.address || '—'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'Geist Mono', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.location} · {timeShort(e.time)}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface3)', padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase', flexShrink: 0 }}>{e.type}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: c, background: bg, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{e.chargeStatus === 'charge_failed' ? 'failed' : e.chargeStatus}</span>
                <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, width: 48, textAlign: 'right', flexShrink: 0 }}>{e.chargedAmount > 0 ? money2(e.chargedAmount) : '—'}</span>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
