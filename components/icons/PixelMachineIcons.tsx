import React from 'react';
import type { LucideProps } from 'lucide-react';

// Hand-drawn pixel-art gym equipment icons, replacing lucide-react for the
// machine icon set (utils/equipmentIcons.ts MACHINE_ICONS_LIST / ICON_MAP).
// No open pixel-art icon set (including Streamline's actual free "Pixel"
// pack) has real gym equipment icons — they're generic UI packs — so these
// are original artwork on a 16x16 grid (32x32 viewBox, 2 units/cell).

const GRID = 16;
const CELL = 2;
const VIEWBOX = GRID * CELL;

type Cell = [number, number];

function block(x1: number, y1: number, x2: number, y2: number): Cell[] {
  const out: Cell[] = [];
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) out.push([x, y]);
  return out;
}
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
function ring(cx: number, cy: number, rOuter: number, rInner: number): Cell[] {
  const out: Cell[] = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) {
    const d = dist(x + 0.5, y + 0.5, cx, cy);
    if (d <= rOuter && d >= rInner) out.push([x, y]);
  }
  return out;
}
function disc(cx: number, cy: number, r: number): Cell[] {
  const out: Cell[] = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) {
    if (dist(x + 0.5, y + 0.5, cx, cy) <= r) out.push([x, y]);
  }
  return out;
}

function createPixelIcon(cells: Cell[]): React.FC<LucideProps> {
  const PixelIcon: React.FC<LucideProps> = ({ size = 24, color, className, style, ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      className={className}
      style={style}
      fill={color || 'currentColor'}
      {...rest}
    >
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * CELL} y={y * CELL} width={CELL} height={CELL} />
      ))}
    </svg>
  );
  return PixelIcon;
}

// Dumbbell — two plate blocks + connecting bar
export const Dumbbell = createPixelIcon([
  ...block(0, 4, 3, 11),
  ...block(12, 4, 15, 11),
  ...block(4, 7, 11, 8),
]);

// Footprints (Treadmill / Running) — two footprints; reads far more clearly
// at low-res than trying to draw the whole machine
export const Footprints = createPixelIcon([
  ...disc(5, 11.5, 3.1), ...disc(5, 7, 1.7), // back foot: pad + toes
  ...disc(11.5, 7, 2.6), ...disc(11.5, 3, 1.4), // front foot (mid-stride): pad + toes
]);

// Bike (Exercise Bike / Cycle) — two wheel rings + frame + seat + handlebar
export const Bike = createPixelIcon([
  ...ring(4, 11, 3.3, 2.1), ...ring(12, 11, 3.3, 2.1), // wheels
  ...block(4, 7, 5, 10), ...block(5, 7, 11, 8), ...block(10, 7, 11, 10), // frame
  ...block(3, 5, 6, 6), // seat
  ...block(10, 5, 13, 6), ...block(11, 6, 12, 7), // handlebar + post
]);

// Waves (Rowing Machine / Rower) — rail + footrest + seat + flywheel housing
export const Waves = createPixelIcon([
  ...block(1, 13, 14, 14), // rail
  ...block(1, 9, 3, 12), // footrest
  ...block(7, 11, 9, 12), // seat
  ...disc(13, 10, 2.2), // flywheel housing
  ...block(12, 12, 13, 13), // chain down to seat height
]);

// Weight (Squat Rack / Barbell) — two uprights, j-hooks, bar
export const Weight = createPixelIcon([
  ...block(1, 1, 3, 13), ...block(12, 1, 14, 13),
  ...block(1, 13, 3, 14), ...block(12, 13, 14, 14),
  ...block(4, 5, 11, 6),
  ...block(1, 5, 3, 5), ...block(12, 5, 14, 5),
]);

// BicepsFlexed (Bench Press / Arms) — rack posts + loaded bar + bench pad on legs
export const BicepsFlexed = createPixelIcon([
  ...block(2, 10, 13, 11), // bench pad
  ...block(2, 12, 4, 14), ...block(11, 12, 13, 14), // bench legs
  ...block(1, 3, 2, 9), ...block(13, 3, 14, 9), // rack posts
  ...block(1, 2, 5, 3), ...block(10, 2, 14, 3), // plates near posts
  ...block(4, 4, 11, 5), // barbell
]);

// Sliders (Cable Machine / Pulleys) — cable-crossover silhouette: two angled
// arms meeting low in the middle, distinct from every other icon in the set
const cableMachineCells: Cell[] = [];
for (let i = 0; i < 7; i++) {
  cableMachineCells.push([2 + i, 1 + i], [3 + i, 1 + i]); // left arm, 2px thick
  cableMachineCells.push([13 - i, 1 + i], [12 - i, 1 + i]); // right arm, mirrored
}
export const Sliders = createPixelIcon([
  ...cableMachineCells,
  ...block(6, 9, 9, 10), ...block(6, 11, 9, 12), // meeting point + handle
]);

// Disc (Leg Press / Plate Loaded) — alternating-width stacked plates
export const Disc = createPixelIcon([
  ...block(3, 3, 12, 4),
  ...block(1, 7, 14, 8),
  ...block(3, 11, 12, 12),
  ...block(4, 14, 11, 15),
]);

// HeartPulse (Cardio / Aerobics) — two round lobes tapering to a point, pulse line beneath
export const HeartPulse = createPixelIcon([
  ...disc(5.5, 4.5, 2.5), ...disc(10.5, 4.5, 2.5),
  ...block(4, 7, 12, 7), ...block(5, 8, 11, 8), ...block(6, 9, 10, 9), ...block(7, 10, 9, 10), ...block(7.5, 11, 8.5, 11),
  ...block(0, 13, 4, 13), [5, 12], [6, 13], [7, 12], [8, 14], [9, 12], [10, 13], ...block(11, 13, 15, 13),
]);

// Flame (Functional Turf / HIIT) — teardrop
export const Flame = createPixelIcon([
  ...block(7, 1, 8, 1),
  ...block(6, 2, 9, 2),
  ...block(5, 3, 6, 4), ...block(9, 3, 10, 4),
  ...block(4, 5, 5, 7), ...block(10, 5, 11, 7),
  ...block(4, 8, 5, 9), ...block(10, 8, 11, 9),
  ...block(5, 10, 6, 10), ...block(9, 10, 10, 10),
  ...block(6, 11, 9, 13),
  ...block(7, 10, 8, 12),
]);

// Gauge (Weight Stack / Machine) — rails + plate lines + selector pin
export const Gauge = createPixelIcon([
  ...block(4, 1, 5, 13), ...block(10, 1, 11, 13),
  ...block(4, 3, 11, 3), ...block(4, 6, 11, 6), ...block(4, 9, 11, 9), ...block(4, 12, 11, 12),
  ...block(6, 13, 9, 15),
]);

// Shield (Power Rig / Safety Cage) — uprights, top bar, mid safety bar, safety pins
export const Shield = createPixelIcon([
  ...block(1, 1, 3, 14), ...block(12, 1, 14, 14),
  ...block(1, 1, 14, 2),
  ...block(1, 8, 14, 9),
  ...block(4, 4, 5, 13), ...block(10, 4, 11, 13),
]);
