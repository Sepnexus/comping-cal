import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmbeddedHeader } from './EmbeddedHeader';
import { ResultPanel } from './ResultPanel';
import { History } from './History';
import {
  AccessDeniedCard,
  AddressMissingCard,
  BillingIssueCard,
  ErrorCard,
  RunningSkeleton,
  VerifyingCard,
  ConfirmScreen,
} from './WorkspaceStates';
import { devLaunchContext, getLaunchContext, launchContextFromUrl, setLaunchContext, toolApi } from '../lib/api';
import type { HistoryItem, PublicSnapshot, SessionInfo } from '../lib/types';

type WsState =
  | 'verifying'
  | 'confirm'
  | 'addressMissing'
  | 'accessDenied'
  | 'running'
  | 'result'
  | 'billingIssue'
  | 'error';

export interface Fallback {
  kind: string;
  message: string;
}

export function ToolApp({ screen }: { screen: 'workspace' | 'history' }) {
  const [ws, setWs] = useState<WsState>('verifying');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [address, setAddress] = useState('');
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [fallback, setFallback] = useState<Fallback | null>(null);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState<{ kind: 'charged' | 'free' | 'saved'; msg: string } | null>(null);
  const [locName, setLocName] = useState('…');
  const [contactName, setContactName] = useState('…');
  const [ready, setReady] = useState(false); // launch context established?
  const [billingReason, setBillingReason] = useState<string | null>(null);
  const [accessInfo, setAccessInfo] = useState<{ title: string; message: string } | null>(null);
  const runningCount = useRef(14);
  // Real launch (GHL button / SSO) carries the location in the URL → fixed context,
  // no switcher. Only the dev bootstrap (bare localhost) gets the location picker.
  const launchedViaUrl = useMemo(() => !!launchContextFromUrl(), []);
  const navigate = useNavigate();

  const flashToast = useCallback((t: { kind: 'charged' | 'free' | 'saved'; msg: string }) => {
    setToast(t);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const bootstrap = useCallback(async (ghlLocationId?: string) => {
    setWs('verifying');
    setSnapshot(null);
    setFallback(null);
    setReady(false);
    try {
      // Production path: the launch URL (GHL button / SSO) carries the verified
      // locationId + per-location token. Only fall back to the dev bootstrap when
      // launched without those params (e.g. opening localhost directly to test).
      // URL params → reuse an already-established context (client nav) → dev bootstrap.
      const fromUrl = ghlLocationId ? null : (launchContextFromUrl() ?? getLaunchContext());
      const ctx = fromUrl ?? (await devLaunchContext(ghlLocationId));
      setLaunchContext(ctx);
      setReady(true); // launch context (locationId + token) is now set → safe to fetch
      const info = await toolApi.verify();
      setSession(info);
      // Names come from the verified session, not the URL (URL data is untrusted).
      setLocName(info.location?.name?.trim() || 'Unnamed location');
      // The contact button can pass the contact's name + address straight from the
      // GHL page (?name=&address=) — handy when the GHL contact endpoint isn't wired.
      // The server fetch wins when available; the URL values are the fallback/pre-fill.
      const qs = new URLSearchParams(window.location.search);
      const urlName = qs.get('name')?.trim() || '';
      const urlAddr = qs.get('address')?.trim() || '';
      setContactName(info.contact?.name?.trim() || urlName || ctx.contactName || 'Contact');
      const addr = info.contact?.address?.trim() || urlAddr;
      setAddress(addr);

      // pull recent history for this location (free)
      const hist = await toolApi.history().catch(() => ({ items: [] as HistoryItem[], count: 0 }));
      setRecent(hist.items.slice(0, 3));

      // Deep-link: opened from the history list (?property=<id>) → show it directly.
      const propertyId = new URLSearchParams(window.location.search).get('property');
      if (propertyId) {
        try {
          const got = await toolApi.property(propertyId);
          setSnapshot(got.snapshot);
          setWs('result');
          return;
        } catch {
          /* not found / not this location → fall through to the normal flow */
        }
      }

      if (!addr.trim()) {
        setWs('addressMissing');
        return;
      }
      // Already comped this address on this location → open the saved snapshot
      // instantly (free). Uses the same normalization as the comp dedupe, so it
      // matches even when the launch address differs slightly from the stored one.
      const look = await toolApi.lookup({ address: addr }).catch(() => ({ ok: true as const, found: false as const }));
      if (look.found && look.snapshot) {
        setSnapshot(look.snapshot);
        setWs('result');
        return;
      }
      setWs('confirm');
    } catch (err: any) {
      // not authorized (location not entitled) → show the server's reason; otherwise
      // suspended/inactive → 403, bad token/allowlist → 401 (FRD §7.6) → neutral copy.
      if (err?.body?.error === 'not_authorized') {
        setAccessInfo({ title: 'Location not authorized', message: err.body.message ?? 'This location isn’t authorized to use the comping tool.' });
      } else {
        setAccessInfo(null);
      }
      setWs('accessDenied');
    }
  }, []);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runComp = useCallback(
    async (opts: { address: string; refresh?: boolean; overrides?: Record<string, unknown> }) => {
      setWs('running');
      setFallback(null);
      runningCount.current = 8 + Math.floor(Math.random() * 12);
      try {
        const name = contactName && contactName !== '…' ? contactName : undefined;
        const res = await toolApi.comp({ ...opts, contactName: name });
        setSnapshot(res.snapshot);
        setWs('result');
        if (res.charged) flashToast({ kind: 'charged', msg: 'Comp complete' });
        else if (res.freeReason === 'cached_view') flashToast({ kind: 'free', msg: 'Opened saved comp' });
        // refresh recent list
        toolApi.history().then((h) => setRecent(h.items.slice(0, 3))).catch(() => {});
      } catch (err: any) {
        const body = err?.body ?? {};
        if (err?.status === 402 || body.billingIssue) {
          setBillingReason(body.reason ?? body.fallback?.reason ?? null);
          setWs('billingIssue');
          return;
        }
        const fb: Fallback = body.fallback ?? { kind: body.kind ?? 'temporary_error', message: body.message ?? 'Temporarily unavailable. You weren’t charged. Try again.' };
        setFallback(fb);
        setWs('error');
      }
    },
    [flashToast, contactName],
  );

  const refresh = useCallback(() => {
    if (snapshot) runComp({ address: snapshot.address, refresh: true });
  }, [snapshot, runComp]);

  const onRepairs = useCallback(
    async (text: string) => {
      if (!snapshot) return;
      const res = await toolApi.repairs({ snapshotId: snapshot.id, repairsText: text });
      setSnapshot(res.snapshot);
      if (res.charged) flashToast({ kind: 'charged', msg: 'Repair estimate added' });
    },
    [snapshot, flashToast],
  );

  const onWriteback = useCallback(
    async (fields: Record<string, number | string>) => {
      if (!snapshot) return;
      await toolApi.writeback({ contactId: session?.contact?.id, snapshotId: snapshot.id, fields });
      flashToast({ kind: 'saved', msg: 'Pushed to CRM — see the contact’s AI Comping fields' });
    },
    [snapshot, session, flashToast],
  );

  const openSnapshot = useCallback(async (id: string) => {
    const got = await toolApi.property(id);
    setSnapshot(got.snapshot);
    setWs('result');
    window.history.pushState(null, '', '/');
  }, []);

  // Rename the launched location (e.g. naming an auto-provisioned one) from the header.
  const renameLocation = useCallback(async (name: string) => {
    const r = await toolApi.setLocationName({ name });
    setLocName(r.name);
    setToast({ kind: 'saved', msg: 'Location name updated' });
    setTimeout(() => setToast(null), 2200);
  }, []);

  // History screen is its own route → opening a row navigates to the comp view,
  // preserving the launch params (locationId/token) and adding ?property=<id>.
  if (screen === 'history') {
    const openFromHistory = (id: string) => {
      const sp = new URLSearchParams(window.location.search);
      sp.set('property', id);
      navigate('/?' + sp.toString()); // client-side → preserves the launch context
    };
    return (
      <Shell screen="history" contactName={contactName} locName={locName} onSwitchLocation={bootstrap} onRenameLocation={renameLocation} allowSwitch={!launchedViaUrl}>
        <History onOpen={openFromHistory} ready={ready} />
      </Shell>
    );
  }

  return (
    <Shell screen="workspace" contactName={contactName} locName={locName} onSwitchLocation={bootstrap} onRenameLocation={renameLocation} allowSwitch={!launchedViaUrl}>
      <div style={{ maxWidth: ws === 'result' ? 1180 : 1180, margin: '0 auto', padding: '26px 28px 60px' }}>
        {ws === 'verifying' && <VerifyingCard />}
        {ws === 'accessDenied' && <AccessDeniedCard title={accessInfo?.title} message={accessInfo?.message} />}
        {ws === 'billingIssue' && <BillingIssueCard reason={billingReason} onViewSaved={() => (window.location.href = '/history')} />}
        {ws === 'error' && (
          <ErrorCard
            fallback={fallback}
            onRetry={(overrides) => runComp({ address, overrides })}
          />
        )}
        {ws === 'addressMissing' && (
          <AddressMissingCard
            value={address}
            onChange={setAddress}
            onContinue={() => runComp({ address })}
          />
        )}
        {ws === 'confirm' && (
          <ConfirmScreen
            address={address}
            subject={session?.contact ?? null}
            recent={recent}
            price={session?.location?.perCompPrice}
            onAddressChange={setAddress}
            onComp={() => runComp({ address })}
            onOpenRecent={openSnapshot}
            onViewAll={() => (window.location.href = '/history')}
          />
        )}
        {ws === 'running' && <RunningSkeleton count={runningCount.current} />}
        {ws === 'result' && snapshot && (
          <ResultPanel
            snapshot={snapshot}
            contact={session?.contact ?? null}
            locationName={locName}
            onRefresh={refresh}
            onRepairs={onRepairs}
            onWriteback={onWriteback}
            onSnapshot={setSnapshot}
          />
        )}
      </div>

      {toast && <Toast toast={toast} />}
    </Shell>
  );
}

function Shell({
  children,
  screen,
  contactName,
  locName,
  onSwitchLocation,
  onRenameLocation,
  allowSwitch,
}: {
  children: React.ReactNode;
  screen: 'workspace' | 'history';
  contactName: string;
  locName: string;
  onSwitchLocation: (id: string) => void;
  onRenameLocation: (name: string) => void | Promise<void>;
  allowSwitch: boolean;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <EmbeddedHeader screen={screen} contactName={contactName} locationName={locName} onSwitchLocation={onSwitchLocation} onRenameLocation={onRenameLocation} allowSwitch={allowSwitch} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }} key={screen}>
        <div style={{ animation: 'fadeUp .4s ease both' }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ toast }: { toast: { kind: 'charged' | 'free' | 'saved'; msg: string } }) {
  const color = toast.kind === 'charged' ? 'var(--brand)' : toast.kind === 'saved' ? 'var(--text)' : 'var(--blue)';
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface)',
        border: `1px solid var(--border2)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        fontSize: 13.5,
        fontWeight: 600,
        zIndex: 95,
        animation: 'slideDown .3s ease both',
      }}
    >
      {toast.msg}
    </div>
  );
}
