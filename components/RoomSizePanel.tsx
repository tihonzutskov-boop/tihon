import React, { useEffect, useMemo, useState } from 'react';
import { Ruler, Check, AlertTriangle } from 'lucide-react';
import { Gym, EquipmentItem } from '../types';
import { applyStandardSizes, countOffSize, setRoomSize, unitsPerMetreOf, SizeReport } from '../utils/machineSizes';

// The room's real size, which the whole map is measured in.
//
// Maps are drawn at whatever size looked right on screen, so the room's real
// width sets how many map units make a metre for this gym: every zone keeps its
// place and is measured in the same metres as the room, and every machine goes
// to its real size. The length then sets how long the room is at that scale,
// and the zones stretch with it.
// The room's size and the scale machines are sized by used to be set in two
// places, and could disagree; now they are one.

interface Props {
  gym: Gym;
  equipment: EquipmentItem[];
  /** Saves the changed gym as one undoable step. */
  onChange: (gym: Gym) => void;
}

const twoDecimals = (v: number) => Math.round(v * 100) / 100;
const names = (list: string[], max = 5) =>
  list.length <= max ? list.join(', ') : `${list.slice(0, max).join(', ')} and ${list.length - max} more`;
const parse = (text: string) => parseFloat(text.replace(',', '.'));
const plausible = (v: number) => Number.isFinite(v) && v >= 3 && v <= 500;

const RoomSizePanel: React.FC<Props> = ({ gym, equipment, onChange }) => {
  const dims = gym.dimensions || { width: 780, height: 580 };
  const upm = unitsPerMetreOf(dims);
  const roomWidth = twoDecimals(dims.width / upm);
  const roomLength = twoDecimals(dims.height / upm);
  const [widthText, setWidthText] = useState(String(roomWidth));
  const [lengthText, setLengthText] = useState(String(roomLength));
  const [report, setReport] = useState<SizeReport | null>(null);

  // The room was resized on the map, or undone: start from what it is now.
  useEffect(() => { setWidthText(String(roomWidth)); }, [roomWidth]);
  useEffect(() => { setLengthText(String(roomLength)); }, [roomLength]);
  // A different gym: the last result no longer describes it.
  useEffect(() => { setReport(null); }, [gym.id]);

  const offSize = useMemo(() => countOffSize(gym, equipment), [gym, equipment]);
  const width = parse(widthText), length = parse(lengthText);
  const valid = plausible(width) && plausible(length);
  const widthChanged = valid && Math.abs(width - roomWidth) >= 0.01;
  const lengthChanged = valid && Math.abs(length - roomLength) >= 0.01;
  const changed = widthChanged || lengthChanged;

  const apply = () => {
    if (!valid) return;
    const result = changed ? setRoomSize(gym, width, length, equipment) : applyStandardSizes(gym, equipment);
    onChange(result.gym);
    setReport(result);
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div>
      <label className="block text-[10px] text-slate-500 mb-1 uppercase">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text" inputMode="decimal" value={value}
          onChange={e => { set(e.target.value); setReport(null); }}
          aria-label={`Real room ${label.toLowerCase()} in metres`}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-7 text-sm text-white focus:border-lime-500 focus:outline-none"
        />
        <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-950/50 p-3 rounded border border-slate-800 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-white flex items-center"><Ruler className="w-3.5 h-3.5 mr-1.5 text-lime-400" />Room size</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
          The room's size in real life. Zones and machines are measured in the same metres, so every machine is drawn at its real size in it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field('Width', widthText, setWidthText)}
        {field('Length', lengthText, setLengthText)}
      </div>

      <p className={`text-[10px] leading-snug ${changed ? 'text-amber-300' : 'text-slate-500'}`}>
        {!valid
          ? "Enter the room's width and length in metres."
          : widthChanged
            ? `The map has the room ${roomWidth} m wide. It will be scaled to ${width} m: every zone keeps its place and grows or shrinks with the room, and machines go to their real size.${lengthChanged ? ` The room will be ${length} m long, the zones stretching with it.` : ''}`
            : lengthChanged
              ? `The room will be ${length} m long instead of ${roomLength} m. The zones stretch with it; machines keep their real size.`
              : offSize === 0
                ? 'Every machine with a fixed size is at it.'
                : `${offSize} machine${offSize === 1 ? " isn't" : "s aren't"} at their real size yet.`}
      </p>

      <button
        type="button" onClick={apply} disabled={!valid || (!changed && offSize === 0)}
        className="w-full py-2 rounded bg-lime-500 hover:bg-lime-400 disabled:opacity-40 disabled:hover:bg-lime-500 text-xs font-bold text-slate-950"
      >
        {changed || offSize === 0 ? 'Set room size' : 'Put machines at their real size'}
      </button>

      {report && (
        <div className="space-y-2 text-[10.5px] leading-snug" role="status">
          <p className="flex items-start gap-1.5 text-lime-300">
            <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{report.resized.length === 0 ? 'No machine needed resizing.' : `Resized ${report.resized.length} machine${report.resized.length === 1 ? '' : 's'} to their real size.`} Undo puts it all back.</span>
          </p>
          {report.overlaps.length > 0 && (
            <p className="flex items-start gap-1.5 text-amber-300">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                {report.overlaps.length === 1 ? 'Two machines now overlap' : `${report.overlaps.length} pairs now overlap`}, so move them apart in the machine editor: {names(report.overlaps.map(([a, b]) => `${a.name || 'Unnamed'} and ${b.name || 'Unnamed'}`), 4)}.
              </span>
            </p>
          )}
          {report.unknown.length > 0 && (
            <p className="text-slate-500">
              No size yet, so left as drawn: {names(report.unknown.map(r => r.name || 'Unnamed'))}. Give their Equipment Library items a real size to fix them too.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RoomSizePanel;
