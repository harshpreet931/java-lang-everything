import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Bar } from "@/components/site/Bar";
import { Search } from "@/components/site/Search";
import { themeScript } from "@/lib/theme-script";
import { site } from "@/lib/site";
import { posthogScript } from "@/lib/analytics";

// lit instruments type, all SIL OFL 1.1 and self-hosted from src/fonts (each folder has its OFL.txt).
// next/font sets --nf-*; globals.css turns them into the public stacks --font-title, --font-body ...
const title = localFont({
  src: "../fonts/redaction/Redaction-400-normal.woff2",
  weight: "400",
  variable: "--nf-title",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const titleEroded = localFont({
  src: "../fonts/redaction-20/Redaction20-400-normal.woff2",
  weight: "400",
  variable: "--nf-title-eroded",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});
const body = localFont({
  src: [
    { path: "../fonts/piazzolla/Piazzolla-100-900-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/piazzolla/Piazzolla-100-900-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--nf-body",
  display: "swap",
  // next/font measures one fallback for both styles, so the italic ledes wrapped differently on swap (cls 0.17
  // at 390). globals.css defines "jle body fallback" with a measured size-adjust per style instead.
  adjustFontFallback: false,
  fallback: ["jle body fallback"],
});
// the latin subsets have no arrows or maths signs. these are the full upstream geist builds, fetched only
// when a page uses a character in unicode-range (font loader values must be literals, so it is repeated).
// they sit first in every stack (globals.css).
const sym = localFont({
  src: "../fonts/geist-symbols/geist-symbols.woff2",
  weight: "100 900",
  variable: "--nf-sym",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+2074-2075, U+2077, U+2079, U+2082, U+2190-2194, U+2197, U+21B3, U+21B5, U+221E, U+2248, U+2260, U+2264-2265, U+25B2, U+25B6, U+25C0, U+25CB, U+25CF" }],
});
const symMono = localFont({
  src: "../fonts/geist-symbols/geist-mono-symbols.woff2",
  weight: "100 900",
  variable: "--nf-sym-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+2074-2075, U+2077, U+2079, U+2082, U+2190-2194, U+2197, U+21B3, U+21B5, U+221E, U+2248, U+2260, U+2264-2265, U+25B2, U+25B6, U+25C0, U+25CB, U+25CF, U+23CE, U+2500-257F" }],
});
const ui = localFont({
  src: "../fonts/geist/geist-normal.woff2",
  weight: "100 900",
  variable: "--nf-ui",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/geist-mono/geist-mono-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/geist-mono/geist-mono-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--nf-mono",
  display: "swap",
  adjustFontFallback: false,
});
const pixel = localFont({
  src: "../fonts/geist-pixel/geist-pixel-normal.woff2",
  weight: "400",
  variable: "--nf-pixel",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const addr = localFont({
  src: "../fonts/departure-mono/DepartureMono-Regular.woff2",
  weight: "400",
  variable: "--nf-addr",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const faces = [title, titleEroded, body, ui, mono, pixel, addr, sym, symMono].map((f) => f.variable).join(" ");

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
  // google search console (url-prefix property). a domain property on harshpreet.com verifies by dns instead
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
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={faces}
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
        <Script id="posthog" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: posthogScript }} />
      </body>
    </html>
  );
}
