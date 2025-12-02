import React, { useState, useEffect } from 'react';
import { WorkoutPlan, Exercise } from '../types';
import { generateProgramAnalysis } from '../services/geminiService';
import { Trash2, Dumbbell, Clock, BrainCircuit } from 'lucide-react';

interface ProgramListProps {
  workout: WorkoutPlan;
  onRemoveExercise: (id: string) => void;
  onClear: () => void;
}

const ProgramList: React.FC<ProgramListProps> = ({ workout, onRemoveExercise, onClear }) => {
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
    <div className="bg-slate-900 border-t border-slate-700 lg:border-t-0 lg:border-l lg:w-96 flex flex-col h-full shadow-2xl">
      <div className="p-6 border-b border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Dumbbell className="w-5 h-5 mr-2 text-lime-400" />
            Current Session
          </h2>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
            {workout.exercises.length} Exercises
          </span>
        </div>
        <p className="text-xs text-slate-500">Drag items to reorder (Coming soon)</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {workout.exercises.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
            <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center">
              <PlusIcon />
            </div>
            <p className="text-sm">Map is empty. Add exercises.</p>
          </div>
        ) : (
          workout.exercises.map((ex, index) => (
            <div key={ex.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex justify-between group">
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-slate-500 text-xs font-mono mt-0.5">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-slate-200 text-sm">{ex.name}</h4>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                    <span className="text-lime-400/80">{ex.sets} x {ex.reps}</span>
                    <span>•</span>
                    <span>{ex.targetMuscle}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onRemoveExercise(ex.id)}
                className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* AI Analysis Footer */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        {analyzing ? (
          <div className="flex items-center text-xs text-indigo-400 animate-pulse">
            <BrainCircuit className="w-4 h-4 mr-2" />
            Analyzing program balance...
          </div>
        ) : analysis ? (
           <div className="bg-indigo-900/30 border border-indigo-500/30 rounded p-3">
             <div className="flex items-center text-xs text-indigo-300 font-semibold mb-1">
               <BrainCircuit className="w-3 h-3 mr-1.5" />
               AI Insight
             </div>
             <p className="text-xs text-indigo-200 leading-relaxed">{analysis}</p>
           </div>
        ) : null}

        {workout.exercises.length > 0 && (
          <div className="mt-4 flex space-x-2">
             <button 
               onClick={onClear}
               className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
             >
               Clear All
             </button>
             <button className="flex-[2] py-2 bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold rounded text-sm transition-colors shadow-lg shadow-lime-900/20">
               Start Workout
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple Icon helper
const PlusIcon = () => (
  <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export default ProgramList;
