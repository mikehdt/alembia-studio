/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'selector',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // extend: {
    //   fontFamily: {
    //     sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
    //   },
    // },
    transitionDuration: {
      DEFAULT: '200ms',
    },
    extend: {},
  },
  plugins: [],
};
