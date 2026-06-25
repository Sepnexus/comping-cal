import { useState, type CSSProperties } from 'react';
import { Icon, ic } from '../lib/icons';

/**
 * Property thumbnail that handles all three image cases:
 *   • a valid URL → shows the photo
 *   • a URL that fails to load → falls back to the placeholder
 *   • null/undefined (API returned no imagery) → placeholder
 */
export function Thumb({
  image,
  size = 34,
  radius = 8,
  onClick,
}: {
  image?: string | null;
  size?: number;
  radius?: number;
  onClick?: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    border: '1px solid var(--border)',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
  };

  if (image && !errored) {
    return <img src={image} alt="" onClick={onClick} onError={() => setErrored(true)} style={{ ...base, objectFit: 'cover' }} />;
  }
  return (
    <div
      onClick={onClick}
      style={{
        ...base,
        backgroundImage: 'repeating-linear-gradient(135deg,var(--surface3),var(--surface3) 5px,var(--surface2) 5px,var(--surface2) 10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon path={ic.imageOff} size={Math.round(size * 0.46)} stroke="var(--muted)" width={1.7} />
    </div>
  );
}
