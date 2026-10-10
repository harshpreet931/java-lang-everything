// generic figures, available in every mdx file without an import.
// chapter-specific figures go in src/components/figures/<part>/ and get imported.

import { ArrayViz } from "./ArrayViz";
import { Bars } from "./Bars";
import { Bits } from "./Bits";
import { Flow } from "./Flow";
import { Memory } from "./Memory";
import { CodeStepper, MemoryStepper } from "./MemoryStepper";
import { Slide, Slides } from "./Slides";
import { Tree } from "./Tree";

export const viz = { ArrayViz, Bars, Bits, Flow, Memory, MemoryStepper, CodeStepper, Slides, Slide, Tree };

export { ArrayViz, Bars, Bits, Flow, Memory, MemoryStepper, CodeStepper, Slides, Slide, Tree };
