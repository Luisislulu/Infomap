import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Infomap — Daily AI & Technology Signals",
    template: "%s · Infomap",
  },
  description:
    "A daily, source-aware briefing of the most useful signals in AI and technology.",
  applicationName: "Infomap",
  openGraph: {
    type: "website",
    title: "Infomap — Daily AI & Technology Signals",
    description: "One focused scan of the AI and technology landscape, every day.",
    siteName: "Infomap",
  },
  twitter: {
    card: "summary",
    title: "Infomap — Daily AI & Technology Signals",
    description: "One focused scan of the AI and technology landscape, every day.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="infomap-theme" strategy="beforeInteractive">
          {'try{const t=localStorage.getItem("infomap:theme");if(["signal","ocean","ember","violet","forest","rose","mono","noir"].includes(t))document.documentElement.dataset.theme=t;const l=localStorage.getItem("infomap:language");if(l==="zh"){document.documentElement.lang="zh-CN";document.documentElement.dataset.language="zh"}}catch{}'}
        </Script>
        {children}
      </body>
    </html>
  );
}
