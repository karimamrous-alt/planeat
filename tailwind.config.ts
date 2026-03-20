import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#E8622A', dark: '#C94E1A', light: '#F0855A' },
        secondary: { DEFAULT: '#F5A623', light: '#FBBF4A' },
        warm:      { DEFAULT: '#FDF6F0', card: '#FFFFFF' },
        brown:     { DEFAULT: '#2C1810', mid: '#8B5E3C', light: '#C4956A' },
        season:    '#4CAF50',
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans:    ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card:      '0 2px 16px 0 rgba(44,24,16,0.08)',
        'card-lg': '0 8px 32px 0 rgba(44,24,16,0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
