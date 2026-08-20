import React, { useState, useEffect } from 'react';
import { WorkoutPlan, Language, Exercise, WorkoutDay, Weekday, LibraryExercise } from '../types';
import { translations, translateMuscle, translateExerciseName, translateDayName } from '../translations';
import { Trash2, Dumbbell, X, Calendar, Plus, Edit2, Check, ChevronRight, MapPin, Play, Download, Info, PartyPopper } from 'lucide-react';
import { getEquipmentIcon } from '../utils/equipmentIcons';
import { exportWorkoutToPdf } from '../utils/pdfExporter';
import ExerciseDetailModal from './ExerciseDetailModal';

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'M' }, { key: 'tue', label: 'T' }, { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' }, { key: 'fri', label: 'F' }, { key: 'sat', label: 'S' }, { key: 'sun', label: 'S' }
];

interface ProgramListProps {
  workout: WorkoutPlan;
  activeDayIndex: number;
  setActiveDayIndex: (index: number) => void;
  onRemoveExercise: (id: string) => void;
  onAddExercise: (exercise: Exercise) => void;
  onUpdateExercise: (exercise: Exercise) => void;
  onClear: () => void;
  onLocateExercise: (exercise: Exercise) => void;
  onWatchVideo: (exercise: Exercise) => void;
  onClose?: () => void;
  isLoggedIn?: boolean;
  onCompleteWorkout?: (dayName: string, exerciseCount: number, planDayId?: string) => Promise<void>;
  onSavePlan?: () => void;
  onSetDayWeekday?: (dayId: string, weekday: Weekday | undefined) => void;
  onAddDay?: () => void;
  onRemoveDay?: (dayId: string) => void;
  libraryExercises?: LibraryExercise[];
  onCreateLibraryExercise?: () => void;
  lang: Language;
}

const ProgramList: React.FC<ProgramListProps> = ({
  workout,
  activeDayIndex,
  setActiveDayIndex,
  onRemoveExercise,
  onAddExercise,
  onUpdateExercise,
  onClear,
  onLocateExercise,
  onWatchVideo,
  onClose,
  isLoggedIn = false,
  onCompleteWorkout,
  onSavePlan,
  onSetDayWeekday,
  onAddDay,
  onRemoveDay,
  libraryExercises,
  onCreateLibraryExercise,
  lang
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDetailExercise, setSelectedDetailExercise] = useState<Exercise | null>(null);
  const [isPlanSaved, setIsPlanSaved] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const t = translations[lang];

  const currentDay = workout.days[activeDayIndex] || workout.days[0];

  // Manual Add/Edit Form State
  const [formName, setFormName] = useState('');
  const [formSets, setFormSets] = useState(3);
  const [formReps, setFormReps] = useState('10');
  const [formMuscle, setFormMuscle] = useState('');

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    onAddExercise({
      id: `manual-${Date.now()}`,
      name: formName,
      sets: formSets,
      reps: formReps,
      targetMuscle: formMuscle || 'General',
      equipmentId: 'manual',
    });

    resetForm();
    setIsAdding(false);
  };

  const addFromLibrary = (le: LibraryExercise) => {
    onAddExercise({
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: le.name,
      sets: 3,
      reps: '8-12',
      targetMuscle: le.targetMuscle || 'Full Body',
      notes: le.instructions ? le.instructions.substring(0, 100) : '3 sets of 8-12 reps',
      equipmentId: 'manual',
      videoUrl: le.videoUrl,
      makeHarder: le.makeHarder,
      makeEasier: le.makeEasier,
      libraryExerciseId: le.id,
    });
    setShowLibraryPicker(false);
    setPickerSearch('');
  };

  const startEditing = (ex: Exercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormSets(ex.sets);
    setFormReps(ex.reps);
    setFormMuscle(ex.targetMuscle);
    setIsAdding(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formName) return;

    onUpdateExercise({
      id: editingId,
      name: formName,
      sets: formSets,
      reps: formReps,
      targetMuscle: formMuscle,
      equipmentId: currentDay.exercises.find(ex => ex.id === editingId)?.equipmentId || 'manual',
      notes: currentDay.exercises.find(ex => ex.id === editingId)?.notes
    });

    resetForm();
    setEditingId(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormSets(3);
    setFormReps('10');
    setFormMuscle('');
  };

  useEffect(() => {
    setIsCompleted(false);
  }, [activeDayIndex]);

  const handleCompleteWorkout = async () => {
    if (!onCompleteWorkout || !currentDay || isCompleting) return;
    setIsCompleting(true);
    try {
      await onCompleteWorkout(currentDay.name, currentDay.exercises.length, currentDay.id);
      setIsCompleted(true);
    } finally {
      setIsCompleting(false);
    }
  };

  const totalExercises = workout.days.reduce((acc, d) => acc + d.exercises.length, 0);

  return (
    <div className="bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl w-full">
      <div className="p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-lime-400" />
            {t.trainingPlan}
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700 font-semibold">
              {totalExercises} {t.items}
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Day Tabs */}
        {(workout.days.length > 1 || onAddDay) && (
          <div className="flex items-center overflow-x-auto scrollbar-hide space-x-2 pb-2">
            {workout.days.map((day, idx) => (
              <div key={`${day.id}-${idx}`} className="flex-shrink-0 flex items-center">
                <button
                  onClick={() => setActiveDayIndex(idx)}
                  className={`
                    px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                    ${activeDayIndex === idx
                      ? 'bg-lime-500 border-lime-500 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                  `}
                >
                  {t.day} {idx + 1}
                </button>
                {onRemoveDay && workout.days.length > 1 && (
                  <button
                    onClick={() => onRemoveDay(day.id)}
                    className="ml-1 p-1 text-slate-600 hover:text-red-400 transition-colors"
                    title="Remove day"
                    aria-label="Remove day"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {onAddDay && (
              <button
                onClick={onAddDay}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-lime-500 hover:text-lime-400 transition-colors"
                title="Add day"
                aria-label="Add day"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {currentDay && onSetDayWeekday && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mr-1">{lang === 'et' ? 'Nädalapäev' : lang === 'ru' ? 'День' : 'Day'}</span>
            {WEEKDAYS.map(w => (
              <button
                key={w.key}
                onClick={() => onSetDayWeekday(currentDay.id, currentDay.weekday === w.key ? undefined : w.key)}
                title={w.key}
                className={`
                  w-6 h-6 rounded-md text-[10px] font-bold transition-all border flex items-center justify-center
                  ${currentDay.weekday === w.key
                    ? 'bg-lime-500 border-lime-500 text-slate-950'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-500'}
                `}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentDay && (
          <div className="mb-4">
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
               <ChevronRight className="w-3 h-3 mr-1 text-lime-500" />
               {translateDayName(currentDay.name, activeDayIndex, lang)}
             </div>
          </div>
        )}

        {!isAdding && !editingId && !showLibraryPicker ? (
          <button
            onClick={() => { libraryExercises ? setShowLibraryPicker(true) : (resetForm(), setIsAdding(true)); }}
            className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-lime-400 hover:border-lime-500/50 transition-all text-xs font-bold flex items-center justify-center bg-slate-950/30"
          >
            <Plus className="w-3 h-3 mr-2" />
            {t.addExerciseManually}
          </button>
        ) : showLibraryPicker ? (
          <div className="bg-slate-800 border border-lime-500/30 rounded-lg p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <input
              autoFocus
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-lime-500 transition-colors"
            />
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {(libraryExercises || [])
                .filter(le => {
                  const q = pickerSearch.trim().toLowerCase();
                  if (!q) return true;
                  return le.name.toLowerCase().includes(q) || le.targetMuscle.toLowerCase().includes(q) || le.category.toLowerCase().includes(q);
                })
                .map(le => (
                  <button
                    key={le.id}
                    type="button"
                    onClick={() => addFromLibrary(le)}
                    className="w-full text-left p-2 rounded-lg bg-slate-950 border border-slate-700 hover:border-lime-500/50 transition-colors"
                  >
                    <div className="text-xs font-bold text-white">{le.name}</div>
                    <div className="text-[10px] text-slate-500">{le.targetMuscle} · {le.category}</div>
                  </button>
                ))}
              {(libraryExercises || []).length === 0 && (
                <p className="text-[11px] text-slate-500 text-center py-3">No exercises in the library yet.</p>
              )}
            </div>
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowLibraryPicker(false); setPickerSearch(''); }}
                className="flex-1 py-2 text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                {t.cancel}
              </button>
              {onCreateLibraryExercise && (
                <button
                  type="button"
                  onClick={onCreateLibraryExercise}
                  className="flex-1 py-2 bg-lime-500 text-slate-900 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-lime-400 transition-colors"
                >
                  + New Exercise
                </button>
              )}
            </div>
          </div>
        ) : isAdding ? (
          <form onSubmit={handleManualAdd} className="bg-slate-800 border border-lime-500/30 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">{t.exerciseName}</label>
              <input 
                autoFocus
                type="text" 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-lime-500 transition-colors"
                placeholder="Squats..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">{t.sets}</label>
                <input 
                  type="number" 
                  value={formSets} 
                  onChange={(e) => setFormSets(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-lime-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">{t.reps}</label>
                <input 
                  type="text" 
                  value={formReps} 
                  onChange={(e) => setFormReps(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-lime-500"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">{t.muscleGroup}</label>
              <input 
                type="text" 
                value={formMuscle} 
                onChange={(e) => setFormMuscle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-lime-500"
                placeholder="Quads..."
              />
            </div>
            <div className="flex space-x-2 pt-2">
              <button 
                type="button"
                onClick={() => { setIsAdding(false); resetForm(); }}
                className="flex-1 py-2 text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                {t.cancel}
              </button>
              <button 
                type="submit"
                className="flex-1 py-2 bg-lime-500 text-slate-900 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-lime-400 transition-colors"
              >
                {t.add}
              </button>
            </div>
          </form>
        ) : null}

        {(!currentDay || currentDay.exercises.length === 0) && !isAdding && !showLibraryPicker ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 pt-10">
            <div className="w-16 h-16 border-2 border-dashed border-slate-800 rounded-full flex items-center justify-center">
              <Dumbbell className="w-8 h-8 opacity-20" />
            </div>
            <div className="text-center px-6">
              <p className="text-sm font-medium text-slate-400">{t.planEmpty}</p>
              <p className="text-xs text-slate-600 mt-1">{t.selectEquipment}</p>
            </div>
          </div>
        ) : (
          currentDay.exercises.map((ex, index) => {
            const ExIcon = getEquipmentIcon('', ex.name, ex.targetMuscle);
            return editingId === ex.id ? (
              <form key={`edit-${ex.id}-${index}`} onSubmit={handleUpdate} className="bg-slate-800 border border-blue-500/30 rounded-lg p-3 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <input 
                    autoFocus
                    type="text" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <input 
                    type="number" 
                    value={formSets} 
                    onChange={(e) => setFormSets(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white outline-none"
                    placeholder="Sets"
                  />
                  <input 
                    type="text" 
                    value={formReps} 
                    onChange={(e) => setFormReps(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white outline-none"
                    placeholder="Reps"
                  />
                </div>
                <div className="flex space-x-2 pt-1">
                   <button 
                    type="button"
                    onClick={() => { setEditingId(null); resetForm(); }}
                    className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-1.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-500 transition-colors flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    {t.update}
                  </button>
                </div>
              </form>
            ) : (
              <div 
                key={`ex-${ex.id}-${index}`} 
                onClick={() => setSelectedDetailExercise(ex)}
                className="bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group hover:shadow-lg hover:shadow-slate-950/40 relative"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-slate-500 text-xs font-mono mt-0.5 border border-slate-800 group-hover:border-lime-500/50 group-hover:text-lime-400 transition-colors">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200 text-sm group-hover:text-white transition-colors flex items-center gap-1.5">
                        <ExIcon className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                        <span>{translateExerciseName(ex.name, lang)}</span>
                        <Info className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 opacity-60 group-hover:opacity-100 transition-all ml-1" />
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                        <span className="text-lime-400/80 font-mono">{ex.sets} x {ex.reps}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-purple-400/80">{translateMuscle(ex.targetMuscle, lang)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); startEditing(ex); }}
                      className="text-slate-500 hover:text-blue-400 p-1 rounded hover:bg-slate-700/50 transition-colors"
                      title={t.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveExercise(ex.id); }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-700/50 transition-colors"
                      title={t.remove}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Direct Action Buttons for Ease of Use */}
                <div className="mt-3 flex space-x-2" onClick={(e) => e.stopPropagation()}>
                   {ex.equipmentId !== 'manual' && (
                     <button 
                       onClick={() => onLocateExercise(ex)}
                       className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-lime-400 rounded border border-slate-800 flex items-center justify-center transition-colors"
                     >
                       <MapPin className="w-3 h-3 mr-1.5" />
                       {t.locate}
                     </button>
                   )}
                   <button 
                     onClick={() => setSelectedDetailExercise(ex)}
                     className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-blue-400 rounded border border-slate-800 flex items-center justify-center transition-colors"
                   >
                     <Play className="w-3 h-3 mr-1.5 text-blue-400" />
                     {t.watchVideo}
                   </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedDetailExercise && (
        <ExerciseDetailModal 
          exercise={selectedDetailExercise}
          onClose={() => setSelectedDetailExercise(null)}
          onLocateExercise={onLocateExercise}
          lang={lang}
        />
      )}

      <div className="p-4 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-10">
        {totalExercises > 0 && (
          <div className="space-y-2">
             <button 
               onClick={() => exportWorkoutToPdf(workout, lang)}
               className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-1.5 min-h-[44px]"
             >
               <Download className="w-4 h-4" />
               {t.exportPlan}
             </button>
             <div className="flex space-x-2">
                <button 
                  onClick={onClear}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 min-h-[44px] flex items-center justify-center"
                >
                  {t.clear}
                </button>
                <button
                  onClick={() => {
                    onSavePlan?.();
                    setIsPlanSaved(true);
                    setTimeout(() => setIsPlanSaved(false), 2500);
                  }}
                  className={`flex-1 py-2.5 font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 min-h-[44px] ${
                    isPlanSaved 
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-900/30' 
                      : 'bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 text-slate-950 shadow-lime-900/20 active:scale-95'
                  }`}
                >
                  {isPlanSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{lang === 'et' ? 'Salvestatud!' : lang === 'ru' ? 'Сохранено!' : 'Saved!'}</span>
                    </>
                  ) : (
                    <span>{t.savePlan}</span>
                  )}
                </button>
             </div>

             {isLoggedIn ? (
               <button
                 onClick={handleCompleteWorkout}
                 disabled={isCompleting || isCompleted}
                 className={`w-full py-2.5 font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 min-h-[44px] disabled:cursor-not-allowed ${
                   isCompleted
                     ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                     : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                 }`}
               >
                 {isCompleted ? (
                   <>
                     <PartyPopper className="w-4 h-4" />
                     <span>Workout logged!</span>
                   </>
                 ) : (
                   <span>{isCompleting ? 'Logging…' : 'Mark Day Complete'}</span>
                 )}
               </button>
             ) : (
               <p className="text-center text-[10px] text-slate-600 pt-1">Log in to track completed workouts</p>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramList;