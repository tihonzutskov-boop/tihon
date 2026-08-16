
import React from 'react';
import { GymMachine, Language, EquipmentItem } from '../types';
import { translations, getGymTranslation } from '../translations';
import { X, Info, Camera, Layers } from 'lucide-react';
import { DEFAULT_EQUIPMENT } from '../services/api';

interface MachineDetailModalProps {
  machine: GymMachine;
  onClose: () => void;
  lang: Language;
}

const MachineDetailModal: React.FC<MachineDetailModalProps> = ({ machine, onClose, lang }) => {
  const t = translations[lang] || translations.et;
  
  // Find linked equipment item if available for photo and setup text
  let storedEquipment: EquipmentItem[] = DEFAULT_EQUIPMENT;
  try {
    const raw = localStorage.getItem('gyde_equipment_library');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        storedEquipment = parsed;
      }
    }
  } catch (e) {
    // fallback
  }

  const linkedEquipment = storedEquipment.find(eq => eq.id === machine.equipmentId || eq.name.toLowerCase() === machine.name.toLowerCase());
  
  const displayImage = machine.imageUrl || linkedEquipment?.imageUrl;
  const displayDescription = getGymTranslation(machine.longDescription, lang) || linkedEquipment?.description || machine.description || t.noInstructions;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] z-10 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start bg-slate-850 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wider bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/20">
                  {linkedEquipment?.category || 'Equipment Station'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                {getGymTranslation(machine.name, lang)}
              </h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body: Equipment Picture + Identification & Setup Text */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Equipment Photo */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-lime-400" />
              <span>Equipment Appearance & Identification Photo</span>
            </h3>

            {displayImage ? (
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video max-h-64 flex items-center justify-center">
                <img 
                  src={displayImage} 
                  alt={machine.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full max-h-64 object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center text-slate-500 flex flex-col items-center justify-center">
                <Camera className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-xs font-semibold text-slate-400">No equipment photo uploaded</p>
                <p className="text-[10px] text-slate-600 mt-1">Admin can upload a photo in the Equipment Library.</p>
              </div>
            )}
          </div>

          {/* Identification & Setup Instructions */}
          <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-lime-400 uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Identification & Setup Instructions</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {displayDescription}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors min-h-[44px]"
          >
            {t.closeGuide || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MachineDetailModal;
