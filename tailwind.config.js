/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6EF',
        beige: '#F1E8DA',
        sand: '#E5D5BD',
        brown: {
          DEFAULT: '#6B4F3A',
          dark: '#4A3527',
        },
        gold: '#C9A96A',
        rose: {
          DEFAULT: '#C98A8A',
          dark: '#B06B6B',
        },
        ink: '#3D3229',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        script: ['"Great Vibes"', 'cursive'],
        body: ['"Cormorant Garamond"', 'serif'],
        sans: ['Jost', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(107, 79, 58, 0.12)',
        card: '0 4px 16px rgba(107, 79, 58, 0.10)',
      },
    },
  },
  plugins: [],
};
