import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Augurian — agent",
  description:
    "Drafter-pattern agent over your Fireflies meetings, GA4, and Search Console. Internal tool — never sends to clients.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Apple-style auto theming. The chrome on iOS Safari picks this up.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1612" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
