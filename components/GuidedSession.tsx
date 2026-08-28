import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, Check, Plus, Minus, Dumbbell, PlayCircle } from 'lucide-react';
import { WorkoutDay, Gym, EquipmentItem, LibraryExercise, Exercise } from '../types';
import GymMap from './GymMap';
import { getExerciseLocations } from '../utils/exerciseMatcher';

interface GuidedSessionProps {
  day: WorkoutDay;
  gym: Gym;
  equipmentList: EquipmentItem[];
  libraryExercises: LibraryExercise[];
  onClose: () => void;
  onFinish: () => void;
}

type StageKey = 'locate' | 'identify' | 'tutorial';
const STAGES: { key: StageKey; label: string }[] = [
  { key: 'locate', label: 'Locate' },
  { key: 'identify', label: 'Identify' },
  { key: 'tutorial', label: 'Tutorial' },
];

interface SetRow {
  reps: string;
  duration: string;
  weight: string;
  done: boolean;
}

const GuidedSession: React.FC<GuidedSessionProps> = ({ day, gym, equipmentList, libraryExercises, onClose, onFinish }) => {
  const exercises = day.exercises;
  const blockTypeByExerciseId = useMemo(() => {
    const map: Record<string, string> = {};
    (day.blocks || []).forEach(b => {
      if (b.type === 'warmup' || b.type === 'cooldown') {
        b.exerciseIds.forEach(id => { map[id] = b.type; });
      }
    });
    return map;
  }, [day.blocks]);
  const total = exercises.length * 3;
  const [current, setCurrent] = useState(0);
  const [setState, setSetState] = useState<Record<number, SetRow[]>>({});

  const exIdx = Math.floor(current / 3);
  const stageIdx = current % 3;
  const stage = STAGES[stageIdx];
  const exercise: Exercise | undefined = exercises[exIdx];

  const [tutorialStepIdx, setTutorialStepIdx] = useState(0);
  const [tutorialPlaying, setTutorialPlaying] = useState(false);
  const tutorialVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setTutorialStepIdx(0);
    setTutorialPlaying(false);
  }, [exIdx]);

  // Exercises built in the plan-template builder (Coaching > Catalog) are
  // never tied to a specific gym's zone — they're created with
  // equipmentId: 'manual' and no machineId, since a template is meant to be
  // reusable across whichever gym a trainee ends up training at. A direct
  // id lookup always misses for those, so fall back to the same
  // name/equipment matching ExerciseLibrary and GymMap already use to
  // resolve "where does this actually live" dynamically in the trainee's
  // current gym.
  const zone = useMemo(() => {
    if (!exercise) return undefined;
    const direct = gym.zones.find(z => z.id === exercise.equipmentId);
    if (direct) return direct;
    const location = getExerciseLocations(exercise, gym);
    return location.primaryZone || location.matchedZones[0] || undefined;
  }, [gym, exercise]);
  const machine = useMemo(() => {
    if (!exercise) return undefined;
    const direct = zone?.machines?.find(m => m.id === exercise.machineId);
    if (direct) return direct;
    const location = getExerciseLocations(exercise, gym);
    return location.primaryMachine || undefined;
  }, [zone, exercise, gym]);
  const equipmentItem = useMemo(() => {
    if (!machine) return undefined;
    // Machines placed before addMachineFromEquipment started setting
    // equipmentId (AdminPage.tsx) never got linked back to their Equipment
    // Library item — fall back to matching by name, which the placement
    // flow always copies from the equipment item verbatim.
    return equipmentList.find(e => e.id === machine.equipmentId) || equipmentList.find(e => e.name === machine.name);
  }, [machine, equipmentList]);
  const libraryExercise = useMemo(
    () => (exercise?.libraryExerciseId ? libraryExercises.find(le => le.id === exercise.libraryExerciseId) : undefined),
    [exercise, libraryExercises]
  );

  const rows: SetRow[] = useMemo(() => {
    if (!exercise) return [];
    if (setState[exIdx]) return setState[exIdx];
    if (exercise.setDetails && exercise.setDetails.length > 0) {
      return exercise.setDetails.map(s => ({ reps: s.reps || '', duration: '', weight: s.weight || '', done: false }));
    }
    return Array.from({ length: Math.max(exercise.sets || 1, 1) }, () => ({
      reps: exercise.reps || '',
      duration: '',
      weight: '',
      done: false,
    }));
  }, [exercise, exIdx, setState]);

  if (!exercise) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-400">This day doesn't have any exercises yet.</p>
        <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold">Close</button>
      </div>
    );
  }

  const setRows = (next: SetRow[]) => setSetState(prev => ({ ...prev, [exIdx]: next }));
  const toggleSet = (i: number) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, done: !r.done } : r));
    setRows(next);
  };
  const updateSet = (i: number, field: 'reps' | 'duration' | 'weight', value: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r));
    setRows(next);
  };
  const addSet = () => setRows([...rows, { reps: exercise.reps || '', duration: '', weight: '', done: false }]);
  const removeSet = () => { if (rows.length > 1) setRows(rows.slice(0, -1)); };
  const completeAll = () => setRows(rows.map(r => ({ ...r, done: true })));

  const go = (dir: number) => {
    const next = current + dir;
    if (next < 0 || next > total - 1) return;
    setCurrent(next);
  };
  const jumpTo = (i: number) => setCurrent(i);

  const isLastStage = current === total - 1;
  const pct = Math.round(((current + 1) / total) * 100);

  const instructions = libraryExercise?.instructions || exercise.notes || 'No instructions added yet.';
  const gifUrl = libraryExercise?.imageUrl;
  const harder = libraryExercise?.makeHarder || exercise.makeHarder;
  const easier = libraryExercise?.makeEasier || exercise.makeEasier;
  const allSetsDone = rows.length > 0 && rows.every(r => r.done);

  const tutorialSteps = libraryExercise?.steps || [];
  const hasTutorialVideo = !!(libraryExercise?.tutorialVideoUrl && tutorialSteps.length > 0);

  const playNextTutorialStep = () => {
    if (tutorialStepIdx >= tutorialSteps.length - 1) return;
    const video = tutorialVideoRef.current;
    const next = tutorialSteps[tutorialStepIdx + 1];
    if (video && next && next.time != null) {
      const target = next.time;
      setTutorialPlaying(true);
      const onTime = () => {
        if (video.currentTime >= target) {
          video.pause();
          video.removeEventListener('timeupdate', onTime);
          setTutorialStepIdx(i => i + 1);
          setTutorialPlaying(false);
        }
      };
      video.addEventListener('timeupdate', onTime);
      video.play();
    } else {
      setTutorialStepIdx(i => i + 1);
    }
  };
  const playPrevTutorialStep = () => {
    if (tutorialStepIdx <= 0) return;
    const prevIdx = tutorialStepIdx - 1;
    const video = tutorialVideoRef.current;
    const t = tutorialSteps[prevIdx]?.time;
    if (video && t != null) video.currentTime = t;
    setTutorialStepIdx(prevIdx);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* Locate full-screen map overlay */}
      {stage.key === 'locate' && (
        <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/70">
            <button
              onClick={() => (current === 0 ? onClose() : go(-1))}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {current === 0 ? 'Close' : 'Back'}
            </button>
            <div className="text-right">
              <p className="text-[10.5px] font-extrabold text-lime-400 uppercase tracking-wide">Locate</p>
              <p className="text-sm font-extrabold">{exercise.name}</p>
            </div>
          </div>
          <div className="flex-1 relative m-4 rounded-2xl border border-slate-800 overflow-hidden bg-slate-900">
            {zone ? (
              <GymMap
                zones={gym.zones}
                dimensions={gym.dimensions}
                entrance={gym.entrance}
                floorColor={gym.floorColor}
                annexes={gym.annexes}
                focusedZoneId={zone.id}
                selectedMachineId={machine?.id || null}
                hideSearch
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 gap-2 text-slate-500">
                <Dumbbell className="w-8 h-8 opacity-50" />
                <p className="text-sm">Location isn't set for this exercise yet.</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900/70">
            <button
              onClick={() => go(1)}
              className="w-full py-3.5 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 text-slate-950 transition-colors"
            >
              I found it — Continue
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-1">
          <button onClick={onClose} aria-label="Close session" className="p-1.5 -ml-1.5 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-lime-400">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
            Personal Coaching
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">
          <span>Step {current + 1} of {total}</span>
          <span className="text-slate-700">·</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
          <div className="h-full bg-lime-500 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-1.5">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wide border ${
                i < stageIdx
                  ? 'text-lime-400 border-lime-500/30 bg-lime-500/5'
                  : i === stageIdx
                  ? 'text-lime-400 border-lime-500 bg-lime-500/10'
                  : 'text-slate-500 border-slate-800 bg-slate-900'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 max-w-lg mx-auto w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-5">
          {stage.key === 'tutorial' && hasTutorialVideo ? (
            <>
              {/* Caption + Next Step used to sit as an absolute overlay on
                  top of the video — on a phone that overlay was tall
                  enough to cover a large part of the frame. It now sits
                  below the video in normal flow so the clip stays fully
                  visible; only the compact step indicator stays as a
                  corner overlay since it doesn't obscure anything. */}
              <div className="relative aspect-video border-b border-slate-800 bg-black overflow-hidden">
                <video
                  ref={tutorialVideoRef}
                  src={libraryExercise!.tutorialVideoUrl}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/80" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    Step {tutorialStepIdx + 1} of {tutorialSteps.length}
                  </span>
                  {tutorialPlaying ? (
                    <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white bg-lime-500/25 border border-lime-500/60 px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                      Playing&hellip;
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {tutorialSteps.map((_, i) => (
                        <span
                          key={i}
                          className={`h-[3px] rounded-full transition-all ${
                            i === tutorialStepIdx ? 'w-4 bg-lime-400' : i < tutorialStepIdx ? 'w-2.5 bg-lime-500/60' : 'w-2.5 bg-white/25'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3.5 border-b border-slate-800">
                <div className="flex items-start gap-2.5 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 mb-2.5">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-lime-400 text-slate-950 text-[11px] font-black flex items-center justify-center">
                    {tutorialStepIdx + 1}
                  </div>
                  <p className="text-[13px] font-bold text-white leading-snug">
                    {tutorialSteps[tutorialStepIdx]?.text}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={playPrevTutorialStep}
                    disabled={tutorialStepIdx === 0}
                    className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold bg-slate-800 border border-slate-700 text-white disabled:opacity-30 transition-opacity"
                  >
                    ←
                  </button>
                  <button
                    onClick={playNextTutorialStep}
                    disabled={tutorialStepIdx >= tutorialSteps.length - 1}
                    className="flex-1 py-2 rounded-lg text-[11px] font-extrabold bg-lime-500 text-slate-950 disabled:opacity-30 transition-opacity"
                  >
                    Next Step →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-44 border-b border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
              {stage.key === 'identify' ? (
                equipmentItem?.imageUrl ? (
                  <img src={equipmentItem.imageUrl} alt={equipmentItem.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
                    <Dumbbell className="w-8 h-8 opacity-50" />
                    <span>{equipmentItem ? 'No photo added yet' : 'Equipment not linked yet'}</span>
                  </div>
                )
              ) : stage.key === 'tutorial' ? (
                gifUrl ? (
                  <img src={gifUrl} alt={exercise.name} className="w-full h-full object-cover" />
                ) : (
                  <PlayCircle className="w-10 h-10 text-sky-400" />
                )
              ) : null}
            </div>
          )}
          <div className="p-5">
            <p className="text-[11px] font-extrabold text-lime-400 uppercase tracking-wide mb-1.5">
              {exercise.targetMuscle} · {stage.label}
            </p>
            <h2 className="text-xl font-extrabold text-white mb-3">{exercise.name}</h2>

            {stage.key === 'locate' && zone && (
              <div className="mb-3">
                <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{zone.name}</span>
              </div>
            )}

            {!(stage.key === 'tutorial' && hasTutorialVideo) && (
              <p className="text-sm text-slate-400 leading-relaxed">
                {stage.key === 'locate' && zone && `Head to the ${zone.name}. Follow the map above — it marks exactly where this machine sits on the gym floor.`}
                {stage.key === 'locate' && !zone && 'This exercise has no zone set — ask an admin to link it in the plan editor.'}
                {stage.key === 'identify' && (equipmentItem?.description || 'Look for the machine matching this name on the gym floor.')}
                {stage.key === 'tutorial' && instructions}
              </p>
            )}

            {stage.key === 'tutorial' && (harder || easier) && (
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                {harder && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold text-orange-400 uppercase tracking-wide mb-1">Harder</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{harder}</p>
                  </div>
                )}
                {easier && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wide mb-1">Easier</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{easier}</p>
                  </div>
                )}
              </div>
            )}

            {stage.key === 'tutorial' && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="space-y-2.5">
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-3.5 text-xs font-extrabold text-slate-500 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 text-center">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Reps</label>
                        <input
                          value={row.reps}
                          onChange={e => updateSet(i, 'reps', e.target.value)}
                          placeholder="--"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-1 py-2 text-center text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                        />
                      </div>
                      <div className="flex-1 text-center">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Duration</label>
                        <input
                          value={row.duration}
                          onChange={e => updateSet(i, 'duration', e.target.value)}
                          placeholder="--"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-1 py-2 text-center text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                        />
                      </div>
                      <div className="flex-1 text-center">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Weight</label>
                        <input
                          value={row.weight}
                          onChange={e => updateSet(i, 'weight', e.target.value)}
                          placeholder="--"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-1 py-2 text-center text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                        />
                      </div>
                      <button
                        onClick={() => toggleSet(i)}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                          row.done ? 'bg-lime-500 border-lime-500 text-slate-950' : 'border-slate-700 text-slate-500 hover:border-slate-500'
                        }`}
                        aria-label={row.done ? 'Mark set incomplete' : 'Mark set complete'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <button onClick={addSet} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Set
                  </button>
                  <button onClick={removeSet} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                    <Minus className="w-3.5 h-3.5" /> Remove Set
                  </button>
                </div>
                <button
                  onClick={completeAll}
                  className={`w-full flex items-center justify-end gap-2 mt-4 text-sm font-extrabold transition-colors ${
                    allSetsDone ? 'text-lime-400' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Complete All
                  <span className={`w-7 h-7 rounded-full border flex items-center justify-center ${allSetsDone ? 'bg-lime-500 border-lime-500 text-slate-950' : 'border-slate-700'}`}>
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {stage.key !== 'locate' && (
          <div className="flex gap-2.5 mb-6">
            <button
              onClick={() => go(-1)}
              disabled={current === 0}
              className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() => (isLastStage ? onFinish() : go(1))}
              className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 text-slate-950 transition-colors"
            >
              {isLastStage ? 'Finish session' : stage.key === 'tutorial' ? 'Next exercise →' : 'Next →'}
            </button>
          </div>
        )}

        <div>
          <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-2.5">Today's exercises</h4>
          <div>
            {exercises.map((e, i) => {
              const doneEx = i < exIdx;
              const isCurrent = i === exIdx;
              return (
                <div key={e.id} className="py-2 border-b border-slate-800/70 last:border-none">
                  <div className={`flex items-center gap-2.5 text-[12.5px] mb-1.5 ${isCurrent ? 'text-white font-bold' : doneEx ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 ${
                        doneEx
                          ? 'bg-lime-500 text-slate-950'
                          : isCurrent
                          ? 'bg-lime-500/15 border border-lime-500 text-lime-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                      }`}
                    >
                      {doneEx ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    <span>{e.name}</span>
                    {blockTypeByExerciseId[e.id] && (
                      <span className={`text-[8.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                        blockTypeByExerciseId[e.id] === 'warmup' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        {blockTypeByExerciseId[e.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-7">
                    {STAGES.map((s, si) => {
                      const abs = i * 3 + si;
                      const subDone = abs < current;
                      const subActive = abs === current;
                      return (
                        <button
                          key={s.key}
                          onClick={() => jumpTo(abs)}
                          className={`text-[9.5px] font-bold px-2 py-1 rounded-full border transition-colors ${
                            subActive
                              ? 'bg-lime-500/10 border-lime-500 text-lime-400'
                              : subDone
                              ? 'border-lime-500/30 text-lime-400'
                              : 'border-slate-700 text-slate-500 hover:border-slate-500'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedSession;
