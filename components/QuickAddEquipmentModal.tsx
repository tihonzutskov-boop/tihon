import React, { useState, useRef, useMemo } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, MapPin, Sparkles, AlertCircle } from 'lucide-react';
import { EquipmentItem, GymZone } from '../types';
import { api } from '../services/api';
import { CATEGORIES, ICON_OPTIONS, MUSCLE_GROUPS, EquipmentCategoryCombo } from './EquipmentLibrary';

interface QuickAddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetZone?: GymZone | null;
  availableZones?: GymZone[];
  equipmentList?: EquipmentItem[];
  onEquipmentCreated: (equipment: EquipmentItem, zoneId?: string) => void;
}

export const QuickAddEquipmentModal: React.FC<QuickAddEquipmentModalProps> = ({
  isOpen,
  onClose,
  targetZone,
  availableZones = [],
  equipmentList = [],
  onEquipmentCreated,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [quickLabel, setQuickLabel] = useState<string>('');
  const [category, setCategory] = useState<string>('Machines');
  const [icon, setIcon] = useState<string>('Dumbbell');
  const [description, setDescription] = useState<string>('');
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(targetZone?.id || availableZones[0]?.id || '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const allCategories = useMemo(() => {
    const fromItems = equipmentList.map(item => item.category).filter(Boolean) as string[];
    return Array.from(new Set([...CATEGORIES.filter(c => c !== 'All'), ...fromItems])).sort();
  }, [equipmentList]);

  const toggleMuscleGroup = (m: string) => {
    setMuscleGroups(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync target zone when modal opens or changes
  React.useEffect(() => {
    if (targetZone) {
      setSelectedZoneId(targetZone.id);
    } else if (availableZones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(availableZones[0].id);
    }
  }, [targetZone, availableZones]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      setErrorMessage('Please upload a picture of the equipment to continue.');
      return;
    }

    setIsSaving(true);
    try {
      const newId = `eq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const trimmedName = quickLabel.trim();
      const finalName = trimmedName || 'Equipment (Photo)';

      const newEquipment: EquipmentItem = {
        id: newId,
        name: finalName,
        category,
        icon,
        imageUrl: imageUrl,
        description: description.trim(),
        muscleGroups,
        defaultFootprint: { width: 40, height: 40 }
      };

      // Persist to shared Equipment Library database
      await api.createEquipment(newEquipment);

      // Trigger placement callback
      onEquipmentCreated(newEquipment, selectedZoneId || targetZone?.id);

      // Reset state and close
      setImageUrl('');
      setQuickLabel('');
      setCategory('Machines');
      setIcon('Dumbbell');
      setDescription('');
      setMuscleGroups([]);
      setErrorMessage('');
      onClose();
    } catch (err: any) {
      console.error('Failed to create quick equipment item:', err);
      setErrorMessage('Failed to save equipment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentActiveZone = availableZones.find(z => z.id === selectedZoneId) || targetZone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Quick Add Equipment</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-lime-500/10 text-lime-400 border border-lime-500/20">
                  Floor Plan Quick-Add
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a picture to place this equipment immediately on the floor plan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Target Zone Placement Indicator */}
          {currentActiveZone ? (
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-lime-400 flex-shrink-0" />
                <span>Placing into Zone:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {currentActiveZone.name}
                </span>
              </div>
              {availableZones.length > 1 && !targetZone && (
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2 py-1 text-slate-200 focus:border-lime-500 outline-none"
                >
                  {availableZones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Minimal Form: Picture Upload Only */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-lime-400" />
                Equipment Picture *
              </span>
              <span className="text-[10px] text-lime-400/90 lowercase font-normal">
                (only required field)
              </span>
            </label>

            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-lime-500/40 bg-slate-950 aspect-video max-h-56 flex items-center justify-center group shadow-inner">
                <img 
                  src={imageUrl} 
                  alt="Equipment Preview" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-600 transition-all shadow-md"
                  >
                    <Upload className="w-3.5 h-3.5" /> Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                  isDragOver
                    ? 'border-lime-400 bg-lime-500/10 scale-[1.01]'
                    : 'border-slate-700 hover:border-lime-500/60 bg-slate-950/40 hover:bg-slate-950/70'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-lime-400 border border-slate-700/80 flex items-center justify-center mb-3 shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white mb-1">
                  Upload Equipment Photo
                </p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Drag and drop a photo here, or click to browse from your device/camera.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
                  <Sparkles className="w-3 h-3 text-lime-400" />
                  <span>Only a picture is needed right now</span>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Optional Quick Label (Can be left blank) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400">
                Quick Label / Name <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-slate-500">
                Can be filled in later in Equipment Library
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Leg Press, Cable Station, Bench (optional)..."
              value={quickLabel}
              onChange={(e) => setQuickLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500 outline-none transition-all"
            />
          </div>

          {/* Same fields as the full Equipment Library form — all optional here, can also be finished later */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Category
              </label>
              <EquipmentCategoryCombo value={category} categories={allCategories} onChange={setCategory} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Map Icon Badge
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none min-h-[44px]"
              >
                {ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400">
              Muscle Groups Targeted <span className="text-slate-600 font-normal">(Optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(m => {
                const active = muscleGroups.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscleGroup(m)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                      active
                        ? 'bg-lime-500/10 border-lime-500 text-lime-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400">
              Identification & Setup Instructions <span className="text-slate-600 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Describe what this equipment looks like and how to set it up..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 outline-none resize-none"
            />
          </div>

          {/* Information Note */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed space-y-1">
            <p className="flex items-start gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-lime-400 flex-shrink-0 mt-0.5" />
              <span>
                This creates a full Equipment Library record and immediately places it on your map.
              </span>
            </p>
            <p className="text-[10px] text-slate-500 pl-5">
              Anything left blank here can still be filled in anytime from the Equipment Library.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !imageUrl}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-all shadow-md shadow-lime-500/10 min-h-[44px] ${
                isSaving || !imageUrl ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Placing Equipment...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Place & Save to Library</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
