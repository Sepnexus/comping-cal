export function money(n: number | null | undefined, opts: { dash?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return opts.dash ? '—' : 'Not available';
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Precise money with cents — for billing/P&L where sub-dollar amounts matter. */
export function money2(n: number | null | undefined, opts: { dash?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return opts.dash ? '—' : '$0.00';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compact money like $363K / $1.2M for cards. */
export function moneyK(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return '$' + Math.round(n);
}

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function dateMonthDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export function timeOfDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleTimeString('en-US', { hour12: false });
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return String(iso);
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return dateShort(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
