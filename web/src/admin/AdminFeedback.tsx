import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { Icon } from '../lib/icons';

interface FeedbackItem {
  id: string;
  time: string;
  location: string;
  address: string | null;
  contactName: string | null;
  rating: 'up' | 'down';
  reason: string | null;
}

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1100, margin: '0 auto', padding: '26px 28px 50px' };
const cardBase: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)' };

const THUMB_UP = 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3';
const THUMB_DOWN = 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17';

function timeFmt(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminFeedback() {
  const nav = useNavigate();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [counts, setCounts] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .feedback()
      .then((r: any) => {
        setItems(r.items);
        setCounts(r.counts);
      })
      .catch((err: any) => {
        if (err?.status === 401) {
          adminToken.clear();
          nav('/admin/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [nav]);

  const total = counts.up + counts.down;
  const satisfaction = total ? Math.round((counts.up / total) * 100) : 0;

  return (
    <div style={page}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Feedback</h1>
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>Thumbs up / down that reps left on a comp, with the reason on a thumbs-down.</p>
      </div>

      {/* summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Positive', value: String(counts.up), color: 'var(--brand)' },
          { label: 'Negative', value: String(counts.down), color: 'var(--red, #c0392b)' },
          { label: 'Satisfaction', value: total ? `${satisfaction}%` : '—', color: 'var(--text)' },
        ].map((c) => (
          <div key={c.label} style={{ ...cardBase, padding: 15 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 22, marginTop: 8, color: c.color }}>{loading ? '—' : c.value}</div>
          </div>
        ))}
      </div>

      {/* list */}
      <div style={{ ...cardBase, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '11px 18px', fontWeight: 700, width: 60 }}></th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Address</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Location</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Contact</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Reason</th>
              <th style={{ textAlign: 'right', padding: '11px 18px', fontWeight: 700 }}>When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 18 }}><div className="sk" style={{ height: 120, width: '100%' }} /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 26, color: 'var(--muted)', textAlign: 'center' }}>No feedback yet.</td></tr>
            ) : (
              items.map((f) => {
                const up = f.rating === 'up';
                const color = up ? 'var(--brand)' : 'var(--red, #c0392b)';
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: up ? 'var(--brand-soft)' : 'var(--red-soft, #fbeceb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon path={up ? THUMB_UP : THUMB_DOWN} size={15} stroke={color} width={1.9} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{f.address || '—'}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text2)' }}>{f.location}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text2)' }}>{f.contactName || '—'}</td>
                    <td style={{ padding: '12px 10px', color: f.reason ? 'var(--text)' : 'var(--muted)', maxWidth: 320 }}>{f.reason || (up ? '—' : 'No reason given')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontFamily: 'Geist Mono', color: 'var(--text2)', fontSize: 12 }}>{timeFmt(f.time)}</td>
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
