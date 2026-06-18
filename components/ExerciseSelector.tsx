
import React, { useState } from 'react';
import { GymZone, AiSuggestion, Exercise, Language } from '../types';
import { generateExercisesForEquipment } from '../services/geminiService';
import { translations, getGymTranslation } from '../translations';
import { Loader2, Plus, Sparkles } from 'lucide-react';

interface ExerciseSelectorProps {
  zone: GymZone | null;
  onAddExercise: (exercise: Exercise) => void;
  onClose: () => void;
  lang: Language;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({ zone, onAddExercise, onClose, lang }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [goal, setGoal] = useState("Hypertrophy");
  const t = translations[lang];
  
  const handleGenerate = async () => {
    if (!zone) return;
    setLoading(true);
    const results = await generateExercisesForEquipment(zone.name, goal, lang);
    setSuggestions(results);
    setLoading(false);
  };

  if (!zone) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center border-l border-slate-700">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.894-1.447L14 7m0 13V7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-300">Select a Zone</h3>
        <p className="text-sm mt-2">{t.selectEquipment}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-800/50">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">{zone.type}</span>
            <h2 className="text-2xl font-bold text-white mt-1">{getGymTranslation(zone.name, lang)}</h2>
            {zone.description && (
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{getGymTranslation(zone.description, lang)}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">{t.trainingGoal}</label>
          <select 
            value={goal} 
            onChange={(e) => setGoal(e.target.value)}
            className="w-full bg-slate-950 text-white rounded-lg px-4 py-2 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Hypertrophy">Hypertrophy (Muscle Growth)</option>
            <option value="Strength">Max Strength</option>
            <option value="Endurance">Endurance / Cardio</option>
            <option value="Rehabilitation">Rehabilitation</option>
            <option value="Explosive Power">Explosive Power</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t.consulting}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              {t.generate}
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {suggestions.length === 0 && !loading && (
          <div className="text-center py-10 opacity-50 border-2 border-dashed border-slate-700 rounded-xl">
             <p className="text-sm">{t.noExercises}</p>
          </div>
        )}

        {suggestions.map((sug, idx) => (
          <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-white">{sug.name}</h4>
              <button
                onClick={() => onAddExercise({
                  id: Date.now().toString() + idx,
                  name: sug.name,
                  sets: sug.sets,
                  reps: sug.reps,
                  targetMuscle: sug.targetMuscle,
                  notes: sug.notes,
                  equipmentId: zone.id
                })}
                className="bg-slate-700 hover:bg-emerald-500 hover:text-white text-slate-300 p-1.5 rounded-full transition-colors"
                title="Add to Program"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center text-xs text-slate-400 space-x-3 mb-2">
              <span className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">{sug.sets} {t.sets}</span>
              <span className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">{sug.reps} {t.reps}</span>
              <span className="bg-slate-900 px-2 py-0.5 rounded text-purple-300">{sug.targetMuscle}</span>
            </div>
            <p className="text-xs text-slate-500 italic">"{sug.notes}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseSelector;
