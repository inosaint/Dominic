/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        figma: {
          bg: '#2c2c2c',
          surface: '#383838',
          'surface-hover': '#444444',
          border: '#4d4d4d',
          text: '#ffffff',
          'text-secondary': '#b3b3b3',
          'text-tertiary': '#808080',
          accent: '#0d99ff',
          'accent-hover': '#0b87e0',
          success: '#14ae5c',
          warning: '#f2994a',
          error: '#f24822',
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
