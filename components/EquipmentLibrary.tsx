import React, { useState, useMemo, useRef } from 'react';
import { EquipmentItem, Gym, GymZone, LibraryExercise, Language } from '../types';
import { translations, getGymTranslation } from '../translations';
import { 
  Dumbbell, Search, Plus, Edit2, Trash2, Check, X, 
  Layers, Box, Sliders, Disc, Activity, Waves, Sparkles, 
  Wind, MapPin, Eye, ArrowRight, CheckCircle2, AlertCircle, 
  ExternalLink, ChevronRight, Info, Camera, Upload, Image as ImageIcon
} from 'lucide-react';
import { api, DEFAULT_EQUIPMENT } from '../services/api';
import { getEquipmentExerciseCount } from '../utils/equipmentMatcher';

interface EquipmentLibraryProps {
  gym: Gym;
  equipmentList?: EquipmentItem[];
  exercises?: LibraryExercise[];
  onEquipmentChange?: (updatedList: EquipmentItem[]) => void;
  onGymChange?: (updatedGym: Gym) => void;
  onSelectEquipmentForZone?: (equipment: EquipmentItem) => void;
  onSelectMachine?: (machine: GymMachine, zoneId: string) => void;
  onClose?: () => void;
  zones?: GymZone[];
  lang?: Language;
}

const CATEGORIES = [
  'All',
  'Free Weights',
  'Machines',
  'Benches & Racks',
  'Cables',
  'Cardio',
  'Functional & Floor',
  'Accessories'
];

const ICON_OPTIONS = [
  { label: 'Dumbbell', value: 'Dumbbell', icon: Dumbbell },
  { label: 'Weight & Barbell', value: 'Weight', icon: Disc },
  { label: 'Power Rack', value: 'Layers', icon: Layers },
  { label: 'Bench / Box', value: 'Box', icon: Box },
  { label: 'Cable Station', value: 'Sliders', icon: Sliders },
  { label: 'Disc / Machine', value: 'Disc', icon: Disc },
  { label: 'Cardio / Run', value: 'Activity', icon: Activity },
  { label: 'Rower / Waves', value: 'Waves', icon: Waves },
  { label: 'Floor Space / Mat', value: 'Sparkles', icon: Sparkles },
  { label: 'Bands / Wind', value: 'Wind', icon: Wind }
];

export const getEquipmentIconComponent = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'dumbbell': return Dumbbell;
    case 'weight': return Disc;
    case 'layers': return Layers;
    case 'box': return Box;
    case 'sliders': return Sliders;
    case 'disc': return Disc;
    case 'activity': return Activity;
    case 'waves': return Waves;
    case 'sparkles': return Sparkles;
    case 'wind': return Wind;
    default: return Dumbbell;
  }
};

const EquipmentLibrary: React.FC<EquipmentLibraryProps> = ({
  gym,
  equipmentList = DEFAULT_EQUIPMENT,
  exercises = [],
  onEquipmentChange = () => {},
  onGymChange,
  onSelectEquipmentForZone,
  onSelectMachine,
  onClose,
  zones,
  lang = 'en'
}) => {
  const safeEquipmentList = useMemo(() => {
    return Array.isArray(equipmentList) && equipmentList.length > 0 
      ? equipmentList 
      : DEFAULT_EQUIPMENT;
  }, [equipmentList]);

  const safeExercises = useMemo(() => {
    return Array.isArray(exercises) ? exercises : [];
  }, [exercises]);

  const isDrawerMode = Boolean(onClose);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewItem, setPreviewItem] = useState<EquipmentItem | null>(null);
  const [assigningEquipment, setAssigningEquipment] = useState<EquipmentItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for Add/Edit Modal (Image + Identification Text - NO Video)
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Free Weights');
  const [formIcon, setFormIcon] = useState('Dumbbell');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsFloorSpace, setFormIsFloorSpace] = useState(false);
  const [formFootprintW, setFormFootprintW] = useState('40');
  const [formFootprintH, setFormFootprintH] = useState('40');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Compute map of which zones contain each equipment item
  const activeZones = zones || gym?.zones || [];
  const equipmentZonePlacements = useMemo(() => {
    const map = new Map<string, GymZone[]>();
    activeZones.forEach(zone => {
      const zoneEqIds = new Set<string>(zone.equipmentIds || []);
      (zone.machines || []).forEach(m => {
        if (m.equipmentId) zoneEqIds.add(m.equipmentId);
      });
      zoneEqIds.forEach(eqId => {
        const existing = map.get(eqId) || [];
        existing.push(zone);
        map.set(eqId, existing);
      });
    });
    return map;
  }, [activeZones]);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return safeEquipmentList.filter(item => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [safeEquipmentList, selectedCategory, searchTerm]);

  // Open modal to create a new equipment item
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('Free Weights');
    setFormIcon('Dumbbell');
    setFormDescription('');
    setFormImageUrl('');
    setFormIsFloorSpace(false);
    setFormFootprintW('40');
    setFormFootprintH('40');
    setIsCreatingNew(true);
  };

  // Open modal to edit an existing item
  const handleOpenEditModal = (item: EquipmentItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category || 'Free Weights');
    setFormIcon(item.icon || 'Dumbbell');
    setFormDescription(item.description || '');
    setFormImageUrl(item.imageUrl || '');
    setFormIsFloorSpace(Boolean(item.isFloorSpace));
    setFormFootprintW(item.defaultFootprint?.width?.toString() || '40');
    setFormFootprintH(item.defaultFootprint?.height?.toString() || '40');
    setIsCreatingNew(true);
  };

  // Save changes from modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const w = parseFloat(formFootprintW) || 40;
    const h = parseFloat(formFootprintH) || 40;

    if (editingItem) {
      const updated: EquipmentItem = {
        ...editingItem,
        name: formName.trim(),
        category: formCategory,
        icon: formIcon,
        description: formDescription.trim(),
        imageUrl: formImageUrl.trim() || undefined,
        isFloorSpace: formIsFloorSpace,
        defaultFootprint: { width: w, height: h }
      };
      await api.saveEquipment(updated);
      onEquipmentChange(safeEquipmentList.map(item => item.id === updated.id ? updated : item));
    } else {
      const newId = `eq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const created: EquipmentItem = {
        id: newId,
        name: formName.trim(),
        category: formCategory,
        icon: formIcon,
        description: formDescription.trim(),
        imageUrl: formImageUrl.trim() || undefined,
        isFloorSpace: formIsFloorSpace,
        defaultFootprint: { width: w, height: h }
      };
      await api.createEquipment(created);
      onEquipmentChange([...safeEquipmentList, created]);
    }

    setIsCreatingNew(false);
    setEditingItem(null);
  };

  // Delete item handler
  const handleDeleteItem = async (id: string) => {
    await api.deleteEquipment(id);
    onEquipmentChange(safeEquipmentList.filter(item => item.id !== id));
    setDeleteConfirmId(null);
  };

  // Toggle equipment in a zone directly from quick assignment modal
  const handleToggleZonePlacement = (zoneId: string, equipmentId: string) => {
    if (!onGymChange) return;

    const updatedZones = (gym.zones || []).map(zone => {
      if (zone.id !== zoneId) return zone;

      const currentIds = new Set<string>(zone.equipmentIds || []);
      if (currentIds.has(equipmentId)) {
        currentIds.delete(equipmentId);
      } else {
        currentIds.add(equipmentId);
      }

      return {
        ...zone,
        equipmentIds: Array.from(currentIds)
      };
    });

    const updatedGym = { ...gym, zones: updatedZones };
    api.saveGym(updatedGym);
    onGymChange(updatedGym);
  };

  // Restore preset defaults if needed
  const handleRestoreDefaults = async () => {
    if (window.confirm('Restore standard equipment library presets? This will add any missing default items.')) {
      const existingIds = new Set(safeEquipmentList.map(e => e.id));
      const missing = DEFAULT_EQUIPMENT.filter(e => !existingIds.has(e.id));
      
      for (const item of missing) {
        await api.createEquipment(item);
      }
      
      const merged = [...safeEquipmentList, ...missing];
      onEquipmentChange(merged);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden h-full">
      {/* Header Bar */}
      <div className={`border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm flex ${
        isDrawerMode ? 'p-4 items-center justify-between' : 'p-6 flex-col md:flex-row md:items-center md:justify-between gap-4'
      }`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Equipment Library
                <span className="text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                  {safeEquipmentList.length} items
                </span>
              </h1>
              <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
                {isDrawerMode ? 'Browse gym equipment and locate on map' : 'Manage reusable physical gear, cardio machines, and floor setups'}
              </p>
            </div>
          </div>

          {/* Close button for Drawer mode */}
          {isDrawerMode && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Close equipment drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Action Buttons for Admin mode */}
        {!isDrawerMode && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRestoreDefaults}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
              title="Import or restore standard gym equipment catalog"
            >
              Import Standard Presets
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-all shadow-md shadow-lime-500/10"
            >
              <Plus className="w-4 h-4" />
              Add Equipment Item
            </button>
          </div>
        )}
      </div>

      {/* Search & Category Filter Bar */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-800/60 bg-slate-900/30 flex flex-col gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search equipment by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const count = cat === 'All' 
              ? safeEquipmentList.length 
              : safeEquipmentList.filter(e => e.category === cat).length;
            const active = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border ${
                  active
                    ? 'bg-lime-500 text-slate-950 border-lime-500 font-bold shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-slate-900/20 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View of Equipment Cards */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        {filteredEquipment.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 max-w-xl mx-auto mt-6">
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 mb-3 text-slate-500">
              <Search className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-sm md:text-base font-bold text-white mb-1">No equipment found</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              {searchTerm 
                ? `No items matching "${searchTerm}". Try resetting search filters.`
                : 'No equipment items currently in this category.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 ${
            isDrawerMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
          }`}>
            {filteredEquipment.map(item => {
              const IconComp = getEquipmentIconComponent(item.icon);
              const placedZones = equipmentZonePlacements.get(item.id) || [];
              const unlockedExercisesCount = getEquipmentExerciseCount(item.id, safeExercises, safeEquipmentList);

              return (
                <div
                  key={item.id}
                  className="group relative bg-slate-900/80 border border-slate-800 hover:border-lime-500/40 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-xl hover:shadow-lime-500/5 hover:-translate-y-0.5"
                >
                  {/* Optional Equipment Picture / Visual Identification Header */}
                  {item.imageUrl ? (
                    <div 
                      onClick={() => setPreviewItem(item)}
                      className="relative h-36 w-full bg-slate-950 overflow-hidden cursor-pointer group/img"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-white">
                        <span className="bg-slate-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-lime-400 font-mono font-bold flex items-center gap-1 border border-slate-800">
                          <Camera className="w-3 h-3" /> Equipment Photo
                        </span>
                        <span className="bg-slate-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-slate-300 flex items-center gap-1 border border-slate-800">
                          <Eye className="w-3 h-3" /> View Specs
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="p-4 md:p-5 flex-1 flex flex-col">
                    {/* Card Top: Icon, Category Pill & Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div 
                        onClick={() => setPreviewItem(item)}
                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                      >
                        <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80 text-lime-400 group-hover:bg-lime-500/10 group-hover:border-lime-500/30 transition-colors flex-shrink-0">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5 truncate">
                            {item.category || 'General'}
                          </span>
                          <h3 className="text-sm font-bold text-white group-hover:text-lime-400 transition-colors line-clamp-1">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      {/* Action buttons (only in Admin mode) */}
                      {!isDrawerMode && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit equipment picture & setup instructions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete equipment item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Equipment Identification & Setup Guidance */}
                    <div 
                      onClick={() => setPreviewItem(item)}
                      className="cursor-pointer mb-3"
                    >
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <Info className="w-3 h-3 text-slate-400" />
                        <span>Identification & Setup</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 min-h-[36px]">
                        {item.description || (item.isFloorSpace ? 'Open turf/mat zone for core and bodyweight movements.' : 'Standard gym workout station. Adjust seat height and safety pins to suit posture.')}
                      </p>
                    </div>

                    {/* Badges: Unlocks X Exercises + Placed in Y Zones */}
                    <div className="mt-auto pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Enables Exercises:
                        </span>
                        <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                          {unlockedExercisesCount} {unlockedExercisesCount === 1 ? 'exercise' : 'exercises'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-blue-400" />
                          In Zones:
                        </span>
                        {!isDrawerMode ? (
                          <button
                            onClick={() => setAssigningEquipment(item)}
                            className="font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/20 text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <span>{placedZones.length} {placedZones.length === 1 ? 'zone' : 'zones'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px]">
                            {placedZones.length} {placedZones.length === 1 ? 'zone' : 'zones'}
                          </span>
                        )}
                      </div>

                      {/* Zone name tags list with click-to-locate in Drawer mode */}
                      {placedZones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {placedZones.slice(0, 4).map(zone => (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => {
                                if (isDrawerMode && onSelectMachine) {
                                  const machine = (zone.machines || []).find(m => m.equipmentId === item.id) || {
                                    id: `m-${item.id}`,
                                    name: item.name,
                                    x: 0,
                                    y: 0,
                                    width: 40,
                                    height: 40,
                                    equipmentId: item.id
                                  };
                                  onSelectMachine(machine, zone.id);
                                  if (onClose) onClose();
                                }
                              }}
                              className={`text-[9px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700 truncate max-w-[140px] transition-colors ${
                                isDrawerMode ? 'hover:bg-blue-600 hover:text-white cursor-pointer' : ''
                              }`}
                              title={isDrawerMode ? `Click to view ${item.name} in ${zone.name}` : zone.name}
                            >
                              📍 {zone.name}
                            </button>
                          ))}
                          {placedZones.length > 4 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-500">
                              +{placedZones.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Create / Edit Equipment Item (Picture + Setup Text - NO Video) */}
      {isCreatingNew && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col my-auto">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-lime-500/10 text-lime-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingItem ? 'Edit Equipment Item' : 'Add New Equipment Item'}
                  </h3>
                  <p className="text-[10px] text-slate-400">Physical equipment photo & identification setup instructions</p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreatingNew(false); setEditingItem(null); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Dumbbell Bench, Power Rack, Cable Crossover..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none min-h-[44px]"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Map Icon Badge
                  </label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none min-h-[44px]"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Equipment Picture */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Equipment Picture (What it looks like)
                </label>
                
                {formImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video max-h-44 group">
                    <img 
                      src={formImageUrl} 
                      alt="Equipment Preview" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormImageUrl('')}
                        className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs font-semibold hover:bg-red-600 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-lime-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-lime-500/20 text-slate-400 group-hover:text-lime-400 mx-auto flex items-center justify-center mb-2 transition-colors">
                      <Camera className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      Click to upload equipment picture
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      PNG, JPG, or WebP photo showing what the machine / rack looks like
                    </p>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />

                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold block mb-1">Or paste direct image URL:</span>
                  <input
                    type="url"
                    placeholder="https://example.com/equipment-photo.jpg"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none"
                  />
                </div>
              </div>

              {/* Text instructions describing what it looks like / how to identify or set it up */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Identification & Setup Instructions *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe what this equipment looks like, how to identify it on the gym floor, and how to set it up (e.g. 'Adjustable bench, set flat or incline, positioned under the barbell rack. Use pull-pin under seat to adjust incline angle')..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none resize-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Answers: What is this equipment, what does it look like, and how do members set it up?
                </p>
              </div>

              {/* Tag for open floor space */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="chk-floor-space"
                  checked={formIsFloorSpace}
                  onChange={(e) => setFormIsFloorSpace(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-lime-500 focus:ring-lime-500 h-4 w-4 bg-slate-900"
                />
                <label htmlFor="chk-floor-space" className="cursor-pointer">
                  <span className="block text-xs font-bold text-white">
                    Designates Open Floor / Mat Area
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Enables bodyweight and floor exercises (push-ups, planks, stretches) in any zone where this is placed.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsCreatingNew(false); setEditingItem(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-all shadow-md shadow-lime-500/20 min-h-[44px]"
                >
                  {editingItem ? 'Save Changes' : 'Create Equipment Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Equipment Detail Preview (Picture + Setup Guidance - NO Video) */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-lime-500/10 text-lime-400">
                  {React.createElement(getEquipmentIconComponent(previewItem.icon), { className: 'w-5 h-5' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/20">
                      {previewItem.category}
                    </span>
                    {previewItem.isFloorSpace && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Open Floor Space
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {previewItem.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Equipment Picture */}
              {previewItem.imageUrl ? (
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 max-h-72 flex items-center justify-center">
                  <img 
                    src={previewItem.imageUrl} 
                    alt={previewItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-h-72 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center text-slate-500 flex flex-col items-center justify-center">
                  <Camera className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-xs font-semibold text-slate-400">No equipment photo uploaded yet.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Admin can upload a photo showing how to spot and identify this machine.</p>
                </div>
              )}

              {/* Equipment Identification & Setup Instructions */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-lime-400 uppercase tracking-wider">
                  <Info className="w-4 h-4" />
                  <span>Equipment Identification & Setup Instructions</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {previewItem.description || 'Adjustable gym equipment station. Ensure safety locks and pin heights are securely engaged before loading weight.'}
                </p>
              </div>

              {/* Placed Zones on Gym Map */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>Physical Locations in this Gym:</span>
                </h4>
                {(() => {
                  const placedZones = equipmentZonePlacements.get(previewItem.id) || [];
                  if (placedZones.length === 0) {
                    return (
                      <p className="text-xs text-slate-500 italic">Not placed in any gym zone yet.</p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-2">
                      {placedZones.map(zone => (
                        <div
                          key={zone.id}
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs text-white"
                        >
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: zone.color || '#3b82f6' }}
                          />
                          <span className="font-semibold">{zone.name}</span>
                          <span className="text-[10px] text-slate-500">({zone.type})</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Referenced Exercises Enabled by this Equipment (Names/Muscles only - no duplicate video) */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exercises Enabled by this Equipment ({getEquipmentExerciseCount(previewItem.id, safeExercises, safeEquipmentList)}):</span>
                </h4>
                {(() => {
                  const enabledExercises = safeExercises.filter(ex => 
                    (ex.requiredEquipmentIds || []).includes(previewItem.id) ||
                    (ex.equipmentRequired || '').toLowerCase().includes(previewItem.name.toLowerCase())
                  );

                  if (enabledExercises.length === 0) {
                    return (
                      <p className="text-xs text-slate-500 italic">No exercises currently linked to this equipment in the Exercise Library.</p>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {enabledExercises.map(ex => (
                        <div 
                          key={ex.id}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-white truncate block">{ex.name}</span>
                            <span className="text-[10px] text-slate-400">{ex.targetMuscle}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono flex-shrink-0">
                            {ex.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center flex-shrink-0">
              {!isDrawerMode && (
                <button
                  onClick={() => {
                    const item = previewItem;
                    setPreviewItem(null);
                    handleOpenEditModal(item);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5 min-h-[44px]"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Equipment
                </button>
              )}
              <button
                onClick={() => setPreviewItem(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-colors ml-auto min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Quick Zone Placement Manager */}
      {assigningEquipment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Zone Inventory Placements</h3>
                  <p className="text-[10px] text-slate-400">Place or remove <span className="text-lime-400 font-semibold">{assigningEquipment.name}</span> in zones</p>
                </div>
              </div>
              <button
                onClick={() => setAssigningEquipment(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
              {(gym.zones || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No gym zones created yet. Create zones in the Floor Plan editor first.</p>
              ) : (
                (gym.zones || []).map(zone => {
                  const isPresent = (zone.equipmentIds || []).includes(assigningEquipment.id) ||
                    (zone.machines || []).some(m => m.equipmentId === assigningEquipment.id);

                  return (
                    <div
                      key={zone.id}
                      onClick={() => handleToggleZonePlacement(zone.id, assigningEquipment.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isPresent
                          ? 'bg-lime-500/10 border-lime-500/40 text-white'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: zone.color || '#3b82f6' }}
                        />
                        <div>
                          <span className="text-xs font-bold block">{zone.name}</span>
                          <span className="text-[10px] text-slate-500">{zone.type}</span>
                        </div>
                      </div>

                      <div className={`p-1.5 rounded-lg border ${
                        isPresent
                          ? 'bg-lime-500 text-slate-950 border-lime-500'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setAssigningEquipment(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-500/10">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Delete Equipment Item?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will remove this equipment from the Equipment Library and any associated zone lists.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteItem(deleteConfirmId)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentLibrary;
