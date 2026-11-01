import React from 'react';
import { MachineShape, CARDIO_SHAPES } from '../utils/machineShapes';

// A machine drawn as it looks from the ceiling, filling the footprint it was
// placed at on the map: a treadmill's belt and console, a rack's four posts and
// bar. Cardio is blue and free weights yellow, so the type reads before the
// machine does.
//
// Each drawing is a list of parts with a role (the frame, a pad, a bar…) in its
// own natural proportions; the palette decides how a role looks. Machines on
// the map have no direction yet, so a drawing turns a quarter to lie along its
// footprint's long side — a treadmill placed wider than long is lying sideways.

type Role = 'frame' | 'surface' | 'step' | 'console' | 'screen' | 'bar' | 'metal' | 'rail'
  | 'cushion' | 'cushion2' | 'plate' | 'hub' | 'outline' | 'wood' | 'post';
type Part = [Role, 'rect' | 'path' | 'circle' | 'ellipse', Record<string, number | string>];

interface Drawing { size: [number, number]; parts: Part[] }

const DRAWINGS: Record<Exclude<MachineShape, 'dumbbells'>, Drawing> = {
  treadmill: { size: [30, 60], parts: [
    ['frame', 'rect', { x: 1.5, y: 9, width: 27, height: 50, rx: 3 }],
    ['surface', 'rect', { x: 5.5, y: 15, width: 19, height: 41, rx: 1.5 }],
    ['step', 'path', { d: 'M5.5 21H24.5M5.5 27H24.5M5.5 33H24.5M5.5 39H24.5M5.5 45H24.5M5.5 51H24.5' }],
    ['console', 'rect', { x: 1, y: 1, width: 28, height: 9, rx: 3 }],
    ['screen', 'rect', { x: 9, y: 3, width: 12, height: 4.5, rx: 1 }],
    ['bar', 'path', { d: 'M3.5 10V25M26.5 10V25' }]] },
  bike: { size: [22, 44], parts: [
    ['frame', 'path', { d: 'M11 7C16 7 17 14 15.5 23L14 37C13.5 40 8.5 40 8 37L6.5 23C5 14 6 7 11 7Z' }],
    ['surface', 'rect', { x: 8.5, y: 12, width: 5, height: 11, rx: 2 }],
    ['bar', 'path', { d: 'M3 8.5Q11 3 19 8.5' }],
    ['screen', 'rect', { x: 8, y: 3, width: 6, height: 3.5, rx: 1 }],
    ['metal', 'path', { d: 'M4 26H8M14 26H18' }],
    ['cushion2', 'ellipse', { cx: 11, cy: 33, rx: 3.6, ry: 4.6 }]] },
  rower: { size: [14, 60], parts: [
    ['rail', 'rect', { x: 5.5, y: 13, width: 3, height: 46, rx: 1.5 }],
    ['frame', 'circle', { cx: 7, cy: 7.5, r: 6.5 }],
    ['surface', 'circle', { cx: 7, cy: 7.5, r: 3 }],
    ['bar', 'path', { d: 'M2 14.5H12' }],
    ['cushion', 'rect', { x: 1.5, y: 17, width: 4, height: 6, rx: 1 }],
    ['cushion', 'rect', { x: 8.5, y: 17, width: 4, height: 6, rx: 1 }],
    ['cushion2', 'rect', { x: 3.5, y: 36, width: 7, height: 7, rx: 2 }]] },
  elliptical: { size: [26, 60], parts: [
    ['frame', 'rect', { x: 3, y: 8, width: 20, height: 51, rx: 9 }],
    ['surface', 'rect', { x: 10, y: 14, width: 6, height: 40, rx: 3 }],
    ['cushion2', 'rect', { x: 4.5, y: 30, width: 5, height: 16, rx: 2 }],
    ['cushion2', 'rect', { x: 16.5, y: 22, width: 5, height: 16, rx: 2 }],
    ['console', 'rect', { x: 6, y: 1, width: 14, height: 7, rx: 2.5 }],
    ['screen', 'rect', { x: 9, y: 2.5, width: 8, height: 3.5, rx: 1 }],
    ['bar', 'path', { d: 'M2 6V27M24 6V27' }]] },
  stairs: { size: [30, 44], parts: [
    ['frame', 'rect', { x: 2, y: 8, width: 26, height: 35, rx: 3 }],
    ['surface', 'rect', { x: 6, y: 13, width: 18, height: 27, rx: 1.5 }],
    ['step', 'path', { d: 'M6 18.5H24M6 24H24M6 29.5H24M6 35H24' }],
    ['console', 'rect', { x: 5, y: 1, width: 20, height: 7, rx: 2.5 }],
    ['screen', 'rect', { x: 10, y: 2.5, width: 10, height: 3.5, rx: 1 }],
    ['bar', 'path', { d: 'M3.5 9V31M26.5 9V31' }]] },
  rack: { size: [45, 45], parts: [
    ['wood', 'rect', { x: 1, y: 1, width: 43, height: 43, rx: 2 }],
    ['outline', 'rect', { x: 7, y: 9, width: 31, height: 27 }],
    ['post', 'rect', { x: 4.5, y: 6.5, width: 5, height: 5 }],
    ['post', 'rect', { x: 35.5, y: 6.5, width: 5, height: 5 }],
    ['post', 'rect', { x: 4.5, y: 33.5, width: 5, height: 5 }],
    ['post', 'rect', { x: 35.5, y: 33.5, width: 5, height: 5 }],
    ['bar', 'path', { d: 'M0.5 22H44.5' }],
    ['plate', 'rect', { x: 2, y: 16, width: 3, height: 12, rx: 1 }],
    ['plate', 'rect', { x: 40, y: 16, width: 3, height: 12, rx: 1 }]] },
  // The pads are what you see of a bench, so they are the bright part here.
  bench: { size: [14, 40], parts: [
    ['surface', 'rect', { x: 4, y: 1, width: 6, height: 38, rx: 1 }],
    ['frame', 'rect', { x: 1.5, y: 2, width: 11, height: 24, rx: 4 }],
    ['frame', 'rect', { x: 1.5, y: 27, width: 11, height: 10, rx: 3.5 }]] },
};

// A rack holds as many pairs as its length fits, rather than a fixed nine
// stretched to whatever length it was placed at.
const dumbbellRack = (length: number): Drawing => {
  const H = 16;
  const W = Math.max(24, length);
  const pairs = Math.max(2, Math.floor((W - 4) / 10));
  const gap = (W - 4) / pairs;
  const parts: Part[] = [['frame', 'rect', { x: 1, y: 2.5, width: W - 2, height: 11, rx: 2 }]];
  for (let i = 0; i < pairs; i++) {
    const x = 2 + i * gap + (gap - 7.5) / 2;
    parts.push(['hub', 'rect', { x, y: 4.5, width: 2.2, height: 7, rx: 0.6 }]);
    parts.push(['hub', 'rect', { x: x + 5.3, y: 4.5, width: 2.2, height: 7, rx: 0.6 }]);
    parts.push(['metal', 'path', { d: `M${x + 2.2} 8H${x + 5.3}` }]);
  }
  return { size: [W, H], parts };
};

const PALETTE = {
  cardio: { solid: '#3b82f6', deep: '#1e3a8a', soft: '#bfdbfe' },
  free: { solid: '#eab308', deep: '#78350f', soft: '#fde68a' },
};

const line = (color: string, width: number) => ({ fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

const look = (role: Role, p: typeof PALETTE.cardio): React.SVGProps<SVGElement> => {
  switch (role) {
    case 'frame': case 'console': return { fill: p.solid, stroke: p.deep, strokeWidth: 0.6 };
    case 'rail': return { fill: p.solid, stroke: p.deep, strokeWidth: 0.6 };
    case 'surface': case 'screen': return { fill: p.deep };
    case 'step': return { ...line(p.soft, 0.6), strokeOpacity: 0.45 };
    case 'bar': return line(p.soft, 1.6);
    case 'metal': return line(p.soft, 1.4);
    case 'cushion': return { fill: p.deep, fillOpacity: 0.55 };
    case 'cushion2': return { fill: p.deep, fillOpacity: 0.85 };
    case 'plate': return { fill: p.deep, stroke: p.soft, strokeWidth: 0.7 };
    case 'hub': case 'post': return { fill: p.soft };
    case 'outline': return line(p.solid, 1.1);
    case 'wood': return { fill: p.solid, fillOpacity: 0.22, stroke: p.solid, strokeWidth: 0.6 };
  }
};

interface Props {
  shape: MachineShape;
  width: number;
  height: number;
}

const MachineTopView: React.FC<Props> = ({ shape, width, height }) => {
  const natural = shape === 'dumbbells' ? null : DRAWINGS[shape];
  // Lie along the footprint's long side: turn a quarter when the drawing's
  // long side and the footprint's disagree.
  const drawingIsLong = natural ? natural.size[1] >= natural.size[0] : false;
  const footprintIsLong = height >= width;
  const turned = drawingIsLong !== footprintIsLong;
  const boxW = turned ? height : width;
  const boxH = turned ? width : height;
  // Measured in the rack's own units: 16 across, so its length scales to match.
  const drawing = natural || dumbbellRack((boxW / boxH) * 16);
  const [W, H] = drawing.size;
  const palette = CARDIO_SHAPES.has(shape) ? PALETTE.cardio : PALETTE.free;

  return (
    <g transform={turned ? `translate(${width} 0) rotate(90)` : undefined} className="pointer-events-none">
      <g transform={`scale(${boxW / W} ${boxH / H})`}>
        {drawing.parts.map(([role, tag, attrs], i) =>
          React.createElement(tag, { key: i, ...attrs, ...look(role, palette) })
        )}
      </g>
    </g>
  );
};

export default MachineTopView;
