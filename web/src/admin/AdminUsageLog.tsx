import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { timeOfDay } from '../lib/format';
import { Icon, ic } from '../lib/icons';

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return '$' + n.toFixed(2);
}

type ChargeStatus = 'charged' | 'free' | 'charge_failed' | 'not_attempted';
type UsageType = 'comp' | 'refresh' | 'repairs';

interface UsageRow {
  id: string;
  time: string;
  location: string;
  address: string;
  type: UsageType;
  brickedStatus: number | null;
  chargedAmount: number;
  chargeStatus: ChargeStatus;
  reason: string;
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1680, margin: '0 auto', padding: '26px 28px 50px' };

const typeChip: Record<UsageType, [string, string]> = {
  comp: ['var(--text2)', 'var(--surface3)'],
  refresh: ['var(--blue)', 'var(--blue-soft)'],
  repairs: ['var(--brand)', 'var(--brand-soft)'],
};

function statusColor(s: number | null): string {
  if (s == null) return 'var(--muted)';
  if (s >= 200 && s < 300) return 'var(--brand)';
  return 'var(--red, #c0392b)';
}

function outcomeChip(s: ChargeStatus): { text: string; color: string; bg: string } {
  switch (s) {
    case 'charged': return { text: 'charged', color: 'var(--brand)', bg: 'var(--brand-soft)' };
    case 'charge_failed': return { text: 'charge failed', color: 'var(--red, #c0392b)', bg: 'var(--red-soft, #fbeceb)' };
    case 'free': return { text: 'free', color: 'var(--blue)', bg: 'var(--blue-soft)' };
    default: return { text: 'not attempted', color: 'var(--text2)', bg: 'var(--surface3)' };
  }
}

const selStyle: React.CSSProperties = { height: 38, borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, padding: '0 10px', cursor: 'pointer' };

export function AdminUsageLog() {
  const nav = useNavigate();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page_, setPage] = useState(1);
  const pageSize = 25;
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  // Debounced fetch on any filter/page change.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      adminApi
        .usage({ page: page_, pageSize, type, status, q })
        .then((r: any) => {
          setRows(r.items ?? []);
          setTotal(r.total ?? 0);
        })
        .catch((err: any) => {
          if (err?.status === 401) {
            adminToken.clear();
            nav('/admin/login', { replace: true });
          }
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [nav, page_, type, status, q]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [type, status, q]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page_ - 1) * pageSize + 1;
  const to = Math.min(total, page_ * pageSize);

  return (
    <div style={page}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Usage log</h1>
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>
          Append-only billing audit — one row per comp / refresh / repairs, with why it was charged, free, or failed.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Icon path={ic.search} size={15} stroke="var(--muted)" width={2} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or location…" style={{ width: '100%', height: 38, border: '1px solid var(--border2)', background: 'var(--surface)', borderRadius: 10, padding: '0 12px 0 34px', color: 'var(--text)', fontSize: 13 }} />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selStyle}>
          <option value="">All types</option>
          <option value="comp">Comp</option>
          <option value="refresh">Refresh</option>
          <option value="repairs">Repairs</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selStyle}>
          <option value="">All outcomes</option>
          <option value="charged">Charged</option>
          <option value="free">Free</option>
          <option value="charge_failed">Charge failed</option>
          <option value="not_attempted">Not attempted (error)</option>
        </select>
        {(type || status || q) && (
          <button onClick={() => { setType(''); setStatus(''); setQ(''); }} style={{ ...selStyle, cursor: 'pointer', color: 'var(--text2)' }}>Clear</button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700 }}>Time</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Location</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Address</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Type</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>API</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700 }}>Charged</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Outcome</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700 }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 18 }}><div className="sk" style={{ height: 260, width: '100%' }} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No matching events.</td></tr>
            ) : (
              rows.map((l) => {
                const [rColor, rBg] = typeChip[l.type] ?? typeChip.comp;
                const oc = outcomeChip(l.chargeStatus);
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'Geist Mono', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{timeOfDay(l.time)}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{l.location}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text2)' }}>{l.address}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: rColor, background: rBg, padding: '2px 8px', borderRadius: 20, fontFamily: 'Geist Mono' }}>{l.type}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Geist Mono', color: statusColor(l.brickedStatus) }}>{l.brickedStatus ?? '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'Geist Mono', fontWeight: 600 }}>{l.chargedAmount > 0 ? usd(l.chargedAmount) : '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: oc.color, background: oc.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{oc.text}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{l.reason}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text2)' }}>
          <span>{total === 0 ? 'No events' : `${from}–${to} of ${total}`}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page_ <= 1 || loading} style={pagerBtn(page_ <= 1)}>Prev</button>
            <span style={{ fontFamily: 'Geist Mono' }}>Page {page_} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page_ >= totalPages || loading} style={pagerBtn(page_ >= totalPages)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 32,
    padding: '0 13px',
    borderRadius: 8,
    border: '1px solid var(--border2)',
    background: 'var(--surface)',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    fontWeight: 600,
    fontSize: 12.5,
    cursor: disabled ? 'default' : 'pointer',
  };
}
