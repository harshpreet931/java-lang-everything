import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Crimson_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Bar } from "@/components/site/Bar";
import { Search } from "@/components/site/Search";
import { themeScript } from "@/lib/theme-script";
import { site } from "@/lib/site";

// three faces, three jobs: crimson pro for reading, cormorant for headings,
// jetbrains mono for code and figures.
const serif = Crimson_Pro({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `learn java, visually · ${site.name}`, template: `%s · ${site.name}` },
  description:
    "a free, open-source visual guide to java by harshpreet: 192 interactive chapters from the basics to JVM internals, concurrency and garbage collection, with runnable code checked on jdk 25.",
  keywords: [
    "learn java", "java tutorial", "java course", "java visualized", "java internals", "jvm", "garbage collection",
    "java concurrency", "java memory model", "hashmap internals", "java 25", "effective java", "java interview",
  ],
  category: "education",
  // google search console: url-prefix property https://java-lang-everything.vercel.app/
  verification: { google: "IXbhcGIm1Fs7jeLfLaoVMXsQvtlaSZqBAlmHBgz-VPE" },
  openGraph: {
    title: site.name,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
  authors: [{ name: site.author.name, url: site.author.url }],
  creator: site.author.name,
  publisher: site.author.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#191816" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${serif.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-sm bg-hi px-3 py-2 text-14 text-bg focus:translate-y-0"
        >
          skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: site.name,
              url: site.url,
              description: site.description,
              author: { "@type": "Person", name: site.author.name, url: site.author.url, sameAs: [site.author.github] },
            }),
          }}
        />
        <Bar />
        {children}
        <Search />
      </body>
    </html>
  );
}
