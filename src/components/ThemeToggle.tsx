import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="cf-theme-toggle cf-theme-toggle-compact"
      aria-label={isDark ? 'Switch to bright mode' : 'Switch to dark mode'}
      title={isDark ? 'Bright mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}
