import type { Metadata } from "next";
import "./globals.css";
import "./competition.css";
import "./ugs.css";
import "./ugs-dark.css";

export const metadata: Metadata = {
  title: "Union Gaming Society · UGS",
  description: "Union Gaming: our community, RB Tiquicia and Club Champions in UCL.",
  icons: {
    icon: {url: "/brand/ugs-logo-192.png", type: "image/png"},
    shortcut: "/brand/ugs-logo-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
