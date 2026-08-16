
import React, { useState } from 'react';
import { GymZone, AiSuggestion, Exercise, Language } from '../types';
import { generateExercisesForEquipment } from '../services/geminiService';
import { translations, getGymTranslation, translateMuscle, translateExerciseName } from '../translations';
import { Loader2, Plus, Sparkles, Map, X } from 'lucide-react';
import { getEquipmentIcon } from '../utils/equipmentIcons';

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
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
          <Map className="w-8 h-8 opacity-50 text-lime-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-300">{t.selectZoneTitle}</h3>
        <p className="text-sm mt-2">{t.selectEquipment}</p>
      </div>
    );
  }

  const ZoneIcon = getEquipmentIcon(zone.icon, zone.name, zone.type);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-800/50">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <ZoneIcon className="w-4 h-4 text-lime-400" />
              <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">{zone.type}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{getGymTranslation(zone.name, lang)}</h2>
            {zone.description && (
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{getGymTranslation(zone.description, lang)}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">{t.trainingGoal}</label>
          <select 
            value={goal} 
            onChange={(e) => setGoal(e.target.value)}
            className="w-full bg-slate-950 text-white rounded-xl px-4 py-2.5 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[44px]"
          >
            <option value="Hypertrophy">{t.goalHypertrophy}</option>
            <option value="Strength">{t.goalMaxStrength}</option>
            <option value="Endurance">{t.goalCardio}</option>
            <option value="Rehabilitation">{t.goalRehab}</option>
            <option value="Explosive Power">{t.goalPower}</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 text-sm min-h-[44px]"
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
          <div key={`sug-${sug.name}-${idx}`} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-blue-500/50 transition-colors group">
            <div className="flex justify-between items-start mb-2 gap-2">
              <h4 className="font-semibold text-white text-sm">{translateExerciseName(sug.name, lang)}</h4>
              <button
                onClick={() => onAddExercise({
                  id: `ex-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                  name: sug.name,
                  sets: sug.sets,
                  reps: sug.reps,
                  targetMuscle: sug.targetMuscle,
                  notes: sug.notes,
                  equipmentId: zone.id
                })}
                className="bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold p-2 rounded-xl transition-all min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0 shadow-md"
                title={t.addToProgram}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center text-xs text-slate-400 space-x-3 mb-2">
              <span className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">{sug.sets} {t.sets}</span>
              <span className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">{sug.reps} {t.reps}</span>
              <span className="bg-slate-900 px-2 py-0.5 rounded text-purple-300">{translateMuscle(sug.targetMuscle, lang)}</span>
            </div>
            <p className="text-xs text-slate-500 italic">"{sug.notes}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseSelector;
