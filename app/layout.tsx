import type { Metadata } from "next";
import "./globals.css";
import "./competition.css";
import "./ugs.css";
import "./ugs-dark.css";

export const metadata: Metadata = {
  title: "Union Gaming Society · UGS",
  description: "Union Gaming: our community, RB Tiquicia and Club Champions in Matchroom. Costa Rican roots. Friends worldwide.",
  icons: {
    icon: {url: "/brand/ugs-initials.png", type: "image/png"},
    shortcut: "/brand/ugs-initials.png",
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
