import React, { useState } from 'react';
import { Language, GymZone, Exercise, WorkoutDay } from '../types';
import { translations } from '../translations';
import { generateFullProgramFromPreferences } from '../services/geminiService';
import { BrainCircuit, Loader2, ArrowRight, ArrowLeft, Check, Sparkles, Target, Zap, Clock, Dumbbell, CalendarRange, X } from 'lucide-react';

interface PlanWizardProps {
  zones: GymZone[];
  onFinish: (days: WorkoutDay[]) => void;
  onCancel: () => void;
  lang: Language;
}

const PlanWizard: React.FC<PlanWizardProps> = ({ zones, onFinish, onCancel, lang }) => {
  const t = translations[lang];
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [prefs, setPrefs] = useState({
    goal: 'goalMuscle',
    level: 'levelIntermediate',
    time: 'time60',
    focus: 'focusFull',
    frequency: 'freq3'
  });

  const steps = [
    { 
      id: 'frequency', 
      title: t.questionFrequency, 
      icon: CalendarRange,
      options: [
        { id: 'freq1', label: t.freq1 },
        { id: 'freq2', label: t.freq2 },
        { id: 'freq3', label: t.freq3 },
        { id: 'freq4', label: t.freq4 },
        { id: 'freq5', label: t.freq5 }
      ]
    },
    { 
      id: 'goal', 
      title: t.questionGoal, 
      icon: Target,
      options: [
        { id: 'goalMuscle', label: t.goalMuscle },
        { id: 'goalStrength', label: t.goalStrength },
        { id: 'goalEndurance', label: t.goalEndurance },
        { id: 'goalWeight', label: t.goalWeight }
      ]
    },
    { 
      id: 'level', 
      title: t.questionLevel, 
      icon: Zap,
      options: [
        { id: 'levelBeginner', label: t.levelBeginner },
        { id: 'levelIntermediate', label: t.levelIntermediate },
        { id: 'levelAdvanced', label: t.levelAdvanced }
      ]
    },
    { 
      id: 'time', 
      title: t.questionTime, 
      icon: Clock,
      options: [
        { id: 'time30', label: t.time30 },
        { id: 'time60', label: t.time60 },
        { id: 'time90', label: t.time90 }
      ]
    },
    { 
      id: 'focus', 
      title: t.questionFocus, 
      icon: Dumbbell,
      options: [
        { id: 'focusFull', label: t.focusFull },
        { id: 'focusUpper', label: t.focusUpper },
        { id: 'focusLower', label: t.focusLower },
        { id: 'focusCore', label: t.focusCore }
      ]
    }
  ];

  const handleGenerate = async () => {
    setLoading(true);
    const daySuggestions = await generateFullProgramFromPreferences(prefs, zones, lang);
    
    const workoutDays: WorkoutDay[] = daySuggestions.map((ds, dayIdx) => ({
      id: `day-${Date.now()}-${dayIdx}`,
      name: ds.dayName,
      exercises: ds.exercises.map((s, exIdx) => ({
        id: `ai-${Date.now()}-${dayIdx}-${exIdx}`,
        name: s.name,
        sets: s.sets,
        reps: s.reps,
        targetMuscle: s.targetMuscle,
        notes: s.notes,
        equipmentId: s.equipmentId || 'manual'
      }))
    }));

    onFinish(workoutDays);
    setLoading(false);
  };

  const currentStepData = steps[step];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onCancel} />
      
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-300">
        
        {loading ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-6 my-auto">
            <div className="relative">
              <div className="w-20 h-20 bg-lime-500/20 rounded-full animate-ping absolute inset-0" />
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center relative border border-lime-500/50">
                <BrainCircuit className="w-10 h-10 text-lime-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{t.generatingPlan}</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">{t.wizardLoadingDesc}</p>
            </div>
            <Loader2 className="w-6 h-6 text-lime-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2.5 sm:p-3 bg-lime-500/10 rounded-2xl border border-lime-500/20">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-lime-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t.wizardTitle}</h2>
                  <p className="text-slate-400 text-xs sm:text-sm">{t.wizardSubtitle}</p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex h-1.5 bg-slate-800 flex-shrink-0">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 transition-all duration-500 ${i <= step ? 'bg-lime-500' : ''}`} 
                />
              ))}
            </div>

            {/* Step Content */}
            <div className="p-5 sm:p-8 space-y-6 flex-1 overflow-y-auto">
              <div className="flex items-center space-x-3 text-lime-400">
                <currentStepData.icon className="w-5 h-5" />
                <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider text-sm">{currentStepData.title}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {currentStepData.options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPrefs(p => ({ ...p, [currentStepData.id]: opt.id }))}
                    className={`
                      p-4 rounded-2xl border-2 text-left transition-all group relative overflow-hidden min-h-[52px] flex items-center justify-between
                      ${prefs[currentStepData.id as keyof typeof prefs] === opt.id 
                        ? 'bg-lime-500 border-lime-500 text-slate-950 shadow-lg shadow-lime-900/20 font-extrabold' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 font-bold'}
                    `}
                  >
                    <span className="relative z-10 text-sm sm:text-base">{opt.label}</span>
                    {prefs[currentStepData.id as keyof typeof prefs] === opt.id && (
                      <Check className="w-4 h-4 ml-2 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center flex-shrink-0 gap-3">
              <button 
                onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs sm:text-sm font-bold uppercase min-h-[44px] px-3 py-2 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{step === 0 ? t.cancel : t.back}</span>
              </button>

              {step === steps.length - 1 ? (
                <button 
                  onClick={handleGenerate}
                  className="bg-lime-500 hover:bg-lime-400 text-slate-950 px-6 sm:px-8 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 shadow-xl shadow-lime-900/20 min-h-[44px]"
                >
                  <span>{t.generate}</span>
                  <Sparkles className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={() => setStep(s => s + 1)}
                  className="bg-white hover:bg-slate-200 text-slate-950 px-6 sm:px-8 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 min-h-[44px]"
                >
                  <span>{t.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlanWizard;