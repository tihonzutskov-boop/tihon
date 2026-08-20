import React, { useState, useMemo, useEffect } from 'react';
import { GymZone, Exercise, Language, EquipmentItem, LibraryExercise } from '../types';
import { translations, getGymTranslation, translateMuscle, translateExerciseName } from '../translations';
import { Plus, Map as MapIcon, X, Dumbbell, Play, Check, Layers, Info } from 'lucide-react';
import { getEquipmentIcon } from '../utils/equipmentIcons';
import { getEquipmentIconComponent } from './EquipmentLibrary';
import { evaluateZoneExercises, getZoneEquipmentIds } from '../utils/equipmentMatcher';
import { api, DEFAULT_EQUIPMENT, DEFAULT_EXERCISES } from '../services/api';

interface ExerciseSelectorProps {
  zone: GymZone | null;
  onAddExercise: (exercise: Exercise) => void;
  onClose: () => void;
  lang: Language;
  equipmentList?: EquipmentItem[];
  exercises?: LibraryExercise[];
  onWatchVideo?: (url: string) => void;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  zone,
  onAddExercise,
  onClose,
  lang,
  equipmentList = DEFAULT_EQUIPMENT,
  exercises: propExercises,
  onWatchVideo
}) => {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [localExercises, setLocalExercises] = useState<LibraryExercise[]>(propExercises || DEFAULT_EXERCISES);

  const t = translations[lang] || translations.en;

  // Load exercises if not provided
  useEffect(() => {
    if (!propExercises || propExercises.length === 0) {
      api.fetchExercises().then(data => {
        if (data && data.length > 0) {
          setLocalExercises(data);
        }
      }).catch(err => console.warn('Could not load exercises', err));
    } else {
      setLocalExercises(propExercises);
    }
  }, [propExercises]);

  const activeEquipmentList = equipmentList || DEFAULT_EQUIPMENT;

  // Compute matched exercises for the active zone
  const zoneEvaluation = useMemo(() => {
    if (!zone) return { fullySupported: [], partiallySupported: [], unsupportedCount: 0 };
    return evaluateZoneExercises(zone, localExercises, activeEquipmentList);
  }, [zone, localExercises, activeEquipmentList]);

  // Compute zone equipment items
  const zoneEquipmentItems = useMemo(() => {
    if (!zone) return [];
    const eqIds = getZoneEquipmentIds(zone, activeEquipmentList);
    const map = new Map(activeEquipmentList.map(e => [e.id, e]));
    return eqIds.map(id => map.get(id) || {
      id,
      name: id.replace(/^eq-/, '').replace(/-/g, ' '),
      category: 'Equipment',
      icon: 'Dumbbell'
    });
  }, [zone, activeEquipmentList]);

  const handleAddLibraryExercise = (ex: LibraryExercise) => {
    const newEx: Exercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: ex.name,
      sets: 3,
      reps: '8-12',
      targetMuscle: ex.targetMuscle || 'Full Body',
      notes: ex.instructions ? ex.instructions.substring(0, 100) : '3 sets of 8-12 reps',
      equipmentId: zone?.id,
      videoUrl: ex.videoUrl,
      makeHarder: ex.makeHarder,
      makeEasier: ex.makeEasier,
      libraryExerciseId: ex.id,
    };
    onAddExercise(newEx);
    setAddedIds(prev => new Set([...prev, ex.id]));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(ex.id);
        return next;
      });
    }, 2000);
  };

  if (!zone) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center border-l border-slate-700 bg-slate-900">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
          <MapIcon className="w-8 h-8 opacity-50 text-lime-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-300">{t.selectZoneTitle}</h3>
        <p className="text-sm mt-2">{t.selectEquipment}</p>
      </div>
    );
  }

  const ZoneIcon = getEquipmentIcon(zone.icon, zone.name, zone.type);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 shadow-xl overflow-hidden">
      {/* Zone Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-850/80 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="min-w-0 pr-2">
            <div className="flex items-center space-x-2">
              <ZoneIcon className="w-4 h-4 text-lime-400 flex-shrink-0" />
              <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">{zone.type}</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 truncate">{getGymTranslation(zone.name, lang)}</h2>
            {zone.description && (
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{getGymTranslation(zone.description, lang)}</p>
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

        {/* Equipment Badges in Zone */}
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-lime-400" />
            <span>Equipment in this zone ({zoneEquipmentItems.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {zoneEquipmentItems.length > 0 ? (
              zoneEquipmentItems.map(eq => {
                const EqIcon = getEquipmentIconComponent(eq.icon);
                return (
                  <span
                    key={eq.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-700/70 text-[10px] font-semibold text-slate-200"
                  >
                    <EqIcon className="w-3 h-3 text-lime-400 flex-shrink-0" />
                    <span>{eq.name}</span>
                  </span>
                );
              })
            ) : (
              <span className="text-[11px] text-slate-500 italic">No equipment tagged in this zone yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* SECTION 1: Suggested Exercises Driven by Zone Equipment */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Suggested Exercises</h3>
              <span className="px-2 py-0.5 rounded-full bg-lime-500/10 border border-lime-500/30 text-[10px] font-bold text-lime-400">
                {zoneEvaluation.fullySupported.length} Available
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Matches zone equipment</span>
          </div>

          {zoneEvaluation.fullySupported.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold text-slate-300">No matching exercises for current equipment</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Add equipment in the Admin map editor or tag this zone with Floor Space to unlock suggested exercises.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {zoneEvaluation.fullySupported.map(ex => {
                const isRecentlyAdded = addedIds.has(ex.id);
                return (
                  <div
                    key={ex.id}
                    className="p-3 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-lime-500/50 rounded-xl transition-all shadow-sm group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-white text-sm group-hover:text-lime-300 transition-colors">
                            {translateExerciseName(ex.name, lang)}
                          </h4>
                          {ex.category && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700/60 text-[9px] text-slate-400">
                              {ex.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-purple-300 font-medium mt-0.5">
                          {translateMuscle(ex.targetMuscle, lang)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {ex.videoUrl && onWatchVideo && (
                          <button
                            onClick={() => onWatchVideo(ex.videoUrl!)}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors"
                            title="Watch Video Guide"
                            aria-label="Watch Video Guide"
                          >
                            <Play className="w-3.5 h-3.5 fill-indigo-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleAddLibraryExercise(ex)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow min-h-[36px] ${
                            isRecentlyAdded
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-lime-500 hover:bg-lime-400 text-slate-950 active:scale-95'
                          }`}
                          title="Add to Workout Plan"
                        >
                          {isRecentlyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Requirements / Form Preview */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-700/50 gap-2">
                      <span className="truncate">
                        Requires: <span className="text-slate-300">{ex.equipmentRequired || 'None'}</span>
                      </span>
                      {ex.instructions && (
                        <span className="text-[10px] text-slate-500 line-clamp-1 italic max-w-[50%]">
                          {ex.instructions}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExerciseSelector;
