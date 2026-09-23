import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0b0e14",
          850: "#10141c",
          800: "#161b26",
          700: "#232a38",
          600: "#333d50",
          400: "#8b95a8",
          300: "#b7c0d0",
        },
        up: "#34d399",
        down: "#f87171",
        brand: "#6ee7b7",
        accent: "#f0b429",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
