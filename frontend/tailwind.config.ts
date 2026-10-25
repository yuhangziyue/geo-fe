import type { Config } from 'tailwindcss';
import { color } from './design/tokens';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: color } },
  plugins: [],
} satisfies Config;
