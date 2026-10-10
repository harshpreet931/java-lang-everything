// starting points for /play. each one runs the same in the browser runtime and on jdk 25
// (checked by hand: see the playground notes). keep them short and a little surprising.

export type Example = { id: string; label: string; code: string; /** stdout + stderr from a real jdk 25 run */ expected: string };

export const examples: Example[] = [
  {
    id: "hello",
    expected: "hello, world!\n1 squared is 1\n2 squared is 4\n3 squared is 9",
    label: "hello",
    code: `void main() {
    String name = "world";
    IO.println("hello, " + name + "!");

    for (int i = 1; i <= 3; i++) {
        IO.println(i + " squared is " + i * i);
    }
}
`,
  },
  {
    id: "records",
    expected: "Circle[r=1.0] has area 3.14\nSquare[side=2.0] has area 4.00\nRect[w=2.0, h=3.0] has area 6.00",
    label: "records + patterns",
    code: `sealed interface Shape permits Circle, Square, Rect {}
record Circle(double r) implements Shape {}
record Square(double side) implements Shape {}
record Rect(double w, double h) implements Shape {}

double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.r() * c.r();
        case Square q -> q.side() * q.side();
        case Rect(double w, double h) -> w * h;
    };
}

void main() {
    var shapes = List.of(new Circle(1), new Square(2), new Rect(2, 3));
    for (Shape s : shapes) {
        IO.println(s + " has area " + String.format("%.2f", area(s)));
    }
}
`,
  },
  {
    id: "streams",
    expected: "3 letters: [jit]\n4 letters: [heap]\n5 letters: [stack]\n6 letters: [thread, lambda, record]\n8 letters: [bytecode]",
    label: "streams",
    code: `void main() {
    var words = List.of("stack", "heap", "jit", "gc", "bytecode", "thread", "lambda", "record");

    var byLength = words.stream()
        .filter(w -> w.length() > 2)
        .collect(Collectors.groupingBy(String::length, TreeMap::new, Collectors.toList()));

    byLength.forEach((len, ws) -> IO.println(len + " letters: " + ws));
}
`,
  },
  {
    id: "cache",
    expected: "127 == 127 ? true\n128 == 128 ? false\n128 equals 128 ? true",
    label: "the integer cache",
    code: `void main() {
    Integer a = 127, b = 127;
    Integer c = 128, d = 128;

    IO.println("127 == 127 ? " + (a == b));
    IO.println("128 == 128 ? " + (c == d));
    IO.println("128 equals 128 ? " + c.equals(d));
}
`,
  },
  {
    id: "pool",
    expected: "true\nfalse\ntrue\ntrue",
    label: "the string pool",
    code: `void main() {
    String a = "duke";
    String b = "duke";
    String c = new String("duke");

    IO.println(a == b);          // two literals, one pooled object
    IO.println(a == c);          // new String() makes a second object
    IO.println(a.equals(c));     // same characters, though
    IO.println(a == c.intern()); // intern() hands back the pooled one
}
`,
  },
  {
    id: "exception",
    expected: "5\nException in thread \"main\" java.lang.ArithmeticException: / by zero\n\tat Main.divide(Main.java:2)\n\tat Main.main(Main.java:7)",
    label: "an exception",
    code: `int divide(int a, int b) {
    return a / b;
}

void main() {
    IO.println(divide(10, 2));
    IO.println(divide(1, 0));
    IO.println("never printed");
}
`,
  },
  {
    id: "textblock",
    expected: "{\n  \"name\": \"duke\",\n  \"since\": 1995\n}\n4 lines, 38 chars",
    label: "text blocks",
    code: `void main() {
    String json = """
        {
          "name": "duke",
          "since": 1995
        }
        """;
    IO.print(json);
    IO.println(json.split("\\n").length + " lines, " + json.length() + " chars");
}
`,
  },
];
