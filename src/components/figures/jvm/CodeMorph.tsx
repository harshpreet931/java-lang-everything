import { highlightLines } from "@/lib/highlight";
import { CodeMorphClient, type MorphStep } from "./CodeMorphClient";

/**
 * <CodeMorph file="Point.java" steps={steps} />
 * steps: [{ title, code, note, marks?: [lines that changed], stats?: [{ label, value, tone }] }]
 * keep `steps` in an `export const` at the top of the mdx so the code keeps its indentation.
 */
export async function CodeMorph({ steps, file }: { steps: (MorphStep & { code: string })[]; file: string }) {
  const lines = await Promise.all(steps.map((s) => highlightLines(s.code)));
  const plain = steps.map(({ code: _code, ...rest }) => rest);
  return <CodeMorphClient steps={plain} lines={lines} file={file} />;
}
