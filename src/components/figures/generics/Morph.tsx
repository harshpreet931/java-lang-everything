import { highlightLines } from "@/lib/highlight";
import { MorphClient, type MorphStep } from "./MorphClient";

/**
 * <Morph file="Box.java" steps={steps} />
 * code changing shape one step at a time. steps: [{ title, code, note, marks?, verdict? }]
 * keep `steps` in a .ts data file (or an export) so the code keeps its indentation.
 * highlighting happens on the server, with the same themes as the code blocks.
 */
export async function Morph({ steps, file }: { steps: (MorphStep & { code: string })[]; file: string }) {
  const lines = await Promise.all(steps.map((s) => highlightLines(s.code)));
  const plain = steps.map(({ code: _code, ...rest }) => rest);
  return <MorphClient steps={plain} lines={lines} file={file} />;
}
