import React, { useState } from 'react';
import { WorkoutDay, Exercise, SetDetail, SessionBlock, SessionBlockType, LibraryExercise } from '../types';
import { ChevronUp, ChevronDown, X, Plus, Minus, GripVertical } from 'lucide-react';

interface SessionBuilderProps {
  day: WorkoutDay;
  onChange: (day: WorkoutDay) => void;
  targetDurationMin: number;
  libraryExercises: LibraryExercise[];
  onCreateLibraryExercise?: () => void;
  onSave: () => void;
  onClear: () => void;
  onClose?: () => void;
}

const TYPE_META: Record<SessionBlockType, { label: string; desc: string }> = {
  single: { label: 'Single Exercise', desc: 'One exercise, its own sets' },
  superset: { label: 'Superset', desc: '2+ exercises done back-to-back' },
  circuit: { label: 'Circuit', desc: 'A rotation repeated for rounds' },
  warmup: { label: 'Warm Up', desc: 'Flagged separately in the outline' },
  cooldown: { label: 'Cool Down', desc: 'Flagged separately in the outline' },
};

const blankSet = (): SetDetail => ({ reps: '', weight: '', restSec: 60 });

const blankExercise = (): Exercise => ({
  id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  targetMuscle: '',
  sets: 3,
  reps: '',
  equipmentId: 'manual',
  setDetails: [blankSet(), blankSet(), blankSet()],
});

// Same heuristic used across the app's other duration estimates: 30 sec of
// work per 8 reps, plus each set's own rest.
const exerciseMinutes = (ex: Exercise): number => {
  const sets = ex.setDetails && ex.setDetails.length > 0 ? ex.setDetails : [{ reps: String(ex.reps || 8), weight: '', restSec: 60 }];
  const totalSec = sets.reduce((a, s) => {
    const reps = parseFloat(s.reps) || 8;
    return a + (reps / 8) * 30 + (s.restSec ?? 60);
  }, 0);
  return totalSec / 60;
};

const exerciseVolume = (ex: Exercise): number => {
  const sets = ex.setDetails || [];
  return sets.reduce((a, s) => a + (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0), 0);
};

const exerciseReps = (ex: Exercise): number => {
  const sets = ex.setDetails || [];
  return sets.reduce((a, s) => a + (parseFloat(s.reps) || 0), 0);
};

// Days created before blocks existed (or edited outside the builder) have no
// `blocks` array — treat every exercise as its own Single Exercise block.
const blocksFor = (day: WorkoutDay): SessionBlock[] =>
  day.blocks && day.blocks.length > 0
    ? day.blocks
    : day.exercises.map(ex => ({ id: `blk-${ex.id}`, type: 'single' as SessionBlockType, exerciseIds: [ex.id] }));

const letterFor = (index: number) => String.fromCharCode(65 + index);

const SessionBuilder: React.FC<SessionBuilderProps> = ({
  day, onChange, targetDurationMin, libraryExercises, onCreateLibraryExercise, onSave, onClear, onClose,
}) => {
  const [openComboFor, setOpenComboFor] = useState<string | null>(null); // exercise id
  const [comboSearch, setComboSearch] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const blocks = blocksFor(day);
  const exercisesById = new Map<string, Exercise>(day.exercises.map(ex => [ex.id, ex]));

  const totals = day.exercises.reduce(
    (acc, ex) => ({
      exercises: acc.exercises + 1,
      sets: acc.sets + (ex.setDetails?.length || 0),
      reps: acc.reps + exerciseReps(ex),
      volume: acc.volume + exerciseVolume(ex),
      minutes: acc.minutes + exerciseMinutes(ex),
    }),
    { exercises: 0, sets: 0, reps: 0, volume: 0, minutes: 0 }
  );
  const minutes = Math.round(totals.minutes);
  const atCapacity = targetDurationMin > 0 && minutes >= targetDurationMin;
  const pct = targetDurationMin > 0 ? Math.min((minutes / targetDurationMin) * 100, 100) : 0;
  const fillTone = minutes >= targetDurationMin ? 'full' : minutes / (targetDurationMin || 1) >= 0.8 ? 'near' : 'ok';

  const setBlocks = (nextBlocks: SessionBlock[], nextExercises?: Exercise[]) => {
    onChange({ ...day, blocks: nextBlocks, exercises: nextExercises || day.exercises });
  };
  const setExercises = (nextExercises: Exercise[]) => {
    onChange({ ...day, blocks, exercises: nextExercises });
  };

  const addBlock = (type: SessionBlockType) => {
    const isGroup = type === 'superset' || type === 'circuit';
    const newExs = isGroup ? [blankExercise(), blankExercise()] : [blankExercise()];
    const newBlock: SessionBlock = {
      id: `blk-${Date.now()}`,
      type,
      title: type === 'superset' ? 'Superset' : type === 'circuit' ? 'Circuit' : undefined,
      exerciseIds: newExs.map(e => e.id),
    };
    setBlocks([...blocks, newBlock], [...day.exercises, ...newExs]);
    setAddMenuOpen(false);
  };
  const removeBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setBlocks(
      blocks.filter(b => b.id !== blockId),
      day.exercises.filter(ex => !block.exerciseIds.includes(ex.id))
    );
  };
  const moveBlock = (blockId: string, dir: -1 | 1) => {
    const i = blocks.findIndex(b => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const updateBlockTitle = (blockId: string, title: string) => {
    setBlocks(blocks.map(b => (b.id === blockId ? { ...b, title } : b)));
  };
  const addExerciseToBlock = (blockId: string) => {
    const newEx = blankExercise();
    setBlocks(
      blocks.map(b => (b.id === blockId ? { ...b, exerciseIds: [...b.exerciseIds, newEx.id] } : b)),
      [...day.exercises, newEx]
    );
  };

  const updateExercise = (exId: string, patch: Partial<Exercise>) => {
    setExercises(day.exercises.map(ex => (ex.id === exId ? { ...ex, ...patch } : ex)));
  };
  const changeSetCount = (exId: string, delta: number) => {
    const ex = exercisesById.get(exId);
    if (!ex) return;
    const sets = ex.setDetails || [];
    const nextSets = delta > 0 ? [...sets, blankSet()] : sets.length > 1 ? sets.slice(0, -1) : sets;
    updateExercise(exId, { setDetails: nextSets, sets: nextSets.length });
  };
  const updateSet = (exId: string, setIdx: number, field: keyof SetDetail, value: string) => {
    const ex = exercisesById.get(exId);
    if (!ex) return;
    const sets = [...(ex.setDetails || [])];
    const nextValue = field === 'restSec' ? (parseInt(value, 10) || 0) : value;
    sets[setIdx] = { ...sets[setIdx], [field]: nextValue } as SetDetail;
    // Set 1's reps/weight cascade forward — most sets share the same reps/weight,
    // so this saves retyping each row. Rest is excluded: it's meant to vary per set.
    if (setIdx === 0 && (field === 'reps' || field === 'weight')) {
      for (let i = 1; i < sets.length; i++) sets[i] = { ...sets[i], [field]: nextValue } as SetDetail;
    }
    updateExercise(exId, { setDetails: sets, sets: sets.length, reps: sets[0]?.reps || '' });
  };
  const pickExercise = (exId: string, le: LibraryExercise) => {
    updateExercise(exId, {
      name: le.name,
      targetMuscle: le.targetMuscle || 'Full Body',
      notes: le.instructions ? le.instructions.substring(0, 100) : undefined,
      videoUrl: le.videoUrl,
      makeHarder: le.makeHarder,
      makeEasier: le.makeEasier,
      libraryExerciseId: le.id,
    });
    setOpenComboFor(null);
    setComboSearch('');
  };

  const filteredLibrary = libraryExercises.filter(le => {
    const q = comboSearch.trim().toLowerCase();
    if (!q) return true;
    return le.name.toLowerCase().includes(q) || le.targetMuscle.toLowerCase().includes(q);
  });

  const renderExerciseEditor = (exId: string, nested: boolean) => {
    const ex = exercisesById.get(exId);
    if (!ex) return null;
    const sets = ex.setDetails || [];
    const isOpen = openComboFor === exId;

    return (
      <div key={exId} className={nested ? 'bg-slate-900 border border-slate-800 rounded-xl p-3 mb-2.5' : 'px-4 pb-4'}>
        <div className="flex items-center gap-2.5 mb-3 relative">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-extrabold text-slate-500 flex-shrink-0">
            {ex.name ? ex.name.split(' ').map(w => w[0]).slice(0, 2).join('') : '?'}
          </div>
          <div className="flex-1 relative">
            <input
              value={isOpen ? comboSearch : ex.name}
              onFocus={() => { setOpenComboFor(exId); setComboSearch(''); }}
              onChange={e => setComboSearch(e.target.value)}
              onBlur={() => setTimeout(() => setOpenComboFor(cur => (cur === exId ? null : cur)), 150)}
              placeholder="Type or select exercise"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-lime-500 transition-colors"
            />
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-lime-500/30 rounded-lg max-h-52 overflow-y-auto z-20 shadow-2xl">
                {filteredLibrary.map(le => (
                  <button
                    key={le.id}
                    type="button"
                    onClick={() => pickExercise(exId, le)}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-lime-500/10 hover:text-lime-400 transition-colors border-b border-slate-700/50 last:border-none"
                  >
                    {le.name}
                    <div className="text-[10px] font-medium text-slate-500">{le.targetMuscle}</div>
                  </button>
                ))}
                {onCreateLibraryExercise && (
                  <button
                    type="button"
                    onClick={() => { setOpenComboFor(null); onCreateLibraryExercise(); }}
                    className="w-full py-2 text-center text-[10.5px] font-extrabold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-colors"
                  >
                    + Create New Exercise
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => changeSetCount(exId, -1)}
            className="w-6 h-6 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:border-lime-500 hover:text-lime-400 flex items-center justify-center transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[11px] font-extrabold text-slate-300 min-w-[54px]">{sets.length} Sets</span>
          <button
            type="button"
            onClick={() => changeSetCount(exId, 1)}
            className="w-6 h-6 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:border-lime-500 hover:text-lime-400 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
              <th className="text-center w-6 pb-1.5">#</th>
              <th className="text-left pb-1.5 px-2">Reps</th>
              <th className="text-left pb-1.5 px-2">Weight (kg)</th>
              <th className="text-left pb-1.5 px-2">Rest (sec)</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s, i) => (
              <tr key={i}>
                <td className="text-center text-[11px] font-extrabold text-slate-500 py-0.5">{i + 1}</td>
                <td className="px-2 py-0.5">
                  <input
                    value={s.reps}
                    onChange={e => updateSet(exId, i, 'reps', e.target.value)}
                    placeholder="—"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-[11.5px] font-bold text-white outline-none focus:border-lime-500 transition-colors"
                  />
                </td>
                <td className="px-2 py-0.5">
                  <input
                    value={s.weight}
                    onChange={e => updateSet(exId, i, 'weight', e.target.value)}
                    placeholder="—"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-[11.5px] font-bold text-white outline-none focus:border-lime-500 transition-colors"
                  />
                </td>
                <td className="px-2 py-0.5">
                  <input
                    value={s.restSec}
                    onChange={e => updateSet(exId, i, 'restSec', e.target.value)}
                    placeholder="60"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-[11.5px] font-bold text-white outline-none focus:border-lime-500 transition-colors"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right text-[10.5px] font-extrabold text-slate-400 mt-1.5">{exerciseVolume(ex).toLocaleString()} kg</p>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Summary column */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 overflow-y-auto">
        <div className="p-4 pb-2">
          <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">Summary</h4>
          <input
            value={day.name}
            onChange={e => onChange({ ...day, name: e.target.value })}
            className="w-full bg-transparent text-sm font-extrabold text-white outline-none border-b border-transparent focus:border-lime-500 transition-colors"
          />
        </div>
        <div className="px-4 pb-3 space-y-0">
          {[
            ['Exercises', totals.exercises],
            ['Sets', totals.sets],
            ['Reps', totals.reps],
            ['Volume', `${totals.volume.toLocaleString()} kg`],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-center justify-between py-1.5 border-b border-white/5">
              <span className="text-[11.5px] font-bold text-slate-400">{k}</span>
              <span className="text-[12.5px] font-extrabold tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wide">Duration</span>
            <span className="text-[11.5px] font-extrabold tabular-nums">{minutes} / {targetDurationMin} min</span>
          </div>
          <div className="h-2 rounded-full bg-slate-950 overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all ${fillTone === 'full' ? 'bg-red-400' : fillTone === 'near' ? 'bg-amber-400' : 'bg-lime-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`text-[10px] font-bold ${fillTone === 'full' ? 'text-red-400' : fillTone === 'near' ? 'text-amber-400' : 'text-slate-500'}`}>
            {minutes >= targetDurationMin
              ? 'At capacity — remove or shorten something to add more'
              : `${targetDurationMin - minutes} min left`}
          </p>
        </div>
        <div className="px-3 py-3 space-y-2">
          {blocks.map((b, bi) => {
            const meta = TYPE_META[b.type];
            const isGroup = b.type === 'superset' || b.type === 'circuit';
            const primary = exercisesById.get(b.exerciseIds[0]);
            return (
              <div key={b.id}>
                <div className="flex items-start gap-2 px-1 py-1">
                  <div className="w-5 h-5 rounded-full border border-lime-500 text-lime-400 text-[9.5px] font-extrabold flex items-center justify-center flex-shrink-0">
                    {letterFor(bi)}
                  </div>
                  <div>
                    <div className="text-[11.5px] font-extrabold flex items-center gap-1.5">
                      {isGroup ? (b.title || meta.label) : (primary?.name || 'New exercise')}
                      {(b.type === 'warmup' || b.type === 'cooldown') && (
                        <span className={`text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${b.type === 'warmup' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'}`}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                    {!isGroup && primary && (
                      <div className="text-[10px] text-slate-500">{(primary.setDetails?.length || 0)} sets · {exerciseVolume(primary).toLocaleString()} kg</div>
                    )}
                  </div>
                </div>
                {isGroup && b.exerciseIds.map((exId, ei) => {
                  const ex = exercisesById.get(exId);
                  if (!ex) return null;
                  return (
                    <div key={exId} className="flex items-start gap-2 px-1 py-1 ml-5">
                      <div className="w-[17px] h-[17px] rounded-full border border-slate-600 text-slate-400 text-[8.5px] font-extrabold flex items-center justify-center flex-shrink-0">
                        {letterFor(bi)}{ei + 1}
                      </div>
                      <div>
                        <div className="text-[11px] font-extrabold">{ex.name || 'New exercise'}</div>
                        <div className="text-[10px] text-slate-500">{(ex.setDetails?.length || 0)} sets · {exerciseVolume(ex).toLocaleString()} kg</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 overflow-y-auto p-5">
        {blocks.map((b, bi) => {
          const meta = TYPE_META[b.type];
          const isGroup = b.type === 'superset' || b.type === 'circuit';
          return (
            <div
              key={b.id}
              className={`bg-slate-900 border border-slate-800 rounded-2xl mb-3.5 overflow-visible ${
                b.type === 'warmup' ? 'border-l-2 border-l-amber-400' : b.type === 'cooldown' ? 'border-l-2 border-l-sky-400' : ''
              } ${isGroup ? 'bg-slate-950/40' : ''}`}
            >
              <div className="flex items-center gap-2.5 px-4 py-3">
                <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                <div className="w-6 h-6 rounded-full border border-lime-500 text-lime-400 text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">
                  {letterFor(bi)}
                </div>
                {isGroup ? (
                  <input
                    value={b.title || ''}
                    onChange={e => updateBlockTitle(b.id, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-extrabold text-white outline-none border-b border-transparent focus:border-lime-500 transition-colors"
                  />
                ) : (
                  <div className="flex-1 text-sm font-extrabold text-slate-500">
                    {(b.type === 'warmup' || b.type === 'cooldown') ? '' : meta.label}
                  </div>
                )}
                {(b.type === 'warmup' || b.type === 'cooldown') && (
                  <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0 ${b.type === 'warmup' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'}`}>
                    {meta.label}
                  </span>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => moveBlock(b.id, -1)} className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Move up">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => moveBlock(b.id, 1)} className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Move down">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => removeBlock(b.id)} className="w-6 h-6 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Remove block">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isGroup ? (
                <div className="px-4 pb-4">
                  {b.exerciseIds.map(exId => renderExerciseEditor(exId, true))}
                  {atCapacity ? (
                    <button disabled className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-slate-600 text-[11px] font-bold cursor-not-allowed">
                      Session is full ({targetDurationMin} min) — remove something to add more
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addExerciseToBlock(b.id)}
                      className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-lime-400 hover:border-lime-500/50 text-[11px] font-bold transition-colors"
                    >
                      + Add Exercise
                    </button>
                  )}
                </div>
              ) : (
                renderExerciseEditor(b.exerciseIds[0], false)
              )}
            </div>
          );
        })}

        <div className="relative">
          {atCapacity ? (
            <button disabled className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-600 text-xs font-extrabold cursor-not-allowed">
              Session is full ({targetDurationMin} min)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAddMenuOpen(v => !v)}
              onBlur={() => setTimeout(() => setAddMenuOpen(false), 150)}
              className="px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-extrabold transition-colors"
            >
              + Add Block
            </button>
          )}
          {addMenuOpen && !atCapacity && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-2xl z-30">
              <div className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wide mb-2.5">Choose a block type</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_META) as SessionBlockType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addBlock(t)}
                    className="text-left p-3 rounded-lg border border-slate-800 bg-slate-800/50 hover:border-lime-500 hover:bg-lime-500/5 transition-colors"
                  >
                    <div className="text-xs font-extrabold text-white mb-0.5">{TYPE_META[t].label}</div>
                    <div className="text-[10px] text-slate-500 leading-snug">{TYPE_META[t].desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 1600); }}
            className={`flex-1 py-2.5 font-black rounded-xl text-xs transition-all ${
              saved ? 'bg-emerald-500 text-slate-950' : 'bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 text-slate-950'
            }`}
          >
            {saved ? 'Saved!' : 'Save Plan'}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionBuilder;
