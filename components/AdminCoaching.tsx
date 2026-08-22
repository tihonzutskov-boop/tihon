import React, { useEffect, useState } from 'react';
import { PlanTemplate, WorkoutDay, LibraryExercise } from '../types';
import { QUESTIONNAIRE_GOALS } from '../constants';
import { api } from '../services/api';
import SessionBuilder from './SessionBuilder';
import { ClipboardList, Loader2, X, ChevronRight, Plus } from 'lucide-react';

const DURATIONS = [30, 45, 60, 90];

const blankTemplate = (goal: string): PlanTemplate => ({
  id: `tpl-${Date.now()}`,
  name: '',
  goal,
  daysPerWeek: '3',
  durationMin: 45,
  days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }],
});

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{children}</span>
);

const AdminCoaching: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [openGoals, setOpenGoals] = useState<Set<string>>(new Set());

  const [editingTemplate, setEditingTemplate] = useState<PlanTemplate | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExInstructions, setNewExInstructions] = useState('');

  useEffect(() => {
    Promise.all([api.fetchPlanTemplates(), api.fetchExercises()]).then(([t, e]) => {
      setTemplates(t);
      setLibraryExercises(e);
      setLoading(false);
    });
  }, []);

  const templateGroups = QUESTIONNAIRE_GOALS.map(goal => ({ goal, templates: templates.filter(t => t.goal === goal) }));

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
  };
  const editTemplate = (t: PlanTemplate) => {
    setEditingTemplate({ ...t });
    setActiveDayIndex(0);
  };
  const closeTemplateEditor = () => setEditingTemplate(null);

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
        <div className="p-4 border-b border-slate-800/50">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Personal Coaching</h3>
        </div>

        {templateGroups.map(group => {
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
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!editingTemplate ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Select a template to edit it, or create a new one.</p>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
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
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Session duration</label>
                  <select
                    value={editingTemplate.durationMin}
                    onChange={e => setEditingTemplate({ ...editingTemplate, durationMin: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-lime-500"
                  >
                    {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
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
