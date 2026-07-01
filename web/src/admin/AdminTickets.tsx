import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';

interface Ticket {
  id: string;
  time: string;
  location: string;
  address: string | null;
  contactName: string | null;
  category: string | null;
  message: string | null;
  status: 'open' | 'resolved';
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1480, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)' };

function timeFmt(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminTickets() {
  const nav = useNavigate();
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  function load() {
    adminApi
      .tickets()
      .then((r: any) => setItems(r.items))
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: 'open' | 'resolved') {
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, status } : t)));
    await adminApi.updateTicket(id, status).catch(() => load());
  }

  const shown = filter === 'open' ? items.filter((t) => t.status === 'open') : items;
  const openCount = items.filter((t) => t.status === 'open').length;

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20, gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Support tickets</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>Issues reps raised from the tool when a comp errored — who, where, and why.</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
          {(['open', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'var(--surface)' : 'transparent', color: filter === f ? 'var(--brand)' : 'var(--text2)', boxShadow: filter === f ? 'var(--shadow)' : 'none' }}>
              {f === 'open' ? `Open (${openCount})` : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...cardBase, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '11px 18px', fontWeight: 700 }}>Issue</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Address</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Location</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Raised by</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>When</th>
              <th style={{ textAlign: 'right', padding: '11px 18px', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 18 }}><div className="sk" style={{ height: 120, width: '100%' }} /></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 26, color: 'var(--muted)', textAlign: 'center' }}>{filter === 'open' ? 'No open tickets. 🎉' : 'No tickets yet.'}</td></tr>
            ) : (
              shown.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)', opacity: t.status === 'resolved' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 18px', maxWidth: 420 }}>
                    <div style={{ fontWeight: 600 }}>{t.message}</div>
                    {t.category && <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'Geist Mono', marginTop: 2 }}>{t.category}</div>}
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--text2)' }}>{t.address || '—'}</td>
                  <td style={{ padding: '12px 10px', color: 'var(--text2)' }}>{t.location}</td>
                  <td style={{ padding: '12px 10px', color: 'var(--text2)' }}>{t.contactName || '—'}</td>
                  <td style={{ padding: '12px 10px', fontFamily: 'Geist Mono', color: 'var(--text2)', fontSize: 12 }}>{timeFmt(t.time)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    {t.status === 'open' ? (
                      <button onClick={() => setStatus(t.id, 'resolved')} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--brand)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Mark resolved</button>
                    ) : (
                      <button onClick={() => setStatus(t.id, 'open')} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Resolved · reopen</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
