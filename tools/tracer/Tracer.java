import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.*;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * runs a java program under the debugger (JDI) and prints a step-by-step memory trace as json.
 * the json shape is the Trace type in src/lib/trace.ts.
 *
 *   java --add-modules jdk.jdi Tracer.java path/to/Main.java [--max-steps N] [--include-statics] [--hide-args]
 *
 * see README.md next to this file.
 */
public class Tracer {

    // ------------------------------------------------------------------ knobs

    static final String[] EXCLUDES = {"java.*", "javax.*", "jdk.*", "sun.*", "com.sun.*"};
    static final int HEAP_CAP = 60;           // objects fully expanded per step (the rest become stubs)
    static final int ITEM_CAP = 32;           // array / collection items shown
    static final int STRING_CAP = 200;        // chars shown for a String / StringBuilder
    static final int STATIC_SCAN_CAP = 5000;  // objects scanned when asking "is this still held by a static?"
    static final int GAP = 3;                 // carry an object through at most this many steps of "temporarily unreferenced"
    static final long MAX_SAFE = 9007199254740991L; // 2^53 - 1, biggest long a js number holds exactly
    static final String MORE = "\u2026";     // the ellipsis marker for truncated items

    static final String USAGE = """
            usage: trace.sh path/to/Main.java [--max-steps N] [--include-statics] [--hide-args] [--timeout SECONDS]
              --max-steps N       stop after N steps (default 300)
              --include-statics   also show static fields of your classes (as "static:<Class>" heap boxes)
              --hide-args         don't show main's String[] args
              --timeout SECONDS   give up after this long (default 30)""";

    Path file;
    int maxSteps = 300;
    boolean includeStatics, hideArgs;
    long timeoutMs = 30_000;

    public static void main(String[] args) {
        Tracer t = new Tracer();
        int rc = 0;
        try {
            t.parseArgs(args);
            String json = t.run();
            PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
            out.println(json);
            out.flush();
        } catch (UsageError e) {
            System.err.println(e.getMessage());
            rc = 2;
        } catch (Exception e) {
            System.err.println("tracer: " + e);
            e.printStackTrace();
            rc = 1;
        }
        System.exit(rc);
    }

    static final class UsageError extends Exception {
        UsageError(String msg) { super(msg); }
    }

    void parseArgs(String[] a) throws UsageError {
        for (int i = 0; i < a.length; i++) {
            switch (a[i]) {
                case "--max-steps" -> maxSteps = intArg(a, ++i);
                case "--timeout" -> timeoutMs = intArg(a, ++i) * 1000L;
                case "--include-statics" -> includeStatics = true;
                case "--hide-args" -> hideArgs = true;
                case "-h", "--help" -> throw new UsageError(USAGE);
                default -> {
                    if (a[i].startsWith("-")) throw new UsageError("unknown option " + a[i] + "\n" + USAGE);
                    if (file != null) throw new UsageError("only one .java file please\n" + USAGE);
                    file = Path.of(a[i]);
                }
            }
        }
        if (file == null) throw new UsageError(USAGE);
        if (!Files.isRegularFile(file)) throw new UsageError("no such file: " + file);
        if (maxSteps < 1) throw new UsageError("--max-steps must be at least 1");
    }

    static int intArg(String[] a, int i) throws UsageError {
        if (i >= a.length) throw new UsageError("missing number after " + a[i - 1]);
        try { return Integer.parseInt(a[i]); } catch (NumberFormatException e) { throw new UsageError("not a number: " + a[i]); }
    }

    static void log(String msg) { System.err.println("tracer: " + msg); }

    // ------------------------------------------------------------------ state

    VirtualMachine vm;
    EventRequestManager erm;
    Pump stdout;
    String mainClass;
    Method mainMethod;
    ThreadReference mainThread;
    StepRequest stepReq;
    MethodExitRequest exitReq;
    ExceptionRequest excReq;
    final Set<String> userClasses = new LinkedHashSet<>();

    final List<Snap> snaps = new ArrayList<>();
    Snap pendingException;   // an "uncaught" exception, kept until we know it really killed the program
    String pendingNote;      // "factorial returned 6", attached to the next recorded step
    boolean stopped, mainReturned;

    // same-line loops: STEP_LINE only fires when the line number changes, so `for (...) sum += i;` on one line
    // would run in a single step. we put breakpoints on the spots of the current line a loop can jump back to,
    // and when one that already ran during this visit to the line runs again, that's a new iteration: record a step.
    final List<BreakpointRequest> lineBps = new ArrayList<>();
    final Set<Long> visitHits = new HashSet<>();
    final Map<Method, Map<Integer, List<Location>>> watchCache = new HashMap<>();
    Method visitMethod;
    int visitLine = -1, visitDepth = -1;

    final Map<Long, String> ids = new HashMap<>();      // JDI uniqueID -> "o1", "o2"... in order of first appearance
    final Map<String, Long> uids = new HashMap<>();     // and back
    final Map<String, ObjectReference> refs = new HashMap<>(); // id -> the live object, to re-read things that dropped out of view
    final Map<String, Integer> lastSeen = new HashMap<>();     // id -> index of the last recorded step it was reachable in
    final Map<String, String> typeById = new HashMap<>();      // id -> last type label we printed for it
    final Set<String> lifecycle = new HashSet<>();     // ids that may get state "new" / "dead"
    final Map<Long, GT> generic = new HashMap<>();      // uniqueID -> generic type learned from a declaration
    final Map<Integer, FrameMemo> memos = new HashMap<>(); // per stack slot: local order + last values
    final Map<ReferenceType, Map<String, Field>> fieldCache = new HashMap<>();
    Value emptySentinel;
    boolean emptySentinelLooked;

    // ------------------------------------------------------------------ run

    String run() throws Exception {
        String source = Files.readString(file);
        Path classes = Files.createTempDirectory("jtrace");
        try {
            compile(classes);
            mainClass = findMainClass();
            launch(classes);
            loop();
            finish();
            return Json.pretty(buildTrace(source));
        } finally {
            shutdown();
            deleteTree(classes);
        }
    }

    void compile(Path classes) throws Exception {
        String[] args = {"-g", "-encoding", "UTF-8", "-proc:none", "-Xlint:none", "-d", classes.toString(), file.toString()};
        StringWriter out = new StringWriter();
        int rc;
        Optional<java.util.spi.ToolProvider> javac = java.util.spi.ToolProvider.findFirst("javac");
        if (javac.isPresent()) {
            PrintWriter pw = new PrintWriter(out, true);
            rc = javac.get().run(pw, pw, args);
        } else {
            List<String> cmd = new ArrayList<>();
            cmd.add(Path.of(System.getProperty("java.home"), "bin", "javac").toString());
            cmd.addAll(List.of(args));
            Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            out.write(new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
            rc = p.waitFor();
        }
        if (rc != 0) throw new UsageError("javac failed:\n" + out);
        try (Stream<Path> s = Files.walk(classes)) {
            s.filter(p -> p.toString().endsWith(".class")).sorted().forEach(p -> {
                String rel = classes.relativize(p).toString().replace(File.separatorChar, '.');
                userClasses.add(rel.substring(0, rel.length() - ".class".length()));
            });
        }
    }

    String findMainClass() throws UsageError {
        String base = file.getFileName().toString().replaceFirst("\\.java$", "");
        for (String c : userClasses) if (c.equals(base) || c.endsWith("." + base)) return c;
        throw new UsageError("couldn't find a class called " + base + " in " + file);
    }

    void launch(Path classes) throws Exception {
        LaunchingConnector lc = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> ca = lc.defaultArguments();
        ca.get("main").setValue(mainClass);
        ca.get("options").setValue("-cp \"" + classes + "\" -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8"
                + " -XX:+ShowCodeDetailsInExceptionMessages");
        vm = lc.launch(ca);
        Process p = vm.process();
        try { p.getOutputStream().close(); } catch (IOException ignored) { } // stdin = EOF, so Scanner can't hang us
        stdout = new Pump(p.getInputStream());
        stdout.start();
        Thread err = new Thread(() -> {
            try { p.getErrorStream().transferTo(System.err); } catch (IOException ignored) { }
        }, "stderr-pump");
        err.setDaemon(true);
        err.start();

        erm = vm.eventRequestManager();
        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        cpr.addClassFilter(mainClass);
        cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        cpr.enable();
    }

    void loop() throws Exception {
        EventQueue q = vm.eventQueue();
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (!stopped) {
            long left = deadline - System.currentTimeMillis();
            if (left <= 0) {
                stop("stopped: timed out after " + (timeoutMs / 1000) + "s");
                break;
            }
            EventSet set;
            try {
                set = q.remove(left);
            } catch (VMDisconnectedException e) {
                break;
            }
            if (set == null) continue;
            boolean over = false;
            boolean stepped = set.stream().anyMatch(ev -> ev instanceof StepEvent);
            for (Event ev : set) {
                try {
                    if (ev instanceof VMDeathEvent || ev instanceof VMDisconnectEvent) over = true;
                    else if (ev instanceof ClassPrepareEvent e) onPrepare(e);
                    else if (ev instanceof BreakpointEvent e && mainThread == null) onMainEntry(e.thread());
                    else if (ev instanceof BreakpointEvent e && !stepped) onLineBreakpoint(e);
                    else if (ev instanceof StepEvent e) onStep(e);
                    else if (ev instanceof MethodExitEvent e) onExit(e);
                    else if (ev instanceof ExceptionEvent e) onException(e);
                } catch (VMDisconnectedException e) {
                    over = true;
                }
            }
            if (over) break;
            if (!stopped) {
                try { set.resume(); } catch (VMDisconnectedException e) { break; }
            }
        }
    }

    void onPrepare(ClassPrepareEvent e) throws Exception {
        if (mainMethod != null || !e.referenceType().name().equals(mainClass)) return;
        mainMethod = pickMain(e.referenceType());
        if (mainMethod == null) throw new UsageError("no main method in " + mainClass);
        BreakpointRequest bp = erm.createBreakpointRequest(mainMethod.location());
        bp.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        bp.enable();
    }

    /** same priority the launcher uses: static main(String[]), static main(), instance main(String[]), instance main(). */
    static Method pickMain(ReferenceType rt) {
        Method best = null;
        int bestRank = 99;
        for (Method m : rt.methodsByName("main")) {
            if (m.isAbstract() || m.isNative()) continue;
            boolean strings = m.signature().equals("([Ljava/lang/String;)V");
            boolean none = m.signature().equals("()V");
            if (!strings && !none) continue;
            int rank = (m.isStatic() ? 0 : 2) + (strings ? 0 : 1);
            if (rank < bestRank) { best = m; bestRank = rank; }
        }
        return best;
    }

    void onMainEntry(ThreadReference t) throws Exception {
        if (mainThread != null) return;
        mainThread = t;
        erm.deleteEventRequests(new ArrayList<>(erm.breakpointRequests()));
        unbufferStdout(t);

        stepReq = erm.createStepRequest(t, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
        for (String x : EXCLUDES) stepReq.addClassExclusionFilter(x);
        stepReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        stepReq.enable();

        exitReq = erm.createMethodExitRequest();
        exitReq.addThreadFilter(t);
        for (String x : EXCLUDES) exitReq.addClassExclusionFilter(x);
        exitReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        exitReq.enable();

        excReq = erm.createExceptionRequest(null, false, true);
        excReq.addThreadFilter(t);
        excReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        excReq.enable();

        record(t, null, false);
        watchLine(t, mainMethod.location());
    }

    void onStep(StepEvent e) {
        if (stopped || mainReturned || !isUserLocation(e.location())) return;
        pendingException = null; // we're back in user code, so whatever was "uncaught" got handled after all
        record(e.thread(), takeNote(), false);
        watchLine(e.thread(), e.location());
    }

    /** a breakpoint on the line we're on fired. if that spot already ran during this visit, it's a new loop iteration. */
    void onLineBreakpoint(BreakpointEvent e) {
        Location loc = e.location();
        if (stopped || mainReturned || !loc.method().equals(visitMethod) || loc.lineNumber() != visitLine) return;
        try {
            if (e.thread().frameCount() != visitDepth) return; // same line, but in some other frame (recursion)
        } catch (IncompatibleThreadStateException x) {
            return;
        }
        if (visitHits.add(loc.codeIndex())) return; // first time this part of the line runs in this visit
        visitHits.clear();
        visitHits.add(loc.codeIndex());
        pendingException = null;
        record(e.thread(), takeNote(), true);
    }

    void watchLine(ThreadReference t, Location loc) {
        if (stopped) return;
        if (!lineBps.isEmpty()) {
            erm.deleteEventRequests(lineBps);
            lineBps.clear();
        }
        visitHits.clear();
        visitMethod = loc.method();
        visitLine = loc.lineNumber();
        try {
            visitDepth = t.frameCount();
        } catch (IncompatibleThreadStateException e) {
            return;
        }
        for (Location l : watchPoints(visitMethod, visitLine)) {
            BreakpointRequest bp = erm.createBreakpointRequest(l);
            bp.addThreadFilter(t);
            bp.setSuspendPolicy(EventRequest.SUSPEND_ALL);
            bp.enable();
            lineBps.add(bp);
        }
        visitHits.add(loc.codeIndex()); // we're standing on this spot right now, so it counts as run
    }

    /**
     * the spots on a line that a loop can jump back to: the line-table entries for the line, plus the target of
     * any backward branch that starts and ends inside the line (javac merges same-line entries, so in
     * `for (int i = 0; i < n; i++) sum += i;` the condition isn't an entry, only a jump target).
     */
    List<Location> watchPoints(Method m, int line) {
        return watchCache.computeIfAbsent(m, k -> new HashMap<>()).computeIfAbsent(line, l -> {
            List<Location> out = new ArrayList<>();
            try {
                List<Location> all = m.allLineLocations();
                byte[] code = vm.canGetBytecodes() ? m.bytecodes() : null;
                long codeEnd = code != null ? code.length : Long.MAX_VALUE;
                List<long[]> ranges = new ArrayList<>();
                for (int i = 0; i < all.size(); i++) {
                    if (all.get(i).lineNumber() != line) continue;
                    out.add(all.get(i));
                    ranges.add(new long[]{all.get(i).codeIndex(), i + 1 < all.size() ? all.get(i + 1).codeIndex() : codeEnd});
                }
                if (code != null) {
                    Set<Long> have = new HashSet<>();
                    for (Location x : out) have.add(x.codeIndex());
                    for (int[] br : Bytecode.branches(code)) {
                        long src = br[0], dst = br[1];
                        if (dst < src && inside(ranges, src) && inside(ranges, dst) && have.add(dst)) {
                            Location target = m.locationOfCodeIndex(dst);
                            if (target != null) out.add(target);
                        }
                    }
                }
            } catch (AbsentInformationException | RuntimeException ignored) { }
            return out;
        });
    }

    static boolean inside(List<long[]> ranges, long pc) {
        for (long[] r : ranges) if (pc >= r[0] && pc < r[1]) return true;
        return false;
    }

    /** just enough of a bytecode walker to find branch instructions and where they go */
    static final class Bytecode {
        static final int[] LEN = new int[256];

        static {
            Arrays.fill(LEN, 1);
            LEN[0x10] = 2; LEN[0x11] = 3; LEN[0x12] = 2; LEN[0x13] = 3; LEN[0x14] = 3;  // bipush sipush ldc ldc_w ldc2_w
            for (int op = 0x15; op <= 0x19; op++) LEN[op] = 2;                         // xload n
            for (int op = 0x36; op <= 0x3a; op++) LEN[op] = 2;                         // xstore n
            LEN[0x84] = 3;                                                              // iinc
            for (int op = 0x99; op <= 0xa8; op++) LEN[op] = 3;                         // if*, goto, jsr
            LEN[0xa9] = 2;                                                              // ret
            for (int op = 0xb2; op <= 0xb8; op++) LEN[op] = 3;                         // fields, invokes
            LEN[0xb9] = 5; LEN[0xba] = 5;                                               // invokeinterface, invokedynamic
            LEN[0xbb] = 3; LEN[0xbc] = 2; LEN[0xbd] = 3; LEN[0xc0] = 3; LEN[0xc1] = 3; // new newarray anewarray checkcast instanceof
            LEN[0xc5] = 4; LEN[0xc6] = 3; LEN[0xc7] = 3; LEN[0xc8] = 5; LEN[0xc9] = 5; // multianewarray ifnull ifnonnull goto_w jsr_w
        }

        /** [from, to] pairs for every jump in the method */
        static List<int[]> branches(byte[] c) {
            List<int[]> out = new ArrayList<>();
            int pc = 0;
            while (pc < c.length) {
                int op = c[pc] & 0xff;
                int len;
                if ((op >= 0x99 && op <= 0xa8) || op == 0xc6 || op == 0xc7) {
                    out.add(new int[]{pc, pc + (short) (((c[pc + 1] & 0xff) << 8) | (c[pc + 2] & 0xff))});
                    len = 3;
                } else if (op == 0xc8 || op == 0xc9) {
                    out.add(new int[]{pc, pc + s4(c, pc + 1)});
                    len = 5;
                } else if (op == 0xaa) { // tableswitch
                    int p = (pc + 4) & ~3, lo = s4(c, p + 4), hi = s4(c, p + 8);
                    out.add(new int[]{pc, pc + s4(c, p)});
                    for (int k = 0; k <= hi - lo; k++) out.add(new int[]{pc, pc + s4(c, p + 12 + 4 * k)});
                    len = p + 12 + (hi - lo + 1) * 4 - pc;
                } else if (op == 0xab) { // lookupswitch
                    int p = (pc + 4) & ~3, n = s4(c, p + 4);
                    out.add(new int[]{pc, pc + s4(c, p)});
                    for (int k = 0; k < n; k++) out.add(new int[]{pc, pc + s4(c, p + 8 + 8 * k + 4)});
                    len = p + 8 + n * 8 - pc;
                } else if (op == 0xc4) { // wide
                    len = (c[pc + 1] & 0xff) == 0x84 ? 6 : 4;
                } else {
                    len = LEN[op];
                }
                pc += len;
            }
            return out;
        }

        static int s4(byte[] c, int p) {
            return ((c[p] & 0xff) << 24) | ((c[p + 1] & 0xff) << 16) | ((c[p + 2] & 0xff) << 8) | (c[p + 3] & 0xff);
        }
    }

    String takeNote() {
        String note = pendingNote;
        pendingNote = null;
        return note;
    }

    void onExit(MethodExitEvent e) throws Exception {
        Method m = e.method();
        if (!isUserType(m.declaringType()) || m.isBridge()) return;
        if (m.equals(mainMethod) && userDepth(e.thread()) <= 1) {
            mainReturned = true;
            stepReq.disable(); // don't single-step through the JVM shutting down
            exitReq.disable();
            return;
        }
        if (pendingException != null || m.isConstructor() || m.isStaticInitializer() || m.returnTypeName().equals("void")) return;
        String txt = frameName(m) + " returned " + noteValue(e.returnValue());
        pendingNote = pendingNote == null ? txt : pendingNote + ", " + txt;
    }

    void onException(ExceptionEvent e) {
        if (stopped || mainReturned) return;
        try {
            ObjectReference ex = e.exception();
            String msg = exceptionMessage(ex, e.thread()); // may invoke code, so do it before reading frames
            Snap s = snapshot(e.thread());
            if (s.frames.isEmpty()) return;
            s.note = "exception: " + ex.referenceType().name() + (msg == null ? "" : ": " + msg);
            pendingException = s;
        } catch (Exception x) {
            log("couldn't record exception: " + x);
        }
    }

    void record(ThreadReference t, String note, boolean iteration) {
        Snap s;
        try {
            s = snapshot(t);
        } catch (Exception e) {
            log("snapshot failed: " + e);
            return;
        }
        if (s.frames.isEmpty()) return;
        Snap last = snaps.isEmpty() ? null : snaps.get(snaps.size() - 1);
        if (note == null && !iteration && s.sameStateAs(last)) return;
        s.note = note;
        for (String id : s.heap.keySet()) lastSeen.put(id, snaps.size());
        snaps.add(s);
        if (snaps.size() >= maxSteps) stop("stopped after " + maxSteps + " steps");
    }

    void stop(String why) {
        stopped = true;
        log(why);
        if (snaps.isEmpty()) return;
        Snap last = snaps.get(snaps.size() - 1);
        last.note = last.note == null ? why : last.note + "; " + why;
    }

    void finish() {
        if (stopped || vm == null) return;
        String all = waitForOutput();
        if (pendingException != null) {
            snaps.add(pendingException);
            return;
        }
        if (snaps.isEmpty()) {
            log("no steps recorded (main never ran?)");
            return;
        }
        Snap last = snaps.get(snaps.size() - 1);
        Snap end = new Snap();
        end.line = last.line;
        end.stdout = all;
        end.note = mainReturned ? "main returned, program ends" : "program exited";
        end.isFinal = true;
        snaps.add(end);
    }

    String waitForOutput() {
        Process p = vm.process();
        try {
            if (!p.waitFor(5, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                p.waitFor(2, TimeUnit.SECONDS);
            }
        } catch (InterruptedException ignored) { }
        return stdout.finish();
    }

    void shutdown() {
        if (vm == null) return;
        try { if (stopped) vm.exit(1); else vm.dispose(); } catch (Exception ignored) { }
        Process p = vm.process();
        if (p != null && p.isAlive()) p.destroyForcibly();
    }

    static void deleteTree(Path dir) {
        try (Stream<Path> s = Files.walk(dir)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    // ------------------------------------------------------------------ talking to the target

    /**
     * System.out buffers small writes, so a print() without a newline would show up a few steps late.
     * swap it for an unbuffered PrintStream over fd 1 before the first line of main runs.
     */
    void unbufferStdout(ThreadReference t) {
        try {
            ClassType sys = classType("java.lang.System");
            ObjectReference old = (ObjectReference) sys.getValue(sys.fieldByName("out"));
            Method flush = ((ClassType) old.referenceType()).concreteMethodByName("flush", "()V");
            old.invokeMethod(t, flush, List.of(), ObjectReference.INVOKE_SINGLE_THREADED);

            ClassType fd = classType("java.io.FileDescriptor");
            Value fdOut = fd.getValue(fd.fieldByName("out"));
            ClassType fos = classType("java.io.FileOutputStream");
            ObjectReference stream = fos.newInstance(t, fos.concreteMethodByName("<init>", "(Ljava/io/FileDescriptor;)V"),
                    List.of(fdOut), ObjectReference.INVOKE_SINGLE_THREADED);
            stream.disableCollection();
            ClassType ps = classType("java.io.PrintStream");
            ObjectReference print = ps.newInstance(t, ps.concreteMethodByName("<init>", "(Ljava/io/OutputStream;Z)V"),
                    List.of(stream, vm.mirrorOf(true)), ObjectReference.INVOKE_SINGLE_THREADED);
            print.disableCollection();
            sys.invokeMethod(t, sys.concreteMethodByName("setOut", "(Ljava/io/PrintStream;)V"),
                    List.of(print), ObjectReference.INVOKE_SINGLE_THREADED);
            stream.enableCollection();
            print.enableCollection();
        } catch (Exception e) {
            log("couldn't unbuffer System.out (print() without a newline may show up late): " + e);
        }
    }

    ClassType classType(String name) {
        List<ReferenceType> l = vm.classesByName(name);
        return l.isEmpty() ? null : (ClassType) l.get(0);
    }

    /** Throwable.detailMessage, or getMessage() for NPEs (their helpful message is computed lazily). */
    String exceptionMessage(ObjectReference ex, ThreadReference t) {
        Value v = get(ex, "detailMessage");
        if (v instanceof StringReference s) return s.value();
        if (!ex.referenceType().name().equals("java.lang.NullPointerException")) return null;
        List<EventRequest> paused = new ArrayList<>();
        for (EventRequest r : new EventRequest[]{stepReq, exitReq, excReq}) {
            if (r != null && r.isEnabled()) { r.disable(); paused.add(r); }
        }
        try {
            Method gm = ((ClassType) ex.referenceType()).concreteMethodByName("getMessage", "()Ljava/lang/String;");
            Value r = ex.invokeMethod(t, gm, List.of(), ObjectReference.INVOKE_SINGLE_THREADED);
            return r instanceof StringReference s ? s.value() : null;
        } catch (Exception e) {
            return null;
        } finally {
            for (EventRequest r : paused) r.enable();
        }
    }

    // ------------------------------------------------------------------ what counts as "your code"

    boolean isUserType(ReferenceType rt) {
        return rt != null && userClasses.contains(rt.name()) && (rt.modifiers() & 0x1000) == 0; // 0x1000 = synthetic
    }

    boolean isUserLocation(Location loc) {
        return isUserType(loc.declaringType()) && loc.lineNumber() > 0 && !loc.method().isBridge();
    }

    int userDepth(ThreadReference t) throws IncompatibleThreadStateException {
        int n = 0;
        for (StackFrame f : t.frames()) if (isUserLocation(f.location())) n++;
        return n;
    }

    List<ReferenceType> loadedUserTypes() {
        List<ReferenceType> out = new ArrayList<>();
        List<String> names = new ArrayList<>(userClasses);
        names.remove(mainClass);
        names.add(0, mainClass);
        for (String n : names) {
            for (ReferenceType rt : vm.classesByName(n)) if (rt.isPrepared() && isUserType(rt)) out.add(rt);
        }
        return out;
    }

    // ------------------------------------------------------------------ snapshots

    static final class FrameMemo {
        final Method method;
        List<String> order = new ArrayList<>();
        Map<String, Object> last = Map.of();
        FrameMemo(Method m) { method = m; }
    }

    static final class Snap {
        int line;
        List<Object> frames = new ArrayList<>();
        LinkedHashMap<String, Map<String, Object>> heap = new LinkedHashMap<>();
        String stdout = "";
        String note;
        List<String> changed = List.of();
        Set<String> staticHeld = Set.of(); // ids that left the picture but are still referenced by a static field
        Map<String, Map<String, Object>> ghosts = Map.of(); // fresh reads of objects that just left the picture
        boolean isFinal;
        boolean truncated; // the heap hit HEAP_CAP, so "not in the heap" doesn't mean "unreachable"

        boolean sameStateAs(Snap o) {
            return o != null && line == o.line && frames.equals(o.frames) && heap.equals(o.heap) && stdout.equals(o.stdout);
        }

        Map<String, Object> json() {
            Map<String, Object> j = new LinkedHashMap<>();
            j.put("line", line);
            j.put("frames", frames);
            j.put("heap", heap);
            j.put("stdout", stdout);
            if (note != null) j.put("note", note);
            if (!changed.isEmpty()) j.put("changed", changed);
            return j;
        }
    }

    Snap snapshot(ThreadReference t) throws Exception {
        List<StackFrame> stack = t.frames();
        int depth = stack.size();
        memos.keySet().removeIf(k -> k >= depth);
        Walker w = new Walker();
        Snap s = new Snap();
        Set<String> changed = new LinkedHashSet<>();

        for (int i = depth - 1; i >= 0; i--) { // bottom of the stack first
            StackFrame f = stack.get(i);
            Location loc = f.location();
            if (!isUserLocation(loc)) continue;
            Method m = loc.method();
            int slot = depth - 1 - i;
            FrameMemo memo = memos.get(slot);
            boolean fresh = memo == null || !memo.method.equals(m);
            if (fresh) {
                memo = new FrameMemo(m);
                memos.put(slot, memo);
            }
            Map<String, Object> locals = new LinkedHashMap<>();
            if (!m.isStatic()) {
                ObjectReference self = f.thisObject();
                if (self != null) locals.put("this", w.ref(self, null));
            }
            List<LocalVariable> vars = orderedLocals(f, m, memo);
            if (!vars.isEmpty()) {
                Map<LocalVariable, Value> vals = f.getValues(vars);
                for (LocalVariable lv : vars) {
                    if (hideArgs && lv.isArgument() && m.equals(mainMethod)) continue;
                    locals.put(lv.name(), w.value(vals.get(lv), parseSig(sigOf(lv))));
                }
            }
            if (!fresh) {
                for (var e : locals.entrySet()) {
                    if (!memo.last.containsKey(e.getKey()) || !Objects.equals(memo.last.get(e.getKey()), e.getValue())) changed.add(e.getKey());
                }
            }
            memo.last = locals;
            Map<String, Object> fj = new LinkedHashMap<>();
            fj.put("name", frameName(m));
            fj.put("line", loc.lineNumber());
            fj.put("locals", locals);
            s.frames.add(fj);
            s.line = loc.lineNumber();
        }
        if (includeStatics) w.statics();
        w.drain();
        s.heap = w.heap;
        s.truncated = w.truncated;
        s.stdout = stdout.text();

        Snap last = snaps.isEmpty() ? null : snaps.get(snaps.size() - 1);
        if (last != null) {
            // fields and array slots that changed, written as "o3.x" / "o4[0]" so they can't be confused with locals
            for (var e : s.heap.entrySet()) {
                Map<String, Object> before = last.heap.get(e.getKey());
                if (before == null) continue;
                Map<String, Object> now = e.getValue();
                if (before.get("fields") instanceof Map<?, ?> pf && now.get("fields") instanceof Map<?, ?> cf) {
                    for (Object k : cf.keySet()) if (pf.containsKey(k) && !Objects.equals(pf.get(k), cf.get(k))) changed.add(e.getKey() + "." + k);
                }
                if (!now.containsKey("summary") && before.get("items") instanceof List<?> pi && now.get("items") instanceof List<?> ci) {
                    for (int k = 0; k < Math.min(pi.size(), ci.size()); k++) if (!Objects.equals(pi.get(k), ci.get(k))) changed.add(e.getKey() + "[" + k + "]");
                }
            }
            if (!includeStatics) {
                List<String> gone = new ArrayList<>();
                for (String id : last.heap.keySet()) if (!s.heap.containsKey(id) && lifecycle.contains(id)) gone.add(id);
                if (!gone.isEmpty() && !s.truncated) {
                    Set<Long> held = staticReachable();
                    Set<String> heldIds = new HashSet<>();
                    for (String id : gone) if (held.contains(uids.get(id))) heldIds.add(id);
                    s.staticHeld = heldIds;
                }
            }
        }
        s.changed = new ArrayList<>(changed);
        s.ghosts = s.truncated ? Map.of() : ghosts(w, snaps.size());
        return s;
    }

    /**
     * objects that were reachable in one of the last few steps but aren't now. we read them again, live, so that
     * if they come back (or turn out to be garbage) the copy we show is their real current state, not a stale one.
     * (e.g. `p = new Point(1, 2)`: right after the constructor returns, the new Point is only on the operand stack.)
     */
    Map<String, Map<String, Object>> ghosts(Walker visible, int index) {
        List<String> missing = new ArrayList<>();
        for (var e : lastSeen.entrySet()) {
            if (index - e.getValue() <= GAP && !visible.heap.containsKey(e.getKey())) missing.add(e.getKey());
        }
        if (missing.isEmpty()) return Map.of();
        Walker g = new Walker();
        g.objs.putAll(visible.objs); // things already on screen don't get described twice
        for (String id : missing) {
            ObjectReference o = refs.get(id);
            try {
                if (o != null && !o.isCollected()) g.ref(o, null);
            } catch (ObjectCollectedException ignored) { }
        }
        g.drain();
        return g.heap;
    }

    /** visible locals, in declaration order (JDI hands them back in hash order, so we remember the order per frame). */
    List<LocalVariable> orderedLocals(StackFrame f, Method m, FrameMemo memo) {
        List<LocalVariable> vis;
        try {
            vis = f.visibleVariables();
        } catch (AbsentInformationException e) {
            return List.of();
        }
        Map<String, LocalVariable> byName = new HashMap<>();
        for (LocalVariable lv : vis) byName.put(lv.name(), lv);
        List<String> order = new ArrayList<>();
        for (String n : memo.order) if (byName.containsKey(n)) order.add(n);
        List<LocalVariable> fresh = new ArrayList<>();
        for (LocalVariable lv : vis) if (!order.contains(lv.name())) fresh.add(lv);
        fresh.sort(Comparator.comparingInt(lv -> rank(m, lv)));
        for (LocalVariable lv : fresh) order.add(lv.name());
        memo.order = order;
        List<LocalVariable> out = new ArrayList<>();
        for (String n : order) out.add(byName.get(n));
        return out;
    }

    static int rank(Method m, LocalVariable lv) {
        try {
            return lv.isArgument() ? m.arguments().indexOf(lv) : 1000 + m.variables().indexOf(lv);
        } catch (AbsentInformationException e) {
            return 0;
        }
    }

    static String sigOf(LocalVariable lv) { return lv.genericSignature() != null ? lv.genericSignature() : lv.signature(); }

    static String sigOf(Field f) { return f.genericSignature() != null ? f.genericSignature() : f.signature(); }

    String frameName(Method m) {
        if (m.isConstructor()) return "new " + typeLabel(m.declaringType());
        if (m.isStaticInitializer()) return typeLabel(m.declaringType()) + ".<clinit>";
        String n = m.name();
        if (n.startsWith("lambda$")) {
            String[] parts = n.split("\\$");
            return parts.length > 2 ? "lambda in " + parts[1] : "lambda";
        }
        return n;
    }

    /** objects reachable from static fields of your classes (by uniqueID). used so "dead" isn't claimed for them. */
    Set<Long> staticReachable() {
        Set<Long> seen = new HashSet<>();
        ArrayDeque<ObjectReference> q = new ArrayDeque<>();
        try {
            for (ReferenceType rt : loadedUserTypes()) {
                for (Field f : rt.fields()) {
                    if (f.isStatic() && rt.getValue(f) instanceof ObjectReference r && seen.add(r.uniqueID())) q.add(r);
                }
            }
            while (!q.isEmpty() && seen.size() < STATIC_SCAN_CAP) {
                ObjectReference o = q.poll();
                Collection<Value> kids;
                if (o instanceof StringReference) continue;
                if (o instanceof ArrayReference a) {
                    String comp = ((ArrayType) a.referenceType()).componentSignature();
                    if (!comp.startsWith("L") && !comp.startsWith("[")) continue;
                    kids = a.length() == 0 ? List.of() : a.getValues(0, Math.min(a.length(), 2000));
                } else {
                    List<Field> fs = new ArrayList<>();
                    for (Field f : o.referenceType().allFields()) if (!f.isStatic()) fs.add(f);
                    kids = o.getValues(fs).values();
                }
                for (Value v : kids) if (v instanceof ObjectReference r && seen.add(r.uniqueID())) q.add(r);
            }
        } catch (Exception e) {
            log("static scan failed: " + e);
        }
        return seen;
    }

    // ------------------------------------------------------------------ heap walking

    String idOf(ObjectReference o) {
        long uid = o.uniqueID();
        String id = ids.get(uid);
        if (id == null) {
            id = "o" + (ids.size() + 1);
            ids.put(uid, id);
            uids.put(id, uid);
            refs.put(id, o);
            if (lifecycleEligible(o)) lifecycle.add(id);
        }
        return id;
    }

    /** objects that can be "just allocated" or "now garbage". pooled / cached / singleton things can't. */
    boolean lifecycleEligible(ObjectReference o) {
        if (o instanceof ArrayReference) return true;
        if (o instanceof StringReference) return false;
        ReferenceType rt = o.referenceType();
        String cn = rt.name();
        if (isUserType(rt)) return enumOf(rt) == null;
        if (cn.startsWith("java.util.ImmutableCollections$") || cn.startsWith("java.util.Collections$Empty")) return false;
        return arity(cn) > 0 || cn.equals("java.lang.StringBuilder") || cn.equals("java.lang.StringBuffer") || cn.equals("java.lang.Object");
    }

    static Map<String, Object> refJson(String id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ref", id);
        return m;
    }

    final class Walker {
        final LinkedHashMap<String, Map<String, Object>> heap = new LinkedHashMap<>();
        final Map<String, ObjectReference> objs = new HashMap<>();
        final ArrayDeque<ObjectReference> queue = new ArrayDeque<>();
        int expanded = 0;
        boolean truncated;

        Object value(Value v, GT hint) {
            if (v == null) return null;
            if (v instanceof ObjectReference o) return ref(o, hint);
            return prim((PrimitiveValue) v);
        }

        Map<String, Object> ref(ObjectReference o, GT hint) {
            String id = idOf(o);
            if (hint != null) learnGeneric(o, hint);
            if (!objs.containsKey(id)) {
                objs.put(id, o);
                queue.add(o);
            }
            return refJson(id);
        }

        void drain() {
            while (!queue.isEmpty()) {
                ObjectReference o = queue.poll();
                Map<String, Object> j = new LinkedHashMap<>();
                j.put("type", "?"); // filled in below, once every generic hint for this step is known
                heap.put(idOf(o), j);
                boolean full = expanded < HEAP_CAP;
                if (full) expanded++;
                else truncated = true;
                try {
                    describe(o, j, full);
                } catch (ObjectCollectedException | VMDisconnectedException e) {
                    j.keySet().retainAll(Set.of("type"));
                    j.put("summary", true);
                }
            }
            for (var e : heap.entrySet()) {
                ObjectReference o = objs.get(e.getKey());
                if (o == null) continue;
                String type = label(o);
                e.getValue().put("type", type);
                typeById.put(e.getKey(), type);
            }
        }

        void statics() {
            for (ReferenceType rt : loadedUserTypes()) {
                List<Field> fs = new ArrayList<>();
                for (Field f : rt.fields()) if (f.isStatic() && !f.isSynthetic() && !f.isEnumConstant()) fs.add(f);
                if (fs.isEmpty()) continue;
                Map<Field, Value> vals = rt.getValues(fs);
                Map<String, Object> fields = new LinkedHashMap<>();
                for (Field f : fs) fields.put(f.name(), value(vals.get(f), parseSig(sigOf(f))));
                Map<String, Object> j = new LinkedHashMap<>();
                j.put("type", typeLabel(rt));
                j.put("fields", fields);
                j.put("tag", "static");
                heap.put("static:" + rt.name(), j);
            }
        }

        void describe(ObjectReference o, Map<String, Object> j, boolean full) {
            ReferenceType rt = o.referenceType();
            String cn = rt.name();
            if (o instanceof StringReference s) {
                j.put("value", quote(s.value()));
                return;
            }
            if (BOXES.contains(cn)) {
                j.put("value", boxText(o));
                return;
            }
            if (enumOf(rt) != null) {
                j.put("value", enumName(o));
                return;
            }
            if (!full) {
                j.put("summary", true);
                return;
            }
            if (o instanceof ArrayReference a) {
                List<Object> items = new ArrayList<>();
                int n = Math.min(a.length(), ITEM_CAP);
                if (n > 0) for (Value v : a.getValues(0, n)) items.add(value(v, null));
                if (a.length() > ITEM_CAP) items.add(MORE);
                j.put("items", items);
                return;
            }
            if (isUserType(rt) && rt instanceof ClassType ct) {
                j.put("fields", userFields(o, ct));
                return;
            }
            if (cn.equals("java.lang.StringBuilder") || cn.equals("java.lang.StringBuffer")) {
                j.put("value", quote(builderText(o)));
                return;
            }
            Coll c = readColl(o, cn);
            if (c != null) {
                long uid = o.uniqueID();
                if (c.entries != null) {
                    GT k = elemHint(uid, 0), v = elemHint(uid, 1);
                    List<Object> es = new ArrayList<>();
                    for (Value[] e : c.entries) es.add(Arrays.asList(value(e[0], k), value(e[1], v)));
                    if (c.more) es.add(Arrays.asList(MORE, MORE));
                    j.put("entries", es);
                } else {
                    GT h = elemHint(uid, 0);
                    List<Object> items = new ArrayList<>();
                    for (Value v : c.items) items.add(value(v, h));
                    if (c.more) items.add(MORE);
                    j.put("items", items);
                }
                j.put("summary", true);
                return;
            }
            if (cn.equals("java.lang.Object")) {
                j.put("fields", new LinkedHashMap<>());
                return;
            }
            j.put("summary", true);
        }

        Map<String, Object> userFields(ObjectReference o, ClassType ct) {
            List<ClassType> chain = new ArrayList<>();
            for (ClassType c = ct; c != null && isUserType(c); c = c.superclass()) chain.add(0, c);
            List<Field> fs = new ArrayList<>();
            for (ClassType c : chain) for (Field f : c.fields()) if (!f.isStatic() && !f.isSynthetic()) fs.add(f);
            Map<String, Object> fields = new LinkedHashMap<>();
            if (fs.isEmpty()) return fields;
            Map<Field, Value> vals = o.getValues(fs);
            for (Field f : fs) {
                String name = fields.containsKey(f.name()) ? typeLabel(f.declaringType()) + "." + f.name() : f.name();
                fields.put(name, value(vals.get(f), parseSig(sigOf(f))));
            }
            return fields;
        }
    }

    // ------------------------------------------------------------------ JDK collections, read from their insides (no code runs in the target)

    record Coll(List<Value> items, List<Value[]> entries, boolean more) { }

    static final Set<String> BOXES = Set.of("java.lang.Integer", "java.lang.Long", "java.lang.Double", "java.lang.Float",
            "java.lang.Short", "java.lang.Byte", "java.lang.Character", "java.lang.Boolean");

    static final Set<String> LISTS = Set.of("java.util.ArrayList", "java.util.LinkedList", "java.util.Vector", "java.util.Stack",
            "java.util.ArrayDeque", "java.util.PriorityQueue", "java.util.concurrent.CopyOnWriteArrayList", "java.util.Arrays$ArrayList",
            "java.util.ImmutableCollections$ListN", "java.util.ImmutableCollections$List12",
            "java.util.ImmutableCollections$SetN", "java.util.ImmutableCollections$Set12",
            "java.util.HashSet", "java.util.LinkedHashSet", "java.util.TreeSet",
            "java.util.Collections$EmptyList", "java.util.Collections$EmptySet");

    static final Set<String> MAPS = Set.of("java.util.HashMap", "java.util.LinkedHashMap", "java.util.TreeMap",
            "java.util.concurrent.ConcurrentHashMap", "java.util.ImmutableCollections$MapN", "java.util.ImmutableCollections$Map1",
            "java.util.Collections$EmptyMap");

    static int arity(String cn) {
        if (MAPS.contains(cn)) return 2;
        if (LISTS.contains(cn)) return 1;
        if (cn.startsWith("java.util.Collections$Unmodifiable")) return cn.endsWith("Map") ? 2 : 1;
        return 0;
    }

    Coll readColl(ObjectReference o, String cn) {
        switch (cn) {
            case "java.util.ArrayList": return fromArray(obj(o, "elementData"), num(o, "size"));
            case "java.util.Vector", "java.util.Stack": return fromArray(obj(o, "elementData"), num(o, "elementCount"));
            case "java.util.PriorityQueue": return fromArray(obj(o, "queue"), num(o, "size"));
            case "java.util.concurrent.CopyOnWriteArrayList": return fromArray(obj(o, "array"), -1);
            case "java.util.Arrays$ArrayList": return fromArray(obj(o, "a"), -1);
            case "java.util.ImmutableCollections$ListN": return fromArray(obj(o, "elements"), -1);
            case "java.util.ImmutableCollections$SetN": return fromSparse(obj(o, "elements"));
            case "java.util.ImmutableCollections$List12", "java.util.ImmutableCollections$Set12": {
                List<Value> l = new ArrayList<>();
                l.add(get(o, "e0"));
                Value e1 = get(o, "e1");
                if (e1 != null && !e1.equals(emptySentinel())) l.add(e1);
                return new Coll(l, null, false);
            }
            case "java.util.LinkedList": {
                List<Value> l = new ArrayList<>();
                for (ObjectReference n = obj(o, "first"); n != null && l.size() <= ITEM_CAP; n = obj(n, "next")) l.add(get(n, "item"));
                return capped(l);
            }
            case "java.util.ArrayDeque": {
                ObjectReference arr = obj(o, "elements");
                if (!(arr instanceof ArrayReference a) || a.length() == 0) return new Coll(List.of(), null, false);
                List<Value> all = a.getValues();
                List<Value> l = new ArrayList<>();
                int n = a.length();
                for (int i = num(o, "head"), tail = num(o, "tail"); i != tail && l.size() <= ITEM_CAP; i = (i + 1) % n) l.add(all.get(i));
                return capped(l);
            }
            case "java.util.HashSet", "java.util.LinkedHashSet": return keysOf(mapColl(obj(o, "map")));
            case "java.util.TreeSet": return keysOf(mapColl(obj(o, "m")));
            case "java.util.Collections$EmptyList", "java.util.Collections$EmptySet": return new Coll(List.of(), null, false);
            default:
                if (cn.startsWith("java.util.Collections$Unmodifiable")) {
                    ObjectReference inner = obj(o, cn.endsWith("Map") ? "m" : "c");
                    return inner == null ? null : readColl(inner, inner.referenceType().name());
                }
                return mapColl(o);
        }
    }

    Coll mapColl(ObjectReference m) {
        if (m == null) return null;
        List<Value[]> out = new ArrayList<>();
        switch (m.referenceType().name()) {
            case "java.util.HashMap": return hashTable(obj(m, "table"), "value");
            case "java.util.concurrent.ConcurrentHashMap": return hashTable(obj(m, "table"), "val");
            case "java.util.LinkedHashMap":
                for (ObjectReference n = obj(m, "head"); n != null && out.size() <= ITEM_CAP; n = obj(n, "after")) {
                    out.add(new Value[]{get(n, "key"), get(n, "value")});
                }
                return cappedEntries(out);
            case "java.util.TreeMap": {
                Deque<ObjectReference> st = new ArrayDeque<>();
                ObjectReference cur = obj(m, "root");
                while ((cur != null || !st.isEmpty()) && out.size() <= ITEM_CAP) {
                    while (cur != null) { st.push(cur); cur = obj(cur, "left"); }
                    cur = st.pop();
                    out.add(new Value[]{get(cur, "key"), get(cur, "value")});
                    cur = obj(cur, "right");
                }
                return cappedEntries(out);
            }
            case "java.util.ImmutableCollections$MapN": {
                if (obj(m, "table") instanceof ArrayReference a && a.length() > 0) {
                    List<Value> t = a.getValues();
                    for (int i = 0; i + 1 < t.size() && out.size() <= ITEM_CAP; i += 2) if (t.get(i) != null) out.add(new Value[]{t.get(i), t.get(i + 1)});
                }
                return cappedEntries(out);
            }
            case "java.util.ImmutableCollections$Map1":
                out.add(new Value[]{get(m, "k0"), get(m, "v0")});
                return cappedEntries(out);
            case "java.util.Collections$EmptyMap":
                return cappedEntries(out);
            default:
                return null;
        }
    }

    Coll hashTable(ObjectReference table, String valueField) {
        List<Value[]> out = new ArrayList<>();
        if (table instanceof ArrayReference arr && arr.length() > 0) {
            for (Value b : arr.getValues()) {
                ObjectReference node = (ObjectReference) b;
                if (node != null && node.referenceType().name().endsWith("$TreeBin")) node = obj(node, "first"); // treeified ConcurrentHashMap bin
                for (; node != null; node = obj(node, "next")) {
                    String nn = node.referenceType().name();
                    if (nn.endsWith("$ForwardingNode") || nn.endsWith("$ReservationNode")) break;
                    if (out.size() > ITEM_CAP) return cappedEntries(out);
                    out.add(new Value[]{get(node, "key"), get(node, valueField)});
                }
            }
        }
        return cappedEntries(out);
    }

    static Coll keysOf(Coll map) {
        if (map == null || map.entries == null) return null;
        List<Value> keys = new ArrayList<>();
        for (Value[] e : map.entries) keys.add(e[0]);
        return new Coll(keys, null, map.more);
    }

    static Coll fromArray(ObjectReference arr, int size) {
        if (!(arr instanceof ArrayReference a)) return new Coll(List.of(), null, false);
        int len = size < 0 ? a.length() : Math.min(size, a.length());
        int n = Math.min(len, ITEM_CAP);
        return new Coll(n == 0 ? List.of() : a.getValues(0, n), null, len > ITEM_CAP);
    }

    static Coll fromSparse(ObjectReference arr) {
        List<Value> l = new ArrayList<>();
        if (arr instanceof ArrayReference a && a.length() > 0) for (Value v : a.getValues()) if (v != null && l.size() <= ITEM_CAP) l.add(v);
        return capped(l);
    }

    static Coll capped(List<Value> l) {
        boolean more = l.size() > ITEM_CAP;
        return new Coll(more ? l.subList(0, ITEM_CAP) : l, null, more);
    }

    static Coll cappedEntries(List<Value[]> l) {
        boolean more = l.size() > ITEM_CAP;
        return new Coll(null, more ? l.subList(0, ITEM_CAP) : l, more);
    }

    Value emptySentinel() {
        if (!emptySentinelLooked) {
            emptySentinelLooked = true;
            ClassType ic = classType("java.util.ImmutableCollections");
            Field f = ic == null ? null : findField(ic, "EMPTY");
            if (f != null) emptySentinel = ic.getValue(f);
        }
        return emptySentinel;
    }

    Field findField(ReferenceType rt, String name) {
        return fieldCache.computeIfAbsent(rt, k -> new HashMap<>()).computeIfAbsent(name, n -> {
            if (rt instanceof ClassType ct) {
                for (ClassType c = ct; c != null; c = c.superclass()) for (Field f : c.fields()) if (f.name().equals(n)) return f;
                return null;
            }
            return rt.fieldByName(n);
        });
    }

    Value get(ObjectReference o, String field) {
        if (o == null) return null;
        Field f = findField(o.referenceType(), field);
        return f == null ? null : o.getValue(f);
    }

    ObjectReference obj(ObjectReference o, String field) {
        return get(o, field) instanceof ObjectReference r ? r : null;
    }

    int num(ObjectReference o, String field) {
        return get(o, field) instanceof PrimitiveValue p ? p.intValue() : 0;
    }

    String boxText(ObjectReference o) {
        Value v = get(o, "value");
        if (v instanceof CharValue c) return charLit(c.value());
        if (v instanceof DoubleValue d) return Double.toString(d.value());
        if (v instanceof FloatValue f) return Float.toString(f.value());
        return String.valueOf(v); // Integer, Long, Short, Byte, Boolean: PrimitiveValue.toString is the plain value
    }

    String enumName(ObjectReference o) {
        ClassType e = classType("java.lang.Enum");
        Value v = e == null ? null : o.getValue(findField(e, "name"));
        return v instanceof StringReference s ? s.value() : "?";
    }

    static ClassType enumOf(ReferenceType rt) {
        if (!(rt instanceof ClassType ct)) return null;
        if (ct.isEnum()) return ct;
        ClassType sup = ct.superclass(); // constants with a body are anonymous subclasses of the enum
        return sup != null && sup.isEnum() ? sup : null;
    }

    String builderText(ObjectReference o) {
        if (!(obj(o, "value") instanceof ArrayReference arr)) return "";
        int count = num(o, "count");
        int n = Math.min(count, STRING_CAP + 1);
        boolean utf16 = num(o, "coder") != 0;
        int bytes = Math.min(utf16 ? n * 2 : n, arr.length());
        if (bytes == 0) return "";
        List<Value> vs = arr.getValues(0, bytes);
        StringBuilder sb = new StringBuilder();
        boolean little = ByteOrder.nativeOrder() == ByteOrder.LITTLE_ENDIAN; // the target runs on this machine
        for (int i = 0; i < vs.size(); i += utf16 ? 2 : 1) {
            int b0 = ((ByteValue) vs.get(i)).value() & 0xff;
            if (!utf16) { sb.append((char) b0); continue; }
            if (i + 1 >= vs.size()) break;
            int b1 = ((ByteValue) vs.get(i + 1)).value() & 0xff;
            sb.append((char) (little ? (b1 << 8) | b0 : (b0 << 8) | b1));
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ formatting values

    /** for a raw json number (so 0.1 stays 0.1, not 0.10000000149011612) */
    record Raw(String text) { }

    static Object prim(PrimitiveValue p) {
        if (p instanceof BooleanValue b) return b.value();
        if (p instanceof CharValue c) return charLit(c.value());
        if (p instanceof LongValue l) {
            long v = l.value();
            return v >= -MAX_SAFE && v <= MAX_SAFE ? (Object) v : v + "L";
        }
        if (p instanceof DoubleValue d) {
            double v = d.value();
            // whole doubles stay strings ("2.0") so the reader can still see it's a double, not an int
            if (Double.isNaN(v) || Double.isInfinite(v) || v == Math.rint(v)) return Double.toString(v);
            return new Raw(Double.toString(v));
        }
        if (p instanceof FloatValue f) {
            float v = f.value();
            if (Float.isNaN(v) || Float.isInfinite(v) || v == Math.rint(v)) return Float.toString(v) + "f";
            return new Raw(Float.toString(v));
        }
        return (long) p.intValue(); // byte, short, int
    }

    static String charLit(char c) {
        return switch (c) {
            case '\n' -> "'\\n'";
            case '\t' -> "'\\t'";
            case '\r' -> "'\\r'";
            case '\b' -> "'\\b'";
            case '\f' -> "'\\f'";
            case '\'' -> "'\\''";
            case '\\' -> "'\\\\'";
            default -> c < 0x20 || (c >= 0x7f && c < 0xa0) || Character.isSurrogate(c)
                    ? String.format("'\\u%04x'", (int) c) : "'" + c + "'";
        };
    }

    /** a java string literal, as you'd type it: "hi\n" */
    static String quote(String s) {
        boolean cut = s.length() > STRING_CAP;
        if (cut) s = s.substring(0, STRING_CAP);
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\t' -> sb.append("\\t");
                case '\r' -> sb.append("\\r");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < 0x20 || (c >= 0x7f && c < 0xa0)) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        if (cut) sb.append(MORE);
        return sb.append('"').toString();
    }

    /** a return value, for notes like "factorial returned 6" */
    String noteValue(Value v) {
        if (v == null) return "null";
        if (v instanceof StringReference s) return quote(s.value());
        if (v instanceof PrimitiveValue p) {
            Object o = prim(p);
            return o instanceof Raw r ? r.text() : String.valueOf(o);
        }
        if (!(v instanceof ObjectReference o)) return String.valueOf(v);
        ReferenceType rt = o.referenceType();
        if (BOXES.contains(rt.name())) return boxText(o);
        if (enumOf(rt) != null) return enumName(o);
        String label = label(o);
        return ("aeiouAEIOU".indexOf(label.charAt(0)) >= 0 ? "an " : "a ") + label;
    }

    // ------------------------------------------------------------------ type labels

    String label(ObjectReference o) {
        ReferenceType rt = o.referenceType();
        String base;
        if (rt instanceof ArrayType) base = typeName(rt.name());
        else if (rt.name().contains("$$Lambda")) base = lambdaLabel(rt);
        else {
            ClassType en = enumOf(rt);
            base = typeLabel(en != null ? en : rt);
        }
        GT g = generic.get(o.uniqueID());
        if (g != null && !g.args.isEmpty()) base += "<" + String.join(", ", g.args.stream().map(this::show).toList()) + ">";
        return base;
    }

    String typeLabel(ReferenceType rt) {
        if (isUserType(rt) || userClasses.contains(rt.name())) {
            String simple = userSimple(rt.name());
            if (!simple.isEmpty()) return simple;
            String sup = anonymousOf(rt);
            return sup == null ? afterDot(rt.name()) : "anonymous " + sup;
        }
        return jdkSimple(rt.name());
    }

    String anonymousOf(ReferenceType rt) {
        if (rt instanceof ClassType ct) {
            if (!ct.interfaces().isEmpty()) return typeName(ct.interfaces().get(0).name());
            if (ct.superclass() != null && !ct.superclass().name().equals("java.lang.Object")) return typeName(ct.superclass().name());
        }
        return null;
    }

    String lambdaLabel(ReferenceType rt) {
        if (rt instanceof ClassType ct && !ct.interfaces().isEmpty()) return typeName(ct.interfaces().get(0).name()) + " (lambda)";
        return "lambda";
    }

    /** a binary name (maybe an array, maybe a primitive) as you'd write it: String[], Point, Map.Entry, int */
    String typeName(String binary) {
        int b = binary.indexOf('[');
        String dims = b < 0 ? "" : binary.substring(b);
        String base = b < 0 ? binary : binary.substring(0, b);
        String shown;
        if (!base.contains(".") && Character.isLowerCase(base.isEmpty() ? 'A' : base.charAt(0)) && !userClasses.contains(base)) shown = base; // int, double...
        else if (userClasses.contains(base)) {
            String s = userSimple(base);
            shown = s.isEmpty() ? afterDot(base) : s;
        } else shown = jdkSimple(base);
        return shown + dims;
    }

    static String afterDot(String n) {
        return n.substring(n.lastIndexOf('.') + 1);
    }

    /** Main$Point -> Point, Main$1Local -> Local, Main$1 -> "" (anonymous) */
    static String userSimple(String binary) {
        String s = afterDot(binary);
        return s.substring(s.lastIndexOf('$') + 1).replaceFirst("^[0-9]+", "");
    }

    /** java.util.HashMap -> HashMap, java.util.Map$Entry -> Map.Entry, hidden classes lose their /0x... suffix */
    static String jdkSimple(String binary) {
        String s = afterDot(binary);
        int slash = s.indexOf('/');
        if (slash >= 0) s = s.substring(0, slash);
        return s.replace('$', '.');
    }

    // ------------------------------------------------------------------ generics, from local / field signatures

    /** a parsed generic signature like List<String>, from the LocalVariableTypeTable or a field's Signature attribute */
    record GT(String name, List<GT> args, String wildcard, boolean typeVar) {
        boolean concrete() {
            if (typeVar || wildcard != null) return false;
            for (GT a : args) if (!a.concrete()) return false;
            return true;
        }
    }

    static GT parseSig(String sig) {
        if (sig == null || sig.isEmpty()) return null;
        try {
            return new SigParser(sig).type();
        } catch (RuntimeException e) {
            return null;
        }
    }

    static final class SigParser {
        final String s;
        int i;

        SigParser(String s) { this.s = s; }

        GT type() {
            char c = s.charAt(i++);
            switch (c) {
                case 'L': return classType();
                case '[': {
                    GT t = type();
                    return new GT(t.name + "[]", List.of(), null, t.typeVar);
                }
                case 'T': {
                    int semi = s.indexOf(';', i);
                    String n = s.substring(i, semi);
                    i = semi + 1;
                    return new GT(n, List.of(), null, true);
                }
                case '*': return new GT("", List.of(), "?", false);
                case '+': { GT b = type(); return new GT(b.name, b.args, "? extends ", b.typeVar); }
                case '-': { GT b = type(); return new GT(b.name, b.args, "? super ", b.typeVar); }
                default: return new GT(switch (c) {
                    case 'Z' -> "boolean"; case 'B' -> "byte"; case 'C' -> "char"; case 'S' -> "short";
                    case 'I' -> "int"; case 'J' -> "long"; case 'F' -> "float"; case 'D' -> "double";
                    default -> "void";
                }, List.of(), null, false);
            }
        }

        GT classType() {
            StringBuilder name = new StringBuilder();
            List<GT> args = List.of();
            while (true) {
                char c = s.charAt(i++);
                if (c == ';') break;
                if (c == '<') {
                    args = new ArrayList<>();
                    while (s.charAt(i) != '>') args.add(type());
                    i++;
                } else if (c == '.') {
                    name.append('$');
                    args = List.of();
                } else {
                    name.append(c == '/' ? '.' : c);
                }
            }
            return new GT(name.toString(), args, null, false);
        }
    }

    String show(GT g) {
        if ("?".equals(g.wildcard)) return "?";
        String base = g.typeVar ? g.name : typeName(g.name);
        if (!g.args.isEmpty()) base += "<" + String.join(", ", g.args.stream().map(this::show).toList()) + ">";
        return g.wildcard == null ? base : g.wildcard + base;
    }

    /** remember List<String> for an ArrayList the program declared that way, so the label says ArrayList<String> */
    void learnGeneric(ObjectReference o, GT h) {
        if (h.args.isEmpty() || !h.concrete()) return;
        long uid = o.uniqueID();
        if (generic.containsKey(uid)) return;
        String rn = o.referenceType().name();
        int ar = arity(rn);
        boolean ok = ar > 0
                ? h.args.size() == ar && (h.name.startsWith("java.util.") || h.name.equals("java.lang.Iterable"))
                : h.name.equals(rn);
        if (ok) generic.put(uid, h);
    }

    GT elemHint(long uid, int idx) {
        GT g = generic.get(uid);
        return g != null && g.args.size() > idx ? g.args.get(idx) : null;
    }

    // ------------------------------------------------------------------ after the run: "new" / "dead" states, then json

    Map<String, Object> buildTrace(String source) {
        lifecyclePass();
        List<Object> steps = new ArrayList<>();
        for (Snap s : snaps) steps.add(s.json());
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("file", file.getFileName().toString());
        root.put("source", source);
        root.put("steps", steps);
        return root;
    }

    /**
     * "new": the first step an object shows up in.
     * "dead": it was there last step, it's gone now, it never comes back, and no static field holds it.
     *         dead objects are kept for exactly one step so the diagram can show them going grey/red.
     * gaps: an object that drops out for a step or two and then comes back (a value that only lived on the
     *       operand stack, like a freshly built object on its way back from a constructor) is carried through
     *       the gap unchanged, so it doesn't blink out and back in.
     */
    void lifecyclePass() {
        int n = snaps.size();
        Map<String, Integer> first = new HashMap<>(), last = new HashMap<>();
        Map<String, TreeSet<Integer>> seenAt = new HashMap<>();
        for (int i = 0; i < n; i++) {
            for (String id : snaps.get(i).heap.keySet()) {
                first.putIfAbsent(id, i);
                last.put(id, i);
                seenAt.computeIfAbsent(id, k -> new TreeSet<>()).add(i);
            }
        }
        for (int i = 1; i < n; i++) {
            Snap s = snaps.get(i);
            if (s.isFinal || s.truncated) continue;
            Map<String, Map<String, Object>> prev = snaps.get(i - 1).heap; // includes anything carried into i-1
            for (String id : new ArrayList<>(prev.keySet())) {
                if (s.heap.containsKey(id) || "dead".equals(prev.get(id).get("state"))) continue;
                Integer back = seenAt.containsKey(id) ? seenAt.get(id).higher(i) : null;
                if (isDead(id, i, s, last) || (back != null && back - i <= GAP)) bury(s, prev, id, i, last);
            }
        }
        for (int i = 0; i < n; i++) {
            for (var e : snaps.get(i).heap.entrySet()) {
                if (Integer.valueOf(i).equals(first.get(e.getKey())) && lifecycle.contains(e.getKey()) && !e.getValue().containsKey("state")) {
                    e.getValue().put("state", "new");
                }
            }
        }
        // safety net: every {ref} must point at something in the same step's heap
        for (int i = 0; i < n; i++) {
            Snap s = snaps.get(i);
            List<String> want = new ArrayList<>();
            for (Object f : s.frames) collectRefs(f, want);
            for (Map<String, Object> o : List.copyOf(s.heap.values())) want.addAll(refsIn(o));
            for (String id : want) {
                if (s.heap.containsKey(id)) continue;
                log("bug: step " + i + " points at " + id + " but it isn't in the heap, adding a stub");
                Map<String, Object> stub = new LinkedHashMap<>();
                stub.put("type", typeById.getOrDefault(id, "Object"));
                stub.put("summary", true);
                s.heap.put(id, stub);
            }
        }
    }

    boolean isDead(String id, int i, Snap s, Map<String, Integer> last) {
        return lifecycle.contains(id) && last.getOrDefault(id, -1) < i && !s.staticHeld.contains(id);
    }

    /**
     * put an object that left the picture back into step i: marked "dead" if it's garbage now, plain if it's just
     * in a gap. uses the live re-read from that step when there is one, else the previous step's copy.
     */
    void bury(Snap s, Map<String, Map<String, Object>> prev, String id, int i, Map<String, Integer> last) {
        Map<String, Object> src = s.ghosts.containsKey(id) ? s.ghosts.get(id) : prev.get(id);
        if (src == null) return;
        Map<String, Object> copy = new LinkedHashMap<>(src);
        copy.remove("state");
        if (isDead(id, i, s, last)) copy.put("state", "dead");
        s.heap.put(id, copy);
        for (String child : refsIn(copy)) {
            if (!s.heap.containsKey(child)) bury(s, prev, child, i, last); // keep every arrow pointing at something
        }
    }

    /** ids a heap object points at (through fields, items or entries) */
    static List<String> refsIn(Map<String, Object> obj) {
        List<String> out = new ArrayList<>();
        if (obj.get("fields") instanceof Map<?, ?> f) for (Object v : f.values()) refOf(v, out);
        if (obj.get("items") instanceof List<?> l) for (Object v : l) refOf(v, out);
        if (obj.get("entries") instanceof List<?> l) for (Object pair : l) if (pair instanceof List<?> kv) for (Object v : kv) refOf(v, out);
        return out;
    }

    /** ids a frame's locals point at */
    static void collectRefs(Object frame, List<String> out) {
        if (frame instanceof Map<?, ?> f && f.get("locals") instanceof Map<?, ?> locals) for (Object v : locals.values()) refOf(v, out);
    }

    static void refOf(Object value, List<String> out) {
        if (value instanceof Map<?, ?> m && m.get("ref") instanceof String id) out.add(id);
    }

    // ------------------------------------------------------------------ the target's stdout

    /**
     * reads the target's stdout without ever blocking inside read() (only reads what available() says is there),
     * so when a step event arrives we can grab "everything printed so far" exactly: the target is suspended,
     * its write() already happened, so the bytes are sitting in the pipe.
     */
    static final class Pump extends Thread {
        private final InputStream in;
        private final ByteArrayOutputStream buf = new ByteArrayOutputStream();
        private final Object lock = new Object();
        private volatile boolean done;

        Pump(InputStream in) {
            super("stdout-pump");
            this.in = in;
            setDaemon(true);
        }

        @Override
        public void run() {
            while (!done) {
                synchronized (lock) { pull(); }
                try { Thread.sleep(2); } catch (InterruptedException e) { return; }
            }
        }

        private void pull() {
            byte[] b = new byte[8192];
            try {
                int n;
                while ((n = in.available()) > 0) {
                    int r = in.read(b, 0, Math.min(n, b.length));
                    if (r < 0) return;
                    buf.write(b, 0, r);
                }
            } catch (IOException e) {
                done = true;
            }
        }

        String text() {
            synchronized (lock) {
                pull();
                return buf.toString(StandardCharsets.UTF_8);
            }
        }

        /** call once the process has exited: read to EOF */
        String finish() {
            done = true;
            synchronized (lock) {
                try { in.transferTo(buf); } catch (IOException ignored) { }
                return buf.toString(StandardCharsets.UTF_8);
            }
        }
    }

    // ------------------------------------------------------------------ json out

    static final class Json {
        static final int WIDTH = 100;

        static String pretty(Object v) {
            StringBuilder sb = new StringBuilder();
            write(sb, v, 0);
            return sb.toString();
        }

        /** pretty-print, but keep anything that fits on one line on one line */
        static void write(StringBuilder sb, Object v, int indent) {
            boolean container = (v instanceof Map<?, ?> m && !m.isEmpty()) || (v instanceof List<?> l && !l.isEmpty());
            if (container) {
                StringBuilder flat = new StringBuilder();
                if (compact(flat, v, WIDTH - indent)) {
                    sb.append(flat);
                    return;
                }
            } else {
                compact(sb, v, Integer.MAX_VALUE);
                return;
            }
            String pad = " ".repeat(indent + 2);
            if (v instanceof Map<?, ?> m) {
                sb.append("{\n");
                int k = 0;
                for (var e : m.entrySet()) {
                    sb.append(pad);
                    str(sb, String.valueOf(e.getKey()));
                    sb.append(": ");
                    write(sb, e.getValue(), indent + 2);
                    sb.append(++k < m.size() ? ",\n" : "\n");
                }
                sb.append(" ".repeat(indent)).append('}');
            } else {
                List<?> l = (List<?>) v;
                sb.append("[\n");
                for (int k = 0; k < l.size(); k++) {
                    sb.append(pad);
                    write(sb, l.get(k), indent + 2);
                    sb.append(k + 1 < l.size() ? ",\n" : "\n");
                }
                sb.append(" ".repeat(indent)).append(']');
            }
        }

        /** single-line json; returns false (and stops early) if it would be longer than limit */
        static boolean compact(StringBuilder sb, Object v, int limit) {
            int start = sb.length();
            if (v == null) sb.append("null");
            else if (v instanceof String s) str(sb, s);
            else if (v instanceof Raw r) sb.append(r.text());
            else if (v instanceof Number || v instanceof Boolean) sb.append(v);
            else if (v instanceof Map<?, ?> m) {
                sb.append('{');
                int k = 0;
                for (var e : m.entrySet()) {
                    if (k++ > 0) sb.append(", ");
                    str(sb, String.valueOf(e.getKey()));
                    sb.append(": ");
                    if (!compact(sb, e.getValue(), limit - (sb.length() - start))) return false;
                    if (sb.length() - start > limit) return false;
                }
                sb.append('}');
            } else if (v instanceof List<?> l) {
                sb.append('[');
                int k = 0;
                for (Object x : l) {
                    if (k++ > 0) sb.append(", ");
                    if (!compact(sb, x, limit - (sb.length() - start))) return false;
                    if (sb.length() - start > limit) return false;
                }
                sb.append(']');
            } else str(sb, String.valueOf(v));
            return sb.length() - start <= limit;
        }

        static void str(StringBuilder sb, String s) {
            sb.append('"');
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch (c) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    case '\n' -> sb.append("\\n");
                    case '\r' -> sb.append("\\r");
                    case '\t' -> sb.append("\\t");
                    case '\b' -> sb.append("\\b");
                    case '\f' -> sb.append("\\f");
                    default -> {
                        if (c < 0x20 || c == 0x2028 || c == 0x2029) sb.append(String.format("\\u%04x", (int) c));
                        else sb.append(c);
                    }
                }
            }
            sb.append('"');
        }
    }
}
