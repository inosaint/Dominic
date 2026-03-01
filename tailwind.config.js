/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        figma: {
          bg: 'var(--figma-bg)',
          surface: 'var(--figma-surface)',
          'surface-hover': 'var(--figma-surface-hover)',
          border: 'var(--figma-border)',
          text: 'var(--figma-text)',
          'text-secondary': 'var(--figma-text-secondary)',
          'text-tertiary': 'var(--figma-text-tertiary)',
          accent: 'var(--figma-accent)',
          'accent-hover': 'var(--figma-accent-hover)',
          success: 'var(--figma-success)',
          warning: 'var(--figma-warning)',
          error: 'var(--figma-error)',
        },
      },
      fontSize: {
        '11': '11px',
        '12': '12px',
        '13': '13px',
      },
    },
  },
  plugins: [],
};
