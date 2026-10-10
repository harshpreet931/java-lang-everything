import { highlightLines } from "@/lib/highlight";
import { ClassLifecycleClient } from "./ClassLifecycleClient";
import { SHOP_SOURCE } from "./shopSource";

/** <ClassLifecycle />: when Base and Price get loaded, linked and initialized, from a real -Xlog run. */
export async function ClassLifecycle() {
  const lines = await highlightLines(SHOP_SOURCE);
  return <ClassLifecycleClient lines={lines} />;
}
