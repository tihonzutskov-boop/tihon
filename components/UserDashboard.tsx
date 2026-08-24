
import React, { useEffect, useState } from 'react';
import { User, Gym, Language, WorkoutPlan, Weekday, QuestionnaireAnswers } from '../types';
import { translations, getGymTranslation, translateDayName } from '../translations';
import { Trophy, Flame, Clock, LogOut, ArrowRight, MapPin, Check, Play, Minus, Film } from 'lucide-react';
import GymMap from './GymMap';
import TrainingQuestionnaire from './TrainingQuestionnaire';
import { api } from '../services/api';

interface UserDashboardProps {
  user: User;
  gyms: Gym[];
  workoutPlan: WorkoutPlan;
  onLogout: () => void;
  onEnterGym: (gymId: string) => void;
  onStartWorkout: (dayIndex: number) => void;
  questionnaire: QuestionnaireAnswers | null;
  onSubmitQuestionnaire: (answers: QuestionnaireAnswers) => void;
  onOpenTutorials: () => void;
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

const WEEKDAY_KEYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_SHORT: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

const jsDayToKey = (d: number): Weekday => WEEKDAY_KEYS[(d + 6) % 7];

const startOfThisWeek = (): Date => {
  const now = new Date();
  const todayIdx = WEEKDAY_KEYS.indexOf(jsDayToKey(now.getDay()));
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - todayIdx);
  return monday;
};

const UserDashboard: React.FC<UserDashboardProps> = ({ user, gyms, workoutPlan, onLogout, onEnterGym, onStartWorkout, questionnaire, onSubmitQuestionnaire, onOpenTutorials, lang }) => {
  const t = translations[lang];

  const [stats, setStats] = useState(user.stats || { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 });
  const [logs, setLogs] = useState<WorkoutLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday>(() => jsDayToKey(new Date().getDay()));

  useEffect(() => {
    api.fetchMyWorkouts().then(({ logs, stats }) => {
      setLogs(logs);
      setStats(stats);
      setLoadingLogs(false);
    });
  }, []);

  const todayKey = jsDayToKey(new Date().getDay());
  const weekStart = startOfThisWeek();
  const doneThisWeekIds = new Set(
    logs.filter(l => l.planDayId && new Date(l.completedAt) >= weekStart).map(l => l.planDayId)
  );

  const scheduleByWeekday = WEEKDAY_KEYS.map(key => {
    const day = workoutPlan.days.find(d => d.weekday === key);
    const dayIndex = day ? workoutPlan.days.findIndex(d => d.id === day.id) : -1;
    const status = !day ? 'rest' : doneThisWeekIds.has(day.id) ? 'done' : key === todayKey ? 'today' : 'upcoming';
    return { key, day, dayIndex, status };
  });

  const selectedEntry = scheduleByWeekday.find(s => s.key === selectedWeekday) || scheduleByWeekday.find(s => s.key === todayKey)!;
  const todayEntry = scheduleByWeekday.find(s => s.key === todayKey);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-in fade-in duration-500">

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
               <button
                 onClick={onOpenTutorials}
                 className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                 title={t.exerciseTutorials}
               >
                 <Film className="w-4 h-4 text-lime-400" />
                 <span className="hidden sm:inline">{t.exerciseTutorials}</span>
               </button>
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
                {todayEntry?.day
                  ? todayEntry.status === 'done'
                    ? `Nice work — you've completed today's session (${translateDayName(todayEntry.day.name, todayEntry.dayIndex, lang)}).`
                    : `You have a coaching session scheduled for today — ${translateDayName(todayEntry.day.name, todayEntry.dayIndex, lang)}.`
                  : t.readyToCrush}
              </p>
            </div>
            {todayEntry?.day && todayEntry.status === 'today' && (
              <button
                onClick={() => onStartWorkout(todayEntry.dayIndex)}
                className="flex-shrink-0 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                Start today's session
              </button>
            )}
          </div>
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
        ) : workoutPlan.days.every(d => !d.weekday) ? (
          <TrainingQuestionnaire existing={questionnaire} userName={user.name.split(' ')[0]} onSubmit={onSubmitQuestionnaire} />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {scheduleByWeekday.map(({ key, day, dayIndex, status }) => {
                const isSelected = key === selectedWeekday && status !== 'rest';
                return (
                  <button
                    key={key}
                    disabled={status === 'rest'}
                    onClick={() => setSelectedWeekday(key)}
                    className={`
                      flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all
                      ${status === 'rest' ? 'bg-slate-900/60 border-slate-800/60 opacity-50 cursor-default' : 'bg-slate-900 border-slate-800 cursor-pointer hover:border-slate-600'}
                      ${status === 'today' ? 'border-lime-500' : ''}
                      ${isSelected ? 'ring-1 ring-slate-500' : ''}
                    `}
                  >
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${status === 'today' ? 'text-lime-400' : 'text-slate-500'}`}>{WEEKDAY_SHORT[key]}</span>
                    <span className={`
                      w-7 h-7 rounded-lg flex items-center justify-center text-xs
                      ${status === 'done' ? 'bg-lime-500/15 border border-lime-500/40 text-lime-400' : ''}
                      ${status === 'today' ? 'bg-lime-500 text-slate-950' : ''}
                      ${status === 'upcoming' ? 'bg-slate-800 border border-slate-700 text-slate-500' : ''}
                      ${status === 'rest' ? 'bg-slate-800 border border-slate-800 text-slate-600' : ''}
                    `}>
                      {status === 'done' ? <Check className="w-3.5 h-3.5" /> : status === 'today' ? <Play className="w-3 h-3" /> : status === 'rest' ? <Minus className="w-3.5 h-3.5" /> : null}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 leading-tight min-h-[26px] flex items-center">
                      {day ? translateDayName(day.name, dayIndex, lang) : t.restDay || 'Rest'}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedEntry.day && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-16">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white">{WEEKDAY_SHORT[selectedEntry.key]} &middot; {translateDayName(selectedEntry.day.name, selectedEntry.dayIndex, lang)}</h3>
                  <span className={`
                    text-[11px] font-mono font-bold px-2.5 py-1 rounded-full
                    ${selectedEntry.status === 'done' ? 'text-lime-400 bg-lime-500/10 border border-lime-500/25' : ''}
                    ${selectedEntry.status === 'today' ? 'text-slate-950 bg-lime-500' : ''}
                    ${selectedEntry.status === 'upcoming' ? 'text-slate-400 bg-slate-800 border border-slate-700' : ''}
                  `}>
                    {selectedEntry.status === 'done' ? t.completed : selectedEntry.status === 'today' ? 'Today' : 'Upcoming'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{selectedEntry.day.exercises.length} {t.items}</p>
                <div className="space-y-0">
                  {selectedEntry.day.exercises.map((ex, i) => (
                    <div key={ex.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? 'border-t border-slate-800/80' : ''}`}>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{ex.name}</div>
                        <div className="text-xs text-slate-500">{ex.targetMuscle}</div>
                      </div>
                      <span className="text-xs font-mono text-slate-400 flex-shrink-0">{ex.sets} x {ex.reps}</span>
                    </div>
                  ))}
                </div>
                {selectedEntry.status === 'today' && (
                  <button
                    onClick={() => onStartWorkout(selectedEntry.dayIndex)}
                    className="w-full mt-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                  >
                    Start coaching session
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Gyms Section */}
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

      </main>
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
