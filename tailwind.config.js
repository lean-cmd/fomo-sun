/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'fog': '#c4c9cc',
        'fog-dark': '#8a9199',
        'sun': '#f59e0b',
        'sun-light': '#fbbf24',
        'sun-bright': '#fcd34d',
        'sky': '#3b82f6',
        'sky-light': '#93c5fd',
        'peak': '#1e3a5f',
      },
    },
  },
  plugins: [],
}
