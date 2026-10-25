// The only place a colour value is defined for the dashboard (spec 06 §3.6).
// One TS object feeds both Tailwind (tailwind.config.ts) and ECharts (chartTheme.ts).
export const color = {
  brand: { DEFAULT: '#4F46E5', hover: '#4338CA', ink: '#3730A3', subtle: '#EEF2FF', on: '#FFFFFF' },
  ink: { DEFAULT: '#0F172A', secondary: '#475569', tertiary: '#64748B', disabled: '#94A3B8' },
  surface: { page: '#F8FAFC', card: '#FFFFFF', sunken: '#F1F5F9' },
  line: { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
  positive: { DEFAULT: '#047857', subtle: '#ECFDF5' },
  warning: { DEFAULT: '#B45309', mark: '#D97706', subtle: '#FFFBEB', ink: '#92400E' },
  danger: { DEFAULT: '#BE123C', mark: '#E11D48', subtle: '#FFF1F2' },
  cov: {
    rec: '#3730A3', 'rec-ink': '#FFFFFF',
    partly: '#7C7FF2', 'partly-ink': '#1E1B4B',
    mentioned: '#E0E7FF', 'mentioned-line': '#C7D2FE', 'mentioned-ink': '#312E81',
    none: '#FFFFFF', 'none-line': '#64748B', 'none-ink': '#334155',
    untracked: '#F8FAFC', 'untracked-hatch': '#E2E8F0', 'untracked-ink': '#94A3B8',
  },
  intent: {
    c: '#F0FDFA', 'c-ink': '#115E59', b: '#99F6E4', 'b-ink': '#134E4A',
    a: '#0F766E', 'a-ink': '#FFFFFF', s: '#134E4A', 's-ink': '#FFFFFF',
  },
  severity: { high: '#E11D48', medium: '#D97706', low: '#64748B' },
  delta: { up: '#047857', down: '#B45309', flat: '#64748B' },
  owned: { DEFAULT: '#4F46E5', subtle: '#EEF2FF', ink: '#3730A3' },
} as const;
