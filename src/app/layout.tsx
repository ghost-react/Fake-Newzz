import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FakeNewzz — Evidence-Based News Verification Platform",
  description:
    "An objective, multi-source evidence verification engine. Cross-examines news article links against primary documents, international wires, and official gazettes without predetermined bias.",
  keywords: [
    "fact check",
    "news verification",
    "evidence-based journalism",
    "misinformation detector",
    "cross-source comparison",
  ],
  authors: [{ name: "FakeNewzz Investigative Systems" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-200">
        <div className="relative min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}

