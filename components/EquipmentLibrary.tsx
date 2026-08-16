import React, { useState, useMemo } from 'react';
import { GymZone, GymMachine, EquipmentType, Language, Gym } from '../types';
import { translations, getGymTranslation } from '../translations';
import { Search, MapPin, X, Dumbbell, Play } from 'lucide-react';
import { getEquipmentIcon } from '../utils/equipmentIcons';

const ICON_MAP: Record<string, any> = {
  Dumbbell, Play, MapPin
};

interface EquipmentLibraryProps {
  gym: Gym;
  zones: GymZone[];
  onSelectMachine: (machine: GymMachine, zoneId: string) => void;
  onClose: () => void;
  lang: Language;
  onLangChange?: (lang: Language) => void;
}

const EquipmentLibrary: React.FC<EquipmentLibraryProps> = ({ gym, zones, onSelectMachine, onClose, lang }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | 'All'>('All');
  const t = translations[lang];

  const allMachines = useMemo(() => {
    const list: { machine: GymMachine; zone: GymZone }[] = [];
    zones.forEach(zone => {
      if (zone.machines) {
        zone.machines.forEach(machine => {
          list.push({ machine, zone });
        });
      }
    });
    return list;
  }, [zones]);

  const filteredMachines = useMemo(() => {
    return allMachines.filter(item => {
      const matchesSearch = item.machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.zone.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === 'All' || item.zone.type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [allMachines, searchTerm, activeFilter]);

  const categories = ['All', ...Object.values(EquipmentType).filter(t => t !== EquipmentType.CORRIDOR && t !== EquipmentType.FACILITY)];

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-800/50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Dumbbell className="w-6 h-6 text-lime-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">{t.library}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none transition-all min-h-[44px]"
          />
        </div>

        <div className="flex overflow-x-auto pb-2 scrollbar-hide space-x-2">
          {categories.map((cat, idx) => (
            <button
              key={`cat-${cat}-${idx}`}
              onClick={() => setActiveFilter(cat)}
              className={`
                whitespace-nowrap px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border min-h-[36px] flex items-center
                ${activeFilter === cat 
                  ? 'bg-lime-500 border-lime-500 text-slate-900' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}
            >
              {cat === 'All' ? t.all : getGymTranslation(cat, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMachines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-6">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-800">
              <Search className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm font-medium text-slate-400">{t.noEquipmentFound}</p>
          </div>
        ) : (
          filteredMachines.map(({ machine, zone }, idx) => {
            const MachineIcon = getEquipmentIcon(machine.icon, machine.name, zone.type);
            return (
              <div 
                key={`eq-${zone.id}-${machine.id}-${idx}`}
                className="bg-slate-800/40 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 rounded-xl p-4 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 px-2 py-1 bg-slate-900 rounded-bl-lg border-l border-b border-slate-800 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                  {getGymTranslation(zone.type, lang)}
                </div>

                <div className="flex items-start space-x-4 mb-2">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700 text-lime-400 group-hover:scale-110 transition-transform">
                    <MachineIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white group-hover:text-lime-400 transition-colors">{getGymTranslation(machine.name, lang)}</h4>
                    <div className="flex items-center text-xs text-slate-500 mt-0.5">
                      <MapPin className="w-3 h-3 mr-1 text-slate-600" />
                      <span>{t.inZone} <span className="text-slate-400 font-medium">{getGymTranslation(zone.name, lang)}</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-4">
                  <button 
                    onClick={() => onSelectMachine(machine, zone.id)}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-lime-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-lime-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center min-h-[44px]"
                  >
                    <MapPin className="w-3.5 h-3.5 mr-2" />
                    {t.showOnMap}
                  </button>
                  {machine.videoUrl && (
                    <div className="w-11 h-11 bg-blue-900/20 border border-blue-800/30 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">
                      <Play className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-600 text-center uppercase tracking-widest">
        {filteredMachines.length} {t.items}
      </div>
    </div>
  );
};

export default EquipmentLibrary;
