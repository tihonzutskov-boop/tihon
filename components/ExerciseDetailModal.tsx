import React from 'react';
import { Exercise, Language } from '../types';
import { translations, translateExerciseName, translateMuscle, getEnglishExerciseName } from '../translations';
import { X, Play, MapPin, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import { getEquipmentIcon } from '../utils/equipmentIcons';
import { getYouTubeEmbedUrl } from '../utils/youtubeEmbed';

interface ExerciseDetailModalProps {
  exercise: Exercise;
  onClose: () => void;
  onLocateExercise?: (exercise: Exercise) => void;
  lang: Language;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  exercise,
  onClose,
  onLocateExercise,
  lang,
}) => {
  const t = translations[lang] || translations.et;
  const englishExerciseName = getEnglishExerciseName(exercise.name);

  // Helper to ensure URL is embed-friendly for YouTube & YouTube Shorts
  const getEmbedUrl = (url: string | undefined) => {
    if (url && url.trim()) {
      return getYouTubeEmbedUrl(url);
    }

    // High quality exercise-matched fallback YouTube embeds
    const english = englishExerciseName.toLowerCase();
    if (english.includes('bench press')) return 'https://www.youtube.com/embed/rT7DgCr-3pg';
    if (english.includes('deadlift')) return 'https://www.youtube.com/embed/_oyxCn2iSjU';
    if (english.includes('squat')) return 'https://www.youtube.com/embed/ultWZbUMPL8';
    if (english.includes('pulldown')) return 'https://www.youtube.com/embed/CAwf7n6Luuc';
    if (english.includes('shoulder press')) return 'https://www.youtube.com/embed/qEwKCR5JCog';
    if (english.includes('row')) return 'https://www.youtube.com/embed/H0r_Zcp4pG4';
    if (english.includes('curl')) return 'https://www.youtube.com/embed/yTwo27QT6Lg';
    if (english.includes('treadmill') || english.includes('hike')) return 'https://www.youtube.com/embed/8iPEnn-ltC8';
    if (english.includes('press')) return 'https://www.youtube.com/embed/IZxyjW7MPJQ';

    return 'https://www.youtube.com/embed/SW_C1A-rejs';
  };

  const videoSrc = getEmbedUrl(exercise.videoUrl);
  const exerciseNameTranslated = translateExerciseName(exercise.name, lang);
  const muscleTranslated = translateMuscle(exercise.targetMuscle, lang);

  // Search query prepends "How to do " to the English exercise name to return top-quality instructional YouTube Shorts & fallback videos
  const searchQuery = `How to do ${englishExerciseName} shorts`;
  const youtubeShortsSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

  const ExIcon = getEquipmentIcon('', exercise.name, exercise.targetMuscle);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] z-10 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex justify-between items-start flex-shrink-0">
          <div className="pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest bg-lime-500/10 text-lime-400 px-2.5 py-1 rounded-md border border-lime-500/20">
                {muscleTranslated}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20">
                {exercise.sets} {t.sets} × {exercise.reps} {t.reps}
              </span>
              {onLocateExercise && exercise.equipmentId !== 'manual' && (
                <button
                  onClick={() => {
                    onLocateExercise(exercise);
                    onClose();
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest bg-lime-500 hover:bg-lime-400 text-slate-950 px-3 py-1.5 rounded-md shadow-md transition-all flex items-center gap-1 active:scale-95 cursor-pointer min-h-[36px]"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{t.locate || 'Locate on Map'}</span>
                </button>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <ExIcon className="w-6 h-6 text-lime-400 flex-shrink-0" />
              <span>{exerciseNameTranslated}</span>
            </h2>
          </div>

          <button 
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Video Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center text-red-500">
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                {t.watchVideo || 'Watch YouTube Shorts'}
              </span>
              
              <a 
                href={youtubeShortsSearchUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors font-bold text-[11px] bg-red-950/40 px-2.5 py-1 rounded-md border border-red-500/30"
              >
                <svg className="w-3.5 h-3.5 fill-current text-red-500" viewBox="0 0 24 24">
                  <path d="M17.77 10.32l-1.2-.5L18 8.6a4.11 4.11 0 0 0-5.55-5.65l-6 3.5A4.12 4.12 0 0 0 4.8 12.55l1.2.5L4.6 14.4a4.11 4.11 0 0 0 5.55 5.65l6-3.5a4.12 4.12 0 0 0 1.62-6.23zm-7.27 4.18V9.5l4.8 2.5-4.8 2.5z"/>
                </svg>
                <span>{t.searchOnShorts || 'Search YouTube Shorts'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
              {videoSrc ? (
                <iframe
                  src={videoSrc}
                  title={exercise.name}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/80">
                  <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 shadow-inner">
                    <svg className="w-7 h-7 text-red-500 fill-current" viewBox="0 0 24 24">
                      <path d="M17.77 10.32l-1.2-.5L18 8.6a4.11 4.11 0 0 0-5.55-5.65l-6 3.5A4.12 4.12 0 0 0 4.8 12.55l1.2.5L4.6 14.4a4.11 4.11 0 0 0 5.55 5.65l6-3.5a4.12 4.12 0 0 0 1.62-6.23zm-7.27 4.18V9.5l4.8 2.5-4.8 2.5z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-300 mb-1">{t.noVideoFound || 'No direct video attached'}</p>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Watch short video tutorials and technique breakdowns directly on YouTube Shorts:
                  </p>
                  
                  <a
                    href={youtubeShortsSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600 to-black hover:from-red-500 hover:to-slate-900 text-white border border-red-500/50 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-950/40 group"
                  >
                    <svg className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform fill-current" viewBox="0 0 24 24">
                      <path d="M17.77 10.32l-1.2-.5L18 8.6a4.11 4.11 0 0 0-5.55-5.65l-6 3.5A4.12 4.12 0 0 0 4.8 12.55l1.2.5L4.6 14.4a4.11 4.11 0 0 0 5.55 5.65l6-3.5a4.12 4.12 0 0 0 1.62-6.23zm-7.27 4.18V9.5l4.8 2.5-4.8 2.5z"/>
                    </svg>
                    <span>{t.searchOnShorts || 'Search YouTube Shorts'}</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Technique & Description Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Info className="w-4 h-4 mr-1.5 text-blue-400" />
              {t.description || 'Description & Technique'}
            </h3>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
              {exercise.notes ? (
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {exercise.notes}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  {t.noInstructions || 'Perform with controlled tempo and full range of motion.'}
                </p>
              )}

              {/* Standard Technique Checklist */}
              <div className="pt-2 border-t border-slate-700/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                  <span>Maintain posture & stable core</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                  <span>Control breathing phase</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                  <span>Full extension & contraction</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                  <span>Avoid momentum & sudden jerks</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 flex-shrink-0">
          {exercise.equipmentId && exercise.equipmentId !== 'manual' && onLocateExercise ? (
            <button
              onClick={() => {
                onLocateExercise(exercise);
                onClose();
              }}
              className="flex-1 py-3 px-4 bg-lime-500 hover:bg-lime-400 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-lime-900/20 min-h-[44px]"
            >
              <MapPin className="w-4 h-4" />
              <span>{t.locate}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700 min-h-[44px]"
          >
            {t.cancel || 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExerciseDetailModal;
