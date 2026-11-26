"use client";

import { useProgress } from "@/lib/progress";
import s from "./covers.module.css";

/**
 * the progress rule on a cover label. progress lives in this browser only, so the server draws
 * the empty rule (nothing read yet is a true first frame) and the fill arrives after hydration.
 */
export function CoverProgress({ hrefs }: { hrefs: string[] }) {
  const progress = useProgress();
  const done = hrefs.filter((h) => progress[h]).length;
  const pct = hrefs.length ? (done / hrefs.length) * 100 : 0;
  return (
    <div className={s.rule} data-done={done > 0 || undefined}>
      <i style={{ width: `${pct}%` }} />
      {done > 0 && (
        <span className="sr-only">
          , {done} of {hrefs.length} read
        </span>
      )}
    </div>
  );
}
