// Tailwind CSS v4 integrates through PostCSS. Next.js (incl. Turbopack) detects
// this file automatically, so no custom bundler rule is needed.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
