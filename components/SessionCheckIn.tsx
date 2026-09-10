import React, { useState } from 'react';
import { Loader2, ShieldAlert, Sunrise } from 'lucide-react';
import {
  verdictForCheckIn,
  type IllnessState, type SleepQuality, type Soreness,
  type SessionEffort, type CutShortReason,
  type PreSessionCheckIn, type PostSessionCheckIn, type ReadinessVerdict,
} from '../utils/sessionCheckIn';

interface Props {
  phase: 'pre' | 'post';
  dayName: string;
  planDayId?: string | null;
  /** Post-session only: what the session logged, shown back before asking. */
  summary?: { exercises: number; sets: number; tonnageKg: number };
  /** Pre-session: called with the verdict once the client chooses to proceed. */
  onProceed?: (checkIn: PreSessionCheckIn, verdict: ReadinessVerdict) => void;
  onSubmitPost?: (checkIn: PostSessionCheckIn) => void;
  /** Leaving without training — ILLNESS-4's rest path, or a client backing out. */
  onCancel: () => void;
  saving?: boolean;
}

const OptionRow = <T,>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <div className="mb-4">
    <p className="text-[11px] font-bold text-slate-400 mb-1.5">{label}</p>
    <div className="flex gap-1.5">
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-xl border py-2.5 px-1 text-center transition-colors ${
              selected
                ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-500'
            }`}
          >
            {opt.icon && <span className="block text-base leading-none mb-1">{opt.icon}</span>}
            <span className="block text-[9.5px] font-bold leading-tight">{opt.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const Shell: React.FC<{ dayName: string; badge: string; children: React.ReactNode }> = ({ dayName, badge, children }) => (
  <div className="fixed inset-0 z-[110] bg-slate-950 text-slate-300 overflow-y-auto animate-in fade-in duration-200">
    <div className="max-w-md mx-auto min-h-full flex flex-col">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-lime-400 to-lime-600 text-slate-950 font-black text-sm grid place-items-center flex-shrink-0">
          G
        </div>
        <span className="text-[13px] font-bold text-white">{dayName}</span>
        <span className="text-[10.5px] text-slate-500 ml-auto">{badge}</span>
      </header>
      <div className="px-4 py-4 flex-1">{children}</div>
    </div>
  </div>
);

const SessionCheckIn: React.FC<Props> = ({
  phase, dayName, planDayId, summary, onProceed, onSubmitPost, onCancel, saving,
}) => {
  // Pre-session. Defaults sit at the middle of each scale so a client with
  // nothing to report never has to answer anything — they just start.
  const [readiness, setReadiness] = useState(4);
  const [sleep, setSleep] = useState<SleepQuality>('ok');
  const [soreness, setSoreness] = useState<Soreness>('none');
  const [wasIll, setWasIll] = useState(false);
  const [illness, setIllness] = useState<IllnessState>('recovered');
  const [verdict, setVerdict] = useState<ReadinessVerdict | null>(null);

  // Post-session.
  const [effort, setEffort] = useState<SessionEffort>('hard');
  const [completedFully, setCompletedFully] = useState(true);
  const [cutShortReason, setCutShortReason] = useState<CutShortReason>('time');
  const [note, setNote] = useState('');

  const buildPre = (): PreSessionCheckIn => ({
    phase: 'pre',
    planDayId,
    readiness,
    sleep,
    soreness,
    illness: wasIll ? illness : 'none',
  });

  // --- post ---------------------------------------------------------------

  if (phase === 'post') {
    return (
      <Shell dayName={dayName} badge="Done">
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-lime-400 mb-1.5">Session complete</p>
        <h2 className="text-xl font-extrabold text-white mb-1">Nice work.</h2>
        <p className="text-xs text-slate-500 mb-4">Two taps and you're done.</p>

        {summary && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 mb-4">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.11em] text-slate-500 mb-2.5">What you logged</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [summary.exercises, 'exercises'],
                [summary.sets, 'sets'],
                [summary.tonnageKg > 0 ? summary.tonnageKg.toLocaleString() : '—', 'kg'],
              ].map(([v, l]) => (
                <div key={String(l)}>
                  <div className="text-[17px] font-black text-white tabular-nums leading-none">{v}</div>
                  <div className="text-[9px] font-semibold text-slate-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <OptionRow<SessionEffort>
          label="How hard was that overall?"
          value={effort}
          onChange={setEffort}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'hard', label: 'Hard' },
            { value: 'very_hard', label: 'Very hard' },
            { value: 'maximal', label: 'Maximal' },
          ]}
        />

        <OptionRow<boolean>
          label="Did you get through it all?"
          value={completedFully}
          onChange={setCompletedFully}
          options={[{ value: true, label: 'All of it' }, { value: false, label: 'Cut it short' }]}
        />

        {/* DELOAD-6: the log shows a short session but never why. Only this
            answer separates fatigue from a busy rack, and the rule turns
            entirely on that difference. */}
        {!completedFully && (
          <div className="rounded-xl border border-lime-500/25 bg-lime-500/5 p-3 mb-4">
            <p className="text-[11px] font-bold text-lime-400 mb-1.5">What got in the way?</p>
            <div className="flex flex-col gap-1.5">
              {([
                ['time', 'Ran out of time'],
                ['fatigue', 'Too tired to finish'],
                ['pain', 'Something hurt'],
                ['equipment_busy', 'Equipment was busy'],
                ['other', 'Something else'],
              ] as [CutShortReason, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={cutShortReason === value}
                  onClick={() => setCutShortReason(value)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-[11.5px] font-semibold transition-colors ${
                    cutShortReason === value
                      ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Anything else? (optional)"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-[11.5px] text-slate-300 placeholder:text-slate-500 resize-none focus:outline-none focus:border-lime-500"
        />

        <button
          type="button"
          disabled={saving}
          onClick={() => onSubmitPost?.({
            phase: 'post',
            planDayId,
            effort,
            completedFully,
            cutShortReason: completedFully ? null : cutShortReason,
            note: note.trim() || null,
          })}
          className="w-full mt-4 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-slate-950 font-extrabold text-[13.5px] py-3.5 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Finish →'}
        </button>
      </Shell>
    );
  }

  // --- pre: the verdict, once illness has been reported --------------------

  if (verdict && verdict.verdict !== 'train') {
    const stopped = verdict.verdict === 'rest';
    return (
      <Shell dayName={dayName} badge={stopped ? 'Stopped' : 'Adjusted'}>
        <div className={`rounded-2xl p-4 mb-3.5 border ${
          stopped ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          {stopped
            ? <ShieldAlert className="w-6 h-6 text-red-400 mb-2" />
            : <Sunrise className="w-6 h-6 text-orange-400 mb-2" />}
          <p className={`text-base font-extrabold mb-1.5 ${stopped ? 'text-red-400' : 'text-orange-400'}`}>
            {verdict.headline}
          </p>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">{verdict.detail}</p>
          <span className="inline-block mt-2.5 text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {verdict.rule}
          </span>
        </div>

        {!stopped && (
          // A session that quietly shrank reads as a broken plan, so the
          // adjustment is stated rather than just applied.
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
            {[
              ['Weight on every lift', `${Math.round(verdict.loadFactor * 100)}% of normal`],
              ['Total sets', `${Math.round(verdict.volumeFactor * 100)}% of normal`],
              ['Target effort', 'Well short of hard'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-baseline text-[11.5px] py-1">
                <span className="text-slate-500">{l}</span>
                <span className="font-bold text-orange-400 tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        )}

        {stopped && (
          <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">
            Your plan isn't behind. It resumes where it left off, at a weight that accounts for the
            break — nothing is lost by missing today.
          </p>
        )}

        {stopped ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl border border-slate-700 bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white font-extrabold text-[13.5px] py-3.5 transition-colors"
            >
              Back to my plan
            </button>
            {/* Deliberately reachable. A hard block does not keep anyone from
                training — it teaches them to under-report on the check-in,
                which costs the data the rule depends on. */}
            <button
              type="button"
              onClick={() => onProceed?.(buildPre(), verdict)}
              className="w-full mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 py-2 transition-colors"
            >
              Train anyway
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => onProceed?.(buildPre(), verdict)}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-extrabold text-[13.5px] py-3.5 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Start lighter session →
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 py-2 transition-colors"
            >
              Not today — rest instead
            </button>
          </>
        )}
      </Shell>
    );
  }

  // --- pre: the questions --------------------------------------------------

  const submitPre = () => {
    const pre = buildPre();
    const v = verdictForCheckIn(pre);
    // Only a reported illness produces a screen. Everything else is recorded
    // as a fatigue signal and starts the session immediately — DELOAD-5 needs
    // persistence before anything acts, so one rough night must not shrink a
    // session the client can perfectly well do.
    if (v.verdict === 'train') onProceed?.(pre, v);
    else setVerdict(v);
  };

  return (
    <Shell dayName={dayName} badge="Before we start">
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-lime-400 mb-1.5">Check-in</p>
      <h2 className="text-xl font-extrabold text-white mb-1">How are you today?</h2>
      <p className="text-xs text-slate-500 mb-4">Three taps. It changes what the session asks of you.</p>

      <OptionRow<number>
        label="Energy right now"
        value={readiness}
        onChange={setReadiness}
        options={[
          { value: 1, label: 'Drained', icon: '🪫' },
          { value: 2, label: 'Low', icon: '😮‍💨' },
          { value: 3, label: 'OK', icon: '😐' },
          { value: 4, label: 'Good', icon: '🙂' },
          { value: 5, label: 'Fresh', icon: '⚡' },
        ]}
      />

      <OptionRow<SleepQuality>
        label="Sleep last night"
        value={sleep}
        onChange={setSleep}
        options={[
          { value: 'poor', label: 'Poor' },
          { value: 'ok', label: 'OK' },
          { value: 'good', label: 'Good' },
        ]}
      />

      <OptionRow<Soreness>
        label="Sore from last session"
        value={soreness}
        onChange={setSoreness}
        options={[
          { value: 'none', label: 'Not really' },
          { value: 'some', label: 'A bit' },
          { value: 'a_lot', label: 'A lot' },
        ]}
      />

      <button
        type="button"
        aria-pressed={wasIll}
        onClick={() => setWasIll(v => !v)}
        className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          wasIll ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-500'
        }`}
      >
        <span className={`w-[15px] h-[15px] rounded border-[1.5px] flex-shrink-0 grid place-items-center text-[10px] font-black text-slate-950 ${
          wasIll ? 'bg-orange-400 border-orange-400' : 'border-slate-500'
        }`}>
          {wasIll ? '✓' : ''}
        </span>
        <span className={`text-xs font-bold ${wasIll ? 'text-orange-400' : 'text-slate-300'}`}>
          I've been ill this week
        </span>
      </button>

      {wasIll && (
        <div className="mt-2 rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
          <p className="text-[11px] font-bold text-orange-400 mb-1.5">How recovered are you?</p>
          <div className="flex flex-col gap-1.5">
            {([
              ['recovered', 'Fully recovered', 'No symptoms left'],
              ['mild', 'Mostly, mild symptoms', "Still a bit off"],
              ['unwell', 'Still unwell', "Symptoms haven't settled"],
            ] as [IllnessState, string, string][]).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                aria-pressed={illness === value}
                onClick={() => setIllness(value)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  illness === value
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="block text-[11.5px] font-semibold">{label}</span>
                <span className={`block text-[10px] ${illness === value ? 'text-orange-400/80' : 'text-slate-500'}`}>{hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={submitPre}
        className={`w-full mt-4 rounded-xl font-extrabold text-[13.5px] py-3.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
          wasIll ? 'bg-orange-500 hover:bg-orange-400 text-slate-950' : 'bg-lime-500 hover:bg-lime-400 text-slate-950'
        }`}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {wasIll ? "See today's session →" : 'Start session →'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 py-2 transition-colors"
      >
        Cancel
      </button>
    </Shell>
  );
};

export default SessionCheckIn;
