/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emitter1: '#ef4444', // red-500
        emitter2: '#3b82f6', // blue-500
      },
    },
  },
  plugins: [],
}
