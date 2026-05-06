import type { Config } from "tailwindcss";

// Augurian palette + Apple-restrained design tokens. We deliberately don't
// pull in shadcn or any UI library — Tailwind plus a handful of small
// components is enough to keep the design feeling ours.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EE",
        ink: "#1F2937",
        // The Augurian orange is the only saturated color in the palette;
        // everything else is neutral. Use it sparingly — primary action
        // affordances and one or two highlights, never as a section bg.
        augur: {
          orange: "#E8964D",
          "orange-700": "#D27E36",
        },
        "ink-dark": "#F5F0E8",
        "bg-dark": "#1A1612",
        "surface-dark": "#2A2419",
        border: {
          DEFAULT: "#E5DFD2",
          dark: "#3A3225",
        },
        muted: {
          DEFAULT: "#5B6F7A",
          dark: "#BFB8AA",
        },
      },
      fontFamily: {
        // System stack — no web-font import. Apple-native on macOS, native
        // sans on every other platform.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      fontSize: {
        body: ["15px", { lineHeight: "1.5" }],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "card-dark":
          "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        bubble: "18px",
        card: "12px",
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      maxWidth: {
        chat: "720px",
      },
    },
  },
  plugins: [],
};

export default config;
