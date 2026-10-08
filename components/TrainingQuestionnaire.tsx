import React, { useState } from 'react';
import { ClipboardList, Check } from 'lucide-react';
import RankList from './RankList';
import { moveItem } from '../utils/reorder';
import { QuestionnaireAnswers, ALL_JOINT_STRESS_AREAS, FocusArea } from '../types';
import { SESSION_LENGTHS } from '../constants';
import { chainsOf, chainOf, locationsInChain, sameChain } from '../utils/gymChains';
import {
  TRAINING_TYPES, FOCUS_AREAS, MAX_FOCUS_AREAS, trainingTypeFor, goalLabel,
  goalsFromAnswers, describeGoals,
} from '../utils/goals';

interface TrainingQuestionnaireProps {
  existing: QuestionnaireAnswers | null;
  userName: string;
  gyms?: { id: string; name: string; chain?: string }[];
  // Resolves once the answers have been saved (or not). The questionnaire stays
  // open until then, so a failure can be shown here with everything still filled in.
  onSubmit: (answers: QuestionnaireAnswers) => Promise<{ ok: boolean; error?: string }>;
}

type Mode = 'prompt' | 'form';

const STEP_KEYS = ['about', 'goal', 'schedule', 'preferences', 'health'] as const;
type StepKey = typeof STEP_KEYS[number];
const STEP_LABELS: Record<StepKey, string> = {
  about: 'About you',
  goal: 'Your goal',
  schedule: 'Schedule',
  preferences: 'Preferences',
  health: 'Health & safety',
};

// Plans are built for beginners only for now, so there is one level to show
// and it is already chosen: asking the question with a single answer would only
// make someone tap it. The server still accepts all three levels (validate.js),
// so offering more later is a change to this list and the default below.
const LEVELS = ['Beginner'];
const DEFAULT_LEVEL = LEVELS[0];
const DAYS = ['1', '2', '3', '4'];
const SEXES = ['Male', 'Female', 'Prefer not to say'];
const EQUIPMENT_OPTIONS = ['Machines only', 'Comfortable with free weights', 'Anything'];
const CLEARANCE_OPTIONS = ['Yes, cleared to exercise', 'No / not sure', "Doesn't apply to me"];
// Shared with the exercise tagging chips: eligibility matches these strings
// exactly against an exercise's jointStress, so the two must not drift.
const COMMON_INJURIES = ALL_JOINT_STRESS_AREAS;

interface FormState {
  age: string; heightCm: string; weightKg: string; sex: string;
  trainingType: string; goals: string[]; focusAreas: FocusArea[]; level: string;
  daysPerWeek: string; minutesPerSession: string;
  gymId: string; gymChain: string;
  equipment: string; avoidExercises: string;
  injuryAreas: string[]; injuryNotes: string;
  medicalClearance: string; consent: boolean;
}

const blankForm = (): FormState => ({
  age: '', heightCm: '', weightKg: '', sex: '',
  trainingType: '', goals: [], focusAreas: [], level: DEFAULT_LEVEL,
  daysPerWeek: '', minutesPerSession: '',
  gymId: '', gymChain: '',
  equipment: '', avoidExercises: '',
  injuryAreas: [], injuryNotes: '',
  medicalClearance: '', consent: false,
});

const toFormState = (existing: QuestionnaireAnswers | null): FormState => {
  if (!existing) return blankForm();
  return {
    age: String(existing.age ?? ''),
    heightCm: String(existing.heightCm ?? ''),
    weightKg: String(existing.weightKg ?? ''),
    sex: existing.sex || '',
    ...goalsFromAnswers(existing),
    level: LEVELS.includes(existing.level) ? existing.level : DEFAULT_LEVEL,
    daysPerWeek: existing.daysPerWeek || '',
    // A length that is no longer offered (30 min) is left blank, so it is
    // picked again rather than saved back unchanged.
    minutesPerSession: SESSION_LENGTHS.includes(existing.minutesPerSession) ? existing.minutesPerSession : '',
    gymId: existing.gymId || '',
    gymChain: existing.gymChain || '',
    equipment: existing.equipment || '',
    avoidExercises: existing.avoidExercises || '',
    injuryAreas: existing.injuryAreas || [],
    injuryNotes: existing.injuryNotes || '',
    medicalClearance: existing.medicalClearance || '',
    consent: !!existing.consent,
  };
};

const Pill: React.FC<{ label: string; selected: boolean; disabled?: boolean; tag?: string; onClick?: () => void }> = ({ label, selected, disabled, tag, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
      disabled
        ? 'border-slate-800 bg-slate-900 text-slate-600 opacity-60 cursor-default'
        : selected
        ? 'border-lime-500 bg-lime-500/10 text-lime-400'
        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
    }`}
  >
    {label}
    {tag && (
      <span className="text-[8px] font-extrabold uppercase tracking-wide text-slate-500 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-full">
        {tag}
      </span>
    )}
  </button>
);

const GoalCard: React.FC<{ label: string; hint: string; selected: boolean; onClick: () => void }> = ({ label, hint, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`text-left px-3.5 py-3 rounded-xl border transition-colors ${
      selected
        ? 'border-lime-500 bg-lime-500/10'
        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
    }`}
  >
    <span className={`block text-xs font-extrabold ${selected ? 'text-lime-400' : 'text-slate-200'}`}>{label}</span>
    <span className="block text-[10.5px] font-semibold text-slate-500 mt-0.5 leading-snug">{hint}</span>
  </button>
);

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean; hint?: string }> = ({ children, required, hint }) => (
  <label className="block text-xs font-extrabold text-white mb-2.5">
    {children} {required ? <span className="text-lime-400">*</span> : <span className="text-slate-500 font-semibold">(optional)</span>}
    {hint && <span className="text-slate-500 font-semibold"> · {hint}</span>}
  </label>
);

const NumberField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
    <input
      type="number"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
    />
  </div>
);

const TrainingQuestionnaire: React.FC<TrainingQuestionnaireProps> = ({ existing, userName, gyms = [], onSubmit }) => {
  const [mode, setMode] = useState<Mode>('prompt');
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [form, setForm] = useState<FormState>(() => toFormState(existing));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  // The chain is asked first, then the usual location in it. A chain with one
  // location needs no second question. Answers from before chains were asked
  // carry only a location, and its chain is taken as theirs.
  const chains = chainsOf(gyms);
  const formChainName = form.gymChain || (gyms.find(g => g.id === form.gymId) ? chainOf(gyms.find(g => g.id === form.gymId)!) : '');
  const chosenChain = chains.find(c => sameChain(c.name, formChainName)) || null;
  const usualGym = chosenChain
    ? (chosenChain.locations.length === 1 ? chosenChain.locations[0] : chosenChain.locations.find(g => g.id === form.gymId) || null)
    : null;
  const pickChain = (name: string) => setForm(prev => {
    const locations = locationsInChain(gyms, name);
    const keep = locations.some(g => g.id === prev.gymId);
    return { ...prev, gymChain: name, gymId: keep ? prev.gymId : locations.length === 1 ? locations[0].id : '' };
  });
  const toggleMulti = (key: 'injuryAreas', value: string) => {
    setForm(prev => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };
  // The goals on offer belong to the training type, so switching type clears
  // them rather than carrying a goal over under another type's name.
  const chooseType = (key: string) => {
    setForm(prev => (prev.trainingType === key ? prev : { ...prev, trainingType: key, goals: [] }));
  };
  // Newly picked goals land at the bottom of the ranking, which the client
  // then adjusts — this is what feeds assignAimsToDays's day-per-aim rotation
  // and buildGenerationProfile's "which aim stands in for the goal" pick, so
  // the order here is a real priority signal, not incidental UI state.
  const toggleGoal = (aim: string) => {
    setForm(prev => ({
      ...prev,
      goals: prev.goals.includes(aim) ? prev.goals.filter(a => a !== aim) : [...prev.goals, aim],
    }));
  };
  const toggleFocus = (area: FocusArea) => {
    setForm(prev => {
      if (prev.focusAreas.includes(area)) return { ...prev, focusAreas: prev.focusAreas.filter(a => a !== area) };
      if (prev.focusAreas.length >= MAX_FOCUS_AREAS) return prev;
      return { ...prev, focusAreas: [...prev.focusAreas, area] };
    });
  };
  const reorderGoals = (from: number, to: number) => {
    setForm(prev => ({ ...prev, goals: moveItem(prev.goals, from, to) }));
  };
  const startFresh = () => { setForm(blankForm()); setStep(0); setMaxReached(0); setMode('form'); };
  const editExisting = () => { setForm(toFormState(existing)); setStep(0); setMaxReached(STEP_KEYS.length - 1); setMode('form'); };
  const cancel = () => { setStep(0); setMaxReached(0); setMode('prompt'); };

  const hasHealthInfo = form.injuryNotes.trim() !== '' || form.injuryAreas.length > 0;

  const isStepValid = (key: StepKey): boolean => {
    if (key === 'about') return !!(form.age && form.heightCm && form.weightKg && form.sex && form.level);
    if (key === 'goal') return !!trainingTypeFor(form.trainingType) && form.goals.length > 0;
    if (key === 'schedule') return !!(form.daysPerWeek && form.minutesPerSession);
    if (key === 'preferences') return !!form.equipment && (gyms.length === 0 || (!!chosenChain && !!usualGym));
    if (key === 'health') return !hasHealthInfo || !!(form.medicalClearance && form.consent);
    return true;
  };

  const goNext = async () => {
    const key = STEP_KEYS[step];
    if (!isStepValid(key) || submitting) return;
    if (step === STEP_KEYS.length - 1) {
      const payload: QuestionnaireAnswers = {
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        sex: form.sex,
        // Supporting goals from before the three levels are not asked for any
        // more, so saving answers again lets them go.
        trainingType: form.trainingType,
        goals: form.goals,
        focusAreas: form.focusAreas.length > 0 ? form.focusAreas : undefined,
        level: form.level,
        daysPerWeek: form.daysPerWeek,
        minutesPerSession: form.minutesPerSession,
        gymId: usualGym?.id || undefined,
        gymChain: chosenChain?.name || undefined,
        equipment: form.equipment,
        avoidExercises: form.avoidExercises || undefined,
        injuryAreas: form.injuryAreas,
        injuryNotes: form.injuryNotes || undefined,
        medicalClearance: hasHealthInfo ? form.medicalClearance : undefined,
        consent: hasHealthInfo ? form.consent : undefined,
      };
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await onSubmit(payload);
        if (result.ok) setMode('prompt');
        else setSubmitError(result.error || 'Your answers could not be saved. Please try again.');
      } catch (err: any) {
        setSubmitError(err?.message || 'Your answers could not be saved. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const next = step + 1;
    setStep(next);
    if (next > maxReached) setMaxReached(next);
  };
  const goBack = () => {
    setSubmitError(null);
    if (step === 0) { cancel(); return; }
    setStep(step - 1);
  };
  const jumpStep = (i: number) => { if (i <= maxReached) setStep(i); };

  if (mode === 'prompt') {
    if (existing) {
      const described = describeGoals(existing);
      const chips = [
        described.type, ...described.goals, ...described.extras, ...described.focus.map(f => `Focus: ${f}`),
        existing.level, `${existing.daysPerWeek} days/week`, existing.minutesPerSession,
      ].filter(Boolean);
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-16 text-center">
          <div className="w-14 h-14 rounded-full bg-lime-500 text-slate-950 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white mb-2">Thanks, {userName}!</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto mb-5">
            We've got your goals. Your plan will appear here as soon as a matching training plan is ready.
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {chips.map(c => (
              <span key={c} className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{c}</span>
            ))}
          </div>
          <button onClick={editExisting} className="text-[11.5px] font-bold text-slate-500 hover:text-slate-300 underline transition-colors">
            Edit answers
          </button>
        </div>
      );
    }
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-lime-500/10 border border-lime-500/25 text-lime-400 flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-white mb-2">Let's build your training plan</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto mb-5">
          Answer a few quick questions about your goals and schedule, and your coach will put together a personal step-by-step plan for you.
        </p>
        <button onClick={startFresh} className="bg-lime-500 hover:bg-lime-400 text-slate-950 font-extrabold text-xs px-6 py-3 rounded-xl transition-colors">
          Start questionnaire
        </button>
        <p className="text-[10.5px] text-slate-600 mt-3">Takes about a minute</p>
      </div>
    );
  }

  const chosenType = trainingTypeFor(form.trainingType);
  const key = STEP_KEYS[step];
  const pct = Math.round(((step + 1) / STEP_KEYS.length) * 100);
  const isLast = step === STEP_KEYS.length - 1;
  const valid = isStepValid(key);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 mb-16">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Step {step + 1} of {STEP_KEYS.length}</span>
        <span className="text-[11px] font-extrabold text-lime-400 uppercase tracking-wide">{STEP_LABELS[key]}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
        <div className="h-full bg-lime-500 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-1.5 mb-6">
        {STEP_KEYS.map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => jumpStep(i)}
            disabled={i > maxReached}
            className={`flex-1 text-center py-1.5 px-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide border truncate ${
              i === step
                ? 'text-lime-400 border-lime-500 bg-lime-500/10'
                : i < step
                ? 'text-lime-400 border-lime-500/30 bg-lime-500/5'
                : 'text-slate-500 border-slate-800 bg-slate-900'
            } ${i <= maxReached ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {STEP_LABELS[k]}
          </button>
        ))}
      </div>

      {key === 'about' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Age" value={form.age} onChange={v => set('age', v)} placeholder="28" />
            <NumberField label="Height (cm)" value={form.heightCm} onChange={v => set('heightCm', v)} placeholder="170" />
            <NumberField label="Weight (kg)" value={form.weightKg} onChange={v => set('weightKg', v)} placeholder="65" />
          </div>
          <div>
            <FieldLabel required>Sex</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {SEXES.map(opt => <Pill key={opt} label={opt} selected={form.sex === opt} onClick={() => set('sex', opt)} />)}
            </div>
          </div>
          <div>
            <FieldLabel required>Training experience</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(opt => (
                <Pill key={opt} label={opt} selected={form.level === opt} onClick={() => set('level', opt)} />
              ))}
            </div>
            <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
              Your plan is built for people starting out.
            </p>
          </div>
        </div>
      )}

      {key === 'goal' && (
        <div className="space-y-6">
          <div>
            <FieldLabel required>What kind of training?</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TRAINING_TYPES.map(t => (
                <GoalCard key={t.key} label={t.label} hint={t.hint} selected={form.trainingType === t.key} onClick={() => chooseType(t.key)} />
              ))}
            </div>
          </div>
          {chosenType && (
            <div>
              <FieldLabel required hint={chosenType.goals.length > 2 ? 'pick one or more' : chosenType.goals.length > 1 ? 'pick one or both' : undefined}>What's your goal?</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {chosenType.goals.map(g => (
                  <GoalCard key={g.aim} label={g.label} hint={g.hint} selected={form.goals.includes(g.aim)} onClick={() => toggleGoal(g.aim)} />
                ))}
              </div>
            </div>
          )}
          {/* Only meaningful with both goals picked — one goal is already its
              own rank one. Every day of the plan gets one goal as its main
              focus; this order is what decides which goal that is, day by day. */}
          {form.goals.length > 1 && (
            <div>
              <FieldLabel required hint="most important first">Rank your goals</FieldLabel>
              <p className="text-[11.5px] text-slate-500 mb-3 leading-relaxed">
                Your plan gives each training day to one goal. #1 gets the most days —
                the rest fill in around it. Drag to reorder.
              </p>
              <RankList
                items={form.goals.map(aim => ({ id: aim, label: goalLabel(aim, form.trainingType) }))}
                onMove={reorderGoals}
              />
            </div>
          )}
          {form.goals.length > 0 && (
            <div>
              <FieldLabel hint={`pick up to ${MAX_FOCUS_AREAS}`}>Any area to focus on?</FieldLabel>
              <p className="text-[11.5px] text-slate-500 mb-3 leading-relaxed">
                Your plan adds extra exercises for these areas on the days that train them.
              </p>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map(area => {
                  const selected = form.focusAreas.includes(area);
                  return (
                    <Pill
                      key={area}
                      label={area}
                      selected={selected}
                      disabled={!selected && form.focusAreas.length >= MAX_FOCUS_AREAS}
                      onClick={() => toggleFocus(area)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {key === 'schedule' && (
        <div className="space-y-5">
          <div>
            <FieldLabel required>How many days a week do you want to train?</FieldLabel>
            <p className="text-[11.5px] text-slate-500 mb-3 leading-relaxed">
              Train on whichever days suit you — your plan is a set of sessions to fit into the week.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(opt => <Pill key={opt} label={opt} selected={form.daysPerWeek === opt} onClick={() => set('daysPerWeek', opt)} />)}
            </div>
          </div>
          <div>
            <FieldLabel required>Minutes per session</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {SESSION_LENGTHS.map(opt => <Pill key={opt} label={opt} selected={form.minutesPerSession === opt} onClick={() => set('minutesPerSession', opt)} />)}
            </div>
          </div>
        </div>
      )}

      {key === 'preferences' && (
        <div className="space-y-5">
          {gyms.length > 0 && (
            <div>
              <FieldLabel required>Which gym chain do you train at?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {chains.map(c => (
                  <Pill
                    key={c.name}
                    label={c.name}
                    tag={c.locations.length > 1 ? `${c.locations.length} locations` : undefined}
                    selected={chosenChain?.name === c.name}
                    onClick={() => pickChain(c.name)}
                  />
                ))}
              </div>
            </div>
          )}
          {chosenChain && chosenChain.locations.length > 1 && (
            <div>
              <FieldLabel required>Which location do you usually go to?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {chosenChain.locations.map(g => <Pill key={g.id} label={g.name} selected={usualGym?.id === g.id} onClick={() => set('gymId', g.id)} />)}
              </div>
              <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
                Your plan is built from the equipment this one has. Each time you train you pick which {chosenChain.name} location
                you're at, and anything it doesn't have is swapped for something similar.
              </p>
            </div>
          )}
          {chosenChain && chosenChain.locations.length === 1 && (
            <p className="text-[10.5px] text-slate-500 -mt-2 leading-relaxed">
              Your plan only uses equipment this gym actually has.
            </p>
          )}
          <div>
            <FieldLabel required>Equipment comfort</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map(opt => <Pill key={opt} label={opt} selected={form.equipment === opt} onClick={() => set('equipment', opt)} />)}
            </div>
          </div>
          <div>
            <FieldLabel>Exercises to avoid</FieldLabel>
            <textarea
              value={form.avoidExercises}
              onChange={e => set('avoidExercises', e.target.value)}
              placeholder="e.g. no overhead pressing, prefer avoiding running"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-lime-500 min-h-[72px] resize-y"
            />
          </div>
        </div>
      )}

      {key === 'health' && (
        <div className="space-y-5">
          <div>
            <FieldLabel>Common areas to account for</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COMMON_INJURIES.map(opt => <Pill key={opt} label={opt} selected={form.injuryAreas.includes(opt)} onClick={() => toggleMulti('injuryAreas', opt)} />)}
            </div>
          </div>
          <div>
            <FieldLabel>Anything else?</FieldLabel>
            <textarea
              value={form.injuryNotes}
              onChange={e => set('injuryNotes', e.target.value)}
              placeholder="e.g. asthma, recent surgery, specific pain details"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-lime-500 min-h-[72px] resize-y"
            />
          </div>
          {hasHealthInfo && (
            <>
              <div>
                <FieldLabel required>Do you have medical clearance to exercise?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {CLEARANCE_OPTIONS.map(opt => <Pill key={opt} label={opt} selected={form.medicalClearance === opt} onClick={() => set('medicalClearance', opt)} />)}
                </div>
              </div>
              <label className="flex items-start gap-2.5 bg-slate-800 border border-slate-700 rounded-xl p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={e => set('consent', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-lime-500 flex-shrink-0 cursor-pointer"
                />
                <span className="text-[11.5px] text-slate-300 leading-relaxed">
                  I confirm the health information above is accurate, and I understand my coach will take it into account when building my plan.
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {submitError && (
        <div role="alert" className="mt-6 p-3 rounded-xl bg-red-500/10 border border-red-500/40">
          <p className="text-xs font-bold text-red-300">Your answers were not saved.</p>
          <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed">{submitError} Nothing you entered has been lost — try again.</p>
        </div>
      )}
      <div className="flex gap-2.5 mt-7 pt-5 border-t border-slate-800">
        <button
          onClick={goBack}
          disabled={submitting}
          className="flex-shrink-0 px-5 py-3 rounded-xl text-xs font-extrabold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <button
          onClick={goNext}
          disabled={!valid || submitting}
          className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-lime-500 hover:bg-lime-400 disabled:opacity-40 disabled:cursor-default text-slate-950 transition-colors"
        >
          {isLast ? (submitting ? 'Saving…' : 'Submit questionnaire') : 'Next →'}
        </button>
      </div>
    </div>
  );
};

export default TrainingQuestionnaire;
