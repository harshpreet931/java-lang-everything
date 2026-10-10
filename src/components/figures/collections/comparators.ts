// the comparator chains from the sorting chapter, built the way java builds them:
//   comparing(f)        (a, b) -> f(a).compareTo(f(b))         (NPE if either key is null)
//   comparing(f, nullsFirst(naturalOrder()))  nulls sort before everything
//   thenComparing(g)    first non-zero wins
//   reversed()          Collections.reverseOrder(cmp): cmp.compare(b, a)
// sorted with timSortSmall, so the same pairs get compared as in java (List.sort, n < 32).

import { timSortSmall, type Cmp } from "./javaSort";

export type Person = { name: string; age: number; city: string | null; i: number };
export type Key = "name" | "age" | "city";
export type Nulls = "none" | "first" | "last";

export const PEOPLE: Person[] = [
  { name: "ada", age: 36, city: "london", i: 0 },
  { name: "bob", age: 25, city: null, i: 1 },
  { name: "eve", age: 36, city: "berlin", i: 2 },
  { name: "dan", age: 25, city: "paris", i: 3 },
  { name: "cat", age: 41, city: "berlin", i: 4 },
  { name: "fay", age: 36, city: null, i: 5 },
  { name: "abe", age: 25, city: "london", i: 6 },
];

export class NPE extends Error {}

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function keyCmp(k: Key, nulls: Nulls): Cmp<Person> {
  if (k === "age") return (a, b) => (a.age < b.age ? -1 : a.age > b.age ? 1 : 0);
  if (k === "name") return (a, b) => cmpStr(a.name, b.name);
  return (a, b) => {
    const x = a.city;
    const y = b.city;
    if (nulls === "none") {
      if (x === null || y === null) throw new NPE();
      return cmpStr(x, y);
    }
    if (x === null) return y === null ? 0 : nulls === "first" ? -1 : 1;
    if (y === null) return nulls === "first" ? 1 : -1;
    return cmpStr(x, y);
  };
}

export function build(primary: Key, then: Key | "none", reversed: boolean, nulls: Nulls): Cmp<Person> {
  const p = keyCmp(primary, nulls);
  const t = then === "none" ? null : keyCmp(then, nulls);
  const chain: Cmp<Person> = t ? (a, b) => p(a, b) || t(a, b) : p;
  return reversed ? (a, b) => chain(b, a) : chain;
}

export function sortPeople(primary: Key, then: Key | "none", reversed: boolean, nulls: Nulls): Person[] | "NPE" {
  try {
    return timSortSmall(PEOPLE, build(primary, then, reversed, nulls));
  } catch (e) {
    if (e instanceof NPE) return "NPE";
    throw e;
  }
}

const ref = (k: Key) => `Person::${k}`;
export function codeFor(primary: Key, then: Key | "none", reversed: boolean, nulls: Nulls) {
  const nullArg = nulls === "first" ? ", nullsFirst(naturalOrder())" : nulls === "last" ? ", nullsLast(naturalOrder())" : "";
  const one = (k: Key, first: boolean) => {
    const extra = k === "city" ? nullArg : "";
    if (first) return k === "age" ? `comparingInt(${ref(k)})` : `comparing(${ref(k)}${extra})`;
    return k === "age" ? `.thenComparingInt(${ref(k)})` : `.thenComparing(${ref(k)}${extra})`;
  };
  return `people.sort(${one(primary, true)}${then === "none" ? "" : one(then, false)}${reversed ? ".reversed()" : ""});`;
}
