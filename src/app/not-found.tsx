import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-var(--bar-h))] max-w-[880px] flex-col justify-center px-[var(--gutter)] py-24">
      <pre className="text-13 leading-[1.7] text-mute">
        <span className="text-dead">Exception in thread &quot;main&quot; java.lang.ClassNotFoundException</span>
        {"\n\tat everything.Router.find(Router.java:404)\n\tat everything.You.click(You.java:1)"}
      </pre>
      <h1 className="mt-10 text-[clamp(2rem,1.2rem+2.6vw,2.75rem)] leading-[1.05] font-display font-light tracking-[0.005em] text-hi">
        that page doesn&apos;t exist.
      </h1>
      <p className="mt-4 text-15 text-mute">the link is wrong, or the page moved. the contents has everything.</p>
      <div className="mt-8 flex gap-2">
        <Link href="/learn" className="act solid">
          open the contents
        </Link>
        <Link href="/" className="act">
          go home
        </Link>
      </div>
    </main>
  );
}
