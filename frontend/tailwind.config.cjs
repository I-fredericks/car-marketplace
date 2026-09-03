/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1B2A4A',
        primarydark: '#101B33',
        primarylight: '#3A4F7A',
        accent: '#E8A33D',
        accentdark: '#C6822A',
        success: '#2F9E62',
        warn: '#D97706',
        err: '#DC4C3F',
        bg: '#F7F5F1',
        surface: '#FFFFFF',
        bordercol: '#E4E0D8',
        textprimary: '#1A1A1A',
        textsecondary: '#5C5850',
        textmuted: '#8A867C',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
