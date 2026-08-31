import React, { useEffect, useState } from 'react';
import { PlanTemplate, WorkoutDay, LibraryExercise, CoachingClient, BlueprintDay, GenerationFailureRecord } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';
import { api } from '../services/api';
import SessionBuilder from './SessionBuilder';
import BlueprintDayEditor from './BlueprintDayEditor';
import { selectSplit } from '../utils/planGeneration';
import { ClipboardList, Loader2, X, ChevronRight, Plus, AlertTriangle } from 'lucide-react';

// Engine failure reasons, phrased as what an admin can actually act on.
const FAILURE_LABELS: Record<string, string> = {
  no_gym: 'Client did not select a gym',
  no_candidate_for_slot: 'No eligible exercise for a required movement',
  cannot_fit_duration: 'Required work exceeds the session length',
  no_blueprint_days: 'Blueprint has no days',
  validation_failed: 'Generated plan failed validation',
};

// The concrete next step for each failure, so the queue is actionable
// rather than just a list of what went wrong.
const FAILURE_FIXES: Record<string, string> = {
  no_gym: 'Ask the client to resubmit the questionnaire and pick a gym.',
  no_candidate_for_slot: 'Tag more exercises for this movement pattern in the Exercise Library, or add the missing equipment to this gym.',
  cannot_fit_duration: 'Shorten the required work for this goal, or the client needs a longer session.',
  no_blueprint_days: 'The matched template is in blueprint mode but has no days — add days or switch it back to fixed.',
  validation_failed: 'A generated plan broke a safety or structure rule. The detail above says which.',
};

const DURATIONS = [30, 45, 60, 90];

const DAYS_OPTIONS = ['1', '2', '3', '4'];

type View = 'catalog' | 'clients' | 'issues';

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
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [failures, setFailures] = useState<GenerationFailureRecord[]>([]);
  // Holds authored slots while the editor is toggled to Fixed, so flipping
  // back doesn't silently discard the admin's work.
  const [stashedBlueprint, setStashedBlueprint] = useState<BlueprintDay[] | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<PlanTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1); // 1 = questionnaire (category/days/duration), 2 = session builder
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExInstructions, setNewExInstructions] = useState('');

  useEffect(() => {
    Promise.all([api.fetchPlanTemplates(), api.fetchExercises(), api.fetchCoachingClients(), api.fetchGenerationFailures()]).then(([t, e, c, f]) => {
      setTemplates(t);
      setLibraryExercises(e);
      setClients(c);
      setFailures(f);
      setLoading(false);
    });
  }, []);

  const selectedClient = clients.find(c => c.userId === selectedUserId) || null;

  const templateGroups = QUESTIONNAIRE_GOALS.map(goal => ({ goal, templates: templates.filter(t => t.goal === goal) }));
  const clientGroups = QUESTIONNAIRE_GOALS
    .map(goal => ({ goal, clients: clients.filter(c => c.answers.goals?.includes(goal)) }))
    .filter(g => g.clients.length > 0);

  // Every (goal, days-per-week) combo a client could submit — a ● means a
  // template exists for that exact pair; even without one, the goal-only
  // fallback in the questionnaire matcher still assigns *something* as long
  // as the goal row has at least one ● somewhere.
  const coverage = QUESTIONNAIRE_GOALS.map(goal => ({
    goal,
    perDays: DAYS_OPTIONS.map(d => templates.some(t => t.goal === goal && t.daysPerWeek === d)),
    anyMatch: templates.some(t => t.goal === goal),
  }));

  const toggleGoal = (goal: string) => {
    setOpenGoals(prev => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal); else next.add(goal);
      return next;
    });
  };

  const startNewTemplate = (goal: string) => {
    if (!openGoals.has(goal)) toggleGoal(goal);
    setStashedBlueprint(null);
    setEditingTemplate(blankTemplate(goal));
    setActiveDayIndex(0);
    setWizardStep(1);
  };
  const editTemplate = (t: PlanTemplate) => {
    setEditingTemplate({ ...t });
    setStashedBlueprint(null);
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

  // A template with blueprintDays is resolved per client by the generator;
  // without them it stays a fixed template and is copied verbatim, exactly
  // as before. Both authoring modes stay available so existing templates
  // keep working untouched.
  const isBlueprint = (editingTemplate?.blueprintDays?.length ?? 0) > 0;
  const blueprintDays = editingTemplate?.blueprintDays || [];

  const switchToBlueprint = () => {
    if (!editingTemplate) return;
    setActiveDayIndex(0);
    // Already in blueprint mode, or coming back after a detour through Fixed —
    // never overwrite slots that already exist.
    if ((editingTemplate.blueprintDays?.length ?? 0) > 0) return;
    if (stashedBlueprint && stashedBlueprint.length > 0) {
      setEditingTemplate({ ...editingTemplate, blueprintDays: stashedBlueprint });
      return;
    }
    // Day names come from the same split rules the generator uses, rather
    // than a second copy that can drift out of sync with it.
    const n = parseInt(editingTemplate.daysPerWeek, 10) || 1;
    const names = selectSplit(n).dayNames;
    setEditingTemplate({
      ...editingTemplate,
      blueprintDays: names.map((name, i) => ({
        id: `bpday-${Date.now()}-${i}`,
        name,
        slots: [],
      })),
    });
  };
  const switchToFixed = () => {
    if (!editingTemplate) return;
    if ((editingTemplate.blueprintDays?.length ?? 0) > 0) {
      setStashedBlueprint(editingTemplate.blueprintDays!);
    }
    setEditingTemplate({ ...editingTemplate, blueprintDays: undefined });
    setActiveDayIndex(0);
  };
  const onChangeBlueprintDay = (day: BlueprintDay) => {
    setEditingTemplate(prev => prev
      ? { ...prev, blueprintDays: (prev.blueprintDays || []).map((d, i) => (i === activeDayIndex ? day : d)) }
      : prev);
  };
  const onAddBlueprintDay = () => {
    setEditingTemplate(prev => prev
      ? { ...prev, blueprintDays: [...(prev.blueprintDays || []), { id: `bpday-${Date.now()}`, name: `Day ${(prev.blueprintDays || []).length + 1}`, slots: [] }] }
      : prev);
  };
  const onRemoveBlueprintDay = (dayId: string) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const next = (prev.blueprintDays || []).filter(d => d.id !== dayId);
      return { ...prev, blueprintDays: next.length > 0 ? next : prev.blueprintDays };
    });
    setActiveDayIndex(0);
  };
  const onSavePlan = async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    const exists = templates.some(t => t.id === editingTemplate.id);
    if (exists) {
      const result = await api.savePlanTemplate(editingTemplate);
      if (!result.ok) throw new Error(result.error ? `Not saved to the server: ${result.error}` : 'Not saved to the server — check your connection.');
      setTemplates(prev => prev.map(t => (t.id === editingTemplate.id ? editingTemplate : t)));
    } else {
      const result = await api.createPlanTemplate(editingTemplate);
      if (!result.ok) throw new Error(result.error ? `Not saved to the server: ${result.error}` : 'Not saved to the server — check your connection.');
      setTemplates(prev => [editingTemplate, ...prev]);
    }
  };

  const resolveFailure = async (id: number) => {
    const result = await api.resolveGenerationFailure(id);
    if (result.ok) setFailures(prev => prev.filter(f => f.id !== id));
  };

  const resetClientQuestionnaire = async (client: CoachingClient) => {
    if (!window.confirm(`Reset ${client.name}'s questionnaire? They'll lose their current answers${client.plan ? ' and assigned plan' : ''} and see the "build your training plan" prompt again next time they open the dashboard.`)) {
      return;
    }
    setResetError(null);
    setResetting(true);
    try {
      const result = await api.resetClientQuestionnaire(client.userId);
      if (!result.ok) {
        setResetError(result.error ? `Could not reset: ${result.error}` : 'Could not reset — check your connection.');
        return;
      }
      setClients(prev => prev.filter(c => c.userId !== client.userId));
      setSelectedUserId(null);
    } finally {
      setResetting(false);
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
            <button
              onClick={() => setView('issues')}
              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                view === 'issues' ? 'bg-slate-800 text-white' : failures.length > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Issues{failures.length > 0 ? ` · ${failures.length}` : ''}
            </button>
          </div>
        </div>

        {view === 'catalog' && (
          <div className="p-3 border-b border-slate-800/50">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-2">Coverage · goal &times; days/week</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: '1fr repeat(4, 16px)' }}>
              <span />
              {DAYS_OPTIONS.map(d => (
                <span key={d} className="text-[8px] font-bold text-slate-600 text-center">{d}d</span>
              ))}
              {coverage.map(row => (
                <React.Fragment key={row.goal}>
                  <span
                    className={`text-[9.5px] font-semibold truncate pr-1 ${row.anyMatch ? 'text-slate-400' : 'text-amber-400'}`}
                    title={row.anyMatch ? row.goal : `${row.goal} — no template covers this goal at all`}
                  >
                    {row.goal}
                  </span>
                  {row.perDays.map((has, i) => (
                    <span
                      key={i}
                      className={`text-[10px] text-center leading-none ${has ? 'text-lime-400' : 'text-slate-700'}`}
                      title={`${row.goal} · ${DAYS_OPTIONS[i]} day${DAYS_OPTIONS[i] === '1' ? '' : 's'}/week — ${has ? 'covered' : 'no exact template (falls back to any template for this goal, if one exists)'}`}
                    >
                      {has ? '●' : '·'}
                    </span>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {view === 'issues' ? (
          <>
            <div className="p-3 border-b border-slate-800/40">
              <p className="text-xs text-slate-400">
                {failures.length === 0
                  ? 'No generation issues'
                  : `${failures.length} plan${failures.length === 1 ? '' : 's'} could not be generated`}
              </p>
            </div>
            {failures.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 leading-relaxed">
                Every client who submitted a questionnaire got a plan.
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {failures.map(f => (
                  <div key={f.id} className="p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.04]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{f.userName}</span>
                    </div>
                    <p className="text-[10.5px] font-bold text-amber-400 mb-1">{FAILURE_LABELS[f.reason] || f.reason}</p>
                    {f.detail && <p className="text-[10px] text-slate-400 leading-relaxed mb-2">{f.detail}</p>}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9.5px] text-slate-600">{new Date(f.createdAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => resolveFailure(f.id)}
                        className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : view === 'catalog' ? templateGroups.map(group => {
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
        {view === 'issues' ? (
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Generation issues</h2>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              When the generator can't build a plan it safely can stand behind, it stops rather than delivering a
              questionable one. Those cases land here.
            </p>

            {failures.length === 0 ? (
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
                <p className="text-sm text-slate-300 mb-1">Nothing needs attention.</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every client who submitted a questionnaire received a generated plan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {failures.map(f => (
                  <div key={f.id} className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{f.userName}</p>
                        <p className="text-[11px] text-slate-500">{f.userEmail}</p>
                      </div>
                      <button
                        onClick={() => resolveFailure(f.id)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-amber-400 mb-1.5">{FAILURE_LABELS[f.reason] || f.reason}</p>
                    {f.detail && <p className="text-xs text-slate-400 leading-relaxed mb-3">{f.detail}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {f.gymId && <Tag>Gym: {f.gymId}</Tag>}
                      {f.templateId && <Tag>Template: {f.templateId}</Tag>}
                      <Tag>{new Date(f.createdAt).toLocaleString()}</Tag>
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-3 leading-relaxed">{FAILURE_FIXES[f.reason] || 'Review this client manually.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === 'clients' ? (
          !selectedClient ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">Select a client to see their questionnaire answers.</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-lg font-bold text-white">{selectedClient.name}</h2>
                <button
                  onClick={() => resetClientQuestionnaire(selectedClient)}
                  disabled={resetting}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-red-800/40 bg-red-950/20 text-red-400 hover:bg-red-950/40 text-[11px] font-bold transition-colors disabled:opacity-50"
                >
                  {resetting ? 'Resetting…' : 'Reset Questionnaire'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {hasScheduledPlan(selectedClient) ? (
                  <>Assigned plan: <span className="text-lime-400 font-semibold">{selectedClient.plan?.name}</span></>
                ) : (
                  'No plan assigned yet — add a matching template to the catalog.'
                )}
              </p>
              {resetError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400">
                  {resetError}
                </div>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Questionnaire answers</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <Answer label="Age" value={selectedClient.answers.age} />
                  <Answer label="Height" value={`${selectedClient.answers.heightCm} cm`} />
                  <Answer label="Weight" value={`${selectedClient.answers.weightKg} kg`} />
                  <Answer label="Sex" value={selectedClient.answers.sex} />
                  <Answer label="Experience" value={selectedClient.answers.level} />
                  <Answer
                    label="Schedule"
                    value={`${selectedClient.answers.daysPerWeek}x/week · ${selectedClient.answers.minutesPerSession}${
                      selectedClient.answers.preferredDays?.length
                        ? ` (${selectedClient.answers.preferredDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')})`
                        : ''
                    }`}
                  />
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

            <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 mb-4">
              <button
                onClick={switchToFixed}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-[11.5px] font-bold transition-colors ${
                  !isBlueprint ? 'bg-slate-800 text-lime-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>Fixed exercises</span>
                <span className="text-[9px] font-semibold text-slate-500">Every client gets these exact exercises</span>
              </button>
              <button
                onClick={switchToBlueprint}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-[11.5px] font-bold transition-colors ${
                  isBlueprint ? 'bg-slate-800 text-sky-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>Dynamic slots</span>
                <span className="text-[9px] font-semibold text-slate-500">Generated per client from their gym</span>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3 overflow-x-auto">
              {(isBlueprint ? blueprintDays : editingTemplate.days).map((d, idx) => (
                <div key={d.id} className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => setActiveDayIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      activeDayIndex === idx ? 'bg-lime-500 border-lime-500 text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {isBlueprint ? ((d as BlueprintDay).name || `Day ${idx + 1}`) : `Day ${idx + 1}`}
                  </button>
                  {(isBlueprint ? blueprintDays.length : editingTemplate.days.length) > 1 && (
                    <button onClick={() => (isBlueprint ? onRemoveBlueprintDay(d.id) : onRemoveDay(d.id))} className="ml-1 p-1 text-slate-600 hover:text-red-400 transition-colors" title="Remove day" aria-label="Remove day">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={isBlueprint ? onAddBlueprintDay : onAddDay}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-lime-500 hover:text-lime-400 transition-colors"
                title="Add day"
                aria-label="Add day"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[600px]">
              {isBlueprint ? (
                <BlueprintDayEditor
                  day={blueprintDays[activeDayIndex] || blueprintDays[0]}
                  onChange={onChangeBlueprintDay}
                  libraryExercises={libraryExercises}
                  targetDurationMin={editingTemplate.durationMin}
                />
              ) : (
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
              )}
            </div>

            {isBlueprint && (
              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={closeTemplateEditor}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { onSavePlan().catch(err => window.alert(err?.message || 'Failed to save')); }}
                  className="flex-1 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-extrabold transition-colors"
                >
                  Save Blueprint
                </button>
              </div>
            )}
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
