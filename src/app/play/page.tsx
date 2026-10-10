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
    <main id="main" className="px-[var(--gutter)] pt-14">
      <header className="mx-auto max-w-[36rem] text-center">
        <div className="font-mono text-12 text-faint">everything.play</div>
        <h1 className="mt-4 font-display text-[clamp(2.3rem,1.6rem+2.4vw,3.2rem)] leading-[1.08] font-light text-hi">play</h1>
        <p className="mt-4 text-18 leading-[1.6] text-mute italic">
          write java, run it right here. the real javac from jdk 25, compiled to webassembly. nothing leaves your machine.
        </p>
        <span className="ornament mt-9" aria-hidden />
      </header>

      <div className="mt-10">
        <Playground />
      </div>

      <section className="mx-auto mt-16 max-w-[40rem] text-[1.06rem] leading-[1.75] text-ink">
        <h2 className="text-center font-display text-[1.7rem] font-light text-hi">how this works, honestly</h2>
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
      <Footer />
    </main>
  );
}
