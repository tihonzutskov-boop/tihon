import React from 'react';
import { CableLayout } from '../types';
import { DRAWINGS, DrawnKind, Drawing, Palette, dumbbellRack, lookOf, paletteOf } from '../utils/machineDrawings';
import { cableStationDrawing, readCableLayout } from '../utils/cableStation';

// A machine drawn as it looks from the ceiling, filling the footprint it was
// placed at on the map, in three shades of its zone's colour so it reads as
// part of the zone.
//
// Drawings stand upright, front at the top. Machines on the map have no
// direction yet, so a drawing turns a quarter to lie along its footprint's
// long side — a treadmill placed wider than long is lying sideways.

/** A drawing's parts, painted in a palette. */
export const DrawingParts: React.FC<{ drawing: Drawing; palette: Palette }> = ({ drawing, palette }) => (
  <>
    {drawing.parts.map(([role, tag, attrs], i) =>
      React.createElement(tag, { key: i, ...attrs, ...lookOf(role, palette, drawing.u) })
    )}
  </>
);

interface Props {
  shape: DrawnKind;
  width: number;
  height: number;
  /** The zone's colour, which the machine is drawn in. */
  color?: string;
  cableLayout?: CableLayout;
}

const naturalDrawing = (shape: DrawnKind, cableLayout?: CableLayout): Drawing | null =>
  shape === 'dumbbells' ? null
    : shape === 'cableStation' ? cableStationDrawing(readCableLayout(cableLayout))
    : DRAWINGS[shape];

const MachineTopView: React.FC<Props> = ({ shape, width, height, color, cableLayout }) => {
  const natural = naturalDrawing(shape, cableLayout);
  // Lie along the footprint's long side: turn a quarter when the drawing's
  // long side and the footprint's disagree.
  const drawingIsLong = natural ? natural.size[1] >= natural.size[0] : true;
  const footprintIsLong = height >= width;
  const turned = drawingIsLong !== footprintIsLong;
  const boxW = turned ? height : width;
  const boxH = turned ? width : height;
  // Measured in the rack's own units: 80 across, so its length scales to match.
  const drawing = natural || dumbbellRack((boxH / boxW) * 80);
  const [W, H] = drawing.size;

  return (
    <g transform={turned ? `translate(${width} 0) rotate(90)` : undefined} className="pointer-events-none">
      <g transform={`scale(${boxW / W} ${boxH / H})`}>
        <DrawingParts drawing={drawing} palette={paletteOf(color)} />
      </g>
    </g>
  );
};

export default MachineTopView;
