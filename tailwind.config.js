/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['*.html', 'concepts/*.html'],
  theme: {
    extend: {
      colors: {
        ink: '#16352C',
        inkDeep: '#0F2620',
        teal: '#2E7D6B',
        tealSoft: '#E7F1EE',
        mist: '#F4F6F5',
        line: '#D9E2DF',
        text: '#22312D',
        muted: '#5F6F6A',
        warn: '#8A6D1F',
        warnBg: '#FBF4DF'
      },
      keyframes: {
        fade: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        spin: { to: { transform: 'rotate(360deg)' } }
      },
      animation: {
        fade: 'fade .25s ease',
        spin: 'spin .8s linear infinite'
      }
    }
  },
  plugins: [],
}
