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
        gold: {
          DEFAULT: "#d4af37",
          light: "#e8cc6a",
          dark: "#b8960c",
        },
        deep: "#050505",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        mono: ["Consolas", "monospace"],
        cinzel: ["var(--font-cinzel)", "Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(249, 115, 22, 0.25)",
        "glow-gold": "0 0 20px rgba(212, 175, 55, 0.3)",
        "glow-hp": "0 0 8px rgba(239, 68, 68, 0.6)",
        "glow-ac": "0 0 8px rgba(59, 130, 246, 0.6)",
        "glow-sp": "0 0 8px rgba(168, 85, 247, 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;