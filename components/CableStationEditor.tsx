import React, { useState } from 'react';
import { CableLayout } from '../types';
import { DrawingParts } from './MachineTopView';
import { paletteOf } from '../utils/machineDrawings';
import {
  DEFAULT_CABLE_LAYOUT, MAX_TOWERS, SEAT_NAMES, SideChoice, cableStationDrawing, cableStationExtent,
  choiceAt, fits, setSide, sideBoxes, sideLabel, sidesOf, towerCentres,
} from '../utils/cableStation';

// A cable station's extensions: tap a side of a tower, then give it a seat, a
// bench or a new weight tower joined by a pull-up bar. Its size on the map
// follows from what it's built of.

const CHOICES: [SideChoice, string][] = [['', 'Nothing'], ['pulldown', SEAT_NAMES.pulldown], ['row', SEAT_NAMES.row], ['tower', 'Weight tower']];

interface Props {
  layout: CableLayout;
  /** The zone's colour, which the station is drawn in. */
  color?: string;
  onChange: (layout: CableLayout) => void;
}

const CableStationEditor: React.FC<Props> = ({ layout, color, onChange }) => {
  const sides = sidesOf(layout);
  const [picked, setPicked] = useState<string | null>(null);
  // The bottom end of the last tower until a side is tapped.
  const side = picked && sides.includes(picked) ? picked : sides[sides.length - 1];
  const now = choiceAt(layout, side);

  const drawing = cableStationDrawing(layout);
  const boxes = sideBoxes(layout);
  const [W, H] = drawing.size;
  // The view takes in the empty sides as well as the station.
  const x0 = Math.min(0, ...boxes.map(b => b.box.x)) - 60;
  const y0 = Math.min(0, ...boxes.map(b => b.box.y)) - 60;
  const x1 = Math.max(W, ...boxes.map(b => b.box.x + b.box.width)) + 60;
  const y1 = Math.max(H, ...boxes.map(b => b.box.y + b.box.height)) + 60;

  const blocked = CHOICES.filter(([c]) => c && c !== now && !fits(layout, side, c)).map(([c]) => c);
  const full = blocked.includes('tower') && layout.towers.length >= MAX_TOWERS;
  const why = [
    blocked.some(c => c !== 'tower' || !full) && 'no room on this side, it would run into another part',
    full && `${MAX_TOWERS} towers is the most`,
  ].filter(Boolean).join('; ');
  const n = layout.towers.length;
  const seats = Object.keys(layout.stations).length;
  const [w, h] = cableStationExtent(layout);

  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-semibold">Extensions</span>
        <span className="text-[11px] font-mono text-slate-300">{w} × {h} m</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">
        Tap a + beside a tower for a seat, a bench or another weight tower joined by a pull-up bar. Tap a pull-up bar to change what's beyond it.
      </p>
      <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="w-full h-56 rounded bg-slate-950">
        <rect x={-36} y={-36} width={W + 72} height={H + 72} rx={36} fill={color || '#64748b'} fillOpacity={0.42} />
        <DrawingParts drawing={drawing} palette={paletteOf(color)} />
        {towerCentres(layout).map(([cx, cy], i) => (
          <text key={i} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={72} fontWeight={800} fill="#fff" fillOpacity={0.85} pointerEvents="none">{i + 1}</text>
        ))}
        {boxes.map(({ key, choice, box }) => {
          const on = key === side;
          return (
            <g key={key} className="cursor-pointer" onClick={() => setPicked(key)}>
              <rect
                x={box.x - 10} y={box.y - 10} width={box.width + 20} height={box.height + 20} rx={22}
                fill="transparent" stroke={on ? '#a3e635' : choice ? 'transparent' : '#64748b'} strokeWidth={6} strokeDasharray="16 12"
              />
              {!choice && (
                <path
                  d={`M${box.x + box.width / 2 - 22} ${box.y + box.height / 2}h44M${box.x + box.width / 2} ${box.y + box.height / 2 - 22}v44`}
                  stroke={on ? '#a3e635' : '#94a3b8'} strokeWidth={8} strokeLinecap="round"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{sideLabel(layout, side)}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {CHOICES.map(([choice, name]) => (
          <button
            key={choice || 'none'}
            type="button"
            disabled={blocked.includes(choice)}
            onClick={() => { if (choice !== now) onChange(setSide(layout, side, choice)); }}
            className={`px-2 py-1.5 rounded border text-[11px] font-bold text-left transition-colors disabled:opacity-35 disabled:cursor-default ${
              choice === now ? 'bg-lime-500 border-lime-500 text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500'}`}
          >
            {name}
          </button>
        ))}
      </div>
      {blocked.length > 0 && (
        <p className="text-[10px] text-slate-500 leading-snug">
          Greyed out: {why}.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">{n} {n === 1 ? 'tower' : 'towers'}, {4 * n} weight stacks, {seats} {seats === 1 ? 'seat' : 'seats'}</span>
        <button
          type="button"
          onClick={() => { setPicked(null); onChange(DEFAULT_CABLE_LAYOUT); }}
          className="shrink-0 whitespace-nowrap px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-200"
        >
          Back to standard
        </button>
      </div>
    </div>
  );
};

export default CableStationEditor;
