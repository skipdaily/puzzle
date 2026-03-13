// ─── Puzzle Shape Constants ───────────────────────────────────────────────────
// Layout: LEFT piece (Japanese word) | RIGHT piece (Image), side-by-side.
// Three pairs stacked vertically on the page.
//
// The jigsaw connector is a smooth snake/wave curve using sinusoidal functions.
// All dimensions in PDF points (1 inch = 72 pt).

export const LAYOUT = {
  // Page sizes
  LETTER: { width: 612, height: 792 } as const,
  A4:     { width: 595.28, height: 841.89 } as const,

  // Each piece dimensions
  PIECE_W: 214,  // width of each half-piece (left or right)
  PIECE_H: 230,  // height of each puzzle row

  // Spacing between rows
  ROW_GAP: 14,

  // Styling
  STROKE_WIDTH: 1.2,
  STROKE_COLOR: '#333333',
  FILL_COLOR:   '#FFFFFF',

  // Typography
  JP_FONT_SIZE:    38,
  LABEL_FONT_SIZE: 8,
} as const;

// ─── Snake / wave curves ─────────────────────────────────────────────────────
// Smooth S-curves that sweep across the connector edge.
// amplitude = max horizontal displacement, waves = number of S-bends.

function makeSnakeCurve(
  amplitude: number,
  waves: number,
  phaseShift: number = 0,
): [number, number][] {
  const samples = 200;
  const result: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples; // 0..1 along edge
    const x = t * 100;    // 0..100 template units
    // Smooth envelope: fades in from 0 and out to 0 at both ends
    const envelope = Math.sin(Math.PI * t);
    const y = amplitude * envelope * Math.sin((waves * Math.PI * t) + phaseShift);
    result.push([x, y]);
  }
  return result;
}

// ─── Zigzag (straight-line version of snake) ────────────────────────────────
// Same envelope logic as snake but with sharp straight segments instead of curves.
// teeth = number of zigzag teeth, flip inverts direction.

function makeZigzag(
  amplitude: number,
  teeth: number,
  flip: boolean = false,
): [number, number][] {
  const sign = flip ? -1 : 1;
  const result: [number, number][] = [[0, 0]];
  for (let i = 0; i < teeth; i++) {
    const t0 = i / teeth;           // start of this tooth
    const tMid = (i + 0.5) / teeth; // peak of this tooth
    const t1 = (i + 1) / teeth;     // end of this tooth
    // Envelope fades amplitude in/out at edges
    const envMid = Math.sin(Math.PI * tMid);
    const dir = (i % 2 === 0) ? 1 : -1;
    const peakY = sign * amplitude * envMid * dir;
    result.push([tMid * 100, peakY]);
    result.push([t1 * 100, 0]);
  }
  // Ensure we end exactly at [100, 0]
  if (result[result.length - 1][0] !== 100) {
    result.push([100, 0]);
  }
  return result;
}

// Pre-compute all curves at module load
const CURVES: [number, number][][] = [
  // 0–3: Snake Wave ◀ (Gentle, Medium, Deep, Tight)
  makeSnakeCurve(12, 1.5, 0),           // gentle single S
  makeSnakeCurve(20, 1.5, 0),           // medium single S
  makeSnakeCurve(28, 1.5, 0),           // deep single S
  makeSnakeCurve(18, 2.5, 0),           // tight double S
  // 4–7: Snake Wave ▶ (mirrored — Gentle, Medium, Deep, Tight)
  makeSnakeCurve(12, 1.5, Math.PI),     // gentle single S mirrored
  makeSnakeCurve(20, 1.5, Math.PI),     // medium single S mirrored
  makeSnakeCurve(28, 1.5, Math.PI),     // deep single S mirrored
  makeSnakeCurve(18, 2.5, Math.PI),     // tight double S mirrored
  // 8–11: Snake Ripple ◀ (Light, Medium, Heavy, Fine)
  makeSnakeCurve(14, 3.0, 0),           // light triple ripple
  makeSnakeCurve(20, 3.0, 0),           // medium triple ripple
  makeSnakeCurve(26, 3.0, 0),           // heavy triple ripple
  makeSnakeCurve(12, 4.0, 0),           // fine quad ripple
  // 12–15: Snake Ripple ▶ (mirrored — Light, Medium, Heavy, Fine)
  makeSnakeCurve(14, 3.0, Math.PI),     // light triple ripple mirrored
  makeSnakeCurve(20, 3.0, Math.PI),     // medium triple ripple mirrored
  makeSnakeCurve(26, 3.0, Math.PI),     // heavy triple ripple mirrored
  makeSnakeCurve(12, 4.0, Math.PI),     // fine quad ripple mirrored
  // 16–19: Zigzag ◀ (1–2 teeth, easy to cut)
  makeZigzag(16, 1, false),             // 1 tooth small
  makeZigzag(26, 1, false),             // 1 tooth large
  makeZigzag(16, 2, false),             // 2 teeth small
  makeZigzag(26, 2, false),             // 2 teeth large
  // 20–23: Zigzag ▶ (mirrored)
  makeZigzag(16, 1, true),              // 1 tooth small mirrored
  makeZigzag(26, 1, true),              // 1 tooth large mirrored
  makeZigzag(16, 2, true),              // 2 teeth small mirrored
  makeZigzag(26, 2, true),              // 2 teeth large mirrored
];

function getCurve(seed: number): [number, number][] {
  const idx = ((seed % CURVES.length) + CURVES.length) % CURVES.length;
  return CURVES[idx];
}

// ─── Path for the LEFT (word) piece ──────────────────────────────────────────
//
// Rectangular piece whose RIGHT edge follows the Bézier connector.
// Drawn clockwise from top-left.

export function leftPiecePath(
  x: number, y: number, w: number, h: number, seed: number = 0
): string {
  const baseX  = x + w;            // nominal right edge = connector boundary
  const scale  = h / 100;          // template units → PDF points
  const curve  = getCurve(seed);

  const d: string[] = [
    `M ${x} ${y}`,
    `L ${baseX} ${y}`,
  ];

  // Connector going DOWN the right edge
  for (const [tx, ty] of curve) {
    d.push(
      `L ${baseX + ty * scale} ${y + (tx / 100) * h}`
    );
  }

  d.push(
    `L ${baseX} ${y + h}`,
    `L ${x} ${y + h}`,
    `Z`,
  );
  return d.join(' ');
}

// ─── Path for the RIGHT (image) piece ────────────────────────────────────────
//
// Rectangular piece whose LEFT edge follows the same Bézier connector
// (traversed in reverse so the path closes correctly clockwise).

export function rightPiecePath(
  x: number, y: number, w: number, h: number, seed: number = 0
): string {
  const baseX  = x;                // nominal left edge = connector boundary
  const scale  = h / 100;
  const curve  = getCurve(seed);

  const d: string[] = [
    `M ${baseX} ${y}`,
    `L ${x + w} ${y}`,
    `L ${x + w} ${y + h}`,
    `L ${baseX} ${y + h}`,
  ];

  // Connector going UP the left edge (reversed samples)
  for (let i = curve.length - 1; i >= 0; i--) {
    const [tx, ty] = curve[i];
    d.push(
      `L ${baseX + ty * scale} ${y + (tx / 100) * h}`
    );
  }

  d.push(`Z`);
  return d.join(' ');
}

// ─── Connector-only path (just the shape curve, no rectangle) ────────────────
// Used for stroking only the cut line between left/right pieces.

export function connectorPath(
  x: number, y: number, h: number, seed: number = 0
): string {
  const scale = h / 100;
  const curve = getCurve(seed);

  const d: string[] = [`M ${x} ${y}`];
  for (const [tx, ty] of curve) {
    d.push(`L ${x + ty * scale} ${y + (tx / 100) * h}`);
  }
  d.push(`L ${x} ${y + h}`);
  return d.join(' ');
}

// ─── Layout calculation ───────────────────────────────────────────────────────

export interface PuzzleRowPosition {
  leftX:  number;
  rightX: number;
  y:      number;
  w:      number;
  h:      number;
}

export function puzzlePositions(
  pageHeight: number,
  pageWidth: number
): PuzzleRowPosition[] {
  const pieceW = pageWidth / 2;
  const pieceH = pageHeight / 3;

  return [0, 1, 2].map((i) => ({
    leftX:  0,
    rightX: pieceW,
    y:      i * pieceH,
    w:      pieceW,
    h:      pieceH,
  }));
}
