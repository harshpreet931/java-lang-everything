"use client";

import { useState } from "react";
import { PANEL } from "./kit";

// a neutral map of the java ecosystem. "latest" = newest stable (no alpha/beta/rc/milestone)
// version on maven central (or the project's own download site) checked on 2026-10-08.
// years are first stable releases (1.0) unless noted.

type Item = { name: string; what: string; by: string; since?: string; latest?: string };
type Group = { id: string; label: string; blurb: string; items: Item[] };

const GROUPS: Group[] = [
  {
    id: "apps",
    label: "application frameworks",
    blurb: "wire your code together, serve http, talk to databases and queues.",
    items: [
      { name: "Spring Boot", what: "opinionated setup on top of the spring framework: dependency injection, auto-configuration, an embedded server. the most used option by far.", by: "Broadcom (VMware Tanzu)", since: "2014", latest: "4.1.1 (spring framework 7.0.9)" },
      { name: "Quarkus", what: "built for containers: does as much wiring as possible at build time, first-class GraalVM native images, live reload in dev mode.", by: "Red Hat (IBM)", since: "2019", latest: "3.40.1" },
      { name: "Micronaut", what: "dependency injection resolved at compile time with annotation processors instead of runtime reflection, so it starts fast and native-compiles well.", by: "the Micronaut Foundation", since: "2018", latest: "5.2.2 (platform)" },
      { name: "Helidon", what: "a set of libraries for microservices, with a web server built on virtual threads, plus a MicroProfile flavour.", by: "Oracle", since: "2019" },
      { name: "Jakarta EE", what: "the standard specs formerly called java EE (servlets, JPA, CDI, JAX-RS), implemented by servers like WildFly, Payara, Open Liberty and GlassFish.", by: "the Eclipse Foundation", since: "2019 (as jakarta)", latest: "11 (june 2025)" },
      { name: "Vert.x", what: "a toolkit for reactive, event-loop based apps. libraries, not a framework that owns your main().", by: "the Eclipse Foundation", latest: "5.2.1" },
      { name: "Javalin", what: "a small web library for when you want routes and handlers and nothing else.", by: "community", latest: "7.2.3" },
    ],
  },
  {
    id: "data",
    label: "data access",
    blurb: "everything between your objects and a database. all of them sit on JDBC.",
    items: [
      { name: "JDBC", what: "the JDK's own database API: connections, statements, result sets. everything else here is built on it.", by: "part of the JDK (java.sql)", since: "1997 (jdk 1.1)" },
      { name: "Hibernate ORM", what: "maps objects to tables. the most used implementation of Jakarta Persistence (JPA). you write entities, it writes SQL.", by: "Red Hat (IBM)", since: "2001", latest: "7.4.12.Final" },
      { name: "jOOQ", what: "generates java classes from your schema so you write type-checked SQL in java. SQL-first instead of object-first.", by: "Data Geekery", latest: "3.21.9" },
      { name: "MyBatis", what: "maps SQL you write (in XML or annotations) to objects. no query generation, full control.", by: "community (from iBATIS)", since: "2010", latest: "3.5.19" },
      { name: "Spring Data", what: "repositories from interfaces: declare findByEmail, get an implementation. on top of JPA, JDBC, MongoDB and more.", by: "Broadcom (VMware Tanzu)" },
    ],
  },
  {
    id: "build",
    label: "build",
    blurb: "compile, test, package, resolve dependencies.",
    items: [
      { name: "Maven", what: "declarative pom.xml, a fixed lifecycle, convention over configuration. the default repository format everyone publishes to.", by: "the Apache Software Foundation", since: "2004", latest: "3.10.0 (4.0 in release candidates)" },
      { name: "Gradle", what: "a task graph configured with kotlin or groovy code. incremental builds and caching. the default for android.", by: "Gradle Inc.", since: "2012", latest: "9.8.1" },
    ],
  },
  {
    id: "test",
    label: "testing",
    blurb: "see testing with junit.",
    items: [
      { name: "JUnit", what: "the test runner. finds @Test methods, runs them, reports.", by: "the JUnit team", latest: "6.1.3" },
      { name: "AssertJ", what: "fluent assertions with failure messages that explain the difference.", by: "community", latest: "3.27.7" },
      { name: "Mockito", what: "mocks and spies for the collaborators you don't want in a unit test.", by: "community", since: "2008", latest: "5.24.0" },
      { name: "Testcontainers", what: "real databases, brokers and services in docker, started and stopped by your tests.", by: "Docker (originally AtomicJar)", since: "2015", latest: "2.0.5" },
      { name: "JMH", what: "the benchmark harness from the JDK team. the only sane way to microbenchmark on the JVM.", by: "OpenJDK", since: "2013", latest: "1.37" },
    ],
  },
  {
    id: "libs",
    label: "everyday libraries",
    blurb: "the dependencies that show up in almost every project.",
    items: [
      { name: "Jackson", what: "JSON (and YAML, XML, CSV) to objects and back. jackson 3 moved to the tools.jackson package; 2.x is still maintained.", by: "FasterXML", latest: "2.22.3 and 3.2.3" },
      { name: "Gson", what: "a smaller JSON library from google. simpler, fewer knobs.", by: "Google", latest: "2.14.0" },
      { name: "SLF4J", what: "a logging facade: libraries log through it, the app picks the backend.", by: "QOS.ch", since: "2005", latest: "2.0.20" },
      { name: "Logback", what: "a logging backend, the default under spring boot.", by: "QOS.ch", latest: "1.6.5" },
      { name: "Log4j 2", what: "the other big logging backend, with async loggers. (yes, that log4j: patch it.)", by: "the Apache Software Foundation", since: "2014", latest: "2.26.1" },
      { name: "Guava", what: "google's core libraries: immutable collections, caches, hashing, preconditions. a lot of it has since moved into the JDK.", by: "Google", latest: "33.7.2" },
    ],
  },
  {
    id: "langs",
    label: "languages on the JVM",
    blurb: "they compile to the same bytecode, so they can call java and java can call them.",
    items: [
      { name: "Kotlin", what: "null-safe types, concise syntax, coroutines. the preferred language for android, and common on the server.", by: "JetBrains", since: "2016", latest: "2.4.21" },
      { name: "Scala", what: "functional and object-oriented, with a powerful type system. big in data engineering (spark is written in it).", by: "EPFL and the Scala Center", since: "2004", latest: "3.10.0" },
      { name: "Clojure", what: "a lisp with immutable data structures by default, built for a REPL-driven workflow.", by: "Rich Hickey and Nubank", since: "2009 (first released 2007)", latest: "1.12.6" },
      { name: "Groovy", what: "a dynamic language with java-like syntax. powers gradle's original DSL, jenkins pipelines and spock.", by: "the Apache Software Foundation", since: "2007", latest: "6.0.0" },
    ],
  },
  {
    id: "runtimes",
    label: "runtimes",
    blurb: "where it all runs. see getting a JDK.",
    items: [
      { name: "OpenJDK builds", what: "temurin, corretto, zulu, the oracle JDK, red hat's, microsoft's: the same openjdk code built and supported by different vendors.", by: "many vendors" },
      { name: "GraalVM", what: "a JDK with the graal JIT and native image: compile a whole app ahead of time into one native executable.", by: "Oracle", since: "2019" },
      { name: "OpenJ9", what: "an alternative JVM (not hotspot), tuned for low memory use. ships in IBM Semeru.", by: "the Eclipse Foundation (from IBM)", since: "2017 (open source)" },
    ],
  },
];

export function EcosystemMap() {
  const [sel, setSel] = useState("Spring Boot");
  const all = GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, g })));
  const cur = all.find((i) => i.name === sel)!;

  return (
    <div className="@container">
      <div className="grid gap-x-6 gap-y-5 @[640px]:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.id} className="min-w-0">
            <div className="mb-1.5 border-b border-line-2 pb-1">
              <div className="text-12 text-hi">{g.label}</div>
              <div className="font-serif text-14 leading-[1.4] text-mute italic">{g.blurb}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {g.items.map((i) => {
                const on = i.name === sel;
                return (
                  <button
                    key={i.name}
                    onClick={() => setSel(i.name)}
                    aria-pressed={on}
                    className={`rounded-sm px-2 text-12 leading-[26px] transition-[background-color,color,box-shadow] duration-150 ease-jle ${
                      on ? "bg-well-2 text-hi shadow-[inset_0_0_0_1px_var(--hot)]" : "bg-bg text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-hi"
                    }`}
                  >
                    {i.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-6 px-4 py-3.5 ${PANEL}`} aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-16 text-hi">{cur.name}</span>
          <span className="text-11 text-faint">{cur.g.label}</span>
        </div>
        <p className="mt-1.5 font-serif text-17 leading-[1.55] text-ink">{cur.what}</p>
        <dl className="mt-2 grid grid-cols-[8ch_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-12">
          <dt className="text-faint">by</dt>
          <dd className="text-mute">{cur.by}</dd>
          {cur.since && (
            <>
              <dt className="text-faint">since</dt>
              <dd className="text-mute">{cur.since}</dd>
            </>
          )}
          {cur.latest && (
            <>
              <dt className="text-faint">latest</dt>
              <dd className="text-mute">{cur.latest}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
