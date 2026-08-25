/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        panel: '#161616',
        'panel-border': '#2A2A2A',
        orange: '#FF6A13',
        muted: '#8A8A8A',
        // Per-mode accent colors, matched from the mockups
        golf: '#22C55E',
        gym: '#EF4444',
        bowling: '#F5A623',
        drink: '#8B5CF6',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
