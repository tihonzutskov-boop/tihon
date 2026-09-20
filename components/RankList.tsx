import React, { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { dragTargetIndex, projectedIndex } from '../utils/reorder';

export interface RankItem {
  id: string;
  label: string;
}

interface RankListProps {
  items: RankItem[];
  onMove: (from: number, to: number) => void;
}

interface DragState {
  from: number;
  /** How far the dragged row is from its own slot, in pixels. */
  offset: number;
  /** Distance from one row to the next, gap included. */
  step: number;
  /** Released, and gliding into its slot before the order is committed. */
  settling: boolean;
}

const SETTLE_MS = 200;
const SLIDE = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

// A ranked list you reorder by dragging the handle, or with the arrow keys
// while it has focus. The rows in between slide out of the way as you go, and
// the dragged row glides into its slot on release; the order itself only
// changes once it has arrived, so the commit never makes anything jump.
const RankList: React.FC<RankListProps> = ({ items, onMove }) => {
  const [drag, setDrag] = useState<DragState | null>(null);
  // The handlers read the drag from here, not from the last render: a quick
  // flick can deliver a move before React has re-rendered from the press, and
  // a handler working from the render it was created in would miss it.
  const dragRef = useRef<DragState | null>(null);
  const update = (next: DragState | null) => { dragRef.current = next; setDrag(next); };
  const startY = useRef(0);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const over = drag ? dragTargetIndex(drag.from, drag.offset, drag.step, items.length) : -1;

  const rowStep = (index: number): number => {
    const a = rows.current[0];
    const b = rows.current[1];
    return a && b ? b.offsetTop - a.offsetTop : (rows.current[index]?.offsetHeight ?? 0) + 8;
  };

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (dragRef.current || items.length < 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Capture keeps the moves coming to the handle even once the pointer has
    // left it, which happens constantly — the row follows it out of the way.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
    startY.current = e.clientY;
    update({ from: index, offset: 0, step: rowStep(index), settling: false });
  };

  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.settling) return;
    const min = -d.from * d.step;
    const max = (items.length - 1 - d.from) * d.step;
    update({ ...d, offset: Math.max(min, Math.min(max, e.clientY - startY.current)) });
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.settling) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const slot = dragTargetIndex(d.from, d.offset, d.step, items.length);
    update({ from: d.from, step: d.step, offset: (slot - d.from) * d.step, settling: true });
    settleTimer.current = window.setTimeout(() => {
      if (slot !== d.from) onMove(d.from, slot);
      update(null);
    }, SETTLE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    onMove(index, index + (e.key === 'ArrowUp' ? -1 : 1));
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const dragging = drag !== null && i === drag.from;
        const lifted = dragging && !drag.settling;
        const shown = drag ? projectedIndex(i, drag.from, over) : i;
        const y = !drag ? 0 : dragging ? drag.offset : (shown - i) * drag.step;

        // The lifted row follows the pointer with no easing at all; everything
        // else eases. Easing the lifted row would make it lag behind the finger.
        const transition = !drag
          ? 'none'
          : lifted
            ? 'box-shadow 150ms, border-color 150ms'
            : `${SLIDE}, box-shadow 150ms, border-color 150ms`;

        return (
          <div
            key={item.id}
            ref={el => { rows.current[i] = el; }}
            style={{
              transform: y ? `translateY(${y}px)` : undefined,
              transition,
              zIndex: dragging ? 10 : undefined,
              willChange: drag ? 'transform' : undefined,
            }}
            className={`relative select-none flex items-center gap-3 bg-slate-800 border rounded-xl px-3.5 py-2.5 motion-reduce:!transition-none ${
              dragging ? 'border-lime-500/60 shadow-lg shadow-black/50' : 'border-slate-700'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">
              {shown + 1}
            </span>
            <span className="flex-1 text-sm font-bold text-white">{item.label}</span>
            {items.length > 1 && (
              <button
                type="button"
                aria-label={`Reorder ${item.label}. Drag, or use the up and down arrow keys.`}
                onPointerDown={e => startDrag(e, i)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={e => onKeyDown(e, i)}
                style={{ touchAction: 'none' }}
                className={`w-9 h-9 -mr-1.5 rounded-lg flex items-center justify-center flex-shrink-0 text-slate-500 hover:text-slate-200 focus-visible:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-500 transition-colors ${
                  lifted ? 'cursor-grabbing text-lime-400' : 'cursor-grab'
                }`}
              >
                <GripVertical className="w-5 h-5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RankList;
