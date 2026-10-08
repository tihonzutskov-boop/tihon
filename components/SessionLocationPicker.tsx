import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, ArrowRight, Check, AlertTriangle } from 'lucide-react';

// The first step of a session: which of the chain's locations the client is at.
// The day is then checked against that location's equipment, and anything it
// cannot do comes back swapped for the closest thing it can. The client sees
// what changed before starting, so a different exercise on the floor is never a
// surprise. With nothing changed it goes straight on.

export interface LocationChange {
  from: string;
  /** What it became, or absent when it was left out. */
  to?: string;
  part?: 'warmup' | 'cooldown' | 'zone2';
}

const PART_LABEL = { warmup: 'Warm-up', cooldown: 'Cool-down', zone2: 'Zone 2 cardio' } as const;

export type LocationCheck =
  | { ok: true; changes: LocationChange[] }
  | { ok: false; error: string };

interface Props {
  dayName: string;
  chainName: string | null;
  locations: { id: string; name: string }[];
  usualId: string | null;
  /** The one to show as chosen: where they trained last, or their usual one. */
  initialId: string | null;
  onCancel: () => void;
  check: (gymId: string) => Promise<LocationCheck>;
  /** `checked` is false when the check failed and the client chose to go on anyway. */
  onContinue: (gymId: string, checked: boolean) => void;
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'checking'; gymId: string }
  | { kind: 'changes'; gymId: string; changes: LocationChange[] }
  | { kind: 'failed'; gymId: string; error: string };

const SessionLocationPicker: React.FC<Props> = ({
  dayName, chainName, locations, usualId, initialId, onCancel, check, onContinue,
}) => {
  const only = locations.length === 1 ? locations[0] : null;
  const [stage, setStage] = useState<Stage>(only ? { kind: 'checking', gymId: only.id } : { kind: 'pick' });
  const [chosen, setChosen] = useState<string | null>(
    locations.some(l => l.id === initialId) ? initialId : usualId,
  );
  const latest = useRef(0);
  const nameOf = (id: string) => locations.find(l => l.id === id)?.name || 'This location';

  const run = async (gymId: string) => {
    const ticket = ++latest.current;
    setStage({ kind: 'checking', gymId });
    const result = await check(gymId);
    if (ticket !== latest.current) return; // picked again meanwhile
    if (result.ok === false) { setStage({ kind: 'failed', gymId, error: result.error }); return; }
    if (result.changes.length === 0) { onContinue(gymId, true); return; }
    setStage({ kind: 'changes', gymId, changes: result.changes });
  };

  // One location: nothing to pick, only its equipment to check.
  useEffect(() => { if (only) run(only.id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const swapped = stage.kind === 'changes' ? stage.changes.filter(c => c.to) : [];
  const leftOut = stage.kind === 'changes' ? stage.changes.filter(c => !c.to) : [];

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950 text-slate-300 overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-md mx-auto min-h-full flex flex-col">
        <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-lime-400 to-lime-600 text-slate-950 font-black text-sm grid place-items-center flex-shrink-0">
            G
          </div>
          <span className="text-[13px] font-bold text-white">{dayName}</span>
          <span className="text-[10.5px] text-slate-500 ml-auto">Before you start</span>
        </header>

        <div className="px-4 py-5 flex-1 flex flex-col">
          {stage.kind === 'pick' && (
            <>
              <h2 className="text-lg font-extrabold text-white mb-1">Where are you training today?</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {chainName ? `${chainName} locations don't all have the same equipment. ` : ''}
                Your session is checked against the one you pick, and anything it doesn't have is swapped for something similar.
              </p>
              <div className="space-y-2" role="radiogroup" aria-label="Location">
                {locations.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen === l.id}
                    onClick={() => setChosen(l.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      chosen === l.id ? 'border-lime-500 bg-lime-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 flex-shrink-0 ${chosen === l.id ? 'text-lime-400' : 'text-slate-500'}`} />
                    <span className={`flex-1 text-sm font-bold ${chosen === l.id ? 'text-white' : 'text-slate-300'}`}>{l.name}</span>
                    {l.id === usualId && (
                      <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-slate-500">Usual</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-auto pt-6 flex gap-2">
                <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!chosen}
                  onClick={() => chosen && run(chosen)}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-slate-950"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {stage.kind === 'checking' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16" role="status">
              <Loader2 className="w-7 h-7 text-lime-400 animate-spin" />
              <p className="text-sm text-slate-300">Checking what {nameOf(stage.gymId)} has…</p>
              <button type="button" onClick={onCancel} className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-300">Cancel</button>
            </div>
          )}

          {stage.kind === 'changes' && (
            <>
              <h2 className="text-lg font-extrabold text-white mb-1">
                {stage.changes.length === 1 ? '1 change' : `${stage.changes.length} changes`} at {nameOf(stage.gymId)}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                This location doesn't have everything today's session uses.
                {swapped.length > 0 && ' Each swap moves the same way and works the same muscles, with the same sets and reps.'}
              </p>
              <ul className="space-y-2">
                {swapped.map((c, i) => (
                  <li key={`s${i}`} className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-3">
                    {c.part && <p className="text-[9.5px] font-extrabold uppercase tracking-wide text-slate-500 mb-0.5">{PART_LABEL[c.part]}</p>}
                    <p className="text-[11px] text-slate-500 line-through">{c.from}</p>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" /> {c.to}
                    </p>
                  </li>
                ))}
                {leftOut.map((c, i) => (
                  <li key={`l${i}`} className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3">
                    {c.part && <p className="text-[9.5px] font-extrabold uppercase tracking-wide text-slate-500 mb-0.5">{PART_LABEL[c.part]}</p>}
                    <p className="text-sm font-bold text-slate-200">{c.from}</p>
                    <p className="text-[11px] text-amber-300 mt-0.5">Nothing similar here, so it's left out today.</p>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6 flex gap-2">
                {!only && (
                  <button type="button" onClick={() => setStage({ kind: 'pick' })} className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    Other location
                  </button>
                )}
                {only && (
                  <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onContinue(stage.gymId, true)}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 text-slate-950"
                >
                  Start session <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {stage.kind === 'failed' && (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5" role="alert">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-200">Couldn't check {nameOf(stage.gymId)}'s equipment</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    You can try again, or start with your plan as it is.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-6 flex gap-2">
                <button type="button" onClick={() => onContinue(stage.gymId, false)} className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  Start anyway
                </button>
                <button type="button" onClick={() => run(stage.gymId)} className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 text-slate-950">
                  Try again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionLocationPicker;
