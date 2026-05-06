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
  // "class" instead of "media" → dark: utility classes only fire when
  // `dark` class is on <html>. Since we never add it in v1, the chat is
  // light-mode-only, regardless of OS preference. Switch back to "media"
  // to re-enable OS-following dark mode (and restore the dark CSS vars
  // in app/globals.css).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Augurian.com palette — extracted from the official logo SVG and
        // the live site. Class names kept (`augur-orange`,
        // `augur-orange-700`) for code-stability; the actual accent is
        // Augurian red.
        cream: "#F7F5F2",          // warm off-white surface
        ink: "#212020",            // Augurian wordmark dark
        augur: {
          orange: "#C90000",        // Augurian red (logo + CTA)
          "orange-700": "#A00000",  // deeper red (hover/active)
        },
        "ink-dark": "#F5F5F5",
        "bg-dark": "#1A1A1A",
        "surface-dark": "#252525",
        border: {
          DEFAULT: "#E5E2DD",
          dark: "#3A3A3A",
        },
        muted: {
          DEFAULT: "#5B6F7A",       // Augurian slate (header band)
          dark: "#9A9A9A",
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
