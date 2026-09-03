/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--color-paper)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        slate: 'var(--color-slate)',
        hairline: 'var(--color-hairline)',
        accent: 'var(--color-accent)',
        'accent-muted': 'var(--color-accent-muted)',
        danger: 'var(--color-danger)',
        'danger-muted': 'var(--color-danger-muted)',
        warning: 'var(--color-warning)',
        'warning-muted': 'var(--color-warning-muted)',
        neutral: 'var(--color-neutral)',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
      },
    },
  },
  plugins: [],
};
