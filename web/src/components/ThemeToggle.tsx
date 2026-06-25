import { Icon, ic } from '../lib/icons';
import { useTheme } from '../lib/theme';

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
        color: 'var(--text2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon path={theme === 'dark' ? ic.sun : ic.moon} size={17} />
    </button>
  );
}
