import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, Check, Plus, Minus, Dumbbell, PlayCircle } from 'lucide-react';
import { WorkoutDay, Gym, EquipmentItem, LibraryExercise, Exercise, EffortRating, ExerciseLog, EFFORT_SCALE, JointStressArea, ALL_JOINT_STRESS_AREAS } from '../types';
import { api } from '../services/api';
import GymMap from './GymMap';
import { planSessionRoute } from '../utils/sessionRoute';
import { getYouTubeEmbedUrl } from '../utils/youtubeEmbed';

interface GuidedSessionProps {
  day: WorkoutDay;
  gym: Gym;
  equipmentList: EquipmentItem[];
  libraryExercises: LibraryExercise[];
  onClose: () => void;
  onFinish: () => void;
}

type StageKey = 'locate' | 'identify' | 'tutorial' | 'video' | 'bookend';
const STANDARD_STAGES: { key: StageKey; label: string }[] = [
  { key: 'locate', label: 'Locate' },
  { key: 'identify', label: 'Identify' },
  { key: 'tutorial', label: 'Tutorial' },
];
// A video exercise (YouTube follow-along — warmups, mobility, cooldowns) has
// no equipment to locate or identify, so it gets a single stage instead of
// the usual three.
const VIDEO_STAGES: { key: StageKey; label: string }[] = [
  { key: 'video', label: 'Follow Along' },
];
// A warm-up or cooldown is a description, not a machine. It used to walk the
// client through Locate and Identify first — a map screen and an equipment
// photo — which put the only thing that matters, the steps, on screen three,
// and showed "Equipment not linked yet" for the many bookends that are just
// bodyweight movement. Where to go is kept, as a line of text, since a
// beginner still needs to know where the bike is.
const WARMUP_STAGES: { key: StageKey; label: string }[] = [{ key: 'bookend', label: 'Warm-up' }];
const COOLDOWN_STAGES: { key: StageKey; label: string }[] = [{ key: 'bookend', label: 'Cooldown' }];

interface SetRow {
  reps: string;
  weight: string;
  done: boolean;
}

// Rest reads more naturally in minutes once it passes one, which is where a
// beginner's compound rest usually sits.
const formatRest = (seconds: number | undefined | null): string => {
  if (seconds == null || seconds <= 0) return '—';
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
};

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
  // Video exercises get a single stage instead of the standard three, so the
  // stage list per exercise (and therefore the flat step count) is variable
  // rather than always exercises.length * 3.
  const stagesByExIdx = useMemo(
    () =>
      exercises.map(ex => {
        // The bookend check comes first: a warm-up backed by a real library
        // exercise is still a warm-up, and should not inherit that exercise's
        // equipment stages.
        if (ex.bookend) return ex.bookend === 'warmup' ? WARMUP_STAGES : COOLDOWN_STAGES;
        const le = ex.libraryExerciseId ? libraryExercises.find(l => l.id === ex.libraryExerciseId) : undefined;
        return le?.exerciseType === 'video' ? VIDEO_STAGES : STANDARD_STAGES;
      }),
    [exercises, libraryExercises]
  );
  const startIndexByExIdx = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    stagesByExIdx.forEach(stages => {
      starts.push(acc);
      acc += stages.length;
    });
    return starts;
  }, [stagesByExIdx]);
  const steps = useMemo(() => {
    const flat: { exIdx: number; stageKey: StageKey }[] = [];
    stagesByExIdx.forEach((stages, i) => stages.forEach(s => flat.push({ exIdx: i, stageKey: s.key })));
    return flat;
  }, [stagesByExIdx]);

  const total = steps.length;
  const [current, setCurrent] = useState(0);
  const [setState, setSetState] = useState<Record<number, SetRow[]>>({});
  // How hard each exercise felt, and whether anything hurt. Keyed by exercise
  // index like setState. These two answers are what the adaptive engine reads
  // to decide whether the load moves next session.
  const [effortState, setEffortState] = useState<Record<number, EffortRating>>({});
  const [painState, setPainState] = useState<Record<number, boolean>>({});
  // Where it hurt. Without this the engine can only avoid the joints this
  // exercise happened to load; with it, every replacement loading that area is
  // ruled out.
  const [painAreaState, setPainAreaState] = useState<Record<number, JointStressArea>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const curStep = steps[current];
  const exIdx = curStep?.exIdx ?? 0;
  const stage = curStep ? stagesByExIdx[curStep.exIdx].find(s => s.key === curStep.stageKey)! : STANDARD_STAGES[0];
  const exercise: Exercise | undefined = exercises[exIdx];

  const [tutorialStepIdx, setTutorialStepIdx] = useState(0);
  const [tutorialPlaying, setTutorialPlaying] = useState(false);
  // The disabled attribute on the nav buttons only reflects tutorialPlaying
  // once React re-renders — a second click fired before that commits (e.g.
  // a fast double-tap) still reaches the handler and can attach a second
  // timeupdate listener, letting the step jump ahead unpredictably. This
  // ref updates synchronously, so the guard below closes that gap
  // regardless of render timing.
  const tutorialPlayingRef = useRef(false);
  const tutorialVideoRef = useRef<HTMLVideoElement>(null);
  const [variationOverlay, setVariationOverlay] = useState<'harder' | 'easier' | null>(null);
  useEffect(() => {
    setTutorialStepIdx(0);
    setTutorialPlaying(false);
    tutorialPlayingRef.current = false;
    setVariationOverlay(null);
  }, [exIdx]);

  // Planned for the whole day at once rather than per exercise, so each
  // exercise is sent to the copy of its equipment nearest to wherever the last
  // one left the client — starting from the door. Resolving each exercise
  // independently picked an arbitrary copy and could send someone back and
  // forth across the building between sets.
  //
  // Routing resolves locations by name/equipment matching, which is what makes
  // plan-template exercises work at all: those are authored with
  // equipmentId 'manual' and no machineId, since a template is meant to be
  // reusable across whichever gym the trainee ends up in, so a direct id
  // lookup always misses for them.
  const route = useMemo(() => planSessionRoute(exercises, gym), [exercises, gym]);
  const routeStop = route[exIdx];
  // Everywhere else in the gym this same exercise could be done. Kept so a
  // client who finds their machine occupied has somewhere to go.
  const alternatives = routeStop?.alternatives || [];

  const zone = useMemo(() => {
    if (!exercise) return undefined;
    // An explicitly assigned zone always wins: an admin who pinned a machine
    // meant that machine, and routing must not second-guess it.
    const direct = gym.zones.find(z => z.id === exercise.equipmentId);
    if (direct) return direct;
    return routeStop?.zone || undefined;
  }, [gym, exercise, routeStop]);
  const machine = useMemo(() => {
    if (!exercise) return undefined;
    const direct = zone?.machines?.find(m => m.id === exercise.machineId);
    if (direct) return direct;
    return routeStop?.machine || undefined;
  }, [zone, exercise, routeStop]);
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
    // The engine's suggested weight pre-fills the field rather than replacing
    // it: the client still confirms what they actually lifted, and that is what
    // gets logged. A suggestion the plan made is not evidence it happened.
    const suggested = exercise.adaptation?.suggestedWeight;
    const seedWeight = (authored?: string) =>
      authored && authored.trim() !== '' ? authored : suggested != null ? String(suggested) : '';
    if (exercise.setDetails && exercise.setDetails.length > 0) {
      return exercise.setDetails.map(s => ({ reps: s.reps || '', weight: seedWeight(s.weight), done: false }));
    }
    return Array.from({ length: Math.max(exercise.sets || 1, 1) }, () => ({
      reps: exercise.reps || '',
      weight: seedWeight(),
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
  const updateSet = (i: number, field: 'reps' | 'weight', value: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r));
    setRows(next);
  };
  const addSet = () => setRows([...rows, { reps: exercise.reps || '', weight: '', done: false }]);
  const removeSet = () => { if (rows.length > 1) setRows(rows.slice(0, -1)); };
  const completeAll = () => setRows(rows.map(r => ({ ...r, done: true })));
  const setEffort = (value: EffortRating) =>
    setEffortState(prev => ({ ...prev, [exIdx]: prev[exIdx] === value ? undefined as any : value }));
  const togglePain = () => setPainState(prev => {
    const next = !prev[exIdx];
    // Clearing the flag clears the area with it, so a mis-tap can't leave a
    // stale location attached to a session with no pain reported.
    if (!next) setPainAreaState(areas => { const copy = { ...areas }; delete copy[exIdx]; return copy; });
    return { ...prev, [exIdx]: next };
  });
  const setPainArea = (area: JointStressArea) =>
    setPainAreaState(prev => (prev[exIdx] === area ? (() => { const c = { ...prev }; delete c[exIdx]; return c; })() : { ...prev, [exIdx]: area }));

  // Only completed sets on library-linked exercises are logged. A set the
  // client never ticked did not happen, and logging it would hand the
  // progression rule reps that were never performed.
  const buildLogs = (): ExerciseLog[] => {
    const logs: ExerciseLog[] = [];
    exercises.forEach((ex, i) => {
      if (!ex.libraryExerciseId) return;
      // A warm-up is not training work — logging it would feed the progression
      // rules a set they should never act on, and ask the client to rate the
      // effort of their own warm-up.
      if (ex.bookend) return;
      const exRows = setState[i];
      if (!exRows) return;
      const completed = exRows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.done);
      if (completed.length === 0) return;

      // What the plan asked for at the time, carried alongside what was done,
      // so the rule can compare the two without re-deriving a prescription
      // that may since have changed.
      const targetReps = (idx: number) =>
        parseInt(ex.setDetails?.[idx]?.reps || ex.reps || '0', 10) || 0;

      const weightText = completed.find(({ r }) => r.weight.trim() !== '')?.r.weight;
      const weight = weightText != null ? parseFloat(weightText) : NaN;

      logs.push({
        exerciseId: ex.libraryExerciseId,
        planDayId: day.id,
        weight: Number.isFinite(weight) ? weight : null,
        sets: completed.map(({ r, idx }) => ({
          reps: parseInt(r.reps, 10) || 0,
          targetReps: targetReps(idx),
        })),
        effort: effortState[i] ?? null,
        pain: painState[i] === true,
        painArea: painState[i] === true ? painAreaState[i] ?? null : null,
      });
    });
    return logs;
  };

  const finishSession = async () => {
    const logs = buildLogs();
    if (logs.length === 0) return onFinish();
    setSaving(true);
    setSaveError(null);
    const result = await api.logExercises(logs);
    setSaving(false);
    if (!result.ok) return setSaveError(result.error || 'Could not save your training log');
    onFinish();
  };

  const go = (dir: number) => {
    const next = current + dir;
    if (next < 0 || next > total - 1) return;
    setCurrent(next);
  };
  const jumpTo = (i: number) => setCurrent(i);

  const isLastStage = current === total - 1;
  const pct = Math.round(((current + 1) / total) * 100);

  const instructions = libraryExercise?.instructions || exercise.notes;
  const gifUrl = libraryExercise?.imageUrl;
  const harder = libraryExercise?.makeHarder || exercise.makeHarder;
  const easier = libraryExercise?.makeEasier || exercise.makeEasier;
  const allSetsDone = rows.length > 0 && rows.every(r => r.done);

  // A Harder/Easier variation can carry its own tutorial two ways: a quick
  // inline one (YouTube link + plain steps, entered right on the field) or
  // a link to another library exercise that has its own tutorial. Quick
  // wins if both are somehow set, since it's the more specific choice.
  const resolveVariationMedia = (which: 'harder' | 'easier') => {
    const linkedId = which === 'harder' ? libraryExercise?.harderExerciseId : libraryExercise?.easierExerciseId;
    const quick = which === 'harder' ? libraryExercise?.harderTutorial : libraryExercise?.easierTutorial;
    if (quick?.videoUrl) {
      return { source: 'youtube' as const, videoUrl: quick.videoUrl, steps: quick.steps || [], name: null as string | null };
    }
    if (linkedId) {
      const linked = libraryExercises.find(le => le.id === linkedId);
      if (linked?.tutorialVideoUrl) {
        return { source: 'native' as const, videoUrl: linked.tutorialVideoUrl, steps: (linked.steps || []).map(s => s.text), name: linked.name };
      }
      if (linked?.videoUrl) {
        return { source: 'youtube' as const, videoUrl: linked.videoUrl, steps: [] as string[], name: linked.name };
      }
    }
    return null;
  };
  const harderMedia = resolveVariationMedia('harder');
  const easierMedia = resolveVariationMedia('easier');

  const tutorialSteps = libraryExercise?.steps || [];
  const hasTutorialVideo = !!(libraryExercise?.tutorialVideoUrl && tutorialSteps.length > 0);

  const playNextTutorialStep = () => {
    if (tutorialPlayingRef.current) return;
    if (tutorialStepIdx >= tutorialSteps.length - 1) return;
    const video = tutorialVideoRef.current;
    const next = tutorialSteps[tutorialStepIdx + 1];
    if (video && next && next.time != null) {
      const target = next.time;
      tutorialPlayingRef.current = true;
      setTutorialPlaying(true);
      const onTime = () => {
        if (video.currentTime >= target) {
          video.pause();
          video.removeEventListener('timeupdate', onTime);
          tutorialPlayingRef.current = false;
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
    if (tutorialPlayingRef.current) return;
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
            {/* The app can't know what's free, so the honest help is telling
                someone where else the same thing is. Kept quiet — it matters
                only to the person who walked over and found it taken. */}
            {alternatives.length > 0 && (
              <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
                {alternatives.length === 1 ? "There's another" : `There are ${alternatives.length} more`}
                {' in '}
                {Array.from(new Set(alternatives.map(a => a.zone.name))).join(', ')}
                {' if this one is busy.'}
              </p>
            )}
            <button
              onClick={() => go(1)}
              className="w-full py-3.5 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 active:scale-95 text-slate-950 transition-all duration-150"
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
          {stagesByExIdx[exIdx].map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wide border ${
                i < stagesByExIdx[exIdx].findIndex(st => st.key === stage.key)
                  ? 'text-lime-400 border-lime-500/30 bg-lime-500/5'
                  : s.key === stage.key
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
          <div className="p-5 pb-4">
            <p className="text-[11px] font-extrabold text-lime-400 uppercase tracking-wide mb-1.5">
              {exercise.bookend
                ? `${exercise.cardioMinutes || 0} min`
                : `${exercise.targetMuscle} · ${stage.label}`}
            </p>
            {/* Plans generated before bookends were named for themselves still
                carry the backing machine's name, so the title is corrected
                here too rather than only at the source. */}
            <h2 className="text-xl font-extrabold text-white">
              {exercise.bookend
                ? (exercise.bookend === 'warmup' ? day.warmup?.name : day.cooldown?.name)
                  || (exercise.bookend === 'warmup' ? 'Warm-up' : 'Cooldown')
                : exercise.name}
            </h2>
          </div>
          {stage.key === 'video' ? (
            <div className="relative aspect-video border-b border-slate-800 bg-black overflow-hidden">
              <iframe
                src={getYouTubeEmbedUrl(libraryExercise?.videoUrl)}
                title={exercise.name}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : stage.key === 'bookend' ? null : stage.key === 'tutorial' && hasTutorialVideo ? (
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
                    disabled={tutorialStepIdx === 0 || tutorialPlaying}
                    className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold bg-slate-800 border border-slate-700 text-white active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all duration-150"
                  >
                    ←
                  </button>
                  <button
                    onClick={playNextTutorialStep}
                    disabled={tutorialStepIdx >= tutorialSteps.length - 1 || tutorialPlaying}
                    className="flex-1 py-2 rounded-lg text-[11px] font-extrabold bg-lime-500 text-slate-950 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all duration-150"
                  >
                    {tutorialPlaying ? 'Playing…' : 'Next Step →'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Identify is the step where the photo is the whole point — it is
            // how someone picks this machine out of a room of machines — so it
            // gets more height, and the image is contained rather than cropped
            // to fill. object-cover was cutting the ends off the very thing the
            // client is being asked to recognise.
            <div
              className={`${stage.key === 'identify' ? 'h-72' : 'h-44'} border-b border-slate-800 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900`}
            >
              {stage.key === 'identify' ? (
                equipmentItem?.imageUrl ? (
                  <img
                    src={equipmentItem.imageUrl}
                    alt={equipmentItem.name}
                    className="w-full h-full object-contain p-3"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
                    <Dumbbell className="w-8 h-8 opacity-50" />
                    <span>{equipmentItem ? 'No photo added yet' : 'Equipment not linked yet'}</span>
                  </div>
                )
              ) : stage.key === 'tutorial' ? (
                gifUrl ? (
                  // Same reasoning: a cropped demonstration can hide the part of
                  // the movement it exists to show.
                  <img src={gifUrl} alt={exercise.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <PlayCircle className="w-10 h-10 text-sky-400" />
                )
              ) : null}
            </div>
          )}
          <div className="p-5">
            {stage.key === 'locate' && zone && (
              <div className="mb-3">
                <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{zone.name}</span>
              </div>
            )}

            {stage.key === 'video' && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Follow along with the full video before moving on — there's nothing to log for this one.
                </p>
              </div>
            )}

            {stage.key !== 'bookend' && !(stage.key === 'tutorial' && hasTutorialVideo) && (stage.key !== 'tutorial' || instructions) && (stage.key !== 'video' || instructions) && (
              <p className={`text-sm text-slate-400 leading-relaxed ${stage.key === 'video' ? 'mt-3' : ''}`}>
                {stage.key === 'locate' && zone && `Head to the ${zone.name}. Follow the map above — it marks exactly where this machine sits on the gym floor.`}
                {stage.key === 'locate' && !zone && 'This exercise has no zone set — ask an admin to link it in the plan editor.'}
                {stage.key === 'identify' && (equipmentItem?.description || 'Look for the machine matching this name on the gym floor.')}
                {stage.key === 'tutorial' && instructions}
                {stage.key === 'video' && instructions}
              </p>
            )}

            {stage.key === 'tutorial' && !exercise.bookend && (harder || easier || harderMedia || easierMedia) && (
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                {(harder || harderMedia) && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold text-orange-400 uppercase tracking-wide mb-1">Harder</p>
                    {harder && <p className="text-xs text-slate-300 leading-relaxed">{harder}</p>}
                    {harderMedia && (
                      <button
                        onClick={() => setVariationOverlay('harder')}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 text-[10px] font-extrabold active:scale-95 transition-all duration-150 ${harder ? 'mt-2' : ''}`}
                      >
                        <PlayCircle className="w-3 h-3" /> Watch tutorial
                      </button>
                    )}
                  </div>
                )}
                {(easier || easierMedia) && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wide mb-1">Easier</p>
                    {easier && <p className="text-xs text-slate-300 leading-relaxed">{easier}</p>}
                    {easierMedia && (
                      <button
                        onClick={() => setVariationOverlay('easier')}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 text-[10px] font-extrabold active:scale-95 transition-all duration-150 ${easier ? 'mt-2' : ''}`}
                      >
                        <PlayCircle className="w-3 h-3" /> Watch tutorial
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* A warm-up gets its steps instead of an effort rating — nothing
                about it is logged or progressed, so asking how hard it was
                would be asking for a number nothing reads. */}
            {stage.key === 'bookend' && (
              <>
                {/* All that survives of the old Locate stage. A beginner still
                    needs to know where the bike is; they do not need a map
                    screen and an equipment photo to be told. */}
                {zone && (
                  <p className="text-xs text-slate-500 mb-3">
                    Head to the <span className="font-bold text-slate-300">{zone.name}</span>.
                  </p>
                )}
                <ul className="space-y-1.5">
                  {(exercise.bookend === 'warmup' ? day.warmup : day.cooldown)?.steps.map((step, i) => (
                    <li key={i} className="text-sm text-slate-400 leading-relaxed flex gap-2.5">
                      <span className="text-slate-600 font-bold shrink-0">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                {/* Falls back to the entry's own notes when the day carries no
                    structured steps — an older plan, or one built by hand. */}
                {!(exercise.bookend === 'warmup' ? day.warmup : day.cooldown)?.steps?.length && exercise.notes && (
                  <p className="text-sm text-slate-400 leading-relaxed">{exercise.notes}</p>
                )}
              </>
            )}

            {(stage.key === 'tutorial' || stage.key === 'bookend') && exercise.isCardio && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Duration</p>
                    <p className="text-xl font-extrabold text-white">{exercise.cardioMinutes || 0} min</p>
                  </div>
                  <button
                    onClick={() => toggleSet(0)}
                    className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      rows[0]?.done ? 'bg-lime-500 border-lime-500 text-slate-950' : 'border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}
                    aria-label={rows[0]?.done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {stage.key === 'tutorial' && !exercise.isCardio && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="space-y-2.5">
                  {rows.map((row, i) => {
                    const restSec = exercise.setDetails?.[i]?.restSec;
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2">
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
                          {/* Rest, not duration. Duration was an input nothing
                              ever read — a strength set has no duration to
                              record — while the number that actually matters
                              between sets was relegated to a caption below.
                              Shown rather than typed: it is what the plan
                              prescribes, not something the client reports. */}
                          <div className="flex-1 text-center">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rest</label>
                            <div className="w-full bg-slate-800/40 border border-slate-800 rounded-lg px-1 py-2 text-center text-sm font-bold text-slate-300">
                              {formatRest(restSec)}
                            </div>
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
                      </div>
                    );
                  })}
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

                {/* How hard it was, and whether anything hurt. Each number is
                    labelled with reps left rather than left as a bare score —
                    the rules key off how close to failure the set was, and a
                    number on its own would mean something different to
                    everyone answering it. */}
                {/* Why this looks different from last time. A weight that moves
                    with no explanation reads as a bug, and for a beginner the
                    explanation is most of the coaching. */}
                {exercise.adaptation && exercise.adaptation.action !== 'maintain' && (
                  <div
                    className={`mt-4 p-3 rounded-lg border ${
                      exercise.adaptation.action === 'refer' || exercise.adaptation.action === 'withdraw'
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-lime-500/10 border-lime-500/30'
                    }`}
                  >
                    <p
                      className={`text-[10px] font-extrabold uppercase tracking-wide ${
                        exercise.adaptation.action === 'refer' || exercise.adaptation.action === 'withdraw'
                          ? 'text-amber-300'
                          : 'text-lime-400'
                      }`}
                    >
                      {exercise.substitutedFor ? `Swapped in for ${exercise.substitutedFor.name}` : 'Updated from last time'}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">{exercise.adaptation.reason}</p>
                  </div>
                )}

                {!exercise.bookend && (
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <p className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">How hard was that?</p>
                  <div className="grid grid-cols-5 gap-1.5 mt-2.5">
                    {EFFORT_SCALE.map(level => {
                      const selected = effortState[exIdx] === level.value;
                      return (
                        <button
                          key={level.value}
                          onClick={() => setEffort(level.value)}
                          aria-pressed={selected}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-center transition-colors ${
                            selected
                              ? 'bg-lime-500 border-lime-500 text-slate-950'
                              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base font-extrabold leading-none">{level.value}</span>
                          <span className={`text-[8.5px] font-bold leading-tight ${selected ? 'text-slate-900' : 'text-slate-500'}`}>
                            {level.repsLeft}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {effortState[exIdx] && (
                    <p className="text-[11px] font-bold text-lime-400 mt-2">
                      {EFFORT_SCALE.find(l => l.value === effortState[exIdx])?.label}
                    </p>
                  )}

                  <button
                    onClick={togglePain}
                    aria-pressed={painState[exIdx] === true}
                    className={`w-full mt-3 py-2.5 rounded-lg border text-xs font-extrabold transition-colors ${
                      painState[exIdx]
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {painState[exIdx] ? 'Something hurt — we\'ll swap this out' : 'Something hurt?'}
                  </button>

                  {/* Asked only once pain is flagged, so the common case stays a
                      single tap. The answer decides what the replacement can
                      be: anything loading this area is ruled out entirely. */}
                  {painState[exIdx] && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                      <p className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wide">Where?</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ALL_JOINT_STRESS_AREAS.map(area => {
                          const selected = painAreaState[exIdx] === area;
                          return (
                            <button
                              key={area}
                              onClick={() => setPainArea(area)}
                              aria-pressed={selected}
                              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-bold transition-colors ${
                                selected
                                  ? 'bg-amber-500 border-amber-500 text-slate-950'
                                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {area}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-2.5 leading-snug">
                        If it was sharp, or it hurt during the set rather than afterwards, stop this
                        exercise for today.
                      </p>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* A failed save would otherwise be invisible: the session closes, the
            client believes it was recorded, and the plan silently never
            advances. Surface it and let them retry rather than trapping them
            in the session. */}
        {saveError && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40">
            <p className="text-xs font-bold text-amber-300">{saveError}</p>
            <button
              onClick={finishSession}
              className="mt-2 text-xs font-extrabold text-amber-200 underline underline-offset-2 hover:text-white"
            >
              Try saving again
            </button>
          </div>
        )}

        {stage.key !== 'locate' && (
          <div className="flex gap-2.5 mb-6">
            <button
              onClick={() => go(-1)}
              disabled={current === 0}
              className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-slate-800 border border-slate-700 text-slate-300 active:scale-95 disabled:opacity-40 disabled:active:scale-100 hover:bg-slate-700 transition-all duration-150"
            >
              ← Previous
            </button>
            <button
              onClick={() => (isLastStage ? (saveError ? onFinish() : finishSession()) : go(1))}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-extrabold bg-lime-500 hover:bg-lime-400 active:scale-95 text-slate-950 transition-all duration-150 disabled:opacity-60 disabled:active:scale-100"
            >
              {isLastStage
                ? saving
                  ? 'Saving…'
                  : saveError
                  ? 'Finish anyway'
                  : 'Finish session'
                : stage.key === 'video'
                ? 'Mark Complete →'
                : stage.key === 'tutorial' || stage.key === 'bookend'
                ? 'Next exercise →'
                : 'Next →'}
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
                    {stagesByExIdx[i][0]?.key === 'video' && (
                      <span className="text-[8.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                        ▶ Video
                      </span>
                    )}
                    {blockTypeByExerciseId[e.id] && (
                      <span className={`text-[8.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                        blockTypeByExerciseId[e.id] === 'warmup' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        {blockTypeByExerciseId[e.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-7">
                    {stagesByExIdx[i].map((s, si) => {
                      const abs = startIndexByExIdx[i] + si;
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

      {/* Variation tutorial overlay — Harder/Easier's own video + steps,
          from either a quick inline tutorial or a linked library exercise. */}
      {variationOverlay && (() => {
        const media = variationOverlay === 'harder' ? harderMedia : easierMedia;
        if (!media) return null;
        const tone = variationOverlay === 'harder' ? 'orange' : 'sky';
        return (
          <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3.5 border-b border-slate-800 bg-slate-900/70">
              <button
                onClick={() => setVariationOverlay(null)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {exercise.name}
              </button>
              <span className={`ml-auto text-[9px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full ${tone === 'orange' ? 'bg-orange-500/15 text-orange-400' : 'bg-sky-500/15 text-sky-400'}`}>
                {variationOverlay === 'harder' ? 'Harder variation' : 'Easier variation'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-video bg-black">
                {media.source === 'native' ? (
                  <video src={media.videoUrl} controls playsInline className="w-full h-full object-cover" />
                ) : (
                  <iframe
                    src={getYouTubeEmbedUrl(media.videoUrl)}
                    title={media.name || `${variationOverlay} variation tutorial`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="p-5">
                {media.name && <h3 className="text-lg font-extrabold text-white mb-1">{media.name}</h3>}
                <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-4">
                  {media.name ? `${variationOverlay === 'harder' ? 'Harder' : 'Easier'} version of ${exercise.name}` : 'Quick tutorial'}
                </p>
                {media.steps.length > 0 && (
                  <div className="space-y-2.5">
                    {media.steps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full text-slate-950 text-[11px] font-black flex items-center justify-center ${tone === 'orange' ? 'bg-orange-400' : 'bg-sky-400'}`}>
                          {i + 1}
                        </div>
                        <p className="text-[13px] font-bold text-white leading-snug">{s}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GuidedSession;
