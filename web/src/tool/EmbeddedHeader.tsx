import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, ic } from '../lib/icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { devLocations } from '../lib/api';

/**
 * The "in GoHighLevel" tool header. The location is fixed by the launch context.
 * `allowSwitch` (dev only — when opened without real URL params) shows a small
 * picker to preview other seeded locations; in production it's plain text.
 */
export function EmbeddedHeader({
  screen,
  contactName,
  locationName,
  onSwitchLocation,
  onRenameLocation,
  allowSwitch = false,
}: {
  screen: 'workspace' | 'history';
  contactName: string;
  locationName: string;
  onSwitchLocation?: (ghlLocationId: string) => void;
  onRenameLocation?: (name: string) => void | Promise<void>;
  allowSwitch?: boolean;
}) {
  const nav = useNavigate();
  const [locs, setLocs] = useState<{ ghlLocationId: string; name: string; status: string }[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Inline rename of the location (e.g. naming an auto-provisioned "Unnamed location").
  const unnamed = !locationName || locationName === 'Unnamed location';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const startEdit = () => {
    setDraft(unnamed ? '' : locationName);
    setEditing(true);
  };
  const saveName = async () => {
    const name = draft.trim();
    if (!name || name === locationName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRenameLocation?.(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (allowSwitch) devLocations().then(setLocs).catch(() => {});
  }, [allowSwitch]);

  // Close the switcher on any click outside it, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: 600,
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--brand)' : 'var(--text2)',
    boxShadow: active ? 'var(--shadow)' : 'none',
  });

  const contactLabel = (
    <>
      Contact <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{contactName}</strong>
    </>
  );

  // Editable location-name chip shown after the contact, in both dev and prod layouts.
  const locNamePart = editing ? (
    <input
      autoFocus
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={saveName}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveName();
        if (e.key === 'Escape') setEditing(false);
      }}
      placeholder="Name this location"
      style={{
        font: 'inherit',
        fontSize: 12.5,
        padding: '2px 8px',
        borderRadius: 7,
        border: '1px solid var(--brand)',
        background: 'var(--surface)',
        color: 'var(--text)',
        width: 180,
        outline: 'none',
      }}
    />
  ) : (
    <button
      onClick={startEdit}
      title="Click to rename this location"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12.5,
        fontStyle: unnamed ? 'italic' : 'normal',
        color: unnamed ? 'var(--brand)' : 'var(--text2)',
        padding: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {unnamed ? 'Name this location' : locationName}
      <Icon path="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" size={12} stroke="var(--muted)" width={2} />
    </button>
  );

  return (
    <header
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 22px',
        zIndex: 20,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img src="/assets/closer-control-logo.png" alt="Closer Control" style={{ height: 26, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>Comping</span>
      </div>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface3)',
          color: 'var(--text2)',
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
        in GoHighLevel
      </span>

      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, borderLeft: '1px solid var(--border)', paddingLeft: 14, position: 'relative' }}>
        <Icon path={ic.user} size={15} stroke="var(--muted)" width={2} />
        {allowSwitch ? (
          <>
            <button
              onClick={() => setOpen((o) => !o)}
              title="Switch launch context (testing)"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden' }}
            >
              {contactLabel}
              <Icon path="M6 9l6 6 6-6" size={13} stroke="var(--muted)" width={2} />
            </button>
            {open && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: 280,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 60,
                    padding: 6,
                    maxHeight: 360,
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', color: 'var(--muted)', textTransform: 'uppercase', padding: '7px 9px 4px' }}>
                    Launch as location (testing)
                  </div>
                  {locs.map((l) => (
                    <button
                      key={l.ghlLocationId}
                      onClick={() => {
                        setOpen(false);
                        onSwitchLocation?.(l.ghlLocationId);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        gap: 8,
                        padding: '9px 10px',
                        borderRadius: 9,
                        border: 'none',
                        background: l.name === locationName ? 'var(--brand-soft)' : 'transparent',
                        color: l.name === locationName ? 'var(--brand)' : 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || l.ghlLocationId}</span>
                      <span style={{ fontSize: 10, fontFamily: 'Geist Mono', color: l.status === 'active' ? 'var(--muted)' : 'var(--red)' }}>{l.status}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--text2)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactLabel}</span>
        )}
        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>·</span>
        {locNamePart}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 2 }}>
        <button onClick={() => nav('/')} style={tab(screen === 'workspace')}>Comp</button>
        <button onClick={() => nav('/history')} style={tab(screen === 'history')}>History</button>
      </div>
      <ThemeToggle size={34} />
    </header>
  );
}
