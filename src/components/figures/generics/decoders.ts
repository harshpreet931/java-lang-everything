// signatures for the <Decoder> figures in part 05. the signatures are the real
// ones from jdk 25's java.util.Collections (checked with javap -s).

import type { Part } from "./Decoder";

export const sortSig: Part[] = [
  { t: "public static " },
  { t: "<T", title: "<T", note: "this method declares its own type parameter, T. it's a generic method, so T is worked out fresh at every call: sort a List<String> and T is String." },
  { t: " " },
  { t: "extends", title: "extends", note: "a bound: whatever T turns out to be, it must be a subtype of what comes next. in a bound, extends covers both 'extends a class' and 'implements an interface'." },
  { t: " " },
  { t: "Comparable<", title: "Comparable<", note: "T must be Comparable, so sort can call compareTo on its elements. but comparable to what?" },
  { t: "? super T", title: "? super T", note: "to T, or to any supertype of T. Comparable<T> alone would turn away LocalDate (it's comparable to ChronoLocalDate, its parent) and any subclass that inherits compareTo. this wildcard lets them in." },
  { t: ">>", title: ">>", note: "the first > closes Comparable<...>, the second closes the type parameter list. everything between <T and here is the declaration; from now on T is just a name." },
  { t: " void sort(" },
  { t: "List<T> list", title: "List<T>", note: "and the parameter: a list of exactly T. sort reads elements and writes them back in a new order, so it needs the real T, not a wildcard." },
  { t: ")" },
];

export const copySig: Part[] = [
  { t: "public static " },
  { t: "<T>", title: "<T>", note: "one type parameter, no bound. T is the type of the elements being copied, and javac infers it from the two lists." },
  { t: " void copy(" },
  { t: "List<? super T> dest", title: "? super T", note: "dest is a consumer: copy only writes Ts into it. any list that can hold a T will do: a List<T>, a List of a supertype, a List<Object>. consumer super." },
  { t: ", " },
  { t: "List<? extends T> src", title: "? extends T", note: "src is a producer: copy only reads from it, and everything it reads must be a T. a List<T> works, so does a list of any subtype of T. producer extends." },
  { t: ")" },
];
