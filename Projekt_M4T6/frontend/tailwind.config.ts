import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff7ed",
          400: "#fb923c",
          500: "#f97316",
          700: "#c2410c",
        },
        ink: {
          900: "#111827",
          950: "#070814",
        },
        parchment: "#f5efe0",
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
        mono: ["Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(249, 115, 22, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;