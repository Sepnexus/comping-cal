import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { money } from '../lib/format';

interface PnlRow {
  month: string;
  revenue: number;
  brickedCost: number;
  fees: number;
  profit: number;
  margin: number;
}

interface ByAccount {
  name: string;
  rev: number;
  cost: number;
}

interface Pnl {
  rows: PnlRow[];
  totals: { rev: number; cost: number; profit: number };
  byAccount: ByAccount[];
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1180, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)' };

function monthShort(m: string): string {
  const d = new Date(m + '-01');
  if (isNaN(d.getTime())) return m;
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export function AdminPnl() {
  const nav = useNavigate();
  const [data, setData] = useState<Pnl | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .pnl()
      .then((r) => setData(r))
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav]);

  const t = data?.totals;
  const rows = data?.rows ?? [];
  const grossProfit = t ? t.rev - t.cost : 0;
  const grossMargin = t && t.rev ? (grossProfit / t.rev) * 100 : 0;
  const totalFees = rows.reduce((s, r) => s + r.fees, 0);

  const kpis = [
    { label: 'Revenue (30d)', value: t ? money(t.rev) : '—', delta: 'collected', deltaColor: 'var(--brand)', color: 'var(--text)' },
    { label: 'Comp API cost', value: t ? money(t.cost) : '—', delta: 'COGS', deltaColor: 'var(--text2)', color: 'var(--text)' },
    { label: 'Gross profit', value: t ? money(grossProfit) : '—', delta: 'rev − cost', deltaColor: 'var(--brand)', color: 'var(--brand)' },
    { label: 'Gross margin', value: t ? `${grossMargin.toFixed(1)}%` : '—', delta: 'Target 65%', deltaColor: 'var(--brand)', color: 'var(--text)' },
    { label: 'Net profit', value: t ? money(t.profit) : '—', delta: 'after fees', deltaColor: 'var(--brand)', color: 'var(--text)' },
    { label: 'Proc. fees', value: money(totalFees), delta: t && t.rev ? `${((totalFees / t.rev) * 100).toFixed(1)}% of rev` : '—', deltaColor: 'var(--amber)', color: 'var(--text)' },
  ];

  const maxRev = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20, gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Expenses &amp; P&amp;L</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>What we charge vs what the comp API costs us — profitability at a glance.</p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>This year</button>
          <button style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Export</button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
        {kpis.map((c, i) => (
          <div key={c.label} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, padding: 15, boxShadow: 'var(--shadow)', animation: 'fadeUp .5s ease both', animationDelay: `${(i * 0.05).toFixed(2)}s` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase', lineHeight: 1.3, minHeight: 26 }}>{c.label}</div>
            {loading ? (
              <div className="sk" style={{ height: 24, width: '70%', marginTop: 8 }} />
            ) : (
              <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 22, letterSpacing: '-.5px', marginTop: 8, color: c.color }}>{c.value}</div>
            )}
            <div style={{ fontSize: 11, color: c.deltaColor, marginTop: 3, fontWeight: 600 }}>{c.delta}</div>
          </div>
        ))}
      </div>

      {/* Chart + profitability */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...cardBase, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Revenue vs API cost</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--brand)' }} />
                Revenue
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />
                API cost
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 14, height: 170 }}>
            {loading ? (
              <div className="sk" style={{ height: '100%', width: '100%' }} />
            ) : rows.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center', margin: '0 auto' }}>No data yet.</div>
            ) : (
              rows
                .slice()
                .reverse()
                .map((b, i) => (
                  <div key={b.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'end' }}>
                    <span style={{ fontFamily: 'Geist Mono', fontSize: 10, color: 'var(--brand)', fontWeight: 600 }}>${(b.profit / 1000).toFixed(1)}k</span>
                    <div style={{ width: '100%', display: 'flex', gap: 4, alignItems: 'end', height: '100%' }}>
                      <div style={{ flex: 1, height: `${(b.revenue / maxRev) * 100}%`, background: 'var(--brand)', borderRadius: '3px 3px 0 0', transformOrigin: 'bottom', animation: 'barGrow .7s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${(i * 0.05).toFixed(2)}s` }} />
                      <div style={{ flex: 1, height: `${(b.brickedCost / maxRev) * 100}%`, background: 'var(--red)', borderRadius: '3px 3px 0 0', transformOrigin: 'bottom', animation: 'barGrow .7s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${(i * 0.05).toFixed(2)}s` }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{monthShort(b.month)}</span>
                  </div>
                ))
            )}
          </div>
        </div>

        <div style={{ ...cardBase, padding: '18px 20px' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Profitability by account</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 14 }}>
            {loading ? (
              <div className="sk" style={{ height: 200, width: '100%' }} />
            ) : (data?.byAccount ?? []).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '8px 0' }}>No data yet.</div>
            ) : (
              (data?.byAccount ?? []).map((a) => {
                const profit = a.rev - a.cost;
                const margin = a.rev ? (profit / a.rev) * 100 : 0;
                const profitColor = profit < 0 ? 'var(--red)' : 'var(--brand)';
                return (
                  <div key={a.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>
                        {money(a.rev)} rev · {money(a.cost)} cost
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, color: profitColor }}>
                        {profit < 0 ? '−' : '+'}
                        {money(Math.abs(profit))}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{margin.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Monthly P&L table */}
      <div style={{ ...cardBase, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Monthly P&amp;L</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '10px 18px', fontWeight: 700 }}>Month</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700 }}>Revenue</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700 }}>API cost</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700 }}>Proc. fees</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700 }}>Net profit</th>
              <th style={{ textAlign: 'right', padding: '10px 18px', fontWeight: 700 }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 18 }}>
                  <div className="sk" style={{ height: 180, width: '100%' }} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No monthly data yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.month} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600 }}>{new Date(r.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono' }}>{money(r.revenue)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono', color: 'var(--red)' }}>{money(r.brickedCost)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{money(r.fees)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono', fontWeight: 600, color: 'var(--brand)' }}>{money(r.profit)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontFamily: 'Geist Mono' }}>{r.margin.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
