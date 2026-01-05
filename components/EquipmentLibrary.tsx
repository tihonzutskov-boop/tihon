
import React, { useState, useMemo } from 'react';
import { GymZone, GymMachine, EquipmentType } from '../types';
import { Search, Info, MapPin, X, Dumbbell, Play, Filter } from 'lucide-react';

interface EquipmentLibraryProps {
  zones: GymZone[];
  onSelectMachine: (machine: GymMachine, zoneId: string) => void;
  onClose: () => void;
}

const EquipmentLibrary: React.FC<EquipmentLibraryProps> = ({ zones, onSelectMachine, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | 'All'>('All');

  // Flatten all machines and associate them with their zone info
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
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-800/50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Dumbbell className="w-6 h-6 text-lime-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Equipment Library</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search equipment or zones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex overflow-x-auto pb-2 scrollbar-hide space-x-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`
                whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border
                ${activeFilter === cat 
                  ? 'bg-lime-500 border-lime-500 text-slate-900' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMachines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-6">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-800">
              <Search className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm font-medium text-slate-400">No equipment found</p>
            <p className="text-xs text-slate-600 mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredMachines.map(({ machine, zone }) => (
            <div 
              key={machine.id}
              className="bg-slate-800/40 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 rounded-xl p-4 transition-all group relative overflow-hidden"
            >
              {/* Category Indicator Tag */}
              <div className="absolute top-0 right-0 px-2 py-1 bg-slate-900 rounded-bl-lg border-l border-b border-slate-800 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                {zone.type}
              </div>

              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-white group-hover:text-lime-400 transition-colors">{machine.name}</h4>
                  <div className="flex items-center text-xs text-slate-500 mt-0.5">
                    <MapPin className="w-3 h-3 mr-1 text-slate-600" />
                    <span>Located in <span className="text-slate-400 font-medium">{zone.name}</span></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <button 
                  onClick={() => onSelectMachine(machine, zone.id)}
                  className="flex-1 py-2 bg-slate-900 hover:bg-lime-500 text-slate-400 hover:text-slate-900 border border-slate-700 hover:border-lime-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                >
                  <MapPin className="w-3 h-3 mr-2" />
                  Show on Map
                </button>
                {machine.videoUrl && (
                  <div className="w-8 h-8 bg-blue-900/20 border border-blue-800/30 rounded-lg flex items-center justify-center text-blue-400 animate-pulse">
                    <Play className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-600 text-center">
        Displaying {filteredMachines.length} machines at {zones[0]?.name || 'the gym'}
      </div>
    </div>
  );
};

export default EquipmentLibrary;
