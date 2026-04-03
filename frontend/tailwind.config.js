/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dosh: {
          50:  '#eef8f7',
          100: '#d7efec',
          200: '#afdeda',
          300: '#7fc8c2',
          400: '#4faea7',
          500: '#2f8f89',
          600: '#24756f',
          700: '#1f5f5b',
          800: '#1d4c49',
          900: '#183d3b',
          950: '#102928',
        },
        success: {
          50: '#eefbf1',
          100: '#d7f5de',
          200: '#b1eac0',
          300: '#7fd692',
          400: '#54be69',
          500: '#2f9e44',
          600: '#237a34',
          700: '#1d5f2a',
          800: '#1a4b23',
          900: '#173e1f',
        },
      },
    },
  },
  plugins: [],
}
