import { useEffect, useState } from 'react';
import { Icon, ic } from '../lib/icons';
import { moneyK, dateMonthDay } from '../lib/format';
import { toolApi } from '../lib/api';
import type { HistoryItem } from '../lib/types';
import { Thumb } from '../components/Thumb';

const STATUS_COLORS: Record<string, [string, string]> = {
  Snapshot: ['var(--text2)', 'var(--surface3)'],
  Refreshed: ['var(--blue)', 'var(--blue-soft)'],
  Stale: ['var(--amber)', 'var(--amber-soft)'],
};

export function History({ onOpen, ready = true }: { onOpen: (id: string) => void; ready?: boolean }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!ready) return; // wait for the launch context before fetching
    let live = true;
    setItems(null);
    const t = setTimeout(() => {
      toolApi.history(query).then((r) => live && setItems(r.items)).catch(() => live && setItems([]));
    }, query ? 220 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, ready]);

  const loading = items === null;
  const empty = !loading && items.length === 0 && !query;
  const filteredEmpty = !loading && items.length === 0 && !!query;

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '26px 28px 50px', animation: 'fadeUp .4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Saved properties</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>Every property this location has ever comped. Viewing, sorting and exporting is always free.</p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <div style={{ position: 'relative' }}>
            <Icon path={ic.search} size={15} stroke="var(--muted)" width={2} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by address…" style={{ height: 38, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, padding: '0 12px 0 34px', color: 'var(--text)', fontSize: 13, width: 200 }} />
          </div>
          <button style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon path={ic.download} size={15} width={2} /> Export
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
              <div className="sk" style={{ height: 14, flex: 2 }} />
              <div className="sk" style={{ height: 14, flex: 1 }} />
              <div className="sk" style={{ height: 14, width: 70 }} />
              <div className="sk" style={{ height: 14, width: 60 }} />
            </div>
          ))}
        </div>
      )}

      {empty && (
        <div style={{ border: '1.5px dashed var(--border2)', borderRadius: 18, background: 'var(--surface)', padding: '60px 30px', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: 15, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon path={ic.clock} size={27} stroke="var(--muted)" width={1.7} />
          </div>
          <h2 style={{ margin: '0 0 7px', fontSize: 19, fontWeight: 700 }}>No saved properties yet</h2>
          <p style={{ margin: '0 auto 20px', maxWidth: 360, color: 'var(--text2)', fontSize: 14 }}>Comp your first address and it'll be saved here forever — no extra cost to revisit.</p>
          <button onClick={() => (window.location.href = '/')} style={{ height: 42, padding: '0 20px', borderRadius: 11, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Comp a property</button>
        </div>
      )}

      {filteredEmpty && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'var(--surface)', padding: '54px 30px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>No properties match “{query}”</h2>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>
            Try a different address or <span onClick={() => setQuery('')} style={{ color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>clear the filter</span>.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
                <th style={th()}>Address</th>
                <th style={th(10)}>Comped</th>
                <th style={th(10, 'right')}>ARV</th>
                <th style={th(10, 'right')}>Repairs</th>
                <th style={th(10)}>Status</th>
                <th style={th(18, 'right')}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => {
                const [c, bg] = STATUS_COLORS[r.status] ?? STATUS_COLORS.Snapshot;
                return (
                  <tr key={r.id} onClick={() => onOpen(r.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', animation: 'slideRight .35s ease both', animationDelay: `${(i * 0.05).toFixed(2)}s` }}>
                    <td style={{ padding: '13px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <Thumb image={r.image} size={34} />
                        <span style={{ fontWeight: 600 }}>{r.address}</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 10px', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{dateMonthDay(r.takenAt)}</td>
                    <td style={{ padding: '13px 10px', textAlign: 'right', fontFamily: 'Geist Mono', fontWeight: 600, color: 'var(--brand)' }}>{moneyK(r.arv)}</td>
                    <td style={{ padding: '13px 10px', textAlign: 'right', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{r.totalRepairCost ? moneyK(r.totalRepairCost) : '—'}</td>
                    <td style={{ padding: '13px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: c, background: bg, padding: '2px 9px', borderRadius: 20 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                      <button onClick={(e) => { e.stopPropagation(); onOpen(r.id); }} style={{ height: 30, padding: '0 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function th(padX = 18, align: 'left' | 'right' = 'left'): React.CSSProperties {
  return { textAlign: align, padding: `11px ${padX}px`, fontWeight: 700 };
}
