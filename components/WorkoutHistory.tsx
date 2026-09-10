import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Loader2, CalendarDays, Dumbbell, TrendingUp, AlertTriangle, Ban, Flame, ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import {
  groupIntoSessions, summarize, exercisesInHistory, historyForExercise, bestSetKg,
  effortLabel, formatSets, formatWeight, formatKg, formatTonnage, attachCheckIns,
  type HistorySession, type LoggedExercise, type WithdrawalRecord, type CheckInRecord,
} from '../utils/workoutHistory';

interface WorkoutHistoryProps {
  // 'self' reads the signed-in user's own log; 'client' reads one client's,
  // which only an admin can do.
  mode: 'self' | 'client';
  clientUserId?: number;
  heading: string;
  subheading?: string;
  // Plan day id -> day name, so a session can be labelled "Upper Body" rather
  // than by a raw id. Supplied by the caller in 'self' mode (it already has the
  // plan); the server resolves it in 'client' mode.
  dayNames?: Record<string, string>;
  onClose: () => void;
}

type Tab = 'sessions' | 'exercises' | 'withdrawn';

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; tone?: 'default' | 'warn' }> = ({
  icon, label, value, tone = 'default',
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
    <div className={`flex items-center gap-1.5 mb-1 ${tone === 'warn' ? 'text-orange-400' : 'text-slate-500'}`}>
      {icon}
      <span className="text-[9.5px] font-bold uppercase tracking-widest">{label}</span>
    </div>
    <p className={`text-xl font-extrabold tabular-nums ${tone === 'warn' ? 'text-orange-300' : 'text-white'}`}>{value}</p>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
      active ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600'
    }`}
  >
    {children}
  </button>
);

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Pain is the one thing in a log that a coach must never have to hunt for.
const PainBadge: React.FC<{ area?: string | null; note?: string | null }> = ({ area, note }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/30">
    <AlertTriangle className="w-3 h-3" />
    {area ? `Pain · ${area}` : 'Pain'}
    {note ? <span className="font-medium text-orange-200/80">— {note}</span> : null}
  </span>
);

const ExerciseRow: React.FC<{ exercise: LoggedExercise }> = ({ exercise }) => {
  const effort = effortLabel(exercise.effort);
  return (
    <div className="py-2.5 border-t border-slate-800/70 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-sm font-semibold text-slate-100">
          {exercise.exerciseName || exercise.exerciseId}
        </span>
        <span className="text-xs text-slate-400 tabular-nums">
          {formatWeight(exercise.weight, exercise.weightUnit)} · {formatSets(exercise.sets)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {effort && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{effort}</span>}
        {exercise.pain && <PainBadge area={exercise.painArea} note={exercise.painNote} />}
        {/* A library entry can be deleted; the session that used it stays. */}
        {!exercise.exerciseName && (
          <span className="text-[10px] text-slate-500">no longer in the exercise library</span>
        )}
      </div>
    </div>
  );
};

const READINESS_WORDS = ['', 'Drained', 'Low', 'OK', 'Good', 'Fresh'];
const SLEEP_WORDS: Record<string, string> = { poor: 'Slept poorly', ok: 'Slept OK', good: 'Slept well' };
const SORENESS_WORDS: Record<string, string> = { none: 'Not sore', some: 'A bit sore', a_lot: 'Very sore' };
const EFFORT_WORDS: Record<string, string> = {
  easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very hard', maximal: 'Maximal',
};
const CUT_SHORT_WORDS: Record<string, string> = {
  time: 'ran out of time', fatigue: 'too tired to finish', pain: 'something hurt',
  equipment_busy: 'equipment was busy', other: 'another reason',
};
const ILLNESS_WORDS: Record<string, string> = {
  recovered: 'Recently ill — fully recovered',
  mild: 'Recently ill — mild symptoms',
  unwell: 'Reported still unwell',
};

const Chip: React.FC<{ tone?: 'plain' | 'warn'; children: React.ReactNode }> = ({ tone = 'plain', children }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
    tone === 'warn'
      ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
      : 'bg-slate-800 text-slate-300 border-slate-700'
  }`}>{children}</span>
);

// How the client said they felt, either side of the session. The value here is
// the pairing: "drained beforehand, cut short from fatigue" is a story neither
// the log nor either check-in tells on its own.
const CheckInStrip: React.FC<{ pre?: CheckInRecord; post?: CheckInRecord }> = ({ pre, post }) => {
  if (!pre && !post) return null;
  const cutShort = post && post.completedFully === false;
  return (
    <div className="pt-3 mt-1 border-t border-slate-800">
      <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Check-in</p>
      <div className="flex flex-wrap gap-1.5">
        {pre?.readiness != null && <Chip tone={pre.readiness <= 2 ? 'warn' : 'plain'}>{READINESS_WORDS[pre.readiness]}</Chip>}
        {pre?.sleep && <Chip tone={pre.sleep === 'poor' ? 'warn' : 'plain'}>{SLEEP_WORDS[pre.sleep]}</Chip>}
        {pre?.soreness && pre.soreness !== 'none' && <Chip tone={pre.soreness === 'a_lot' ? 'warn' : 'plain'}>{SORENESS_WORDS[pre.soreness]}</Chip>}
        {pre?.illness && pre.illness !== 'none' && <Chip tone="warn">{ILLNESS_WORDS[pre.illness] || pre.illness}</Chip>}
        {/* Worth seeing on its own: the client was told to rest and trained anyway. */}
        {pre?.verdict === 'rest' && <Chip tone="warn">Trained against a rest verdict</Chip>}
        {post?.effort && <Chip>Felt {EFFORT_WORDS[post.effort]?.toLowerCase() || post.effort}</Chip>}
        {cutShort && (
          <Chip tone={post!.cutShortReason === 'fatigue' || post!.cutShortReason === 'pain' ? 'warn' : 'plain'}>
            Cut short — {CUT_SHORT_WORDS[post!.cutShortReason || 'other']}
          </Chip>
        )}
      </div>
      {(pre?.note || post?.note) && (
        <p className="text-[11px] text-slate-400 mt-1.5 italic">"{post?.note || pre?.note}"</p>
      )}
    </div>
  );
};

const SessionCard: React.FC<{ session: HistorySession; checkIns?: { pre?: CheckInRecord; post?: CheckInRecord } }> = ({ session, checkIns }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              {session.dayName || 'Session'}
              {session.painFlags > 0 && (
                <span className="ml-2 align-middle inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/30">
                  <AlertTriangle className="w-3 h-3" />
                  {session.painFlags}
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {dateLabel(session.loggedAt)} · {timeLabel(session.loggedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-300 tabular-nums">
                {session.exercises.length} ex · {session.totalSets} sets
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {session.totalReps} reps{session.tonnageKg > 0 ? ` · ${session.tonnageKg.toLocaleString()} kg` : ''}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-slate-800">
          <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest pt-3 pb-1">
            {session.setsAtTarget} of {session.totalSets} sets hit the prescribed reps
          </p>
          {session.exercises.map((ex, i) => <ExerciseRow key={ex.id ?? i} exercise={ex} />)}
          <CheckInStrip pre={checkIns?.pre} post={checkIns?.post} />
        </div>
      )}
    </div>
  );
};

const WithdrawalCard: React.FC<{ record: WithdrawalRecord }> = ({ record }) => {
  const resolved = !!record.resolvedAt;
  const retryOpen = !resolved && !!record.retryAfter && new Date(record.retryAfter) <= new Date();
  const status = resolved
    ? { text: 'Back in the plan', cls: 'bg-lime-500/10 text-lime-400 border-lime-500/25' }
    : record.reason === 'referred'
      ? { text: 'Referred out — no automatic retry', cls: 'bg-red-950/30 text-red-400 border-red-800/40' }
      : retryOpen
        ? { text: 'Retry window open', cls: 'bg-slate-800 text-slate-300 border-slate-700' }
        : { text: 'Withdrawn', cls: 'bg-orange-500/10 text-orange-300 border-orange-500/30' };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-100">{record.exerciseName || record.exerciseId}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pulled {dateLabel(record.withdrawnAt)}
            {record.painArea ? ` · pain in ${record.painArea}` : ''}
            {resolved ? ` · returned ${dateLabel(record.resolvedAt!)}` : ''}
            {!resolved && record.retryAfter && !retryOpen ? ` · retry from ${dateLabel(record.retryAfter)}` : ''}
          </p>
        </div>
        <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full border flex-shrink-0 ${status.cls}`}>
          {status.text}
        </span>
      </div>
    </div>
  );
};

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
  mode, clientUserId, heading, subheading, dayNames, onClose,
}) => {
  const [loading, setLoading] = useState(true);
  // Null is distinct from an empty log: one means the request failed, the other
  // means the client genuinely has not trained. They must not read the same.
  const [logs, setLogs] = useState<LoggedExercise[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [serverDayNames, setServerDayNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('sessions');
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      if (mode === 'client') {
        if (clientUserId == null) return { logs: null as LoggedExercise[] | null, withdrawals: [], dayNames: {}, checkIns: [] };
        const history = await api.fetchClientHistory(clientUserId);
        if (!history) return { logs: null as LoggedExercise[] | null, withdrawals: [], dayNames: {}, checkIns: [] };
        return { logs: history.logs, withdrawals: history.withdrawals, dayNames: history.dayNames, checkIns: history.checkIns || [] };
      }
      const [own, mine] = await Promise.all([
        api.fetchMyExerciseLogs(undefined, 400),
        api.fetchMyCheckIns(200),
      ]);
      return { logs: own, withdrawals: [], dayNames: {}, checkIns: mine.checkIns as CheckInRecord[] };
    };
    load().then(result => {
      if (cancelled) return;
      setLogs(result.logs);
      setWithdrawals(result.withdrawals);
      setCheckIns(result.checkIns);
      setServerDayNames(result.dayNames);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, clientUserId]);

  const sessions = useMemo(
    () => groupIntoSessions(logs || [], { ...serverDayNames, ...(dayNames || {}) }),
    [logs, serverDayNames, dayNames]
  );
  const summary = useMemo(() => summarize(sessions), [sessions]);
  const checkInsBySession = useMemo(() => attachCheckIns(sessions, checkIns), [sessions, checkIns]);
  const exercises = useMemo(() => exercisesInHistory(sessions), [sessions]);
  const focused = useMemo(
    () => (focusedExerciseId ? historyForExercise(sessions, focusedExerciseId) : []),
    [sessions, focusedExerciseId]
  );

  const activeWithdrawals = withdrawals.filter(w => !w.resolvedAt).length;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-200 overflow-y-auto animate-in fade-in duration-200">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{heading}</h1>
            {subheading && <p className="text-xs text-slate-500 truncate">{subheading}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading training history…</span>
          </div>
        ) : logs === null ? (
          <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5">
            <p className="text-sm font-bold text-red-400 mb-1">Could not load the training history</p>
            <p className="text-xs text-slate-400">
              The sessions are still stored — this is a problem reading them, not a sign that anything was lost.
              Try again in a moment.
            </p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
            <Dumbbell className="w-7 h-7 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-bold text-white mb-1">No sessions logged yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              A session appears here once it is finished in the guided workout — that is what records
              the weights, reps and effort. Having a plan assigned does not create history on its own.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Stat icon={<CalendarDays className="w-3.5 h-3.5" />} label="Sessions" value={String(summary.sessions)} />
              <Stat icon={<Flame className="w-3.5 h-3.5" />} label="Week streak" value={summary.weekStreak > 0 ? `${summary.weekStreak} wk` : '—'} />
              <Stat icon={<Dumbbell className="w-3.5 h-3.5" />} label="Sets" value={summary.totalSets.toLocaleString()} />
              <Stat
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                label="Total lifted"
                value={formatTonnage(summary.tonnageKg)}
              />
            </div>

            {(summary.painFlags > 0 || activeWithdrawals > 0) && (
              <div className="mb-6 bg-orange-500/5 border border-orange-500/25 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-orange-300">
                  {summary.painFlags > 0 && `${summary.painFlags} pain report${summary.painFlags !== 1 ? 's' : ''}`}
                  {summary.painFlags > 0 && activeWithdrawals > 0 && ' · '}
                  {activeWithdrawals > 0 && `${activeWithdrawals} movement${activeWithdrawals !== 1 ? 's' : ''} currently withdrawn`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {summary.firstLoggedAt && `Training since ${dateLabel(summary.firstLoggedAt)}.`} Pain reports pull
                  the movement from the plan automatically — they are not only a note.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
              <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')}>
                Sessions ({sessions.length})
              </TabButton>
              <TabButton active={tab === 'exercises'} onClick={() => setTab('exercises')}>
                By exercise ({exercises.length})
              </TabButton>
              {withdrawals.length > 0 && (
                <TabButton active={tab === 'withdrawn'} onClick={() => setTab('withdrawn')}>
                  Withdrawn ({withdrawals.length})
                </TabButton>
              )}
            </div>

            {tab === 'sessions' && (
              <div className="space-y-2.5">
                {sessions.map(s => (
                  <SessionCard key={s.sessionId} session={s} checkIns={checkInsBySession.get(s.sessionId)} />
                ))}
                {summary.sessions >= 400 && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Showing the most recent 400 logged exercises.
                  </p>
                )}
              </div>
            )}

            {tab === 'exercises' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  {exercises.map(ex => {
                    const active = ex.exerciseId === focusedExerciseId;
                    return (
                      <button
                        key={ex.exerciseId}
                        type="button"
                        onClick={() => setFocusedExerciseId(active ? null : ex.exerciseId)}
                        className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors ${
                          active ? 'border-lime-500 bg-lime-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${active ? 'text-lime-300' : 'text-slate-100'}`}>{ex.name}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {ex.sessions} session{ex.sessions !== 1 ? 's' : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div>
                  {!focusedExerciseId ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-xs text-slate-500">
                      Pick a movement to see every session it was trained in, newest first.
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      {(() => {
                        const best = bestSetKg(focused);
                        return (
                          <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            {focused.length} session{focused.length !== 1 ? 's' : ''}
                            {best != null ? ` · heaviest ${formatKg(best)}` : ' · bodyweight'}
                          </p>
                        );
                      })()}
                      <div className="space-y-2.5">
                        {focused.map(({ session, exercise }, i) => (
                          <div key={`${session.sessionId}-${i}`} className="flex items-baseline justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-xs font-semibold text-slate-200 tabular-nums">
                                {formatWeight(exercise.weight, exercise.weightUnit)} · {formatSets(exercise.sets)}
                              </p>
                              <p className="text-[10.5px] text-slate-500">
                                {dateLabel(session.loggedAt)}
                                {effortLabel(exercise.effort) ? ` · ${effortLabel(exercise.effort)}` : ''}
                              </p>
                            </div>
                            {exercise.pain && <PainBadge area={exercise.painArea} note={exercise.painNote} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'withdrawn' && (
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5 mb-1">
                  <Ban className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                  A movement is withdrawn when it hurts. The log alone cannot show this — once pulled,
                  the client stops logging it, so it would look like a skipped exercise.
                </p>
                {withdrawals.map((w, i) => <WithdrawalCard key={`${w.exerciseId}-${i}`} record={w} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WorkoutHistory;
