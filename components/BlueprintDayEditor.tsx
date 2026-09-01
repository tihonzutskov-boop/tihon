import React from 'react';
import { BlueprintDay, ExerciseSlot, MovementPattern, ExerciseCategory, LibraryExercise } from '../types';
import { ChevronUp, ChevronDown, X, Plus, AlertTriangle } from 'lucide-react';

const MOVEMENT_PATTERNS: MovementPattern[] = [
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'squat', 'hinge', 'lunge', 'carry', 'shoulder_abduction', 'core', 'conditioning', 'mobility',
];
const CATEGORIES: ExerciseCategory[] = ['compound', 'isolation', 'cardio', 'mobility', 'warmup', 'cooldown'];

const label = (s: string) => s.replace(/_/g, ' ');

const blankSlot = (): ExerciseSlot => ({
  id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  movementPattern: 'horizontal_push',
  priority: 1,
  setsMin: 3,
  setsMax: 4,
  repsMin: 8,
  repsMax: 12,
  restSeconds: 90,
});

interface BlueprintDayEditorProps {
  day: BlueprintDay;
  onChange: (day: BlueprintDay) => void;
  libraryExercises: LibraryExercise[];
  targetDurationMin: number;
}

const NumField: React.FC<{ label: string; value: number; min?: number; onChange: (n: number) => void }> = ({ label, value, min = 0, onChange }) => (
  <div>
    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
    <input
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))}
      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-[11.5px] font-bold text-white outline-none focus:border-lime-500 transition-colors"
    />
  </div>
);

const BlueprintDayEditor: React.FC<BlueprintDayEditorProps> = ({ day, onChange, libraryExercises, targetDurationMin }) => {
  const slots = day.slots || [];

  // Priority is the list position — the generator drops the highest-priority
  // number first when trimming to fit, so "further down the list" reads as
  // "less important", which is what the ordering controls imply.
  const commit = (next: ExerciseSlot[]) =>
    onChange({ ...day, slots: next.map((s, i) => ({ ...s, priority: i + 1 })) });

  const updateSlot = (id: string, patch: Partial<ExerciseSlot>) =>
    commit(slots.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const removeSlot = (id: string) => commit(slots.filter(s => s.id !== id));
  const moveSlot = (id: string, dir: -1 | 1) => {
    const i = slots.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  // How many tagged, generation-enabled exercises could actually fill each
  // slot. A zero here means every client hits a generation failure on this
  // slot, so it's worth surfacing while authoring rather than at runtime.
  const candidateCount = (pattern: MovementPattern) =>
    libraryExercises.filter(le => le.generationEnabled && le.movementPattern === pattern).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-slate-800">
        <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Day name</label>
        <input
          value={day.name}
          onChange={e => onChange({ ...day, name: e.target.value })}
          placeholder="e.g. Upper, Full Body"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
        />
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          Each slot is a requirement, not a fixed exercise — the generator fills it per client from what their gym supports.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {slots.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            <p className="text-xs">No slots yet — add the first one below.</p>
          </div>
        )}

        {slots.map((slot, idx) => {
          const count = candidateCount(slot.movementPattern);
          return (
            <div key={slot.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full border border-lime-500 text-lime-400 text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs font-extrabold text-white flex-1 truncate">{label(slot.movementPattern)}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => moveSlot(slot.id, -1)} className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Move up">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => moveSlot(slot.id, 1)} className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Move down">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => removeSlot(slot.id)} className="w-6 h-6 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 flex items-center justify-center transition-colors" title="Remove slot">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Movement pattern</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOVEMENT_PATTERNS.map(mp => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => updateSlot(slot.id, { movementPattern: mp })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        slot.movementPattern === mp ? 'bg-lime-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {label(mp)}
                    </button>
                  ))}
                </div>
                {count === 0 ? (
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 mt-2">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    No generation-enabled exercise has this pattern — this slot will fail for every client.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-2">{count} exercise{count === 1 ? '' : 's'} in the library can fill this slot.</p>
                )}
              </div>

              <div className="mb-3">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Prefer type (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSlot(slot.id, { exerciseCategory: slot.exerciseCategory === c ? undefined : c })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        slot.exerciseCategory === c ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  A preference, not a restriction — if nothing of this type fits the slot, the best available exercise is still used.
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-3">
                <NumField label="Sets min" value={slot.setsMin} min={1} onChange={n => updateSlot(slot.id, { setsMin: n })} />
                <NumField label="Sets max" value={slot.setsMax} min={1} onChange={n => updateSlot(slot.id, { setsMax: n })} />
                <NumField label="Reps min" value={slot.repsMin} min={1} onChange={n => updateSlot(slot.id, { repsMin: n })} />
                <NumField label="Reps max" value={slot.repsMax} min={1} onChange={n => updateSlot(slot.id, { repsMax: n })} />
                <NumField label="Rest (s)" value={slot.restSeconds} onChange={n => updateSlot(slot.id, { restSeconds: n })} />
              </div>

              <button
                type="button"
                onClick={() => updateSlot(slot.id, { optional: !slot.optional })}
                className={`w-full py-2 rounded-lg text-[10.5px] font-bold transition-colors ${
                  slot.optional
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {slot.optional ? '✓ Optional — may be dropped to fit the session' : 'Required — never dropped'}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => commit([...slots, blankSlot()])}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-lime-500 hover:text-lime-400 text-[11px] font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Slot
        </button>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed pt-1">
          Target session length is {targetDurationMin} min. If a generated day runs long, optional slots are dropped from the bottom up.
        </p>
      </div>
    </div>
  );
};

export default BlueprintDayEditor;
