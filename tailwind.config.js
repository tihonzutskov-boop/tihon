/** @type {import('tailwindcss').Config} */
export default {
  // Every file that puts a Tailwind class in front of the browser. A class that
  // is only ever built at runtime from pieces would not be found here — the
  // codebase has none — so class names are written out whole.
  content: [
    './index.html',
    './App.tsx',
    './constants.ts',
    './translations.ts',
    './components/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
