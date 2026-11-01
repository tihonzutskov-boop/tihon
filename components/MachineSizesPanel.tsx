import React, { useEffect, useMemo, useState } from 'react';
import { Ruler, Check, AlertTriangle } from 'lucide-react';
import { Gym, EquipmentItem } from '../types';
import { applyStandardSizes, countOffSize, unitsPerMetreOf, SizeReport } from '../utils/machineSizes';

// Puts every machine in the gym at its fixed real size in one go.
//
// Real sizes need the map's scale, and maps are drawn at whatever size looked
// right, so this asks for the room's real width first. That sets how many map
// units make a metre for this gym; nothing already drawn moves or changes size,
// only the machines are then sized in that scale.

interface Props {
  gym: Gym;
  equipment: EquipmentItem[];
  /** Saves the changed gym as one undoable step. */
  onChange: (gym: Gym) => void;
}

const oneDecimal = (v: number) => Math.round(v * 10) / 10;
const names = (list: string[], max = 5) =>
  list.length <= max ? list.join(', ') : `${list.slice(0, max).join(', ')} and ${list.length - max} more`;

const MachineSizesPanel: React.FC<Props> = ({ gym, equipment, onChange }) => {
  const dims = gym.dimensions || { width: 780, height: 580 };
  const upm = unitsPerMetreOf(dims);
  const roomWidth = oneDecimal(dims.width / upm);
  const roomLength = oneDecimal(dims.height / upm);
  const [realWidth, setRealWidth] = useState(String(roomWidth));
  const [report, setReport] = useState<SizeReport | null>(null);

  // The room was resized, or the scale set: start from what it is now.
  useEffect(() => { setRealWidth(String(roomWidth)); }, [roomWidth]);
  // A different gym: the last result no longer describes it.
  useEffect(() => { setReport(null); }, [gym.id]);

  const offSize = useMemo(() => countOffSize(gym, equipment), [gym, equipment]);
  const typed = parseFloat(realWidth.replace(',', '.'));
  const valid = Number.isFinite(typed) && typed >= 3 && typed <= 500;
  const newUpm = valid ? dims.width / typed : upm;
  const changingScale = valid && Math.abs(typed - roomWidth) >= 0.05;

  const apply = () => {
    if (!valid) return;
    const scaled = changingScale ? { ...gym, dimensions: { ...dims, unitsPerMetre: newUpm } } : gym;
    const result = applyStandardSizes(scaled, equipment);
    onChange(result.gym);
    setReport(result);
  };

  return (
    <div className="bg-slate-950/50 p-3 rounded border border-slate-800 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-white flex items-center"><Ruler className="w-3.5 h-3.5 mr-1.5 text-lime-400" />Machine sizes</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
          Every kind of machine has one real size. {offSize === 0
            ? 'All machines with a fixed size are at it.'
            : `${offSize} machine${offSize === 1 ? " isn't" : "s aren't"} at their fixed size yet.`}
        </p>
      </div>

      <div>
        <label className="block text-[10px] text-slate-500 mb-1 uppercase">How wide is this room in real life?</label>
        <div className="relative flex items-center">
          <input
            type="text" inputMode="decimal" value={realWidth}
            onChange={e => setRealWidth(e.target.value)}
            aria-label="Real room width in metres"
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-7 text-sm text-white focus:border-lime-500 focus:outline-none"
          />
          <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
        </div>
        <p className={`text-[10px] mt-1 leading-snug ${changingScale ? 'text-amber-300' : 'text-slate-500'}`}>
          {!valid
            ? 'Enter the width in metres.'
            : changingScale
              ? `The map has it as ${roomWidth} m. Machines will be sized for a ${oneDecimal(typed)} × ${oneDecimal(dims.height / newUpm)} m room; nothing else on the map moves.`
              : `Machines are sized for a ${roomWidth} × ${roomLength} m room.`}
        </p>
      </div>

      <button
        type="button" onClick={apply} disabled={!valid || (!changingScale && offSize === 0)}
        className="w-full py-2 rounded bg-lime-500 hover:bg-lime-400 disabled:opacity-40 disabled:hover:bg-lime-500 text-xs font-bold text-slate-950"
      >
        Apply fixed sizes
      </button>

      {report && (
        <div className="space-y-2 text-[10.5px] leading-snug" role="status">
          <p className="flex items-start gap-1.5 text-lime-300">
            <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{report.resized.length === 0 ? 'Nothing needed resizing.' : `Resized ${report.resized.length} machine${report.resized.length === 1 ? '' : 's'}.`} Undo puts it all back.</span>
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

export default MachineSizesPanel;
