import type { CSSProperties } from 'react';

// SVG path data lifted from the design comp. <Icon path={ic.search} /> renders a
// stroked 24x24 glyph matching the comp's line style.
export const ic = {
  search: 'M21 21l-4.35-4.35 M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  wrench: 'M14.7 6.3a4 4 0 00-5.2 5.2L4 17v3h3l5.5-5.5a4 4 0 005.2-5.2l-2.9 2.9-2.3-.6-.6-2.3z',
  clock: 'M12 8v4l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  card: 'M2 7h20 M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z M2 11h20',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 7V3 M20 21v-5 M20 11V3 M1 14h6 M9 7h6 M17 16h6',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  pl: 'M3 3v18h18 M7 14l4-4 3 3 5-6',
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z M12 10a2 2 0 100-4 2 2 0 000 4z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.5 9a9 9 0 0115-3.4L23 10 M1 14l4.5 4.4A9 9 0 0020.5 15',
  share: 'M18 8a3 3 0 10-2.8-4 M6 15a3 3 0 100-6 3 3 0 000 6z M18 21a3 3 0 100-6 3 3 0 000 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  building: 'M2 12h20 M5 12V7l7-4 7 4v5 M9 21v-6h6v6',
  dollar: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  warn: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 16v-4 M12 8h.01 M12 3a9 9 0 100 18 9 9 0 000-18z',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  plus: 'M12 5v14 M5 12h14',
  close: 'M18 6L6 18 M6 6l12 12',
  chevR: 'M9 18l6-6-6-6',
  expand: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  image: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M16 9a1 1 0 100-2 1 1 0 000 2z',
  imageOff: 'M3 3l18 18 M21 15V5a2 2 0 00-2-2H9 M3 7v12a2 2 0 002 2h12 M3 16l5-5',
  sun: 'M12 3v1 M12 20v1 M4.2 4.2l.7.7 M19.1 19.1l.7.7 M3 12h1 M20 12h1 M4.2 19.8l.7-.7 M19.1 4.9l.7-.7 M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
};

export function Icon({
  path,
  size = 18,
  stroke = 'currentColor',
  width = 1.9,
  style,
}: {
  path: string;
  size?: number;
  stroke?: string;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={path} />
    </svg>
  );
}

export function Spinner({ size = 20, stroke = 'var(--brand)' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border2)" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
