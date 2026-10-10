// java's object sort, the parts that matter for figures.
//
// timSortSmall: TimSort.sort for n < 32 (MIN_MERGE), exactly as in jdk 25: one run is found with
// countRunAndMakeAscending, the rest is binary insertion sort. same comparisons in the same order,
// so the same elements get compared (that's what decides whether a comparator throws).
//
// timSteps: the full run-finding + merge-stack algorithm (mergeCollapse / mergeForceCollapse),
// with minRun as a parameter so a 24-element array can show real merges. galloping is skipped:
// it changes how fast a merge is, not what it produces.

export type Cmp<T> = (a: T, b: T) => number;

export function timSortSmall<T>(input: T[], c: Cmp<T>): T[] {
  const a = [...input];
  const n = a.length;
  if (n < 2) return a;
  const run = countRunAndMakeAscending(a, 0, n, c);
  binarySort(a, 0, n, run, c);
  return a;
}

function countRunAndMakeAscending<T>(a: T[], lo: number, hi: number, c: Cmp<T>) {
  let runHi = lo + 1;
  if (runHi === hi) return 1;
  if (c(a[runHi++], a[lo]) < 0) {
    while (runHi < hi && c(a[runHi], a[runHi - 1]) < 0) runHi++;
    reverse(a, lo, runHi);
  } else {
    while (runHi < hi && c(a[runHi], a[runHi - 1]) >= 0) runHi++;
  }
  return runHi - lo;
}

function reverse<T>(a: T[], lo: number, hi: number) {
  hi--;
  while (lo < hi) {
    const t = a[lo];
    a[lo++] = a[hi];
    a[hi--] = t;
  }
}

function binarySort<T>(a: T[], lo: number, hi: number, start: number, c: Cmp<T>) {
  if (start === lo) start++;
  for (; start < hi; start++) {
    const pivot = a[start];
    let left = lo;
    let right = start;
    while (left < right) {
      const mid = (left + right) >>> 1;
      if (c(pivot, a[mid]) < 0) right = mid;
      else left = mid + 1;
    }
    for (let k = start; k > left; k--) a[k] = a[k - 1];
    a[left] = pivot;
  }
}

/* ---- the whole algorithm, as steps -------------------------------------------- */

export type Run = { base: number; len: number };
export type TStep = {
  a: number[];
  stack: Run[];
  kind: "start" | "run" | "reverse" | "extend" | "push" | "merge" | "done";
  hot: [number, number] | null; // [from, to) range to highlight
  note: string;
};

export function timSteps(input: number[], minRun: number): TStep[] {
  const a = [...input];
  const n = a.length;
  const c: Cmp<number> = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const stack: Run[] = [];
  const out: TStep[] = [];
  const snap = (kind: TStep["kind"], hot: TStep["hot"], note: string) => out.push({ a: [...a], stack: stack.map((r) => ({ ...r })), kind, hot, note });
  snap("start", null, `${n} numbers. timsort walks left to right looking for runs that are already in order. (minRun is ${minRun} here so you can see the merges. the real one picks 16 to 32 for big arrays, and arrays under 32 never merge at all.)`);

  const merge = (i: number) => {
    const r1 = stack[i];
    const r2 = stack[i + 1];
    const merged = a.slice(r1.base, r1.base + r1.len + r2.len).sort(c);
    for (let k = 0; k < merged.length; k++) a[r1.base + k] = merged[k];
    stack[i] = { base: r1.base, len: r1.len + r2.len };
    stack.splice(i + 1, 1);
    return [r1, r2] as const;
  };

  const collapse = () => {
    while (stack.length > 1) {
      let k = stack.length - 2;
      const L = (j: number) => stack[j].len;
      let why = "";
      if ((k > 0 && L(k - 1) <= L(k) + L(k + 1)) || (k > 1 && L(k - 2) <= L(k) + L(k - 1))) {
        why = k > 0 && L(k - 1) <= L(k) + L(k + 1) ? `${L(k - 1)} ≤ ${L(k)} + ${L(k + 1)}` : `${L(k - 2)} ≤ ${L(k)} + ${L(k - 1)}`;
        if (L(k - 1) < L(k + 1)) k--;
      } else if (k < 0 || L(k) > L(k + 1)) {
        break;
      } else {
        why = `${L(k)} ≤ ${L(k + 1)}`;
      }
      const [r1, r2] = merge(k);
      snap("merge", [r1.base, r1.base + r1.len + r2.len], `the stack's balance rule broke (${why}), so merge the runs of ${r1.len} and ${r2.len} into one sorted run of ${r1.len + r2.len}.`);
    }
  };

  let lo = 0;
  let rem = n;
  while (rem > 0) {
    // count the natural run
    let runHi = lo + 1;
    let desc = false;
    if (runHi < n) {
      if (c(a[runHi++], a[lo]) < 0) {
        desc = true;
        while (runHi < n && c(a[runHi], a[runHi - 1]) < 0) runHi++;
      } else {
        while (runHi < n && c(a[runHi], a[runHi - 1]) >= 0) runHi++;
      }
    }
    let len = runHi - lo;
    snap("run", [lo, lo + len], `a natural run of ${len}, ${desc ? "strictly descending" : "ascending"}: ${a.slice(lo, lo + len).join(" ")}.`);
    if (desc) {
      reverse(a, lo, lo + len);
      snap("reverse", [lo, lo + len], `descending runs get reversed in place. now it's ascending. (only strictly descending ones, so reversing can't reorder equal elements.)`);
    }
    if (len < minRun) {
      const force = rem <= minRun ? rem : minRun;
      if (force > len) {
        binarySort(a, lo, lo + force, lo + len, c);
        snap("extend", [lo, lo + force], `shorter than minRun, so binary insertion sort pulls in the next ${force - len} element${force - len === 1 ? "" : "s"} to make a run of ${force}.`);
        len = force;
      }
    }
    stack.push({ base: lo, len });
    snap("push", [lo, lo + len], `push the run onto the stack (lengths now: ${stack.map((r) => r.len).join(", ")}).`);
    collapse();
    lo += len;
    rem -= len;
  }
  while (stack.length > 1) {
    let k = stack.length - 2;
    if (k > 0 && stack[k - 1].len < stack[k + 1].len) k--;
    const [r1, r2] = merge(k);
    snap("merge", [r1.base, r1.base + r1.len + r2.len], `out of input: merge whatever is left on the stack. ${r1.len} + ${r2.len} → ${r1.len + r2.len}.`);
  }
  snap("done", [0, n], `one run, ${n} long. sorted. on input that was already mostly in order, this costs barely more than one pass.`);
  return out;
}
