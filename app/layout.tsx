import type { Metadata } from "next";
import "./globals.css";
import "./competition.css";

export const metadata: Metadata = {
  title: "Matchroom · Tournament HQ",
  description: "Your clubs, fixtures, verified results and tournament awards, together in Matchroom.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
