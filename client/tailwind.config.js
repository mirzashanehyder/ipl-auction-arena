/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ipl: {
          dark: '#0b0f19',
          card: '#151c2e',
          accent: '#3b82f6',
          gold: '#eab308',
          neon: '#10b981',
          crimson: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
