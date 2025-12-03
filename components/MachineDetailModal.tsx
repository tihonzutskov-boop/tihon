
import React from 'react';
import { GymMachine } from '../types';
import { X, Play, Info } from 'lucide-react';

interface MachineDetailModalProps {
  machine: GymMachine;
  onClose: () => void;
}

const MachineDetailModal: React.FC<MachineDetailModalProps> = ({ machine, onClose }) => {
  
  // Helper to ensure URL is embed-friendly if it's a standard YouTube watch link
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    if (url.includes('youtu.be/')) {
        return url.replace('youtu.be/', 'youtube.com/embed/');
    }
    return url;
  };

  const videoSrc = machine.videoUrl ? getEmbedUrl(machine.videoUrl) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Close Button Mobile */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 md:hidden p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Section */}
        <div className="w-full md:w-2/3 bg-black relative aspect-video md:aspect-auto">
          {videoSrc ? (
            <iframe
              src={videoSrc}
              title={machine.name}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-950">
              <Play className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">No video demonstration available.</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="w-full md:w-1/3 flex flex-col border-l border-slate-800">
           {/* Header */}
           <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900">
             <div>
               <h2 className="text-2xl font-bold text-white mb-1">{machine.name}</h2>
               <div className="flex items-center text-xs text-lime-400 font-semibold uppercase tracking-wider">
                  <Info className="w-3 h-3 mr-1.5" />
                  Machine Guide
               </div>
             </div>
             <button 
                onClick={onClose}
                className="hidden md:block text-slate-400 hover:text-white transition-colors"
             >
               <X className="w-6 h-6" />
             </button>
           </div>

           {/* Description */}
           <div className="p-6 overflow-y-auto flex-1 bg-slate-800/50">
             <h3 className="text-sm font-bold text-white mb-3">Instructions</h3>
             <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
               {machine.longDescription || "No detailed instructions provided for this machine."}
             </p>

             <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Pro Tip</h4>
               <p className="text-xs text-slate-400 italic">
                 Scan your environment before starting. Adjust the seat height and weight stack to match your strength level.
               </p>
             </div>
           </div>
           
           <div className="p-4 border-t border-slate-800 bg-slate-900">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors border border-slate-700"
              >
                Close Guide
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MachineDetailModal;
