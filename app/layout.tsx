import type { Metadata } from "next";
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
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{const t=localStorage.getItem("infomap:theme");if(["signal","ocean","ember","violet"].includes(t))document.documentElement.dataset.theme=t}catch{}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
