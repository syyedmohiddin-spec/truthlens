// tailwind.config.ts — Vanta Editorial tokens
import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: "#0a0a0f", 2: "#111118", 3: "#1a1a24", 4: "#242432" },
        cream:  { DEFAULT: "#f5f0e8", 2: "#ede8df", 3: "#c8c3ba" },
        em:     { DEFAULT: "#00e87a", 2: "#00c468" },
        amber:  { DEFAULT: "#f59e0b" },
        rose:   { DEFAULT: "#f43f5e" },
        violet: { DEFAULT: "#a855f7" },
      },
      fontFamily: {
        sans:  ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono:  ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      maxWidth: {
        page: "720px",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":   "spin 3s linear infinite",
        "fade-up":     "fade-up 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) backwards",
        "fade-in":     "fade-in 0.4s ease backwards",
        "bar-fill":    "bar-fill 1.4s cubic-bezier(0.34, 1.1, 0.64, 1) forwards",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "bar-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "var(--bar-width)" },
        },
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
