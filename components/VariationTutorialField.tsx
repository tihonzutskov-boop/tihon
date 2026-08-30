import React, { useState } from 'react';
import { LibraryExercise } from '../types';
import { Search, X, Plus, Link2 } from 'lucide-react';
import { muscleColor } from './ExerciseLibrary';

export interface VariationState {
  mode: 'link' | 'quick';
  linkedId: string;
  videoUrl: string;
  steps: string[];
}

export const blankVariationState = (): VariationState => ({ mode: 'link', linkedId: '', videoUrl: '', steps: [] });

// Reconstructs form state from a saved LibraryExercise's harder/easier
// fields — whichever of the link/quick pair is actually populated decides
// which mode the field opens in; defaults to 'link' when neither is set.
export const variationStateFromExercise = (
  ex: LibraryExercise | null,
  which: 'harder' | 'easier'
): VariationState => {
  if (!ex) return blankVariationState();
  const linkedId = which === 'harder' ? ex.harderExerciseId : ex.easierExerciseId;
  const tutorial = which === 'harder' ? ex.harderTutorial : ex.easierTutorial;
  if (tutorial?.videoUrl || (tutorial?.steps && tutorial.steps.length > 0)) {
    return { mode: 'quick', linkedId: '', videoUrl: tutorial.videoUrl || '', steps: tutorial.steps || [] };
  }
  return { mode: 'link', linkedId: linkedId || '', videoUrl: '', steps: [] };
};

interface VariationTutorialFieldProps {
  value: VariationState;
  onChange: (next: VariationState) => void;
  libraryExercises: LibraryExercise[];
  excludeId?: string;
  accentColor: string;
}

const VariationTutorialField: React.FC<VariationTutorialFieldProps> = ({ value, onChange, libraryExercises, excludeId, accentColor }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const linkedExercise = libraryExercises.find(le => le.id === value.linkedId);
  const candidates = libraryExercises.filter(le => {
    if (le.id === excludeId) return false;
    const q = pickerSearch.trim().toLowerCase();
    return !q || le.name.toLowerCase().includes(q) || le.targetMuscle.toLowerCase().includes(q);
  });

  const setMode = (mode: 'link' | 'quick') => onChange({ ...value, mode });
  const addStep = () => onChange({ ...value, steps: [...value.steps, ''] });
  const updateStep = (i: number, text: string) => onChange({ ...value, steps: value.steps.map((s, si) => (si === i ? text : s)) });
  const removeStep = (i: number) => onChange({ ...value, steps: value.steps.filter((_, si) => si !== i) });

  return (
    <div className="mt-2.5">
      <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 mb-2.5">
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
            value.mode === 'link' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Link an exercise
        </button>
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
            value.mode === 'quick' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Quick tutorial
        </button>
      </div>

      {value.mode === 'link' ? (
        linkedExercise ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: muscleColor(linkedExercise.targetMuscle) }} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate">{linkedExercise.name}</div>
              <div className={`text-[9px] font-bold ${linkedExercise.tutorialVideoUrl || linkedExercise.videoUrl ? 'text-lime-400' : 'text-red-400'}`}>
                {linkedExercise.tutorialVideoUrl || linkedExercise.videoUrl ? '✓ Has its own tutorial video' : 'No tutorial video yet'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, linkedId: '' })}
              className="flex-shrink-0 p-1 text-slate-500 hover:text-red-400 transition-colors"
              aria-label="Unlink exercise"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setPickerOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 text-[10.5px] font-bold transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link an exercise from the library…
            </button>
            {pickerOpen && (
              <div className="mt-1.5 p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="relative mb-1.5">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search exercises…"
                    className="w-full bg-slate-900 border border-slate-800 rounded-md pl-7 pr-2 py-1.5 text-[10.5px] text-white placeholder-slate-600 focus:outline-none focus:border-slate-600"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {candidates.length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-2">No exercises match.</p>
                  ) : (
                    candidates.map(le => (
                      <button
                        key={le.id}
                        type="button"
                        onClick={() => {
                          onChange({ ...value, linkedId: le.id });
                          setPickerOpen(false);
                          setPickerSearch('');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 text-left transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: muscleColor(le.targetMuscle) }} />
                        <span className="text-[10.5px] font-semibold text-white truncate">{le.name}</span>
                        <span className="text-[9px] text-slate-500 ml-auto flex-shrink-0">{le.targetMuscle}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <div>
          <input
            type="text"
            value={value.videoUrl}
            onChange={e => onChange({ ...value, videoUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none mb-2"
            style={{ borderColor: value.videoUrl ? accentColor + '55' : undefined }}
          />
          {value.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1.5">
              <span
                className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center flex-shrink-0 text-slate-950"
                style={{ backgroundColor: accentColor }}
              >
                {i + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={e => updateStep(i, e.target.value)}
                placeholder={`Step ${i + 1}…`}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-[10.5px] text-white placeholder-slate-600 focus:outline-none"
              />
              <button type="button" onClick={() => removeStep(i)} className="flex-shrink-0 p-1 text-slate-600 hover:text-red-400 transition-colors" aria-label="Remove step">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 text-[10px] font-bold transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Step
          </button>
        </div>
      )}
    </div>
  );
};

export default VariationTutorialField;
