export type ThemeId = 'light' | 'dark';

export interface ThemePreset {
  id: ThemeId;
  label: string;
  isDark: boolean;
  swatch: string;
  vars: {
    '--accent-50': string;
    '--accent-500': string;
    '--accent-600': string;
    '--accent-ring': string;
    '--sel-bg': string;
    '--sel-border': string;
  };
}

export const THEMES: Record<ThemeId, ThemePreset> = {
  light: {
    id: 'light',
    label: 'Xanh dương Y tế (Mặc định)',
    isDark: false,
    swatch: '#0D4EA6',
    vars: {
      '--accent-50': '#DCEBFF',
      '--accent-500': '#0D4EA6',
      '--accent-600': '#083578',
      '--accent-ring': 'rgba(13, 78, 166, 0.34)',
      '--sel-bg': '#D2E5FF',
      '--sel-border': 'rgba(13, 78, 166, 0.58)',
    },
  },
  dark: {
    id: 'dark',
    label: 'Tối (Ca trực đêm)',
    isDark: true,
    swatch: '#1E293B',
    vars: {
      '--accent-50': 'rgba(56, 189, 248, 0.16)',
      '--accent-500': '#0284C7',
      '--accent-600': '#0369A1',
      '--accent-ring': 'rgba(56, 189, 248, 0.38)',
      '--sel-bg': 'rgba(14, 116, 144, 0.24)',
      '--sel-border': 'rgba(56, 189, 248, 0.58)',
    },
  },
};

export const THEME_LIST: ThemePreset[] = Object.values(THEMES);

export function applyThemeToDocument(themeId: ThemeId): void {
  const preset = THEMES[themeId] || THEMES.light;
  document.documentElement.classList.toggle('dark', preset.isDark);
  const rootStyle = document.documentElement.style;
  for (const [k, v] of Object.entries(preset.vars)) {
    rootStyle.setProperty(k, v);
  }
}
