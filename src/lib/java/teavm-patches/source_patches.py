# source patches for TeaVM 0.16.0 classlib files whose member list matches the snapshot that the
# teavm-javac playground build (teavm.org/playground/3/) was made from. every anchor must match
# exactly once, so a changed upstream file fails loudly instead of being patched wrong.
# usage: source_patches.py <dir with org/teavm/classlib/...>
import os
import sys

MARK = 'java.lang.everything patch'


def patch(root, rel, pairs):
    p = os.path.join(root, rel)
    with open(p) as f:
        s = f.read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'{rel}: anchor found {n} times: {old[:70]!r}')
        s = s.replace(old, new)
    with open(p, 'w') as f:
        f.write(s)
    print('patched', rel)


def main(root):
    # 1. DecimalFormatSymbols.clone() went through Object.clone(), which on TeaVM 0.16 WasmGC returns an
    #    object whose fields trap when read. DecimalFormat clones its symbols, so every %f died with a NPE.
    patch(root, 'org/teavm/classlib/java/text/TDecimalFormatSymbols.java', [(
        '''    public Object clone() {
        try {
            return super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError("This exception should not been thrown", e);
        }
    }''',
        f'''    public Object clone() {{
        // {MARK}: Object.clone() is broken for this class on WasmGC, copy the fields by hand
        TDecimalFormatSymbols copy = new TDecimalFormatSymbols(locale);
        copy.zeroDigit = zeroDigit;
        copy.groupingSeparator = groupingSeparator;
        copy.decimalSeparator = decimalSeparator;
        copy.perMill = perMill;
        copy.percent = percent;
        copy.digit = digit;
        copy.patternSeparator = patternSeparator;
        copy.nan = nan;
        copy.infinity = infinity;
        copy.minusSign = minusSign;
        copy.monetaryDecimalSeparator = monetaryDecimalSeparator;
        copy.exponentSeparator = exponentSeparator;
        return copy;
    }}''')])

    # 2. Formatter: support %n, stop %% from eating an argument, and round %f half up like the JDK does
    patch(root, 'org/teavm/classlib/java/util/TFormatter.java', [
        ('''                formatSpecifierStart = index;
                char specifier = parseFormatSpecifier();
                configureFormat();
                formatValue(specifier);''',
         f'''                formatSpecifierStart = index;
                char specifier = parseFormatSpecifier();
                // {MARK}: %n is a line break, and neither %n nor %% consume an argument
                if (specifier == 'n') {{
                    out.append("\\n");
                    continue;
                }}
                if (specifier == '%') {{
                    out.append("%");
                    continue;
                }}
                configureFormat();
                formatValue(specifier);'''),
        ('''            format.setMaximumFractionDigits(precision);
            format.setMinimumFractionDigits(precision);''',
         f'''            format.setMaximumFractionDigits(precision);
            format.setMinimumFractionDigits(precision);
            // {MARK}: java.util.Formatter rounds HALF_UP (DecimalFormat defaults to HALF_EVEN)
            format.setRoundingMode(java.math.RoundingMode.HALF_UP);'''),
    ])

    # 3. Thread: join() could wait forever on a thread that had already finished (alive was cleared after
    #    notifyAll and checked outside the lock), unnamed threads were called null, join() before start() hung.
    patch(root, 'org/teavm/classlib/java/lang/TThread.java', [
        ('''    private static TThread mainThread = new TThread("main");''',
         f'''    // {MARK}: thread numbering + a main thread that is alive
    private static int nextThreadNumber;
    private static TThread mainThread = createMainThread();

    private static TThread createMainThread() {{
        TThread thread = new TThread("main");
        thread.alive = true;
        return thread;
    }}'''),
        ('''    private boolean alive = true;''',
         '''    private boolean alive;'''),
        ('''    public TThread(TRunnable target, String name) {
        this.name = name;''',
         f'''    public TThread(TRunnable target, String name) {{
        // {MARK}: unnamed threads are "Thread-0", "Thread-1", ... like on the JVM
        this.name = name != null ? name : "Thread-" + nextThreadNumber++;'''),
        ('''    public void start() {
''',
         f'''    public void start() {{
        // {MARK}: alive from start() on, so join() before start() returns at once
        alive = true;
'''),
        ('''        } finally {
            synchronized (finishedLock) {
                finishedLock.notifyAll();
            }
            alive = false;''',
         f'''        }} finally {{
            // {MARK}: mark the thread dead before waking joiners, under the lock
            synchronized (finishedLock) {{
                alive = false;
                finishedLock.notifyAll();
            }}'''),
        ('''        if (currentThread() == this || !alive) {
            return;
        }
        synchronized (finishedLock) {
            finishedLock.wait(millis, nanos);
        }''',
         f'''        if (currentThread() == this) {{
            return;
        }}
        // {MARK}: check alive under the lock and loop, so a missed notify can't hang join() forever
        synchronized (finishedLock) {{
            if (millis == 0 && nanos == 0) {{
                while (alive) {{
                    finishedLock.wait();
                }}
            }} else if (alive) {{
                finishedLock.wait(millis, nanos);
            }}
        }}'''),
    ])


if __name__ == '__main__':
    main(sys.argv[1])
