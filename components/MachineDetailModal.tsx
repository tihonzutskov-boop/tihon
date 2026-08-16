
import React from 'react';
import { GymMachine, Language } from '../types';
import { translations, getGymTranslation } from '../translations';
import { X, Play, Info } from 'lucide-react';
import { getYouTubeEmbedUrl } from '../utils/youtubeEmbed';

interface MachineDetailModalProps {
  machine: GymMachine;
  onClose: () => void;
  // Added missing lang prop to fix TypeScript error in App.tsx
  lang: Language;
}

const MachineDetailModal: React.FC<MachineDetailModalProps> = ({ machine, onClose, lang }) => {
  const t = translations[lang];
  
  const videoSrc = machine.videoUrl ? getYouTubeEmbedUrl(machine.videoUrl) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90dvh] animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Close Button Mobile */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-30 md:hidden p-2.5 bg-black/70 rounded-full text-white hover:bg-black transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Section */}
        <div className="w-full md:w-2/3 bg-black relative aspect-video md:aspect-auto flex-shrink-0 md:flex-shrink">
          {videoSrc ? (
            <iframe
              src={videoSrc}
              title={machine.name}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-4">
              <Play className="w-12 h-12 md:w-16 md:h-16 mb-2 md:mb-4 opacity-20" />
              <p className="text-xs md:text-sm text-center">No video demonstration available.</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="w-full md:w-1/3 flex flex-col min-h-0 border-l border-slate-800 flex-1 overflow-hidden">
           {/* Header */}
           <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 flex-shrink-0">
             <div>
               <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{getGymTranslation(machine.name, lang)}</h2>
               <div className="flex items-center text-xs text-lime-400 font-semibold uppercase tracking-wider">
                  <Info className="w-3 h-3 mr-1.5" />
                  {t.machineGuide}
               </div>
             </div>
             <button 
                onClick={onClose}
                className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] items-center justify-center"
                aria-label="Close"
             >
               <X className="w-6 h-6" />
             </button>
           </div>

           {/* Description */}
           <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-800/50">
             <h3 className="text-sm font-bold text-white mb-3">{t.instructions}</h3>
             <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
               {getGymTranslation(machine.longDescription, lang) || t.noInstructions}
             </p>

             <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t.proTip}</h4>
               <p className="text-xs text-slate-400 italic">
                 {t.proTipDefault}
               </p>
             </div>
           </div>
           
           <div className="p-4 border-t border-slate-800 bg-slate-900 flex-shrink-0">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors border border-slate-700 min-h-[44px] flex items-center justify-center text-sm"
              >
                {t.closeGuide}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MachineDetailModal;
