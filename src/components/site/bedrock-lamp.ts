import { BEDROCK, type BedrockLayout } from "./bedrock-data";

/**
 * the lamp over the floor. the server's svg stays the picture; this canvas sits on top and draws only
 * the dots that are lit, each in the colour of what it is. dots near the pointer rise in about 140ms
 * and fade over 700ms, so the cursor leaves a short trail. a tap or click sends a ripple. nothing runs
 * while nothing is changing: the loop stops once every dot has settled, and pauses offscreen and on
 * hidden tabs. reduced motion keeps the lamp (colour and opacity) and turns the ripple into a still
 * disc that holds and fades.
 */

const SQL = false;

// kinds (scripts/bedrock.mjs): 0 grid, 1 glyph, 2 header, 3 body, 4 garbage, 5 fresh, 6 ref,
// 7 ref end, 8 tuple, 9 dead tuple, 10 page header, 11 the root reference, 12 its end,
// 13 the root frame's header column, 14 its slots
const RAD = [0.13, 0.36, 0.25, 0.25, 0.27, 0.25, 0.13, 0.27, 0.2, 0.24, 0.2, 0.2, 0.32, 0.25, 0.25];
// what each kind means when lit. the address space only glimmers toward the neutral dot
const LIT = ["--dot", "--book", "--meta", "--live", "--dead", "--hot", "--ref", "--ref", "--live", "--dead", "--meta", "--ref", "--ref", "--meta", "--dot"];
const RING = (k: number) => k === 4 || k === 9;
const BAR = (k: number) => SQL && (k === 1 || k === 8 || k === 10);

type Model = {
  L: BedrockLayout;
  W: number;
  H: number;
  pitch: number;
  ox: number;
  c0: number;
  c1: number;
  kind: Uint8Array;
  grp: Int32Array;
  groups: Int32Array; // [kind, row, col, len] per run
  e: Float32Array;
  tgt: Float32Array;
  ge: Float32Array;
  phone: boolean;
};

function readPalette(el: HTMLElement): string[] {
  const probe = document.createElement("span");
  probe.style.display = "none";
  el.appendChild(probe);
  const out = LIT.map((v) => {
    probe.style.color = `var(${v})`;
    return getComputedStyle(probe).color;
  });
  probe.remove();
  return out;
}

function layout(host: HTMLElement): Model {
  const W = host.clientWidth;
  const H = host.clientHeight;
  const key = W < 640 ? "p" : W < 1100 ? "t" : "d";
  const L = BEDROCK[key];
  const pitch = key === "d" ? Math.min(W / L.vc, 9) : W / L.vc;
  const ox = W / 2 - (L.dc * pitch) / 2;
  const N = L.dc * L.rows;
  const kind = new Uint8Array(N);
  const grp = new Int32Array(N).fill(-1);
  const nums = L.runs.split(" ").map((x) => parseInt(x, 36));
  const groups = new Int32Array(nums);
  for (let g = 0; g < nums.length / 4; g++) {
    const [k, r, c, n] = [nums[g * 4], nums[g * 4 + 1], nums[g * 4 + 2], nums[g * 4 + 3]];
    for (let x = c; x < c + n; x++) {
      kind[r * L.dc + x] = k;
      grp[r * L.dc + x] = g;
    }
  }
  return {
    L, W, H, pitch, ox, kind, grp, groups,
    c0: Math.max(0, Math.floor(-ox / pitch)),
    c1: Math.min(L.dc - 1, Math.ceil((W - ox) / pitch)),
    e: new Float32Array(N),
    tgt: new Float32Array(N),
    ge: new Float32Array(nums.length / 4),
    phone: key === "p",
  };
}

export function mountLamp(host: HTMLElement): () => void {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const cv = document.createElement("canvas");
  host.appendChild(cv);
  const ctx = cv.getContext("2d")!;
  let M = layout(host);
  let pal = readPalette(host);
  let dark = document.documentElement.dataset.theme === "dark";
  let dpr = 1;

  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(M.W * dpr);
    cv.height = Math.round(M.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();

  // ---------------------------------------------------------------------------- drawing

  const draw = () => {
    const { L, pitch, ox, c0, c1, kind, e, grp, ge, groups } = M;
    const cols = L.dc;
    const fadeRows = M.phone ? 4 : 6;
    ctx.clearRect(0, 0, M.W, M.H);
    const glow = (t: number, fill: string) => {
      if (dark && t > 0.25) {
        ctx.shadowColor = fill;
        ctx.shadowBlur = (2.4 + 4 * t) * dpr;
      } else if (ctx.shadowBlur) ctx.shadowBlur = 0;
    };
    for (let r = 0; r < L.rows; r++) {
      const rowFade = Math.min(1, (r + 1) / fadeRows);
      const cy = (r + 0.5) * pitch;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        const k = kind[i];
        let t = SQL && grp[i] >= 0 ? Math.max(e[i], ge[grp[i]]) : e[i];
        if (t < 0.004) continue;
        if (k === 0) t *= 0.55;
        const cx = ox + (c + 0.5) * pitch;
        const fill = pal[k];
        ctx.globalAlpha = k === 1 || k >= 11 ? t : t * (0.6 + 0.4 * rowFade);
        glow(t, fill);
        if (RING(k)) {
          ctx.strokeStyle = fill;
          ctx.lineWidth = Math.max(0.9, pitch * 0.09);
          ctx.beginPath();
          ctx.arc(cx, cy, (RAD[k] - 0.045 + 0.06 * t) * pitch, 0, 6.2832);
          ctx.stroke();
        } else {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(cx, cy, (RAD[k] + (k === 0 ? 0.1 : 0.06) * t) * pitch, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    // sql: tuples, page headers and the word's scan lines are rows, so their bars light whole
    if (SQL) {
      for (let g = 0; g < ge.length; g++) {
        const t = ge[g];
        const k = groups[g * 4];
        if (t < 0.004 || !BAR(k) || groups[g * 4 + 3] < 2) continue;
        const r = groups[g * 4 + 1], c = groups[g * 4 + 2], n = groups[g * 4 + 3];
        const h = pitch * (k === 1 ? 0.5 : 0.34 + 0.06 * t);
        const x0 = ox + (c + 0.5) * pitch - h / 2;
        const fill = pal[k];
        ctx.globalAlpha = k === 1 ? t * 0.9 : t * (0.6 + 0.4 * Math.min(1, (r + 1) / fadeRows));
        glow(t, fill);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x0, (r + 0.5) * pitch - h / 2, (n - 1) * pitch + h, h, h / 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  // ---------------------------------------------------------------------------- the lamp

  type Ripple = { x: number; y: number; t0: number; still: boolean };
  let pointer: { x: number; y: number } | null = null;
  const ripples: Ripple[] = [];
  let raf = 0;
  let last = 0;
  let onScreen = true;
  const lampR = () => (M.phone ? 80 : 160);

  const stamp = (x: number, y: number, R: number, gain: number, ring: number | null) => {
    const { pitch, ox, L, tgt } = M;
    const cs = Math.max(M.c0, Math.floor((x - R - ox) / pitch)), ce = Math.min(M.c1, Math.ceil((x + R - ox) / pitch));
    const rs = Math.max(0, Math.floor((y - R) / pitch)), re = Math.min(L.rows - 1, Math.ceil((y + R) / pitch));
    const band = pitch * 3.2;
    for (let r = rs; r <= re; r++)
      for (let c = cs; c <= ce; c++) {
        const d = Math.hypot(ox + (c + 0.5) * pitch - x, (r + 0.5) * pitch - y);
        let v: number;
        if (ring != null) v = Math.max(0, 1 - Math.abs(d - ring) / band);
        else {
          const u = Math.max(0, 1 - d / R);
          v = u * u * (3 - 2 * u);
        }
        v *= gain;
        const i = r * L.dc + c;
        if (v > tgt[i]) tgt[i] = v;
      }
  };

  const step = (now: number) => {
    raf = 0;
    if (!onScreen || document.hidden) {
      last = 0;
      return;
    }
    const dt = Math.min(48, now - (last || now - 16));
    last = now;
    const { e, tgt, grp, ge } = M;
    tgt.fill(0);
    if (pointer) stamp(pointer.x, pointer.y, lampR(), 1, null);
    for (let k = ripples.length - 1; k >= 0; k--) {
      const rp = ripples[k];
      const age = now - rp.t0;
      if (rp.still) {
        // reduced motion: nothing travels. the disc lights, holds, and lets go
        if (age < 260) stamp(rp.x, rp.y, lampR() * 1.2, 1, null);
        else ripples.splice(k, 1);
      } else {
        const life = 1100, rmax = M.phone ? 240 : 420;
        if (age > life) {
          ripples.splice(k, 1);
          continue;
        }
        stamp(rp.x, rp.y, rmax, 1 - age / life, (1 - Math.pow(1 - age / life, 2)) * rmax);
      }
    }
    let moving = false;
    const up = 1 - Math.pow(0.001, dt / 140); // rise in about 140ms
    const down = dt / 700; // fade over 700ms: the trail
    for (let i = 0; i < e.length; i++) {
      const t = tgt[i];
      let v = e[i];
      if (t > v) v += (t - v) * up;
      else v = Math.max(t, v - down);
      if (Math.abs(t - v) < 0.004) v = t;
      if (v < 0.004) v = 0;
      if (v !== e[i]) moving = true;
      e[i] = v;
    }
    if (SQL) {
      // a sequential scan: when the lamp touches any slot of a row, the whole row lights
      ge.fill(0);
      for (let i = 0; i < e.length; i++) {
        const g = grp[i];
        if (g >= 0 && e[i] > ge[g]) ge[g] = e[i];
      }
    }
    draw();
    if (moving || ripples.length) raf = requestAnimationFrame(step);
    else last = 0;
  };
  const kick = () => {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(step);
  };

  const local = (ev: PointerEvent) => {
    const b = host.getBoundingClientRect();
    return { x: ev.clientX - b.left, y: ev.clientY - b.top };
  };
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType === "touch") return;
    pointer = local(ev);
    kick();
  };
  const onLeave = () => {
    pointer = null;
    kick();
  };
  const onDown = (ev: PointerEvent) => {
    ripples.push({ ...local(ev), t0: performance.now(), still: reduce.matches });
    if (ripples.length > 4) ripples.shift();
    kick();
  };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerdown", onDown);

  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    if (onScreen) kick();
  });
  io.observe(host);
  const onVis = () => {
    if (!document.hidden) kick();
  };
  document.addEventListener("visibilitychange", onVis);

  let w = M.W;
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === w && host.clientHeight === M.H) return;
    w = host.clientWidth;
    M = layout(host);
    size();
    draw();
  });
  ro.observe(host);

  const mo = new MutationObserver(() => {
    requestAnimationFrame(() => {
      pal = readPalette(host);
      dark = document.documentElement.dataset.theme === "dark";
      draw();
    });
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // for screenshots: light the lamp or start a ripple at a fraction of the floor
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as Record<string, unknown>).__bedrock = {
      lamp: (fx: number, fy: number) => {
        pointer = { x: fx * M.W, y: fy * M.H };
        kick();
      },
      ripple: (fx: number, fy: number, age = 0) => {
        ripples.push({ x: fx * M.W, y: fy * M.H, t0: performance.now() - age, still: reduce.matches });
        kick();
      },
    };
  }

  return () => {
    cancelAnimationFrame(raf);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("pointerdown", onDown);
    document.removeEventListener("visibilitychange", onVis);
    io.disconnect();
    ro.disconnect();
    mo.disconnect();
    cv.remove();
  };
}
