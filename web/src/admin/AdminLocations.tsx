import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminToken } from '../lib/api';
import { Icon, ic } from '../lib/icons';
import { money, initials } from '../lib/format';

/** Precise small-dollar formatter (money() rounds, which loses $0.65 etc.). */
function usd(n: number): string {
  return '$' + n.toFixed(2);
}

type Status = 'active' | 'inactive' | 'suspended';

/** Sub-accounts auto-provision unnamed on first launch — show a friendly fallback. */
function displayName(name: string): string {
  return name && name.trim() ? name : 'Unnamed location';
}

interface LocationRow {
  id: string;
  ghlLocationId: string;
  name: string;
  status: Status;
  perCompPrice: number;
  costCeiling: number;
  lifetime: number;
  spend: number;
}

interface LocationDetail {
  id: string;
  ghlLocationId: string;
  name: string;
  status: Status;
  perCompPrice: number;
  costCeiling: number;
  note?: string;
  lifetime: number;
  spend: number;
  outstanding: number;
  token?: string;
  testLaunchUrl?: string;
  buttonUrlTemplate?: string;
}

interface LedgerEntry {
  reason: string;
  time: string;
  delta: number;
  type: string;
  address: string;
  status: number | null;
}

const statusMeta: Record<Status, { color: string; label: string }> = {
  active: { color: 'var(--brand)', label: 'active' },
  inactive: { color: 'var(--muted)', label: 'inactive' },
  suspended: { color: 'var(--red)', label: 'suspended' },
};

const page: React.CSSProperties = { animation: 'fadeUp .4s ease both', maxWidth: 1680, margin: '0 auto', padding: '26px 28px 50px' };

export function AdminLocations() {
  const nav = useNavigate();
  const [items, setItems] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ location: LocationDetail; ledger: LedgerEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const pageSize = 15;

  function handle401(err: any) {
    if (err?.status === 401) {
      adminToken.clear();
      nav('/admin/login', { replace: true });
      return true;
    }
    return false;
  }

  function load() {
    setLoading(true);
    adminApi
      .locations()
      .then((r) => setItems(r.items ?? []))
      .catch(handle401)
      .finally(() => setLoading(false));
  }

  useEffect(load, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  function openDrawer(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    adminApi
      .location(id)
      .then((r) => setDetail({ location: r.location, ledger: r.ledger ?? [] }))
      .catch(handle401)
      .finally(() => setDetailLoading(false));
  }

  function closeDrawer() {
    setOpenId(null);
    setDetail(null);
  }

  async function patch(p: Record<string, unknown>) {
    if (!openId || busy) return;
    setBusy(true);
    try {
      const r = await adminApi.updateLocation(openId, p);
      if (detail) setDetail({ ...detail, location: r.location });
      load();
    } catch (err) {
      if (!handle401(err)) alert('Update failed.');
    } finally {
      setBusy(false);
    }
  }

  function setStatus(status: Status) {
    void patch({ status });
  }
  function promptPrice() {
    const v = window.prompt('Per-comp price (USD)', detail ? String(detail.location.perCompPrice) : '');
    if (v != null && v.trim() !== '' && !Number.isNaN(Number(v))) void patch({ perCompPrice: Number(v) });
  }
  function promptCeiling() {
    const v = window.prompt('Monthly cost ceiling (USD)', detail ? String(detail.location.costCeiling) : '');
    if (v != null && v.trim() !== '' && !Number.isNaN(Number(v))) void patch({ costCeiling: Number(v) });
  }
  function promptNote() {
    const v = window.prompt('Internal note', detail?.location.note ?? '');
    if (v != null) void patch({ note: v });
  }
  function promptRename() {
    const v = window.prompt('Location name', detail?.location.name ?? '');
    if (v != null) void patch({ name: v.trim() });
  }
  async function addLocation() {
    const id = window.prompt('GHL locationId for the new sub-account');
    if (!id || !id.trim()) return;
    const name = window.prompt('Name (optional — you can add it later)') ?? '';
    try {
      await adminApi.createLocation(id.trim(), name.trim() || undefined);
      load();
    } catch (err: any) {
      if (!handle401(err)) alert(err?.status === 409 ? 'That location already exists.' : 'Could not create location.');
    }
  }
  function copy(text?: string) {
    if (text) void navigator.clipboard?.writeText(text);
  }

  const loc = detail?.location;

  const filtered = query.trim()
    ? items.filter((a) => `${a.name} ${a.ghlLocationId}`.toLowerCase().includes(query.trim().toLowerCase()))
    : items;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(pageNo, totalPages);
  const paged = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  const actions: { label: string; color: string; onClick: () => void }[] = [
    { label: 'Rename', color: 'var(--text)', onClick: promptRename },
    { label: 'Activate', color: 'var(--brand)', onClick: () => setStatus('active') },
    { label: 'Deactivate', color: 'var(--text)', onClick: () => setStatus('inactive') },
    { label: 'Set price', color: 'var(--text)', onClick: promptPrice },
    { label: 'Set ceiling', color: 'var(--text)', onClick: promptCeiling },
    { label: 'Suspend', color: 'var(--red)', onClick: () => setStatus('suspended') },
  ];

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 20, gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: 23, fontWeight: 700, letterSpacing: '-.4px' }}>Locations</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5 }}>
            Every GHL sub-account we serve. Identity and billing are scoped per location. New sub-accounts
            auto-register on first launch — click a row to name and manage them.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Icon path={ic.search} size={15} stroke="var(--muted)" width={2} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPageNo(1); }} placeholder="Search name or ID…" style={{ height: 40, width: 220, border: '1px solid var(--border2)', background: 'var(--surface)', borderRadius: 11, padding: '0 12px 0 34px', color: 'var(--text)', fontSize: 13 }} />
          </div>
          <button
            onClick={addLocation}
            style={{ height: 40, padding: '0 16px', borderRadius: 11, border: 'none', background: 'var(--brand)', color: 'var(--brand-ink)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Icon path={ic.plus} size={16} width={2.2} />
            Add location
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', background: 'var(--surface2)' }}>
              <th style={{ textAlign: 'left', padding: '11px 18px', fontWeight: 700 }}>Location</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Rail</th>
              <th style={{ textAlign: 'right', padding: '11px 10px', fontWeight: 700 }}>Lifetime comps</th>
              <th style={{ textAlign: 'right', padding: '11px 10px', fontWeight: 700 }}>Spend</th>
              <th style={{ textAlign: 'left', padding: '11px 10px', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 18 }}>
                  <div className="sk" style={{ height: 200, width: '100%' }} />
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>{query ? 'No locations match your search.' : 'No locations on the allowlist yet.'}</td>
              </tr>
            ) : (
              paged.map((a, i) => {
                const st = statusMeta[a.status] ?? statusMeta.inactive;
                return (
                  <tr
                    key={a.id}
                    onClick={() => openDrawer(a.id)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', animation: 'slideRight .3s ease both', animationDelay: `${(i * 0.03).toFixed(2)}s` }}
                  >
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--text2)' }}>
                          {a.name?.trim() ? initials(a.name) : '··'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: a.name?.trim() ? 'var(--text)' : 'var(--muted)' }}>{displayName(a.name)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{a.ghlLocationId} · GHL</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '2px 8px', borderRadius: 20 }}>GHL wallet</span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono', fontWeight: 600 }}>{a.lifetime.toLocaleString()}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'Geist Mono', color: 'var(--text2)' }}>{money(a.spend)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: st.color }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text2)' }}>
            <span>{(pageClamped - 1) * pageSize + 1}–{Math.min(filtered.length, pageClamped * pageSize)} of {filtered.length}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPageNo((p) => Math.max(1, p - 1))} disabled={pageClamped <= 1} style={locPagerBtn(pageClamped <= 1)}>Prev</button>
              <span style={{ fontFamily: 'Geist Mono' }}>Page {pageClamped} / {totalPages}</span>
              <button onClick={() => setPageNo((p) => Math.min(totalPages, p + 1))} disabled={pageClamped >= totalPages} style={locPagerBtn(pageClamped >= totalPages)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {openId && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,8,.5)', backdropFilter: 'blur(2px)', zIndex: 70, animation: 'fadeUp .2s ease both' }} />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100vh',
              width: 420,
              maxWidth: '92vw',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 71,
              overflowY: 'auto',
              animation: 'slideInDrawer .3s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 13, position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                {loc?.name?.trim() ? initials(loc.name) : '··'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: loc?.name?.trim() ? 'var(--text)' : 'var(--muted)' }}>{loc ? displayName(loc.name) : 'Loading…'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{loc ? `${loc.ghlLocationId} · GHL · ${loc.status}` : '—'}</div>
              </div>
              <button
                onClick={closeDrawer}
                style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <Icon path={ic.close} size={16} width={2.2} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {detailLoading || !loc ? (
                <div className="sk" style={{ height: 360, width: '100%' }} />
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <StatCard label="Billing rail" value="GHL wallet" />
                    <StatCard label="Lifetime comps" value={loc.lifetime.toLocaleString()} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                    <StatCard label="Per-comp price" value={usd(loc.perCompPrice)} />
                    <StatCard label="Cost ceiling" value={`${money(loc.costCeiling)}/mo`} />
                  </div>

                  {loc.outstanding > 0 && (
                    <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red)', borderRadius: 11, padding: '12px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--red)', fontWeight: 500 }}>
                      ⚠ Outstanding GHL balance: {usd(loc.outstanding)} · last collection failed
                    </div>
                  )}

                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Actions</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                    {actions.map((ac) => (
                      <button
                        key={ac.label}
                        onClick={ac.onClick}
                        disabled={busy}
                        style={{
                          height: 40,
                          borderRadius: 10,
                          border: '1px solid var(--border2)',
                          background: 'var(--surface2)',
                          color: ac.color,
                          fontWeight: 600,
                          fontSize: 12.5,
                          cursor: busy ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {ac.label}
                      </button>
                    ))}
                  </div>

                  {loc.note && (
                    <div style={{ marginBottom: 18, padding: '11px 13px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text2)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Note: </span>
                      {loc.note}
                    </div>
                  )}

                  {/* Per-location launch — the token IS the per-location secret. */}
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Launch link</div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.4px', marginBottom: 5 }}>
                      GHL contact-button URL
                    </div>
                    <LinkRow value={loc.buttonUrlTemplate ?? '—'} onCopy={() => copy(loc.buttonUrlTemplate)} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.4px', marginBottom: 5 }}>
                      Test launch (opens the tool as this location)
                    </div>
                    <LinkRow value={loc.testLaunchUrl ?? '—'} href={loc.testLaunchUrl} onCopy={() => copy(loc.testLaunchUrl)} />
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Recent usage</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {(detail?.ledger ?? []).length === 0 ? (
                      <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '8px 0' }}>No usage yet.</div>
                    ) : (
                      (detail?.ledger ?? []).map((l, i) => {
                        const deltaColor = l.delta < 0 ? 'var(--text)' : l.type === 'charge_failed' ? 'var(--red)' : 'var(--brand)';
                        const deltaTxt = l.delta < 0 ? l.delta.toString() : l.type === 'charge_failed' ? usd(Math.abs(l.delta)) : `+${l.delta}`;
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{l.reason}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist Mono' }}>{l.time}</div>
                            </div>
                            <span style={{ fontFamily: 'Geist Mono', fontWeight: 600, color: deltaColor }}>{deltaTxt}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 10, background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Icon path={ic.info} size={15} width={2} />
                    All privileged actions are written to the audit log.
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LinkRow({ value, href, onCopy }: { value: string; href?: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <code
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'Geist Mono',
          fontSize: 11,
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: 9,
          padding: '8px 10px',
          color: 'var(--text2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </code>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" title="Open" style={{ height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--brand)', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          Open
        </a>
      )}
      <button
        onClick={() => {
          onCopy();
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        style={{ height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function locPagerBtn(disabled: boolean): React.CSSProperties {
  return { height: 32, padding: '0 13px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: disabled ? 'var(--muted)' : 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: disabled ? 'default' : 'pointer' };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 11, padding: 12, background: 'var(--surface2)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontFamily: 'Geist Mono', fontWeight: 600, fontSize: 15, marginTop: 4 }}>{value}</div>
    </div>
  );
}
