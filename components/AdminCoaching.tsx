import React, { useEffect, useState } from 'react';
import { CoachingClient, WorkoutPlan, WorkoutDay, Exercise, Weekday } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';
import { api } from '../services/api';
import ProgramList from './ProgramList';
import { ClipboardList, Loader2 } from 'lucide-react';

const blankPlan = (client: CoachingClient): WorkoutPlan => ({
  id: `plan-${client.userId}`,
  name: `${client.name}'s Plan`,
  days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }],
  totalDurationMinutes: 0,
});

const hasScheduledPlan = (client: CoachingClient) => !!client.plan && client.plan.days.some(d => d.weekday);

const Answer: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-xs font-semibold text-slate-200">{value}</p>
  </div>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{children}</span>
);

const AdminCoaching: React.FC = () => {
  const [clients, setClients] = useState<CoachingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [targetPlan, setTargetPlan] = useState<WorkoutPlan | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    api.fetchCoachingClients().then(data => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  const selectedClient = clients.find(c => c.userId === selectedUserId) || null;

  const selectClient = (client: CoachingClient) => {
    setSelectedUserId(client.userId);
    setActiveDayIndex(0);
    setTargetPlan(
      client.plan
        ? { id: `plan-${client.userId}`, name: client.plan.name, days: client.plan.days, totalDurationMinutes: 0 }
        : blankPlan(client)
    );
  };

  const groups = QUESTIONNAIRE_GOALS
    .map(goal => ({ goal, clients: clients.filter(c => c.answers.goals?.includes(goal)) }))
    .filter(g => g.clients.length > 0);

  const updateDays = (updater: (days: WorkoutDay[]) => WorkoutDay[]) => {
    setTargetPlan(prev => (prev ? { ...prev, days: updater(prev.days) } : prev));
  };

  const onAddExercise = (exercise: Exercise) => {
    updateDays(days => days.map((d, i) => (i === activeDayIndex ? { ...d, exercises: [...d.exercises, exercise] } : d)));
  };
  const onRemoveExercise = (id: string) => {
    updateDays(days => days.map((d, i) => (i === activeDayIndex ? { ...d, exercises: d.exercises.filter(e => e.id !== id) } : d)));
  };
  const onUpdateExercise = (exercise: Exercise) => {
    updateDays(days => days.map((d, i) => (i === activeDayIndex ? { ...d, exercises: d.exercises.map(e => (e.id === exercise.id ? exercise : e)) } : d)));
  };
  const onSetDayWeekday = (dayId: string, weekday: Weekday | undefined) => {
    updateDays(days => days.map(d => (d.id === dayId ? { ...d, weekday } : d)));
  };
  const onAddDay = () => {
    updateDays(days => [...days, { id: `day-${Date.now()}`, name: `Workout ${days.length + 1}`, exercises: [] }]);
  };
  const onRemoveDay = (dayId: string) => {
    updateDays(days => {
      const next = days.filter(d => d.id !== dayId);
      return next.length > 0 ? next : days;
    });
    setActiveDayIndex(0);
  };
  const onClear = () => {
    setTargetPlan(prev => (prev ? { ...prev, days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }] } : prev));
    setActiveDayIndex(0);
  };
  const onSavePlan = () => {
    if (!selectedClient || !targetPlan) return;
    api.saveUserPlan(selectedClient.userId, targetPlan.name, targetPlan.days);
    setClients(prev =>
      prev.map(c => (c.userId === selectedClient.userId ? { ...c, plan: { name: targetPlan.name, days: targetPlan.days } } : c))
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading clients…
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-slate-800/50">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Personal Coaching</h3>
          <p className="text-xs text-slate-400">{clients.length} client{clients.length !== 1 ? 's' : ''} submitted a questionnaire</p>
        </div>
        {clients.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">No questionnaires submitted yet.</div>
        ) : (
          groups.map(group => (
            <div key={group.goal} className="p-3 border-b border-slate-800/40">
              <h4 className="text-[10px] font-extrabold text-lime-400 uppercase tracking-widest mb-2 px-1">
                {group.goal} <span className="text-slate-600">· {group.clients.length}</span>
              </h4>
              <div className="space-y-1.5">
                {group.clients.map(client => {
                  const scheduled = hasScheduledPlan(client);
                  return (
                    <button
                      key={client.userId}
                      onClick={() => selectClient(client)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                        selectedUserId === client.userId ? 'border-lime-500 bg-lime-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-lime-400 flex-shrink-0 overflow-hidden">
                          {client.avatarUrl ? (
                            <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" />
                          ) : (
                            client.name.charAt(0)
                          )}
                        </div>
                        <span className="text-xs font-bold text-white truncate">{client.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          scheduled
                            ? 'bg-lime-500/10 text-lime-400 border border-lime-500/25'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        }`}
                      >
                        {scheduled ? 'Plan saved' : 'Needs a plan'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedClient || !targetPlan ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Select a client to see their answers and build a plan.</p>
          </div>
        ) : (
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-white mb-4">{selectedClient.name}</h2>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Questionnaire answers</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <Answer label="Age" value={selectedClient.answers.age} />
                <Answer label="Height" value={`${selectedClient.answers.heightCm} cm`} />
                <Answer label="Weight" value={`${selectedClient.answers.weightKg} kg`} />
                <Answer label="Sex" value={selectedClient.answers.sex} />
                <Answer label="Experience" value={selectedClient.answers.level} />
                <Answer label="Schedule" value={`${selectedClient.answers.daysPerWeek}x/week · ${selectedClient.answers.minutesPerSession}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedClient.answers.goals.map(g => <Tag key={g}>{g}</Tag>)}
              </div>
              <Answer label="Equipment comfort" value={selectedClient.answers.equipment} />
              {selectedClient.answers.avoidExercises && (
                <div className="mt-4">
                  <Answer label="Exercises to avoid" value={selectedClient.answers.avoidExercises} />
                </div>
              )}
              {(selectedClient.answers.injuryAreas.length > 0 || selectedClient.answers.injuryNotes) && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">Health & safety</h4>
                  {selectedClient.answers.injuryAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedClient.answers.injuryAreas.map(a => <Tag key={a}>{a}</Tag>)}
                    </div>
                  )}
                  {selectedClient.answers.injuryNotes && <p className="text-xs text-slate-400 mb-2">{selectedClient.answers.injuryNotes}</p>}
                  {selectedClient.answers.medicalClearance && (
                    <p className="text-xs text-slate-400">
                      Medical clearance: <span className="text-white font-semibold">{selectedClient.answers.medicalClearance}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[640px]">
              <ProgramList
                workout={targetPlan}
                activeDayIndex={activeDayIndex}
                setActiveDayIndex={setActiveDayIndex}
                onAddExercise={onAddExercise}
                onRemoveExercise={onRemoveExercise}
                onUpdateExercise={onUpdateExercise}
                onClear={onClear}
                onLocateExercise={() => {}}
                onWatchVideo={exercise => { if (exercise.videoUrl) window.open(exercise.videoUrl, '_blank'); }}
                onSetDayWeekday={onSetDayWeekday}
                onAddDay={onAddDay}
                onRemoveDay={onRemoveDay}
                onSavePlan={onSavePlan}
                lang="en"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCoaching;
