
import React, { useState, useEffect } from 'react';
import { WorkoutPlan } from '../types';
import { generateProgramAnalysis } from '../services/geminiService';
import { Trash2, Dumbbell, BrainCircuit, X, Calendar } from 'lucide-react';

interface ProgramListProps {
  workout: WorkoutPlan;
  onRemoveExercise: (id: string) => void;
  onClear: () => void;
  onClose?: () => void;
}

const ProgramList: React.FC<ProgramListProps> = ({ workout, onRemoveExercise, onClear, onClose }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Auto-analyze when workout changes significantly (e.g., > 2 exercises)
  useEffect(() => {
    const analyze = async () => {
      if (workout.exercises.length > 2) {
        setAnalyzing(true);
        // Debounce simple effect
        const result = await generateProgramAnalysis(workout.exercises);
        setAnalysis(result);
        setAnalyzing(false);
      } else {
        setAnalysis(null);
      }
    };
    
    // Simple debounce via timeout
    const timeoutId = setTimeout(analyze, 1500);
    return () => clearTimeout(timeoutId);
  }, [workout.exercises.length]); // Only re-run on count change to avoid spam

  return (
    <div className="bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl w-full">
      <div className="p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-lime-400" />
            Training Plan
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
              {workout.exercises.length} Items
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">Your future workout session.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {workout.exercises.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
            <div className="w-16 h-16 border-2 border-dashed border-slate-800 rounded-full flex items-center justify-center">
              <Dumbbell className="w-8 h-8 opacity-20" />
            </div>
            <div className="text-center px-6">
              <p className="text-sm font-medium text-slate-400">Your plan is empty</p>
              <p className="text-xs text-slate-600 mt-1">Select equipment on the map to add exercises.</p>
            </div>
          </div>
        ) : (
          workout.exercises.map((ex, index) => (
            <div key={ex.id} className="bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 flex justify-between group transition-all">
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-slate-500 text-xs font-mono mt-0.5 border border-slate-800">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-slate-200 text-sm">{ex.name}</h4>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                    <span className="text-lime-400/80 font-mono">{ex.sets} x {ex.reps}</span>
                    <span className="text-slate-700">•</span>
                    <span className="text-purple-400/80">{ex.targetMuscle}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onRemoveExercise(ex.id)}
                className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* AI Analysis Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-10">
        {analyzing ? (
          <div className="flex items-center text-xs text-indigo-400 animate-pulse mb-3 bg-indigo-950/20 p-2 rounded">
            <BrainCircuit className="w-4 h-4 mr-2" />
            Analyzing program balance...
          </div>
        ) : analysis ? (
           <div className="bg-indigo-950/30 border border-indigo-500/20 rounded p-3 mb-3">
             <div className="flex items-center text-xs text-indigo-300 font-semibold mb-1">
               <BrainCircuit className="w-3 h-3 mr-1.5" />
               AI Coach Insight
             </div>
             <p className="text-xs text-indigo-200 leading-relaxed opacity-80">{analysis}</p>
           </div>
        ) : null}

        {workout.exercises.length > 0 && (
          <div className="flex space-x-2">
             <button 
               onClick={onClear}
               className="flex-1 py-2.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
             >
               Clear
             </button>
             <button className="flex-[2] py-2.5 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 text-slate-900 font-bold rounded-lg text-sm transition-all shadow-lg shadow-lime-900/20 flex items-center justify-center">
               Save Plan
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramList;
