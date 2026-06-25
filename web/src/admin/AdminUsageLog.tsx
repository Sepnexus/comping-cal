import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { timeOfDay } from '../lib/format';

/** Precise small-dollar formatter (money() rounds, which loses $0.65 etc.). */
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
  freeReason?: string;
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1180, margin: '0 auto', padding: '26px 28px 50px' };

const typeChip: Record<UsageType, [string, string]> = {
  comp: ['var(--text2)', 'var(--surface3)'],
  refresh: ['var(--blue)', 'var(--blue-soft)'],
  repairs: ['var(--brand)', 'var(--brand-soft)'],
};

function statusColor(s: number | null): string {
  if (s == null) return 'var(--muted)';
  if (s >= 200 && s < 300) return 'var(--brand)';
  return 'var(--red)';
}

function outcome(r: UsageRow): { text: string; color: string } {
  switch (r.chargeStatus) {
    case 'charged':
      return { text: 'charged', color: 'var(--text)' };
    case 'charge_failed':
      return { text: 'charge_failed', color: 'var(--red)' };
    case 'free':
      return { text: r.freeReason ? `free · ${r.freeReason}` : 'free', color: 'var(--blue)' };
    case 'not_attempted':
    default:
      return { text: 'not attempted', color: 'var(--muted)' };
  }
}

export function AdminUsageLog() {
  const nav = useNavigate();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .usage()
      .then((r) => setRows(r.items ?? []))
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav]);

  const btn: React.CSSProperties = {
    height: 38,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid var(--border2)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20, gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Usage log</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>
            Append-only billing audit. One row per comp / refresh / repairs — links the comp API call to the wallet charge.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button style={btn}>Filter</button>
          <button style={btn}>Export CSV</button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700 }}>Time</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Location</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Address</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>Type</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>API status</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700 }}>Charged</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700 }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 18 }}>
                  <div className="sk" style={{ height: 240, width: '100%' }} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No usage recorded yet.</td>
              </tr>
            ) : (
              rows.map((l, i) => {
                const [rColor, rBg] = typeChip[l.type] ?? typeChip.comp;
                const out = outcome(l);
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', animation: 'slideRight .25s ease both', animationDelay: `${(i * 0.025).toFixed(2)}s` }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{timeOfDay(l.time)}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{l.location}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text2)' }}>{l.address}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: rColor, background: rBg, padding: '2px 8px', borderRadius: 20, fontFamily: 'Geist Mono' }}>{l.type}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'Geist Mono', color: statusColor(l.brickedStatus) }}>{l.brickedStatus ?? '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'Geist Mono', fontWeight: 600 }}>{l.chargedAmount > 0 ? usd(l.chargedAmount) : '—'}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'Geist Mono', color: out.color }}>{out.text}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
