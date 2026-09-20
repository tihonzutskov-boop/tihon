import React, { useState } from 'react';
import { ClipboardList, Check } from 'lucide-react';
import RankList from './RankList';
import { moveItem } from '../utils/reorder';
import { QuestionnaireAnswers, ALL_JOINT_STRESS_AREAS } from '../types';
import {
  PRIMARY_GOALS, primaryGoalLabel, secondaryOptionsFor, pruneSecondary,
  goalsFromAnswers, describeGoals,
} from '../utils/goals';

interface TrainingQuestionnaireProps {
  existing: QuestionnaireAnswers | null;
  userName: string;
  gyms?: { id: string; name: string }[];
  onSubmit: (answers: QuestionnaireAnswers) => void;
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

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const LEVELS_ENABLED = ['Beginner'];
const DAYS = ['1', '2', '3', '4'];
const LENGTHS = ['30 min', '45 min', '60 min', '90 min'];
const SEXES = ['Male', 'Female', 'Prefer not to say'];
const EQUIPMENT_OPTIONS = ['Machines only', 'Comfortable with free weights', 'Anything'];
const CLEARANCE_OPTIONS = ['Yes, cleared to exercise', 'No / not sure', "Doesn't apply to me"];
// Shared with the exercise tagging chips: eligibility matches these strings
// exactly against an exercise's jointStress, so the two must not drift.
const COMMON_INJURIES = ALL_JOINT_STRESS_AREAS;

interface FormState {
  age: string; heightCm: string; weightKg: string; sex: string;
  primaryGoals: string[]; secondaryGoals: string[]; level: string;
  daysPerWeek: string; minutesPerSession: string;
  gymId: string;
  equipment: string; avoidExercises: string;
  injuryAreas: string[]; injuryNotes: string;
  medicalClearance: string; consent: boolean;
}

const blankForm = (): FormState => ({
  age: '', heightCm: '', weightKg: '', sex: '',
  primaryGoals: [], secondaryGoals: [], level: '',
  daysPerWeek: '', minutesPerSession: '',
  gymId: '',
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
    primaryGoals: goalsFromAnswers(existing).primary,
    secondaryGoals: goalsFromAnswers(existing).secondary,
    level: existing.level || '',
    daysPerWeek: existing.daysPerWeek || '',
    minutesPerSession: existing.minutesPerSession || '',
    gymId: existing.gymId || '',
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleMulti = (key: 'injuryAreas', value: string) => {
    setForm(prev => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };
  // Newly picked main goals land at the bottom of the ranking, which the
  // client then adjusts — this is what feeds assignAimsToDays's day-per-aim
  // rotation and buildGenerationProfile's "which aim stands in for the goal"
  // pick, so the order here is a real priority signal, not incidental UI state.
  // The secondary goals on offer depend on the main goals, so a change here
  // can take one away — it is dropped rather than left selected but hidden.
  const togglePrimary = (aim: string) => {
    setForm(prev => {
      const primaryGoals = prev.primaryGoals.includes(aim)
        ? prev.primaryGoals.filter(a => a !== aim)
        : [...prev.primaryGoals, aim];
      return { ...prev, primaryGoals, secondaryGoals: pruneSecondary(primaryGoals, prev.secondaryGoals) };
    });
  };
  const toggleSecondary = (aim: string) => {
    setForm(prev => ({
      ...prev,
      secondaryGoals: prev.secondaryGoals.includes(aim)
        ? prev.secondaryGoals.filter(a => a !== aim)
        : [...prev.secondaryGoals, aim],
    }));
  };
  const reorderGoals = (from: number, to: number) => {
    setForm(prev => ({ ...prev, primaryGoals: moveItem(prev.primaryGoals, from, to) }));
  };
  const startFresh = () => { setForm(blankForm()); setStep(0); setMaxReached(0); setMode('form'); };
  const editExisting = () => { setForm(toFormState(existing)); setStep(0); setMaxReached(STEP_KEYS.length - 1); setMode('form'); };
  const cancel = () => { setStep(0); setMaxReached(0); setMode('prompt'); };

  const hasHealthInfo = form.injuryNotes.trim() !== '' || form.injuryAreas.length > 0;

  const isStepValid = (key: StepKey): boolean => {
    if (key === 'about') return !!(form.age && form.heightCm && form.weightKg && form.sex);
    if (key === 'goal') return form.primaryGoals.length > 0 && !!form.level;
    if (key === 'schedule') return !!(form.daysPerWeek && form.minutesPerSession);
    if (key === 'preferences') return !!form.equipment && (gyms.length === 0 || !!form.gymId);
    if (key === 'health') return !hasHealthInfo || !!(form.medicalClearance && form.consent);
    return true;
  };

  const goNext = () => {
    const key = STEP_KEYS[step];
    if (!isStepValid(key)) return;
    if (step === STEP_KEYS.length - 1) {
      const payload: QuestionnaireAnswers = {
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        sex: form.sex,
        goals: form.primaryGoals,
        secondaryGoals: form.secondaryGoals.length > 0 ? form.secondaryGoals : undefined,
        level: form.level,
        daysPerWeek: form.daysPerWeek,
        minutesPerSession: form.minutesPerSession,
        gymId: form.gymId || undefined,
        equipment: form.equipment,
        avoidExercises: form.avoidExercises || undefined,
        injuryAreas: form.injuryAreas,
        injuryNotes: form.injuryNotes || undefined,
        medicalClearance: hasHealthInfo ? form.medicalClearance : undefined,
        consent: hasHealthInfo ? form.consent : undefined,
      };
      onSubmit(payload);
      setMode('prompt');
      return;
    }
    const next = step + 1;
    setStep(next);
    if (next > maxReached) setMaxReached(next);
  };
  const goBack = () => {
    if (step === 0) { cancel(); return; }
    setStep(step - 1);
  };
  const jumpStep = (i: number) => { if (i <= maxReached) setStep(i); };

  if (mode === 'prompt') {
    if (existing) {
      const described = describeGoals(existing);
      const chips = [...described.primary, ...described.secondary, existing.level, `${existing.daysPerWeek} days/week`, existing.minutesPerSession].filter(Boolean);
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

  const secondaryOptions = secondaryOptionsFor(form.primaryGoals);
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
        </div>
      )}

      {key === 'goal' && (
        <div className="space-y-5">
          <div>
            <FieldLabel required hint="choose all that apply">What's your main goal?</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {PRIMARY_GOALS.map(g => (
                <GoalCard key={g.aim} label={g.label} hint={g.hint} selected={form.primaryGoals.includes(g.aim)} onClick={() => togglePrimary(g.aim)} />
              ))}
            </div>
          </div>
          {/* Only meaningful with two or more goals — one goal is already its
              own rank one, and a list of one nothing has anything to reorder
              against. Every day of the plan gets one goal as its main focus;
              this order is what decides which goal that is, day by day. */}
          {form.primaryGoals.length > 1 && (
            <div>
              <FieldLabel required hint="most important first">Rank your goals</FieldLabel>
              <p className="text-[11.5px] text-slate-500 mb-3 leading-relaxed">
                Your plan gives each training day to one goal. #1 gets the most days —
                the rest fill in around it. Drag to reorder.
              </p>
              <RankList
                items={form.primaryGoals.map(aim => ({ id: aim, label: primaryGoalLabel(aim) }))}
                onMove={reorderGoals}
              />
            </div>
          )}
          {secondaryOptions.length > 0 && (
            <div>
              <FieldLabel hint="pick any">Anything else to work on?</FieldLabel>
              <p className="text-[11.5px] text-slate-500 mb-3 leading-relaxed">
                Added to your sessions as extra work alongside your main goal. It never takes over a whole training day.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {secondaryOptions.map(o => (
                  <GoalCard key={o.aim} label={o.label} hint={o.hint} selected={form.secondaryGoals.includes(o.aim)} onClick={() => toggleSecondary(o.aim)} />
                ))}
              </div>
            </div>
          )}
          <div>
            <FieldLabel required>Training experience</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(opt => {
                const enabled = LEVELS_ENABLED.includes(opt);
                return (
                  <Pill
                    key={opt}
                    label={opt}
                    selected={form.level === opt}
                    disabled={!enabled}
                    tag={!enabled ? 'Soon' : undefined}
                    onClick={enabled ? () => set('level', opt) : undefined}
                  />
                );
              })}
            </div>
          </div>
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
              {LENGTHS.map(opt => <Pill key={opt} label={opt} selected={form.minutesPerSession === opt} onClick={() => set('minutesPerSession', opt)} />)}
            </div>
          </div>
        </div>
      )}

      {key === 'preferences' && (
        <div className="space-y-5">
          {gyms.length > 0 && (
            <div>
              <FieldLabel required>Which gym do you train at?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {gyms.map(g => <Pill key={g.id} label={g.name} selected={form.gymId === g.id} onClick={() => set('gymId', g.id)} />)}
              </div>
              <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
                Your plan only uses equipment this gym actually has.
              </p>
            </div>
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

      <div className="flex gap-2.5 mt-7 pt-5 border-t border-slate-800">
        <button
          onClick={goBack}
          className="flex-shrink-0 px-5 py-3 rounded-xl text-xs font-extrabold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <button
          onClick={goNext}
          disabled={!valid}
          className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-lime-500 hover:bg-lime-400 disabled:opacity-40 disabled:cursor-default text-slate-950 transition-colors"
        >
          {isLast ? 'Submit questionnaire' : 'Next →'}
        </button>
      </div>
    </div>
  );
};

export default TrainingQuestionnaire;
