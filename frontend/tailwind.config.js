/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e7ff",
          500: "#5b7cff",
          600: "#3f63f6",
          700: "#2f4bd0"
        }
      },
      fontFamily: {
        // HARDCODED - Inter is the only font for this app. Do not change.
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
      }
    }
  },
  plugins: []
};
