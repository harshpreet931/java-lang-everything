import type { Metadata } from "next";
import { Playground } from "@/components/play/Playground";
import { Footer } from "@/components/site/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "online java compiler: run java in your browser",
  description: "a free online java playground: write java 25 and run it right in your browser with the real javac compiled to webassembly. no signup, nothing leaves your machine.",
  alternates: { canonical: "/play" },
  openGraph: { url: "/play" },
};

export default function Play() {
  return (
    <>
      <main id="main" className="px-[var(--gutter)] pt-14">
        <header className="mx-auto max-w-[1180px]">
          <h1 className="font-title text-[clamp(2.375rem,1.7rem+2vw,3rem)] leading-[1.04] tracking-[-0.018em] text-hi">play</h1>
          <p className="mt-4 max-w-[36rem] text-[1.25rem] leading-[1.5] text-mute italic max-sm:text-[1.125rem]">
            write java, run it right here. the real javac from jdk 25, compiled to webassembly. nothing leaves your machine.
          </p>
          <div className="mt-5 font-addr text-[11px] text-mute" translate="no">
            everything.<b className="font-normal text-hi">play</b>
          </div>
        </header>

        <div className="mt-10">
          <Playground />
        </div>

        <section className="mx-auto mt-20 max-w-[var(--measure)] text-[1.125rem] leading-[var(--lh-body)] text-ink">
          <h2 className="font-title text-[1.9375rem] leading-[1.12] tracking-[-0.012em] text-hi">how this works, honestly</h2>
          <p className="mt-4">
            your code is compiled by the real <code className="inline-code">javac</code> (from jdk 25), but it doesn&apos;t
            run on a JVM. it runs on <a className="link" href="https://teavm.org" target="_blank" rel="noreferrer">TeaVM</a>,
            which translates the bytecode to webassembly. for teaching-sized programs that&apos;s the same answer real java
            gives. a few things are different or missing: virtual threads, executors, keyboard input, reflection, files and
            the network, and catching runtime exceptions like <code className="inline-code">/ 0</code>. when a program needs
            those, run it on a real JDK with <code className="inline-code">java Main.java</code>.
          </p>
          <p className="mt-4">
            the details, and how the runtime is built, are in{" "}
            <a className="link" href={`${site.repo}/tree/main/src/lib/java`} target="_blank" rel="noreferrer">
              src/lib/java
            </a>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
