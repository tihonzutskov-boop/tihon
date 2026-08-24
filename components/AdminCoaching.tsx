import React, { useEffect, useState } from 'react';
import { PlanTemplate, WorkoutDay, LibraryExercise, CoachingClient } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';
import { api } from '../services/api';
import SessionBuilder from './SessionBuilder';
import { ClipboardList, Loader2, X, ChevronRight, Plus } from 'lucide-react';

const DURATIONS = [30, 45, 60, 90];

const DAYS_OPTIONS = ['1', '2', '3', '4'];

type View = 'catalog' | 'clients';

const hasScheduledPlan = (client: CoachingClient) => !!client.plan && client.plan.days.some(d => d.weekday);

// goal/daysPerWeek/durationMin start unset — the questionnaire fills them in
// before the builder ever appears, so every template is categorized up front.
const blankTemplate = (goal: string): PlanTemplate => ({
  id: `tpl-${Date.now()}`,
  name: '',
  goal,
  daysPerWeek: '',
  durationMin: 0,
  days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }],
});
const isFullyCategorized = (t: PlanTemplate) => !!(t.goal && t.daysPerWeek && t.durationMin);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{children}</span>
);

const Answer: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-xs font-semibold text-slate-200">{value}</p>
  </div>
);

const Pill: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
      selected ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
    }`}
  >
    {children}
  </button>
);

const AdminCoaching: React.FC = () => {
  const [view, setView] = useState<View>('catalog');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [clients, setClients] = useState<CoachingClient[]>([]);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [openGoals, setOpenGoals] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<PlanTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1); // 1 = questionnaire (category/days/duration), 2 = session builder
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExInstructions, setNewExInstructions] = useState('');

  useEffect(() => {
    Promise.all([api.fetchPlanTemplates(), api.fetchExercises(), api.fetchCoachingClients()]).then(([t, e, c]) => {
      setTemplates(t);
      setLibraryExercises(e);
      setClients(c);
      setLoading(false);
    });
  }, []);

  const selectedClient = clients.find(c => c.userId === selectedUserId) || null;

  const templateGroups = QUESTIONNAIRE_GOALS.map(goal => ({ goal, templates: templates.filter(t => t.goal === goal) }));
  const clientGroups = QUESTIONNAIRE_GOALS
    .map(goal => ({ goal, clients: clients.filter(c => c.answers.goals?.includes(goal)) }))
    .filter(g => g.clients.length > 0);

  const toggleGoal = (goal: string) => {
    setOpenGoals(prev => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal); else next.add(goal);
      return next;
    });
  };

  const startNewTemplate = (goal: string) => {
    if (!openGoals.has(goal)) toggleGoal(goal);
    setEditingTemplate(blankTemplate(goal));
    setActiveDayIndex(0);
    setWizardStep(1);
  };
  const editTemplate = (t: PlanTemplate) => {
    setEditingTemplate({ ...t });
    setActiveDayIndex(0);
    setWizardStep(2); // already categorized — skip straight to the builder
  };
  const closeTemplateEditor = () => setEditingTemplate(null);

  // Pre-creates exactly as many days as answered, and auto-fills the name
  // from the categorization, before dropping into the builder.
  const goToBuilder = (t: PlanTemplate) => {
    const n = parseInt(t.daysPerWeek, 10) || 1;
    const days: WorkoutDay[] = Array.from({ length: n }, (_, i) => ({ id: `day-${Date.now()}-${i}`, name: `Workout ${i + 1}`, exercises: [] }));
    const name = t.name.trim() ? t.name : `${t.goal} — ${n} Day${n === 1 ? '' : 's'} Plan`;
    setEditingTemplate({ ...t, days, name });
    setActiveDayIndex(0);
    setWizardStep(2);
  };
  const pickField = (field: 'goal' | 'daysPerWeek' | 'durationMin', value: string | number) => {
    if (!editingTemplate) return;
    const next = { ...editingTemplate, [field]: value };
    if (field === 'goal' && !openGoals.has(value as string)) toggleGoal(value as string);
    setEditingTemplate(next);
    if (isFullyCategorized(next)) goToBuilder(next);
  };

  const updateDays = (updater: (days: WorkoutDay[]) => WorkoutDay[]) => {
    setEditingTemplate(prev => (prev ? { ...prev, days: updater(prev.days) } : prev));
  };
  const onChangeDay = (day: WorkoutDay) => {
    updateDays(days => days.map((d, i) => (i === activeDayIndex ? day : d)));
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
              Clients{clients.length > 0 ? ` · ${clients.length}` : ''}
            </button>
          </div>
        </div>

        {view === 'catalog' ? templateGroups.map(group => {
          const open = openGoals.has(group.goal);
          return (
            <div key={group.goal} className="border-b border-slate-800/40">
              <div
                onClick={() => toggleGoal(group.goal)}
                className="flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-slate-800/20 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                  <h4 className="text-[10px] font-extrabold text-lime-400 uppercase tracking-widest">
                    {group.goal} <span className="text-slate-600">· {group.templates.length}</span>
                  </h4>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); startNewTemplate(group.goal); }}
                  title={`Add a plan to ${group.goal}`}
                  className="w-5 h-5 rounded-md border border-dashed border-slate-700 text-slate-500 hover:border-lime-500 hover:text-lime-400 hover:bg-lime-500/10 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {open && (
                <div className="px-3 pb-3 space-y-1.5">
                  {group.templates.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-800 rounded-lg">
                      <p className="text-[10.5px] text-slate-500">No plans yet — click + to add the first one.</p>
                    </div>
                  ) : (
                    group.templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => editTemplate(t)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                          editingTemplate?.id === t.id ? 'border-lime-500 bg-lime-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white truncate mb-1">{t.name || 'Untitled template'}</div>
                        <div className="flex gap-1.5 flex-wrap">
                          <Tag>{t.daysPerWeek}x/week</Tag>
                          <Tag>{t.durationMin} min</Tag>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        }) : (
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
        {view === 'clients' ? (
          !selectedClient ? (
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
          )
        ) : !editingTemplate ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Select a template to edit it, or create a new one.</p>
          </div>
        ) : wizardStep === 1 ? (
          <div className="max-w-lg mx-auto pt-6">
            <div className="text-center mb-7">
              <h2 className="text-lg font-extrabold text-white mb-1">New Training Plan</h2>
              <p className="text-xs text-slate-500">Answer these and you'll drop straight into the session builder — no extra click.</p>
            </div>

            <div className="mb-6">
              <div className="text-[10px] font-extrabold text-lime-400 uppercase tracking-wide mb-2.5">Goal category</div>
              <div className="flex flex-wrap gap-2">
                {QUESTIONNAIRE_GOALS.map(g => (
                  <Pill key={g} selected={editingTemplate.goal === g} onClick={() => pickField('goal', g)}>{g}</Pill>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[10px] font-extrabold text-lime-400 uppercase tracking-wide mb-2.5">Days per week</div>
              <div className="flex flex-wrap gap-2">
                {DAYS_OPTIONS.map(d => (
                  <Pill key={d} selected={editingTemplate.daysPerWeek === d} onClick={() => pickField('daysPerWeek', d)}>{d}</Pill>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] font-extrabold text-lime-400 uppercase tracking-wide mb-2.5">Session duration</div>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map(d => (
                  <Pill key={d} selected={editingTemplate.durationMin === d} onClick={() => pickField('durationMin', d)}>{d} min</Pill>
                ))}
              </div>
            </div>

            <button
              onClick={closeTemplateEditor}
              className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Tag>{editingTemplate.goal}</Tag>
              <Tag>{editingTemplate.daysPerWeek}x/week</Tag>
              <Tag>{editingTemplate.durationMin} min</Tag>
              <button
                onClick={() => setWizardStep(1)}
                className="ml-auto text-[11px] font-bold text-slate-500 hover:text-slate-300 underline transition-colors"
              >
                ← Change
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
              <input
                value={editingTemplate.name}
                onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder="e.g. Weight Loss — 3 Day Starter"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
              />
            </div>

            <div className="flex items-center gap-2 mb-3 overflow-x-auto">
              {editingTemplate.days.map((d, idx) => (
                <div key={d.id} className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => setActiveDayIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      activeDayIndex === idx ? 'bg-lime-500 border-lime-500 text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    Day {idx + 1}
                  </button>
                  {editingTemplate.days.length > 1 && (
                    <button onClick={() => onRemoveDay(d.id)} className="ml-1 p-1 text-slate-600 hover:text-red-400 transition-colors" title="Remove day" aria-label="Remove day">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={onAddDay}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-lime-500 hover:text-lime-400 transition-colors"
                title="Add day"
                aria-label="Add day"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[600px]">
              <SessionBuilder
                day={editingTemplate.days[activeDayIndex] || editingTemplate.days[0]}
                onChange={onChangeDay}
                targetDurationMin={editingTemplate.durationMin}
                libraryExercises={libraryExercises}
                onCreateLibraryExercise={() => setShowCreateExercise(true)}
                onSave={onSavePlan}
                onClear={onClear}
                onClose={closeTemplateEditor}
              />
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
