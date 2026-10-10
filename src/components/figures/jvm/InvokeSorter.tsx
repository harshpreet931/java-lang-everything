"use client";

import { Gauntlet, type GauntletCase } from "./Gauntlet";

// "which invoke instruction does this call compile to?", one call at a time.
// every answer and every javap line is real: compiled with javac on jdk 25
// (temurin 25.0.4.1) and read back with `javap -c -p`.

const OPS = ["invokestatic", "invokevirtual", "invokeinterface", "invokespecial", "invokedynamic"];

const CASES: GauntletCase[] = [
  {
    context: "static int util() { ... }",
    code: "util();",
    answer: "invokestatic",
    proof: "invokestatic  #7      // Method util:()I",
    proofLabel: "javap -c -p",
    why: "static methods have no receiver, so there's nothing to dispatch on. the target is known at link time.",
  },
  {
    context: "Dog dog = ...;   // a class",
    code: "dog.sound();",
    answer: "invokevirtual",
    proof: "invokevirtual #19     // Method Dog.sound:()Ljava/lang/String;",
    proofLabel: "javap -c -p",
    why: "an instance method on a class type. which sound() runs depends on the object's runtime class, so it goes through the vtable.",
  },
  {
    context: "List<String> list = ...;",
    code: "list.size();",
    answer: "invokeinterface",
    proof: "invokeinterface #35, 1  // InterfaceMethod java/util/List.size:()I",
    proofLabel: "javap -c -p",
    why: "the static type is an interface. the 1 is the argument count including the receiver, a leftover the JVM doesn't need anymore.",
  },
  {
    context: "ArrayList<String> arrayList = ...;",
    code: "arrayList.size();",
    answer: "invokevirtual",
    proof: "invokevirtual #30     // Method java/util/ArrayList.size:()I",
    proofLabel: "javap -c -p",
    why: "same method as list.size(), different instruction. javac picks by the declared type of the variable, not by the object.",
  },
  {
    context: "class Dog extends Animal",
    code: "new Dog();",
    answer: "invokespecial",
    proof: 'invokespecial #47     // Method Dog."<init>":()V',
    proofLabel: "javap -c -p",
    why: "constructors are never virtual: you're calling exactly Dog.<init>, after new allocated the object.",
  },
  {
    context: "// inside Dog.sound()",
    code: "super.sound();",
    answer: "invokespecial",
    proof: "invokespecial #7      // Method Animal.sound:()Ljava/lang/String;",
    proofLabel: "javap -c -p",
    why: "super. means \"exactly Animal's version\". a virtual call would just come back to Dog.sound() forever.",
  },
  {
    context: "private int secret() { ... }   // same class",
    code: "secret();",
    answer: "invokevirtual",
    proof: "invokevirtual #48     // Method secret:()I",
    proofLabel: "javap -c -p",
    why: "surprise. since java 11 (nestmates, JEP 181) javac emits invokevirtual for private methods. the JVM sees the target is private and calls it directly anyway.",
  },
  {
    context: "// in an inner class, calling the outer class's private method",
    code: "secret();",
    answer: "invokevirtual",
    proof: "invokevirtual #19     // Method Outer.secret:()I",
    proofLabel: "javap -c -p",
    why: "nestmates again: the inner class is allowed to call the private method directly. before java 11 this went through a generated static access$000 bridge.",
  },
  {
    context: "interface Shape { static Shape unit() { ... } }",
    code: "Shape.unit();",
    answer: "invokestatic",
    proof: "invokestatic  #43     // InterfaceMethod Shape.unit:()LShape;",
    proofLabel: "javap -c -p",
    why: "static, even though it lives in an interface. note the constant is an InterfaceMethod reference.",
  },
  {
    context: "// a default method calling a private interface method",
    code: "secret();",
    answer: "invokeinterface",
    proof: "invokeinterface #1, 1   // InterfaceMethod secret:()Ljava/lang/String;",
    proofLabel: "javap -c -p",
    why: "private methods in interfaces get invokeinterface, the interface twin of the nestmate rule.",
  },
  {
    context: "Runnable r = ...;",
    code: "r = () -> {};",
    answer: "invokedynamic",
    proof: "invokedynamic #51, 0  // InvokeDynamic #0:run:()Ljava/lang/Runnable;",
    proofLabel: "javap -c -p",
    why: "creating a lambda is a call to a bootstrap method (LambdaMetafactory) the first time this line runs. no anonymous class in the jar.",
  },
  {
    context: "int n = ...;",
    code: "String x = \"n=\" + n;",
    answer: "invokedynamic",
    proof: "invokedynamic #59, 0  // InvokeDynamic #2:makeConcatWithConstants:(I)Ljava/lang/String;",
    proofLabel: "javap -c -p",
    why: "string concatenation, since java 9. the recipe \"n=\\u0001\" sits in the constant pool and StringConcatFactory builds the code.",
  },
  {
    context: "record Pair(int a, int b) {}",
    code: "// the body javac generates for Pair.toString()",
    answer: "invokedynamic",
    proof: "invokedynamic #16, 0  // InvokeDynamic #0:toString:(LPair;)Ljava/lang/String;",
    proofLabel: "javap -c -p",
    why: "records don't get a generated toString loop. one invokedynamic to ObjectMethods.bootstrap writes it at runtime.",
  },
];

export function InvokeSorter() {
  return <Gauntlet cases={CASES} options={OPS} intro="pick the instruction javac emits for that call." />;
}
