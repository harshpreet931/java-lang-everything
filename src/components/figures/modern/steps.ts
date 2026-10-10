// step data for the <Morph> figures in part 08. kept out of the mdx so the java keeps
// its indentation. every "what javac sees" step matches javap output from javac 25
// (javap -p Hello.class: final class Hello { java.lang.String greeting; Hello(); void main(); }).

export const compactSteps = [
  {
    title: "what you write",
    file: "Hello.java",
    note: "a compact source file: a field and a method, and nothing around them. no class, no static, no String[] args, no import for List. java 25 compiles and runs this as is.",
    marks: [],
    code: `String greeting = "hi";

void main() {
    IO.println(greeting + ", " + List.of("ada", "bob"));
}`,
  },
  {
    title: "the import",
    file: "Hello.java, as javac sees it",
    note: "every compact source file gets an implicit import module java.base: all 58 packages java.base exports, java.util, java.io, java.time and friends. that's why List needed no import.",
    marks: [1],
    code: `import module java.base;                 // implicit

String greeting = "hi";

void main() {
    IO.println(greeting + ", " + List.of("ada", "bob"));
}`,
  },
  {
    title: "the class",
    file: "Hello.java, as javac sees it",
    note: "the members get wrapped in an implicitly declared class: final, in the unnamed package, named after the file by javac (the spec leaves the name up to the compiler, which is why you can't refer to it). javap on the class file shows final class Hello.",
    marks: [3, 4, 9, 10],
    code: `import module java.base;                 // implicit

final class Hello {                      // implicit, named by javac
    Hello() {}                           // implicit

    String greeting = "hi";

    void main() {
        IO.println(greeting + ", " + List.of("ada", "bob"));
    }
}`,
  },
  {
    title: "the launch",
    file: "what java Hello.java does",
    note: "the launcher looks for main(String[]), finds none, takes main(). it's an instance method, so it makes an object with the no-argument constructor and calls main on it. greeting is an ordinary instance field, no static needed.",
    marks: [4, 5],
    code: `// 1. compile Hello.java in memory
// 2. pick a main: no main(String[]) here, so main()
// 3. main() isn't static, so:
Hello h = new Hello();
h.main();`,
  },
  {
    title: "the classic version",
    file: "Hello.java, the old way",
    note: "the same program before java 25. every extra word is a concept you had to wave away on day one: public, class, static, String[], System.out. and greeting has to become static, because main is.",
    marks: [1, 3, 4, 6, 7],
    code: `import java.util.List;

public class Hello {
    static String greeting = "hi";

    public static void main(String[] args) {
        System.out.println(greeting + ", " + List.of("ada", "bob"));
    }
}`,
  },
];
