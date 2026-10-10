"use client";

import { useState } from "react";
import { Term, type Tone } from "./kit";

// every program in $JAVA_HOME/bin of temurin 25.0.4.1 (macOS aarch64): 30 of them.
// every transcript below was captured from that JDK, then trimmed (paths shortened,
// long lists cut with "..."). pids and timestamps are whatever they were on the day.

type Group = "build" | "run" | "inspect" | "diagnose" | "package" | "other";

type Tool = {
  name: string;
  group: Group;
  since: string;
  line: string;
  out: string;
  marks?: Record<string, Tone>;
  daily?: boolean;
};

const GROUPS: { id: Group; label: string; what: string }[] = [
  { id: "build", label: "build", what: "source → classes, docs" },
  { id: "run", label: "run", what: "start a JVM" },
  { id: "inspect", label: "inspect", what: "read class files, no JVM" },
  { id: "diagnose", label: "diagnose", what: "talk to a live JVM" },
  { id: "package", label: "package", what: "jars, runtimes, installers" },
  { id: "other", label: "other", what: "keys, serialization, rmi" },
];

const TOOLS: Tool[] = [
  {
    name: "javac",
    group: "build",
    since: "1.0",
    daily: true,
    line: "the compiler. .java in, .class out. --release N compiles against an older JDK's API.",
    out: `$ javac -d out Hello.java
$ ls out
Hello.class
$ javac --release 17 -d out17 Hello.java`,
  },
  {
    name: "javadoc",
    group: "build",
    since: "1.0",
    line: "turns doc comments into a browsable html site. warns about anything public without a comment.",
    out: `$ javadoc -d docs Hello.java
Loading source file Hello.java...
Constructing Javadoc information...
Standard Doclet version 25.0.4.1+1-LTS
Generating docs/Hello.html...
Hello.java:2: warning: no comment
    public static void main(String[] args) {
                       ^
...
Generating docs/index.html...
3 warnings`,
    marks: { "warning: no comment": "hot" },
  },
  {
    name: "jar",
    group: "build",
    since: "1.1",
    daily: true,
    line: "a zip file with a manifest. --main-class makes it runnable with java -jar.",
    out: `$ jar --create --file hello.jar --main-class Hello -C out .
$ jar --list --file hello.jar
META-INF/
META-INF/MANIFEST.MF
Hello.class
$ java -jar hello.jar
hello, world`,
  },
  {
    name: "java",
    group: "run",
    since: "1.0",
    daily: true,
    line: "the launcher. starts a JVM and runs a class, a jar, a module, or a .java file directly.",
    out: `$ java -version
openjdk version "25.0.4.1" 2026-08-18 LTS
OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)
OpenJDK 64-Bit Server VM Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS, mixed mode, sharing)
$ java Hello.java ada
hello, ada`,
  },
  {
    name: "jshell",
    group: "run",
    since: "9",
    daily: true,
    line: "a REPL. type an expression, see its value. no class, no main, no semicolons.",
    out: `$ jshell
|  Welcome to JShell -- Version 25.0.4.1
jshell> int x = 5
x ==> 5
jshell> x * 2
$2 ==> 10
jshell> List.of(3, 1, 2).stream().sorted().toList()
$3 ==> [1, 2, 3]`,
    marks: { "==>": "hot" },
  },
  {
    name: "jwebserver",
    group: "run",
    since: "18",
    line: "a static file server in one command. for testing and teaching, not production.",
    out: `$ jwebserver -p 8766
Binding to loopback by default. For all interfaces use "-b 0.0.0.0" or "-b ::".
Serving /tmp/tools and subdirectories on 127.0.0.1 port 8766
URL http://127.0.0.1:8766/
127.0.0.1 - - [08/Oct/2026:22:41:03 +0530] "GET /Hello.java HTTP/1.1" 200 -`,
  },
  {
    name: "jrunscript",
    group: "run",
    since: "6",
    line: "a script shell with no script engine left (nashorn went in 15). deprecated in 24, removed in 26.",
    out: `$ jrunscript
Warning: jrunscript is deprecated and will be removed in a future release.`,
    marks: { "Warning: jrunscript is deprecated and will be removed in a future release.": "dead" },
  },
  {
    name: "javap",
    group: "inspect",
    since: "1.0",
    daily: true,
    line: "disassembles a .class file. -c shows the bytecode, -v shows everything (constant pool too).",
    out: `$ javap -c -cp out Hello
  public static void main(java.lang.String[]);
    Code:
         0: aload_0
         1: arraylength
         2: ifle          11
         ...
        14: getstatic     #9    // Field java/lang/System.out
        17: aload_1
        18: invokedynamic #15,0 // makeConcatWithConstants
        23: invokevirtual #19   // Method java/io/PrintStream.println
        26: return`,
    marks: { invokedynamic: "hot" },
  },
  {
    name: "jdeps",
    group: "inspect",
    since: "8",
    daily: true,
    line: "which modules and packages does this code depend on. --print-module-deps feeds straight into jlink.",
    out: `$ jdeps -cp out out/Hello.class
Hello.class -> java.base
   <unnamed>   -> java.io             java.base
   <unnamed>   -> java.lang           java.base
   <unnamed>   -> java.lang.invoke    java.base
$ jdeps --print-module-deps -cp out out/Hello.class
java.base`,
    marks: { "java.base": "live" },
  },
  {
    name: "jdeprscan",
    group: "inspect",
    since: "9",
    line: "scans compiled code for deprecated APIs, so you find the ones marked for removal before an upgrade does.",
    out: `$ jdeprscan --class-path old Old
Directory Old:
class Old uses deprecated method java/lang/Integer::<init>(I)V
class Old uses deprecated method java/lang/Thread::stop()V (forRemoval=true)
class Old uses deprecated method java/lang/System::runFinalization()V (forRemoval=true)`,
    marks: { "(forRemoval=true)": "dead" },
  },
  {
    name: "jnativescan",
    group: "inspect",
    since: "24",
    line: "finds code that calls native methods or restricted FFM methods. for the native access lockdown.",
    out: `$ jnativescan --help
The jnativescan tool can be used to find methods that may access native
functionality when run. This includes restricted method calls and 'native'
method declarations.
--class-path <Path>     The class path as used at runtime
--module-path <Path>    The module path as used at runtime
...`,
  },
  {
    name: "jimage",
    group: "inspect",
    since: "9",
    line: "lists or extracts lib/modules, the single file that holds the whole class library.",
    out: `$ jimage list $JAVA_HOME/lib/modules | head -4
jimage: $JAVA_HOME/lib/modules

Module: java.base
    apple/security/AppleProvider$ProviderService.class
$ jimage list $JAVA_HOME/lib/modules | grep -c '\\.class'
27363`,
    marks: { "27363": "hot" },
  },
  {
    name: "jps",
    group: "diagnose",
    since: "5",
    daily: true,
    line: "lists the JVMs running as you, with their pids. step one of every investigation.",
    out: `$ jps -l
89793 Busy
89868 jdk.jcmd/sun.tools.jps.Jps`,
    marks: { "89793": "hot" },
  },
  {
    name: "jcmd",
    group: "diagnose",
    since: "7",
    daily: true,
    line: "the swiss army knife. sends commands to a live JVM: thread dumps, heap dumps, JFR, flags, GC.",
    out: `$ jcmd 89793 help
89793:
The following commands are available:
Compiler.codecache
GC.class_histogram
GC.heap_dump
GC.heap_info
JFR.start
JFR.dump
Thread.print
VM.flags
VM.native_memory
VM.uptime
... (54 commands on jdk 25)
$ jcmd 89793 VM.uptime
11.573 s`,
    marks: { "54 commands": "hot" },
  },
  {
    name: "jstat",
    group: "diagnose",
    since: "5",
    line: "samples GC counters on an interval. watch eden fill and empty, live.",
    out: `$ jstat -gcutil 89793 500 3
  S0     S1     E      O      M     CCS    YGC   YGCT    FGC  GCT
     -  73.63  83.78   0.49  26.94   2.53    63  0.043     0  0.043
     -  72.47  71.17   0.49  26.94   2.53    74  0.050     0  0.050
     -  68.99  48.65   0.49  26.94   2.53    85  0.058     0  0.058`,
    marks: { "  63": "hot", "  74": "hot", "  85": "hot" },
  },
  {
    name: "jstack",
    group: "diagnose",
    since: "5",
    line: "prints every thread's stack. jcmd <pid> Thread.print does the same.",
    out: `$ jstack 89793
Full thread dump OpenJDK 64-Bit Server VM (25.0.4.1+1-LTS mixed mode, sharing):

"main" #3 [4867] prio=5 os_prio=31 cpu=5905.28ms elapsed=6.05s runnable
   java.lang.Thread.State: RUNNABLE
	at Busy.main(Busy.java:9)
...`,
    marks: { "at Busy.main(Busy.java:9)": "hot" },
  },
  {
    name: "jmap",
    group: "diagnose",
    since: "5",
    line: "heap histograms and heap dumps. jcmd GC.class_histogram / GC.heap_dump are the modern spelling.",
    out: `$ jmap -histo:live 89793 | head -6
 num     #instances         #bytes  class name (module)
-------------------------------------------------------
   1:          3579        8082216  [I (java.base@25.0.4.1)
   2:          8482         382440  [B (java.base@25.0.4.1)
   3:          1685         223104  java.lang.Class (java.base@25.0.4.1)
   4:          8406         201744  java.lang.String (java.base@25.0.4.1)`,
    marks: { "[I": "hot" },
  },
  {
    name: "jinfo",
    group: "diagnose",
    since: "5",
    line: "the flags a running JVM actually ended up with, after ergonomics picked defaults.",
    out: `$ jinfo -flag MaxHeapSize 89793
-XX:MaxHeapSize=6442450944
$ jinfo -flags 89793
VM Flags:
-XX:CICompilerCount=4 -XX:ConcGCThreads=3 -XX:G1HeapRegionSize=4194304
-XX:InitialHeapSize=402653184 -XX:MaxHeapSize=6442450944 ... -XX:+UseG1GC`,
    marks: { "6442450944": "hot" },
  },
  {
    name: "jfr",
    group: "diagnose",
    since: "12",
    daily: true,
    line: "reads flight recordings: summary, print events, or a ready-made view.",
    out: `$ jfr view gc busy.jfr
                                Garbage Collections
Start    GC ID Type                     Heap Before GC Heap After GC Longest Pause
-------- ----- ------------------------ -------------- ------------- -------------
22:41:08     0 Young Garbage Collection        49.1 MB       11.8 MB       1.76 ms
22:41:08     1 Young Garbage Collection       175.8 MB       14.0 MB       1.31 ms
22:41:08     2 Young Garbage Collection       230.0 MB       14.7 MB       1.15 ms`,
  },
  {
    name: "jdb",
    group: "diagnose",
    since: "1.0",
    line: "a command-line debugger. same protocol (JDWP) your IDE's debugger speaks.",
    out: `$ jdb -classpath dbg Hello ada
> stop at Hello:4
> run
Breakpoint hit: "thread=main", Hello.main(), line=4 bci=14
main[1] locals
Method arguments:
args = instance of java.lang.String[1] (id=432)
Local variables:
name = "ada"
main[1] cont
> hello, ada`,
    marks: { "Breakpoint hit": "hot" },
  },
  {
    name: "jhsdb",
    group: "diagnose",
    since: "9",
    line: "the serviceability agent: reads a JVM's memory from outside, even a core dump. needs debugger privileges.",
    out: `$ jhsdb jstack --pid 1476
Attaching to process ID 1476, please wait...
ERROR: attach: task_for_pid(1476) failed: '(os/kern) failure' (5)
Error attaching to process: Can't attach to the process.
Could be caused by an incorrect pid or lack of privileges.`,
    marks: { "lack of privileges": "dead" },
  },
  {
    name: "jconsole",
    group: "diagnose",
    since: "5",
    line: "a small GUI over JMX: heap, threads, classes, MBeans. no transcript, it opens a window.",
    out: `$ jconsole 89793
(opens a window: memory, threads, classes, VM summary, MBeans)`,
  },
  {
    name: "jstatd",
    group: "diagnose",
    since: "5",
    line: "an RMI server that lets jstat and visualvm watch JVMs on another machine. rarely worth the hole in the firewall.",
    out: `$ jstatd
(serves jvmstat counters over RMI, port 1099 by default)`,
  },
  {
    name: "jlink",
    group: "package",
    since: "9",
    daily: true,
    line: "builds a custom runtime with only the modules you name. the JRE you make yourself.",
    out: `$ jlink --add-modules java.base --strip-debug --no-header-files \\
        --no-man-pages --output rt
$ du -sh rt
 45M	rt
$ rt/bin/java -cp out Hello
hello, world`,
    marks: { "45M": "live" },
  },
  {
    name: "jmod",
    group: "package",
    since: "9",
    line: "the .jmod format: like a jar, but it can also carry native libs and commands. input for jlink.",
    out: `$ jmod create --class-path mods/shop.money shop.money.jmod
$ jmod describe shop.money.jmod
shop.money
exports shop.money
requires java.base mandated`,
  },
  {
    name: "jpackage",
    group: "package",
    since: "16",
    line: "wraps your app plus a jlinked runtime into a native installer: .dmg/.pkg, .msi/.exe, .deb/.rpm.",
    out: `$ jpackage --type app-image --name Hello --input input \\
        --main-jar hello.jar --add-modules java.base --dest out
$ du -sh out/Hello.app
 45M	out/Hello.app
$ out/Hello.app/Contents/MacOS/Hello small
hello, small`,
  },
  {
    name: "jarsigner",
    group: "package",
    since: "1.2",
    line: "signs a jar and verifies signatures, using a key from keytool.",
    out: `$ jarsigner -keystore ks.p12 signed.jar demo
$ jarsigner -verify signed.jar
jar verified.

Warning:
The signer's certificate is self-signed.`,
    marks: { "jar verified.": "live" },
  },
  {
    name: "keytool",
    group: "other",
    since: "1.2",
    line: "makes and manages keys and certificates in a keystore. also edits the JDK's trusted CA list (cacerts).",
    out: `$ keytool -genkeypair -alias demo -keyalg EC -dname "CN=demo" -keystore ks.p12
Generating 256-bit EC (secp256r1) key pair and self-signed certificate
(SHA384withECDSA) with a validity of 365 days
	for: CN=demo
$ keytool -list -keystore ks.p12
Keystore type: PKCS12
Your keystore contains 1 entry
demo, Oct 8, 2026, PrivateKeyEntry,`,
  },
  {
    name: "serialver",
    group: "other",
    since: "1.1",
    line: "prints the serialVersionUID java would compute for a class. paste it in before you change the class.",
    out: `$ serialver -classpath ser Pt
Pt:    private static final long serialVersionUID = 7544060657350909732L;`,
  },
  {
    name: "rmiregistry",
    group: "other",
    since: "1.1",
    line: "the name service for java RMI. legacy, kept for the apps that still use it.",
    out: `$ rmiregistry 1099
(runs until killed. RMI clients look up remote objects by name here)`,
  },
];

export function ToolAtlas() {
  const [sel, setSel] = useState("jcmd");
  const [filter, setFilter] = useState<"all" | "daily">("all");
  const t = TOOLS.find((x) => x.name === sel)!;
  const g = GROUPS.find((x) => x.id === t.group)!;

  return (
    <div className="@container">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">show =</span>
        <div className="flex gap-1">
          <button className="word" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            all 30
          </button>
          <button className="word" aria-pressed={filter === "daily"} onClick={() => setFilter("daily")}>
            the ones you&apos;ll use weekly
          </button>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-4 @[620px]:grid-cols-3">
        {GROUPS.map((grp) => (
          <div key={grp.id} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-line-2 pb-1 text-11">
              <span className="text-mute">{grp.label}</span>
              <span className="truncate text-faint">{grp.what}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {TOOLS.filter((x) => x.group === grp.id).map((x) => {
                const on = x.name === sel;
                const dim = filter === "daily" && !x.daily;
                return (
                  <button
                    key={x.name}
                    onClick={() => setSel(x.name)}
                    aria-pressed={on}
                    className={`rounded-sm px-2 text-12 leading-[26px] transition-[background-color,color,box-shadow,opacity] duration-150 ease-jle ${
                      on
                        ? "bg-well-2 text-hi shadow-[inset_0_0_0_1px_var(--hot)]"
                        : "bg-bg text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-hi hover:shadow-[inset_0_0_0_1px_var(--mute)]"
                    } ${dim && !on ? "opacity-30" : ""}`}
                  >
                    {x.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-line-2 pt-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-16 text-hi">{t.name}</span>
          <span className="text-12 text-faint">
            {g.label} · since {t.since === "1.0" || t.since === "1.1" || t.since === "1.2" ? `jdk ${t.since}` : `java ${t.since}`}
          </span>
        </div>
        <p className="mt-1.5 mb-4 font-serif text-17 leading-[1.6] text-ink">{t.line}</p>
        <Term text={t.out} marks={t.marks} label={`${t.name} · real output, jdk 25`} minH="12.5em" />
      </div>
    </div>
  );
}
