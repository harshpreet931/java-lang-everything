import { highlightLines } from "@/lib/highlight";
import { PROGRAMS } from "./bytecodePrograms";
import { BytecodeStepperClient } from "./BytecodeStepperClient";

/**
 * <BytecodeStepper /> or <BytecodeStepper only={["add", "new"]} />
 * java source, its real bytecode (from javap on jdk 25), and the frame:
 * local variable array + operand stack, one instruction per step.
 */
export async function BytecodeStepper({ only }: { only?: string[] }) {
  const progs = only ? PROGRAMS.filter((p) => only.includes(p.id)) : PROGRAMS;
  const lines = await Promise.all(progs.map((p) => highlightLines(p.source)));
  return <BytecodeStepperClient ids={progs.map((p) => p.id)} lines={lines} />;
}
