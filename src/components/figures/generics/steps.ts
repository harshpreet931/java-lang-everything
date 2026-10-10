// step data for the CodeMorph figures in part 05. kept out of the mdx so the
// java inside the template strings keeps its exact indentation.

export const boxSteps = [
  {
    title: "Object box",
    note: "the pre-generics way: store an Object, hand back an Object, make every caller cast. it works for any type, and it checks none of them.",
    marks: [2, 4, 6, 10],
    code: `class Box {
    private Object value;

    Box(Object value) { this.value = value; }

    Object get() { return value; }
}

Box b = new Box("ada");
String s = (String) b.get();      // cast, every time`,
  },
  {
    title: "declare T",
    note: "<T> after the class name declares a type parameter: a name for 'whatever type the user picks'. by itself it does nothing yet.",
    marks: [1],
    code: `class Box<T> {
    private Object value;

    Box(Object value) { this.value = value; }

    Object get() { return value; }
}`,
  },
  {
    title: "use T",
    note: "now use T wherever you meant 'the type in the box'. field, constructor parameter, return type. inside the class, T behaves like any other type name.",
    marks: [2, 4, 6],
    code: `class Box<T> {
    private T value;

    Box(T value) { this.value = value; }

    T get() { return value; }
}`,
  },
  {
    title: "fill it in",
    note: "a caller supplies a type argument. Box<String> is a Box where every T reads as String, so get() returns a String and the cast is gone.",
    marks: [1, 2],
    code: `Box<String> b = new Box<String>("ada");
String s = b.get();               // no cast
b = new Box<String>(42);          // doesn't compile`,
    file: "Main.java",
    verdict: { ok: false, text: "Main.java:3: error: incompatible types: int cannot be converted to String" },
  },
  {
    title: "diamond",
    file: "Main.java",
    note: "java 7: the <> diamond. the type arguments are already on the left, so javac infers them for the right.",
    marks: [1],
    code: `Box<String> b = new Box<>("ada");
String s = b.get();`,
  },
  {
    title: "var",
    file: "Main.java",
    note: 'java 10: var plus diamond still works, because the constructor argument is a String. javac infers Box<String> from "ada" alone.',
    marks: [1],
    code: `var b = new Box<>("ada");          // Box<String>
String s = b.get();`,
  },
];
