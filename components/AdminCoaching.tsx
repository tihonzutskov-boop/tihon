import React, { useEffect, useState } from 'react';
import { CoachingClient, PlanTemplate, WorkoutPlan, WorkoutDay, Exercise, LibraryExercise } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';
import { api } from '../services/api';
import ProgramList from './ProgramList';
import { ClipboardList, Loader2, X } from 'lucide-react';

type View = 'catalog' | 'clients';

const hasScheduledPlan = (client: CoachingClient) => !!client.plan && client.plan.days.some(d => d.weekday);

const blankTemplate = (): PlanTemplate => ({
  id: `tpl-${Date.now()}`,
  name: '',
  goal: QUESTIONNAIRE_GOALS[0],
  daysPerWeek: '3',
  days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }],
});

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{children}</span>
);

const Answer: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-xs font-semibold text-slate-200">{value}</p>
  </div>
);

const AdminCoaching: React.FC = () => {
  const [view, setView] = useState<View>('catalog');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CoachingClient[]>([]);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<PlanTemplate | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExInstructions, setNewExInstructions] = useState('');

  useEffect(() => {
    Promise.all([api.fetchCoachingClients(), api.fetchPlanTemplates(), api.fetchExercises()]).then(
      ([c, t, e]) => {
        setClients(c);
        setTemplates(t);
        setLibraryExercises(e);
        setLoading(false);
      }
    );
  }, []);

  const selectedClient = clients.find(c => c.userId === selectedUserId) || null;

  const templateGroups = QUESTIONNAIRE_GOALS
    .map(goal => ({ goal, templates: templates.filter(t => t.goal === goal) }))
    .filter(g => g.templates.length > 0);
  const clientGroups = QUESTIONNAIRE_GOALS
    .map(goal => ({ goal, clients: clients.filter(c => c.answers.goals?.includes(goal)) }))
    .filter(g => g.clients.length > 0);

  const startNewTemplate = () => {
    setEditingTemplate(blankTemplate());
    setActiveDayIndex(0);
  };
  const editTemplate = (t: PlanTemplate) => {
    setEditingTemplate({ ...t });
    setActiveDayIndex(0);
  };
  const closeTemplateEditor = () => setEditingTemplate(null);

  const asWorkoutPlan = (t: PlanTemplate): WorkoutPlan => ({ id: t.id, name: t.name, days: t.days, totalDurationMinutes: 0 });

  const updateDays = (updater: (days: WorkoutDay[]) => WorkoutDay[]) => {
    setEditingTemplate(prev => (prev ? { ...prev, days: updater(prev.days) } : prev));
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
    setEditingTemplate(prev => (prev ? { ...prev, days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }] } : prev));
    setActiveDayIndex(0);
  };
  const onSavePlan = () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    const exists = templates.some(t => t.id === editingTemplate.id);
    if (exists) {
      api.savePlanTemplate(editingTemplate);
      setTemplates(prev => prev.map(t => (t.id === editingTemplate.id ? editingTemplate : t)));
    } else {
      api.createPlanTemplate(editingTemplate);
      setTemplates(prev => [editingTemplate, ...prev]);
    }
  };

  const createExercise = () => {
    if (!newExName.trim() || !newExMuscle.trim() || !newExCategory.trim() || !newExInstructions.trim()) return;
    const newEx: LibraryExercise = {
      id: `ex-${Date.now()}`,
      name: newExName.trim(),
      targetMuscle: newExMuscle.trim(),
      equipmentRequired: '',
      category: newExCategory.trim(),
      instructions: newExInstructions.trim(),
    };
    api.createExercise(newEx);
    setLibraryExercises(prev => [...prev, newEx]);
    setNewExName(''); setNewExMuscle(''); setNewExCategory(''); setNewExInstructions('');
    setShowCreateExercise(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading coaching data…
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-72 border-r border-slate-800 bg-slate-900 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-slate-800/50 space-y-3">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Personal Coaching</h3>
          <div className="flex items-center bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setView('catalog')}
              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all ${view === 'catalog' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Catalog
            </button>
            <button
              onClick={() => setView('clients')}
              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all ${view === 'clients' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Clients
            </button>
          </div>
        </div>

        {view === 'catalog' ? (
          <>
            <div className="p-3 border-b border-slate-800/40">
              <button
                onClick={startNewTemplate}
                className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-lime-400 hover:border-lime-500/50 transition-all text-xs font-bold bg-slate-950/30"
              >
                + New template
              </button>
            </div>
            {templateGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No plan templates yet.</div>
            ) : (
              templateGroups.map(group => (
                <div key={group.goal} className="p-3 border-b border-slate-800/40">
                  <h4 className="text-[10px] font-extrabold text-lime-400 uppercase tracking-widest mb-2 px-1">{group.goal}</h4>
                  <div className="space-y-1.5">
                    {group.templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => editTemplate(t)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                          editingTemplate?.id === t.id ? 'border-lime-500 bg-lime-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white truncate mb-1">{t.name || 'Untitled template'}</div>
                        <div className="flex gap-1.5">
                          <Tag>{t.daysPerWeek}x/week</Tag>
                          <Tag>{t.days.length} day{t.days.length !== 1 ? 's' : ''}</Tag>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <div className="p-3 border-b border-slate-800/40">
              <p className="text-xs text-slate-400">{clients.length} client{clients.length !== 1 ? 's' : ''} submitted a questionnaire</p>
            </div>
            {clientGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No questionnaires submitted yet.</div>
            ) : (
              clientGroups.map(group => (
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
                          onClick={() => setSelectedUserId(client.userId)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                            selectedUserId === client.userId ? 'border-lime-500 bg-lime-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-lime-400 flex-shrink-0 overflow-hidden">
                              {client.avatarUrl ? <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" /> : client.name.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-white truncate">{client.name}</span>
                          </div>
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              scheduled ? 'bg-lime-500/10 text-lime-400 border border-lime-500/25' : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                            }`}
                          >
                            {scheduled ? 'Plan assigned' : 'Needs a plan'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {view === 'catalog' ? (
          !editingTemplate ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">Select a template to edit it, or create a new one.</p>
            </div>
          ) : (
            <div className="max-w-3xl">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
                    <input
                      value={editingTemplate.name}
                      onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      placeholder="e.g. Weight Loss — 3 Day Starter"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Goal category</label>
                    <select
                      value={editingTemplate.goal}
                      onChange={e => setEditingTemplate({ ...editingTemplate, goal: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                    >
                      {QUESTIONNAIRE_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Days per week</label>
                    <select
                      value={editingTemplate.daysPerWeek}
                      onChange={e => setEditingTemplate({ ...editingTemplate, daysPerWeek: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                    >
                      {['1', '2', '3', '4'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[600px]">
                <ProgramList
                  workout={asWorkoutPlan(editingTemplate)}
                  activeDayIndex={activeDayIndex}
                  setActiveDayIndex={setActiveDayIndex}
                  onAddExercise={onAddExercise}
                  onRemoveExercise={onRemoveExercise}
                  onUpdateExercise={onUpdateExercise}
                  onClear={onClear}
                  onLocateExercise={() => {}}
                  onWatchVideo={exercise => { if (exercise.videoUrl) window.open(exercise.videoUrl, '_blank'); }}
                  onAddDay={onAddDay}
                  onRemoveDay={onRemoveDay}
                  onSavePlan={onSavePlan}
                  onClose={closeTemplateEditor}
                  libraryExercises={libraryExercises}
                  onCreateLibraryExercise={() => setShowCreateExercise(true)}
                  lang="en"
                />
              </div>
            </div>
          )
        ) : !selectedClient ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Select a client to see their questionnaire answers.</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-white mb-1">{selectedClient.name}</h2>
            <p className="text-xs text-slate-500 mb-4">
              {hasScheduledPlan(selectedClient) ? (
                <>Assigned plan: <span className="text-lime-400 font-semibold">{selectedClient.plan?.name}</span></>
              ) : (
                'No plan assigned yet — add a matching template to the catalog.'
              )}
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
          </div>
        )}
      </div>

      {showCreateExercise && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">New exercise</h3>
              <button onClick={() => setShowCreateExercise(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
              <input value={newExName} onChange={e => setNewExName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Target muscle</label>
                <input value={newExMuscle} onChange={e => setNewExMuscle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500" />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                <input value={newExCategory} onChange={e => setNewExCategory(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500" />
              </div>
            </div>
            <div>
              <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Instructions</label>
              <textarea value={newExInstructions} onChange={e => setNewExInstructions(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-lime-500 min-h-[80px]" />
            </div>
            <button
              onClick={createExercise}
              className="w-full py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              Add to library
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoaching;
