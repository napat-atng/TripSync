/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["Sarabun_400Regular"],
        medium:  ["Sarabun_500Medium"],
        bold:    ["Sarabun_700Bold"],
        sarabun: ["Sarabun_400Regular"],
      },
      colors: {
        primary: {
          50:  "#FAECE7",
          100: "#F5C4B3",
          200: "#F0997B",
          300: "#E87455",
          400: "#E06640",
          500: "#D85A30",
          600: "#993C1D",
          700: "#7A2F15",
          800: "#712B13",
          900: "#4A1B0C",
          950: "#2D1007",
        },
        surface: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },
    },
  },
  plugins: [],
};
