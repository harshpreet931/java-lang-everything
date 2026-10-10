"use client";

import { Gauntlet, type GauntletCase } from "./Gauntlet";

// "does this line initialize the class?" every output below is what the real
// program printed on jdk 25 (temurin 25.0.4.1). the classes:
//
//   class A { static { IO.println("A initialized"); }
//             static final int CONST = 42; static final Integer BOXED = 42;
//             static int counter = 0; static void hello() {} }
//   class B extends A { static { IO.println("B initialized"); } }
//   interface I { int X = trace("I"); default void d() {} }   // trace prints "I initialized"
//   interface J { int Y = trace("J"); }
//   class C implements I, J { static { IO.println("C initialized"); } }

const nothing = "(nothing printed)";
const L = "program output";

const CASES: GauntletCase[] = [
  { code: "new A();", ask: "does A get initialized?", answer: "yes", proof: "A initialized", proofLabel: L, why: "new is the most obvious trigger. the class must be initialized before an instance can exist." },
  { code: "A.hello();", ask: "does A get initialized?", answer: "yes", proof: "A initialized", proofLabel: L, why: "invokestatic is a trigger: a static method may rely on static state." },
  { code: "IO.println(A.counter);", ask: "does A get initialized?", answer: "yes", proof: "A initialized\n0", proofLabel: L, why: "getstatic (and putstatic) on a field declared in A initializes A." },
  {
    code: "IO.println(A.CONST);   // static final int CONST = 42",
    ask: "does A get initialized?",
    answer: "no",
    proof: "42",
    proofLabel: L,
    why: "CONST is a compile-time constant, so javac copied 42 into this class (bipush 42). the bytecode never mentions A.CONST at all.",
  },
  {
    code: "IO.println(A.BOXED);   // static final Integer BOXED = 42",
    ask: "does A get initialized?",
    answer: "yes",
    proof: "A initialized\n42",
    proofLabel: L,
    why: "only primitives and Strings can be constant variables. Integer is computed in <clinit>, so reading it needs A initialized.",
  },
  { code: "IO.println(A.class.getSimpleName());", ask: "does A get initialized?", answer: "no", proof: "A", proofLabel: L, why: "a class literal loads A, but asking about the class isn't using it." },
  { code: "IO.println(new A[3].length);", ask: "does A get initialized?", answer: "no", proof: "3", proofLabel: L, why: "creating an array of A loads A and makes the array class, but no A object exists, so A stays uninitialized." },
  { code: 'Class.forName("A");', ask: "does A get initialized?", answer: "yes", proof: "A initialized", proofLabel: L, why: "the one-argument forName initializes. that's how old JDBC drivers registered themselves from a static block." },
  {
    code: 'Class.forName("A", false, loader);',
    ask: "does A get initialized?",
    answer: "no",
    proof: nothing,
    proofLabel: L,
    why: "the second argument is literally \"initialize?\". load it, link it maybe, but don't run <clinit>.",
  },
  {
    context: "// counter is declared in A, not B",
    code: "IO.println(B.counter);",
    ask: "does B get initialized?",
    answer: "no",
    proof: "A initialized\n0",
    proofLabel: L,
    why: "javac writes getstatic B.counter, but the JVM resolves it to the declaring class. only A runs its initializer. B never does.",
  },
  {
    code: "new B();",
    ask: "does A get initialized?",
    answer: "yes",
    proof: "A initialized\nB initialized",
    proofLabel: L,
    why: "a class's superclass is always initialized first. that's why Object's initializer has always run before yours.",
  },
  {
    context: "Object o = null;",
    code: "A a = (A) o;\nIO.println(o instanceof A);",
    ask: "does A get initialized?",
    answer: "no",
    proof: "false",
    proofLabel: L,
    why: "checkcast and instanceof only need A's identity, not its static state.",
  },
  {
    code: "IO.println(A.class.getDeclaredMethods().length);",
    ask: "does A get initialized?",
    answer: "no",
    proof: "1",
    proofLabel: L,
    why: "reflecting over a class's shape doesn't initialize it. calling a static method through reflection would.",
  },
  {
    code: 'var h = MethodHandles.lookup()\n    .findStatic(A.class, "hello", MethodType.methodType(void.class));',
    ask: "does A get initialized?",
    answer: "no",
    proof: nothing,
    proofLabel: L,
    why: "looking up a method handle isn't using it. A initializes the first time the handle is invoked: add h.invoke() and \"A initialized\" appears.",
  },
  {
    context: "interface I { int X = trace(\"I\"); default void d() {} }\ninterface J { int Y = trace(\"J\"); }\nclass C implements I, J { ... }",
    code: "new C();",
    ask: "does J get initialized?",
    answer: "no",
    proof: "I initialized\nC initialized",
    proofLabel: L,
    why: "initializing a class doesn't initialize its interfaces, except ones that declare default methods. I has one, J doesn't. (J would initialize the moment someone reads J.Y.)",
  },
];

export function InitQuiz() {
  return <Gauntlet cases={CASES} options={["yes", "no"]} intro="answer, then see what the real program printed." />;
}
