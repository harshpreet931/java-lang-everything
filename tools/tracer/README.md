# tracer

runs a java program under the debugger and writes down what memory looks like at every line. the output is the `Trace` json from `src/lib/trace.ts`, the thing `<MemoryStepper>` draws.

real execution, not hand-made data. if the diagram says `a` and `b` point at the same `String`, it's because the JVM said so.

## usage

```sh
JAVA_HOME=/path/to/jdk tools/tracer/trace.sh path/to/Main.java --hide-args > Main.trace.json
```

- `--max-steps N`: stop after N steps (default 300). the last step gets a note saying it stopped
- `--include-statics`: also show static fields of your classes, one heap box per class (id `static:Main`, tag `static`)
- `--hide-args`: don't show main's `String[] args`. you almost always want this for the site
- `--timeout SECONDS`: give up after this long (default 30)

needs a JDK 21+ (tested on 25). no build step: `trace.sh` runs `Tracer.java` with the source launcher (`java --add-modules jdk.jdi Tracer.java ...`), which compiles it in memory. a run takes about a second.

regenerate the examples:

```sh
for f in tools/tracer/examples/*.java; do tools/tracer/trace.sh "$f" --hide-args > "${f%.java}.trace.json"; done
```

## how it works

`javac -g` into a temp dir (so local names survive) → launch under JDI → stop at the first line of `main` → step line by line (`STEP_LINE` + `STEP_INTO`, JDK packages filtered out) → at every new line in your code, read every frame of yours, its locals, and walk the heap from there.

collections are read from their insides (`elementData`, `table`, `head`...), so no code runs inside your program while it's being traced.

## what you get

- **frames**: only your code, bottom first. constructors show as `new Point`, lambdas as `lambda in main`. instance methods get `this` as the first local
- **locals**: declaration order. ints are numbers, `char` is `"'a'"`, a `long` too big for js is `"9007199254740993L"`. doubles are numbers, but whole ones stay strings (`"2.0"`) so you can still tell a double from an int. same for floats (`"3.0f"`)
- **ids**: `o1`, `o2`... in order of first appearance, stable for the whole trace. same object, same id
- **strings**: `value: "\"hi\""`. literals are interned, so two `"hi"` literals share an id and `new String("hi")` doesn't
- **boxed**: `value: "42"`. small `Integer`s are cached, so you'll see them shared too (that's real)
- **arrays**: `items`, 32 max, then a `"…"`
- **your classes and records**: `fields` in declaration order, inherited ones first. enums: `value: "RED"`
- **collections**: `ArrayList`, `LinkedList`, `ArrayDeque`, `PriorityQueue`, `Stack`, `HashSet`, `LinkedHashSet`, `TreeSet`, `List.of`, `Set.of`, `Arrays.asList` → `items`. `HashMap`, `LinkedHashMap`, `TreeMap`, `ConcurrentHashMap`, `Map.of` → `entries`. both in real iteration order, with `summary: true`
- **generics**: taken from the declaration, so `List<String> names = new ArrayList<>()` is labeled `ArrayList<String>`
- **everything else**: `StringBuilder` gets a `value`, lambdas are `Runnable (lambda)`, other JDK objects are `{ type, summary: true }`
- **cap**: 60 expanded objects per step (BFS from the stack), the rest are stubs
- **state**: `"new"` on the step an object first shows up. `"dead"` for one step when it turns into garbage (unreachable from every frame and every static field), then it's gone
- **changed**: locals that changed since the last step (`"count"`), plus fields and array slots as `"o3.x"` and `"o4[0]"` so they can't be mixed up with locals
- **notes**: `"factorial returned 6"` after a return. `"exception: java.lang.ArithmeticException: / by zero"` on an uncaught exception, which ends the trace. otherwise the trace ends with an empty stack, empty heap, full stdout and `"main returned, program ends"`
- **stdout**: cumulative, and on the right step even for `print()` without a newline (the tracer swaps `System.out` for an unbuffered one before main starts)

loops written on one line (`for (...) sum += i;`) still get a step per iteration. plain `STEP_LINE` would run them in one go, so the tracer also breakpoints the spots on the current line that a loop jumps back to.

## limitations

- one file, one thread. other threads run and their output shows up, but you don't see their frames
- tracing starts at the first line of `main`, so the main class's static initializers already ran
- stdin is closed. `Scanner` gets a `NoSuchElementException`, nothing hangs
- after a call returns you get one more step on the calling line (callee popped, line not finished yet). that's where return notes go
- an object that's only on the operand stack for a moment (between `new` and the assignment) is carried over from the previous step so it doesn't blink out. for that step nothing points at it
- steps are per line. a variable whose scope ends on the line it's assigned on (the only statement in a loop body) is never seen holding its value
- strings and boxed values never get `"dead"`. they might be pooled or cached and we can't tell cheaply
- `Set.of` / `Map.of` order is randomized per JVM run (that's java, not us), so traces using them can differ between runs. everything else is byte-for-byte reproducible
- deep or infinite recursion stops at `--max-steps`, an endless `Thread.sleep` stops at `--timeout`
