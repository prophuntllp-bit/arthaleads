/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette — matches the app's orange theme (--app-primary #ff6b00).
        // Previously stale blue values; any `text-brand-600` etc. now renders on-brand.
        brand: {
          50:  "#fff4ec",
          100: "#ffe3cf",
          500: "#ff6b00",
          600: "#e85d00",
          700: "#a04100"
        }
      },
      fontFamily: {
        // HARDCODED - Inter Variable is self-hosted via @fontsource-variable/inter.
        // "Inter Variable" is the font-family name registered by the package.
        // Do NOT change or remove this.
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
      }
    }
  },
  plugins: []
};
