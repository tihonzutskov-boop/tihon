import React, { useMemo, useState } from 'react';
import { Gym, LibraryExercise } from '../types';
import { api } from '../services/api';
import { getExerciseLocations } from '../utils/exerciseMatcher';
import { muscleColor } from './ExerciseLibrary';
import EditTutorialModal from './EditTutorialModal';
import { ArrowLeft, Search, Play, X, MapPin, Edit3, Flame, ShieldCheck } from 'lucide-react';

interface ExerciseTutorialsProps {
  libraryExercises: LibraryExercise[];
  gym?: Gym;
  isAdmin: boolean;
  onClose: () => void;
  onLocateExercise: (exercise: LibraryExercise) => void;
  onExercisesUpdated: (updated: LibraryExercise[]) => void;
}

const hasTutorial = (ex: LibraryExercise) => !!(ex.tutorialVideoUrl && ex.steps && ex.steps.length > 0);

const ExerciseTutorials: React.FC<ExerciseTutorialsProps> = ({
  libraryExercises,
  gym,
  isAdmin,
  onClose,
  onLocateExercise,
  onExercisesUpdated,
}) => {
  const [search, setSearch] = useState('');
  const [activeMuscle, setActiveMuscle] = useState('All');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<LibraryExercise | null>(null);

  const muscles = useMemo(
    () => ['All', ...Array.from(new Set(libraryExercises.map(e => e.targetMuscle))).sort()],
    [libraryExercises]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return libraryExercises.filter(e => {
      if (activeMuscle !== 'All' && e.targetMuscle !== activeMuscle) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.targetMuscle.toLowerCase().includes(q);
    });
  }, [libraryExercises, search, activeMuscle]);

  const active = activeId ? libraryExercises.find(e => e.id === activeId) || null : null;

  const handleSaveTutorial = async (updated: LibraryExercise) => {
    await api.saveExercise(updated);
    onExercisesUpdated(libraryExercises.map(e => (e.id === updated.id ? updated : e)));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-3 min-w-0">
          {active ? (
            <button onClick={() => setActiveId(null)} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-white flex items-center gap-2">🏋️ Exercise Tutorials</h1>
              <p className="text-[11px] text-slate-500 truncate">Every library exercise, with a how-to video and step-by-step breakdown.</p>
            </div>
          )}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {!active ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="relative max-w-md mb-3.5">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-lime-500/50"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
            {muscles.map(m => {
              const isActive = activeMuscle === m;
              const color = muscleColor(m);
              return (
                <button
                  key={m}
                  onClick={() => setActiveMuscle(m)}
                  style={isActive && m !== 'All' ? { backgroundColor: color, borderColor: color } : undefined}
                  className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    isActive ? (m === 'All' ? 'bg-lime-500 text-slate-950 border-lime-500' : 'text-slate-950') : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500">
              No exercises match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filtered.map(ex => {
                const color = muscleColor(ex.targetMuscle);
                const tutorial = hasTutorial(ex);
                return (
                  <div
                    key={ex.id}
                    onClick={() => setActiveId(ex.id)}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 hover:-translate-y-0.5 transition-all"
                  >
                    <div className="h-24 flex items-center justify-center relative" style={{ background: `linear-gradient(160deg, ${color}18, #0a1225)` }}>
                      {tutorial && (
                        <span className="absolute top-2 right-2 text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-lime-500/15 text-lime-400 flex items-center gap-1">
                          ▶ Tutorial
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="p-3.5">
                      <span className="inline-block text-[8.5px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}>
                        {ex.targetMuscle}
                      </span>
                      <h3 className="text-xs font-extrabold text-white mb-0.5 leading-tight">{ex.name}</h3>
                      <p className="text-[10px] text-slate-500">{ex.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        (() => {
          const ex = active;
          const color = muscleColor(ex.targetMuscle);
          const tutorial = hasTutorial(ex);
          const related = libraryExercises.filter(e => e.targetMuscle === ex.targetMuscle && e.id !== ex.id);
          const location = gym ? getExerciseLocations(ex, gym) : null;

          return (
            <div className="flex-1 overflow-y-auto md:flex">
              <div className="md:w-[46%] flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60">
                {ex.tutorialVideoUrl ? (
                  <video src={ex.tutorialVideoUrl} controls className="w-full aspect-video bg-black" />
                ) : (
                  <div className="w-full aspect-video flex flex-col items-center justify-center gap-2.5 text-center px-6 bg-gradient-to-br from-slate-900 to-slate-950">
                    <div className="w-12 h-12 rounded-full bg-lime-500/10 border border-lime-500/40 flex items-center justify-center text-lime-400">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
                      <b className="text-slate-300">No video yet</b><br />An admin can add one from &ldquo;Edit Tutorial&rdquo;.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-1 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full mb-2" style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}>
                      {ex.targetMuscle} · {ex.category}
                    </span>
                    <h2 className="text-xl font-extrabold text-white">{ex.name}</h2>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingExercise(ex)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 text-[11px] font-bold hover:border-lime-500/50 hover:text-lime-400 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Tutorial
                    </button>
                  )}
                </div>

                <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">Step by Step</div>
                {tutorial ? (
                  <div className="space-y-3 mb-5">
                    {(ex.steps || []).map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-[22px] h-[22px] rounded-full bg-slate-900 border border-slate-800 text-lime-400 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                        <p className="text-[12.5px] text-slate-300 leading-relaxed pt-0.5">{s.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-slate-400 leading-relaxed mb-5">{ex.instructions || 'No instructions added yet.'}</p>
                )}

                {(ex.makeHarder || ex.makeEasier) && (
                  <>
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">Adjust Difficulty</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                      {ex.makeHarder && (
                        <div className="p-3 rounded-xl border border-amber-500/20 bg-slate-900/60">
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-400 uppercase tracking-wide mb-1"><Flame className="w-3 h-3" /> Harder</div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{ex.makeHarder}</p>
                        </div>
                      )}
                      {ex.makeEasier && (
                        <div className="p-3 rounded-xl border border-emerald-500/20 bg-slate-900/60">
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide mb-1"><ShieldCheck className="w-3 h-3" /> Easier</div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{ex.makeEasier}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {related.length > 0 && (
                  <>
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">More {ex.targetMuscle} exercises</div>
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
                      {related.map(r => (
                        <button key={r.id} onClick={() => setActiveId(r.id)} className="flex-shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:border-lime-500/40 hover:text-lime-400 whitespace-nowrap">
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button
                  onClick={() => onLocateExercise(ex)}
                  className="w-full py-3 rounded-xl border-none bg-lime-500 hover:bg-lime-400 text-slate-950 text-[12.5px] font-extrabold flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  {location?.isMapped ? `Locate in ${location.matchedZones.map(z => z.name).join(', ')}` : 'Locate in Gym'}
                </button>
              </div>
            </div>
          );
        })()
      )}

      {editingExercise && (
        <EditTutorialModal
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onSave={handleSaveTutorial}
        />
      )}
    </div>
  );
};

export default ExerciseTutorials;
