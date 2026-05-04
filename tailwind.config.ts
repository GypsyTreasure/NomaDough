import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D1B2A',
        surface: '#0F2035',
        'surface-raised': '#162840',
        border: '#1A3558',
        accent: '#22C59A',
        'accent-dim': '#1A6B5A',
        'text-primary': '#F0F0F0',
        'text-secondary': '#7A9BB8',
        danger: '#E05050',
      },
      fontFamily: {
        sans: ['Barlow', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
