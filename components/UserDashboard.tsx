
import React, { useEffect, useState } from 'react';
import { User, Gym, Language, WorkoutPlan, WorkoutDay, QuestionnaireAnswers } from '../types';
import { translations, getGymTranslation, translateDayName } from '../translations';
import { Trophy, Flame, Clock, LogOut, ArrowRight, MapPin, Check, Play, History, PlayCircle } from 'lucide-react';
import GymMap from './GymMap';
import TrainingQuestionnaire from './TrainingQuestionnaire';
import WorkoutHistory from './WorkoutHistory';
import { api } from '../services/api';
import { hasGeneratedPlan, startOfWeek, weeklySessions, latestCompletionByDay } from '../utils/planSchedule';
import { describeCompleted } from '../utils/whenDone';

interface UserDashboardProps {
  user: User;
  gyms: Gym[];
  activeGymId: string;
  workoutPlan: WorkoutPlan;
  onLogout: () => void;
  onEnterGym: (gymId: string) => void;
  // The gym map is admin-only for now; without it these cards go nowhere.
  canOpenGymMap?: boolean;
  onStartWorkout: (dayIndex: number, gymId: string) => void;
  questionnaire: QuestionnaireAnswers | null;
  onSubmitQuestionnaire: (answers: QuestionnaireAnswers) => void;
  onOpenTutorials: () => void;
  // H-1: the beginner rules are evidenced to 12 weeks. Past that the engine
  // stops adapting rather than extrapolating, and says so.
  planNeedsReview?: boolean;
  // Changes each time a session is recorded, so the log reloads and the week
  // reflects the session that was just finished.
  logsVersion?: number;
  lang: Language;
}

interface WorkoutLogEntry {
  id: number;
  dayName: string;
  exerciseCount: number;
  durationMinutes: number;
  completedAt: string;
  planDayId?: string | null;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, gyms, activeGymId, workoutPlan, onLogout, onEnterGym, canOpenGymMap, onStartWorkout, questionnaire, onSubmitQuestionnaire, onOpenTutorials, planNeedsReview, logsVersion = 0, lang }) => {
  const t = translations[lang];

  const [stats, setStats] = useState(user.stats || { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 });
  const [logs, setLogs] = useState<WorkoutLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  // Which session's detail is open. Until the client picks one it follows the
  // plan: the next session they have not done this week.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  // Which physical gym the trainee is training at today — a plan's exercises
  // are located against one specific gym's floor plan (zone ids aren't
  // shared across locations), so starting a session at the wrong gym is
  // exactly why "equipment can't be found on the map" happens.
  const [sessionGymId, setSessionGymId] = useState(activeGymId);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    api.fetchMyWorkouts().then(({ logs, stats }) => {
      setLogs(logs);
      setStats(stats);
      setLoadingLogs(false);
    });
  }, [logsVersion]);

  const weekStart = startOfWeek(new Date());
  const completedAtById = latestCompletionByDay(logs, weekStart);
  const doneThisWeekIds = new Set<string>(completedAtById.keys());
  const now = new Date();

  const hasPlan = hasGeneratedPlan(workoutPlan.days);
  const sessions = weeklySessions<WorkoutDay>(workoutPlan.days, doneThisWeekIds);
  const nextSession = sessions.find(x => x.status === 'next');
  const doneCount = sessions.filter(x => x.status === 'done').length;
  const selected = sessions.find(x => x.day.id === selectedDayId)
    || sessions.find(x => x.status === 'next')
    || sessions[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-in fade-in duration-500">

      {planNeedsReview && (
        <div className="bg-lime-500/10 border-b border-lime-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm font-bold text-lime-300">You've finished 12 weeks — time to rebuild your plan</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Your plan has stopped adjusting itself. The guidance it follows is only established for
              the first twelve weeks, so rather than guess past that, it's waiting for a fresh start.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-lime-600 rounded flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg">
                G
              </div>
              <span className="font-bold text-lg text-white">{t.dashboard}</span>
            </div>

            <div className="flex items-center space-x-4">
               <div className="hidden md:flex flex-col items-end mr-2">
                 <span className="text-sm font-bold text-white">{user.name}</span>
                 <span className="text-xs text-slate-500">{user.email}</span>
               </div>
               <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lime-500 font-bold">{user.name.charAt(0)}</span>
                  )}
               </div>
               <button
                 onClick={onLogout}
                 className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                 title={t.logout}
               >
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 p-7 sm:p-8 mb-8">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 420px 260px at 15% 20%, rgba(163,230,53,0.16), transparent 60%), radial-gradient(ellipse 380px 260px at 90% 90%, rgba(56,189,248,0.10), transparent 60%)',
            }}
          />
          <div className="relative flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5 tracking-tight">{t.welcomeBack}, {user.name.split(' ')[0]} 👋</h1>
              <p className="text-sm text-slate-400">
                {!hasPlan
                  ? t.readyToCrush
                  : nextSession
                    ? `Your next session is ${translateDayName(nextSession.day.name, nextSession.dayIndex, lang)}${doneCount > 0 ? ` — ${doneCount} of ${sessions.length} done this week.` : '.'}`
                    : `Nice work — you've completed all ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} this week.`}
              </p>
            </div>
            {hasPlan && nextSession && (
              <button
                onClick={() => onStartWorkout(nextSession.dayIndex, sessionGymId)}
                className="flex-shrink-0 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                Start next session
              </button>
            )}
          </div>
          {gyms.length > 1 && (
            <div className="relative mt-5 flex items-center gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">Training at</label>
              <select
                value={sessionGymId}
                onChange={e => setSessionGymId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-lime-500 cursor-pointer"
              >
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{getGymTranslation(g.name, lang)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <StatCard
            icon={Trophy}
            value={stats.workoutsCompleted || 0}
            label={t.workoutsCompleted}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-400"
          />
          <StatCard
            icon={Flame}
            value={stats.streakDays || 0}
            label={t.dayStreak}
            iconBg="bg-orange-500/10"
            iconColor="text-orange-400"
          />
          <StatCard
            icon={Clock}
            value={Math.round((stats.totalMinutes || 0) / 60)}
            label={t.totalDuration}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-400"
            suffix="h"
          />
        </div>

        {/* The tiles above are the roll-up; these are the two things behind
            them — what was actually lifted, and how each movement is done. */}
        <div className="grid sm:grid-cols-2 gap-3 mb-10 -mt-6">
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-lime-500/50 transition-colors group"
          >
            <span className="flex items-center gap-2.5 text-left">
              <History className="w-4 h-4 text-slate-500 group-hover:text-lime-400 transition-colors flex-shrink-0" />
              <span>
                <span className="block text-sm font-bold text-white">Training history</span>
                <span className="block text-[11px] text-slate-500">Every session you have logged — weights, reps and effort</span>
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lime-400 transition-colors flex-shrink-0" />
          </button>

          {/* onOpenTutorials was wired through App and AdminPage but never
              given a control here, so the tutorials were reachable only by
              admins — the people least likely to need them. */}
          <button
            onClick={onOpenTutorials}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-lime-500/50 transition-colors group"
          >
            <span className="flex items-center gap-2.5 text-left">
              <PlayCircle className="w-4 h-4 text-slate-500 group-hover:text-lime-400 transition-colors flex-shrink-0" />
              <span>
                <span className="block text-sm font-bold text-white">{t.exerciseTutorials}</span>
                <span className="block text-[11px] text-slate-500">How every movement is done, step by step</span>
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-lime-400 transition-colors flex-shrink-0" />
          </button>
        </div>

        {/* My Training Plan */}
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
           <h2 className="text-xl font-bold text-white flex items-center">
             <span className="w-1.5 h-1.5 rounded-full bg-lime-400 mr-2.5" />
             My training plan
           </h2>
           <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-lime-400 bg-lime-500/10 border border-lime-500/25 px-2.5 py-1 rounded-full">
             <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
             Personal Coaching
           </span>
        </div>
        <p className="text-xs text-slate-500 mb-8">Every session walks you through it step by step — find the machine on the map, see what it looks like, then learn how to do it.</p>

        {loadingLogs ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl mb-16">Loading…</div>
        ) : !hasPlan ? (
          <TrainingQuestionnaire existing={questionnaire} userName={user.name.split(' ')[0]} gyms={gyms} onSubmit={onSubmitQuestionnaire} />
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">This week</span>
              <span className="text-xs font-semibold text-slate-400">
                {doneCount} of {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} done
              </span>
            </div>
            <div
              className="grid gap-2 mb-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(sessions.length, 4)}, minmax(0, 1fr))` }}
            >
              {sessions.map(({ day, dayIndex, status }) => {
                const isSelected = day.id === selected.day.id;
                return (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDayId(day.id)}
                    aria-pressed={isSelected}
                    className={`
                      flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all bg-slate-900 cursor-pointer hover:border-slate-600
                      ${status === 'next' ? 'border-lime-500' : 'border-slate-800'}
                      ${isSelected ? 'ring-1 ring-slate-500' : ''}
                    `}
                  >
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${status === 'next' ? 'text-lime-400' : 'text-slate-500'}`}>Session {dayIndex + 1}</span>
                    <span className={`
                      w-7 h-7 rounded-lg flex items-center justify-center text-xs
                      ${status === 'done' ? 'bg-lime-500/15 border border-lime-500/40 text-lime-400' : ''}
                      ${status === 'next' ? 'bg-lime-500 text-slate-950' : ''}
                      ${status === 'todo' ? 'bg-slate-800 border border-slate-700 text-slate-500' : ''}
                    `}>
                      {status === 'done' ? <Check className="w-3.5 h-3.5" /> : status === 'next' ? <Play className="w-3 h-3" /> : null}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 leading-tight min-h-[26px] flex items-center">
                      {translateDayName(day.name, dayIndex, lang)}
                    </span>
                    {status === 'done' && (
                      <span className="text-[10px] font-bold text-lime-400/90 leading-tight">
                        {describeCompleted(completedAtById.get(day.id), now)?.day}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-16">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white">Session {selected.dayIndex + 1} &middot; {translateDayName(selected.day.name, selected.dayIndex, lang)}</h3>
                  <span className={`
                    text-[11px] font-mono font-bold px-2.5 py-1 rounded-full
                    ${selected.status === 'done' ? 'text-lime-400 bg-lime-500/10 border border-lime-500/25' : ''}
                    ${selected.status === 'next' ? 'text-slate-950 bg-lime-500' : ''}
                    ${selected.status === 'todo' ? 'text-slate-400 bg-slate-800 border border-slate-700' : ''}
                  `}>
                    {selected.status === 'done' ? t.completed : selected.status === 'next' ? 'Up next' : 'To do'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  {selected.day.exercises.length} {t.items}
                  {selected.status === 'done' && describeCompleted(completedAtById.get(selected.day.id), now) && (
                    <span className="text-lime-400"> &middot; Completed {describeCompleted(completedAtById.get(selected.day.id), now)!.full}</span>
                  )}
                </p>
                <div className="space-y-0">
                  {selected.day.exercises.map((ex, i) => (
                    <div key={ex.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? 'border-t border-slate-800/80' : ''}`}>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{ex.name}</div>
                        <div className="text-xs text-slate-500">{ex.targetMuscle}</div>
                      </div>
                      <span className="text-xs font-mono text-slate-400 flex-shrink-0">{ex.sets} x {ex.reps}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onStartWorkout(selected.dayIndex, sessionGymId)}
                  className="w-full mt-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  {selected.status === 'done' ? 'Redo this session' : 'Start coaching session'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Gyms Section */}
        {canOpenGymMap && (
        <>
        <div className="mb-8 flex items-center justify-between">
           <h2 className="text-xl font-bold text-white flex items-center">
             <MapPin className="w-5 h-5 mr-2 text-lime-400" />
             {t.availableGyms}
           </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gyms.map(gym => (
            <button
              key={gym.id}
              onClick={() => onEnterGym(gym.id)}
              className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-lime-500/50 hover:-translate-y-0.5 hover:shadow-[0_0_20px_-5px_rgba(132,204,22,0.15)] transition-all flex flex-col text-left"
            >
              <div className="h-40 bg-slate-950 relative w-full border-b border-slate-800 overflow-hidden">
                <div className="absolute inset-0 p-4 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                   <GymMap zones={gym.zones} dimensions={gym.dimensions} entrance={gym.entrance} floorColor={gym.floorColor} annexes={gym.annexes} isThumbnail={true} lang={lang} />
                </div>
              </div>
              <div className="p-6">
                 <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors mb-1">{getGymTranslation(gym.name, lang)}</h3>
                 <p className="text-sm text-slate-500 mb-4">{gym.zones.length} {t.zones} • {gym.annexes ? gym.annexes.length : 0} {t.extensions}</p>
                 <div className="flex items-center text-sm font-semibold text-lime-500 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                   {t.enterGym} <ArrowRight className="w-4 h-4 ml-1.5" />
                 </div>
              </div>
            </button>
          ))}
        </div>
        </>
        )}

      </main>

      {historyOpen && (
        <WorkoutHistory
          mode="self"
          heading="Training history"
          subheading={user.name}
          // Day names come from the plan the dashboard already holds, so a
          // session reads as "Upper Body" rather than a plan-day id.
          dayNames={Object.fromEntries(workoutPlan.days.map(d => [d.id, d.name]))}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, value, label, iconBg, iconColor, suffix = '' }: any) => (
  <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900 flex items-center gap-4">
     <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
       <Icon className="w-5 h-5" />
     </div>
     <div>
       <div className="text-2xl font-black text-white tracking-tight leading-none">{value}{suffix}</div>
       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">{label}</div>
     </div>
  </div>
);

export default UserDashboard;
