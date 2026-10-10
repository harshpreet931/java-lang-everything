// programs for <BytecodeStepper>. the bytecode is copied verbatim from
// `javap -c -p -l` on jdk 25 (temurin 25.0.4.1), compiled with `javac -g`.
// `line` is the line in the snippet shown next to it (the snippet is the real
// source, renumbered from 1). the stepper executes these instructions with a
// tiny simulator (bytecodeSim.ts), so the stack and locals are computed, not typed.

export type Ins = { pc: number; op: string; arg?: string; c?: string; line: number };
export type Method = { name: string; sig: string; locals: string[]; maxStack: number; code: Ins[] };
export type BcProgram = {
  id: string;
  label: string;
  file: string;
  source: string;
  methods: Record<string, Method>;
  entry: { method: string; args: number[] };
  /** optional hand-written notes, by step index, replacing the generated one */
  notes?: Record<number, string>;
};

export const PROGRAMS: BcProgram[] = [
  {
    id: "add",
    label: "a + b",
    file: "Calc.java",
    source: `static int add(int a, int b) {
    int c = a + b;
    return c;
}`,
    entry: { method: "add", args: [3, 4] },
    methods: {
      add: {
        name: "add",
        sig: "static int add(int, int)",
        locals: ["a", "b", "c"],
        maxStack: 2,
        code: [
          { pc: 0, op: "iload_0", line: 2 },
          { pc: 1, op: "iload_1", line: 2 },
          { pc: 2, op: "iadd", line: 2 },
          { pc: 3, op: "istore_2", line: 2 },
          { pc: 4, op: "iload_2", line: 3 },
          { pc: 5, op: "ireturn", line: 3 },
        ],
      },
    },
    notes: {
      0: "add(3, 4) is called. the JVM makes a frame: a local variable array with a in slot 0 and b in slot 1, and an empty operand stack. c has a slot reserved, but nothing in it yet.",
      3: "iadd pops the top two values (4, then 3), adds them, and pushes 7. arithmetic instructions never touch locals, only the stack.",
    },
  },
  {
    id: "loop",
    label: "a loop",
    file: "Calc.java",
    source: `static int sum(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}`,
    entry: { method: "sum", args: [3] },
    methods: {
      sum: {
        name: "sum",
        sig: "static int sum(int)",
        locals: ["n", "total", "i"],
        maxStack: 2,
        code: [
          { pc: 0, op: "iconst_0", line: 2 },
          { pc: 1, op: "istore_1", line: 2 },
          { pc: 2, op: "iconst_0", line: 3 },
          { pc: 3, op: "istore_2", line: 3 },
          { pc: 4, op: "iload_2", line: 3 },
          { pc: 5, op: "iload_0", line: 3 },
          { pc: 6, op: "if_icmpge", arg: "19", line: 3 },
          { pc: 9, op: "iload_1", line: 4 },
          { pc: 10, op: "iload_2", line: 4 },
          { pc: 11, op: "iadd", line: 4 },
          { pc: 12, op: "istore_1", line: 4 },
          { pc: 13, op: "iinc", arg: "2, 1", line: 3 },
          { pc: 16, op: "goto", arg: "4", line: 3 },
          { pc: 19, op: "iload_1", line: 6 },
          { pc: 20, op: "ireturn", line: 6 },
        ],
      },
    },
    notes: {
      7: "if_icmpge 19: pop 3, then 0. is 0 >= 3? no, so fall through into the loop body. a for loop compiles to a test at the top and a goto at the bottom.",
      12: "iinc 2, 1 is i++: it bumps local 2 in place. one of the very few instructions that skips the operand stack.",
      13: "goto 4: jump back to the condition. there's no loop instruction in bytecode, only jumps.",
    },
  },
  {
    id: "call",
    label: "a method call",
    file: "Calc.java",
    source: `static int square(int x) {
    return x * x;
}

static int sumOfSquares(int a, int b) {
    return square(a) + square(b);
}`,
    entry: { method: "sumOfSquares", args: [3, 4] },
    methods: {
      square: {
        name: "square",
        sig: "static int square(int)",
        locals: ["x"],
        maxStack: 2,
        code: [
          { pc: 0, op: "iload_0", line: 2 },
          { pc: 1, op: "iload_0", line: 2 },
          { pc: 2, op: "imul", line: 2 },
          { pc: 3, op: "ireturn", line: 2 },
        ],
      },
      sumOfSquares: {
        name: "sumOfSquares",
        sig: "static int sumOfSquares(int, int)",
        locals: ["a", "b"],
        maxStack: 2,
        code: [
          { pc: 0, op: "iload_0", line: 6 },
          { pc: 1, op: "invokestatic", arg: "#7", c: "Method square:(I)I", line: 6 },
          { pc: 4, op: "iload_1", line: 6 },
          { pc: 5, op: "invokestatic", arg: "#7", c: "Method square:(I)I", line: 6 },
          { pc: 8, op: "iadd", line: 6 },
          { pc: 9, op: "ireturn", line: 6 },
        ],
      },
    },
    notes: {
      2: "invokestatic pops the argument (3) off the caller's stack and pushes a brand new frame for square. the argument becomes the callee's local 0. that's pass-by-value, at the instruction level.",
      6: "ireturn pops 9 off square's stack. the frame is destroyed and 9 is pushed onto the caller's operand stack, right where the call was.",
      8: "second call. notice the 9 from the first call is still waiting on sumOfSquares's stack while square runs again.",
    },
  },
  {
    id: "new",
    label: "new Point(1, 2)",
    file: "Point.java",
    source: `class Point {
    int x, y;

    Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    static Point make() {
        Point p = new Point(1, 2);
        return p;
    }
}`,
    entry: { method: "make", args: [] },
    methods: {
      "<init>": {
        name: "<init>",
        sig: "Point(int, int)",
        locals: ["this", "x", "y"],
        maxStack: 2,
        code: [
          { pc: 0, op: "aload_0", line: 4 },
          { pc: 1, op: "invokespecial", arg: "#1", c: 'Method java/lang/Object."<init>":()V', line: 4 },
          { pc: 4, op: "aload_0", line: 5 },
          { pc: 5, op: "iload_1", line: 5 },
          { pc: 6, op: "putfield", arg: "#7", c: "Field x:I", line: 5 },
          { pc: 9, op: "aload_0", line: 6 },
          { pc: 10, op: "iload_2", line: 6 },
          { pc: 11, op: "putfield", arg: "#13", c: "Field y:I", line: 6 },
          { pc: 14, op: "return", line: 7 },
        ],
      },
      make: {
        name: "make",
        sig: "static Point make()",
        locals: ["p"],
        maxStack: 4,
        code: [
          { pc: 0, op: "new", arg: "#8", c: "class Point", line: 10 },
          { pc: 3, op: "dup", line: 10 },
          { pc: 4, op: "iconst_1", line: 10 },
          { pc: 5, op: "iconst_2", line: 10 },
          { pc: 6, op: "invokespecial", arg: "#16", c: 'Method "<init>":(II)V', line: 10 },
          { pc: 9, op: "astore_0", line: 10 },
          { pc: 10, op: "aload_0", line: 11 },
          { pc: 11, op: "areturn", line: 11 },
        ],
      },
    },
    notes: {
      1: "new #8 allocates a Point on the heap with every field zeroed, and pushes a reference to it. no constructor has run. the object exists, half-born.",
      2: "dup copies the reference. the constructor call will consume one copy; the other is what ends up in p. that's why every new is followed by dup.",
      5: "invokespecial calls the constructor directly (no virtual lookup). it pops 2, 1 and one reference. inside, that reference is this.",
      7: "every constructor starts by calling its superclass constructor. here that's Object's, which does nothing and returns.",
    },
  },
];
