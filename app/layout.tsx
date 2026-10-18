import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./competition.css";
import "./ugs.css";
import "./ugs-dark.css";
import "./ugs-theme.css";

export const metadata: Metadata = {
  title: "Union Gaming Society · UGS",
  applicationName: "UGS",
  appleWebApp: { capable: true, title: "UGS", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  description: "Union Gaming: our community, RB Tiquicia and Club Champions in UCL.",
  icons: {
    icon: {url: "/brand/ugs-logo-192.png", type: "image/png"},
    shortcut: "/brand/ugs-logo-192.png",
    apple: {url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png"},
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e1d5" },
    { media: "(prefers-color-scheme: dark)", color: "#12161f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: "try{var t=localStorage.getItem('ugs-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}"}} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
