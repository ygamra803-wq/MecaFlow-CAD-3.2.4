export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  direction: 'ltr' | 'rtl';
}

export const themes: Theme[] = [
  {
    id: 'arabic',
    name: 'الوضع الهندسي الداكن (عربي)',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      background: '#09090b',
      surface: 'rgba(24, 24, 27, 0.5)',
      text: '#f4f4f5',
      textSecondary: '#a1a1aa',
      border: '#27272a',
      success: '#10b981',
      warning: '#fbbf24',
      error: '#ef4444',
      info: '#3b82f6'
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    direction: 'rtl'
  },
  {
    id: 'dark',
    name: 'Dark Studio',
    colors: {
      primary: '#3b82f6',
      secondary: '#818cf8',
      background: '#09090b',
      surface: 'rgba(24, 24, 27, 0.5)',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      border: '#27272a',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4'
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    direction: 'rtl'
  },
  {
    id: 'light',
    name: 'Light Blueprint',
    colors: {
      primary: '#059669',
      secondary: '#2563eb',
      background: '#f8fafc',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#cbd5e1',
      success: '#10b981',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb'
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    direction: 'rtl'
  }
];

/**
 * مدير السمات (ThemeManager) لدعم تغيير الألوان والوضع الليلي/النهاري
 */
export class ThemeManager {
  private currentTheme: Theme = themes[0];
  private listeners: Array<(theme: Theme) => void> = [];

  setTheme(themeId: string): boolean {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return false;

    this.currentTheme = theme;
    this.applyTheme();
    this.notifyListeners();
    return true;
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getTheme(themeId: string): Theme | undefined {
    return themes.find(t => t.id === themeId);
  }

  getAllThemes(): Theme[] {
    return [...themes];
  }

  subscribe(listener: (theme: Theme) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentTheme));
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    Object.entries(this.currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    root.style.setProperty('--bg-deep', this.currentTheme.colors.background);
    root.style.setProperty('--bg-panel', this.currentTheme.colors.surface);
    root.style.setProperty('--text-main', this.currentTheme.colors.text);
    root.style.setProperty('--text-dim', this.currentTheme.colors.textSecondary);
    root.style.setProperty('--accent', this.currentTheme.colors.primary);
    root.style.setProperty('--border', this.currentTheme.colors.border);

    Object.entries(this.currentTheme.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });
  }
}

export const globalThemeManager = new ThemeManager();
