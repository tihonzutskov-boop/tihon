
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GymZone, EquipmentType, Gym, GymDimensions, GymEntrance, GymAnnex, GymMachine, LibraryExercise } from '../types';
import GymMap from './GymMap';
import ExerciseLibrary from './ExerciseLibrary';
import { api } from '../services/api';
import { parseFloorPlan } from '../services/geminiService';
import { ArrowLeft, Plus, Trash2, Move, Maximize2, MousePointer2, Save, Loader2, Check, Edit3, Eraser, Eye, EyeOff, Footprints, MapPin, LayoutTemplate, DoorOpen, Lock, Bath, Droplets, Palette, BoxSelect, SquareDashed, Undo2, Redo2, Scaling, Grid, PlusSquare, ArrowRightLeft, Cpu, ArrowLeftCircle, Copy, ClipboardPaste, Dumbbell, Activity, Zap, Target, Layers, Box, Wind, RotateCcw, ArrowUpRight, ArrowUpLeft, ArrowDownRight, ArrowDownLeft, ArrowRight, ArrowUp, ArrowDown, MoveDown, Circle, Waves, Timer, Sparkles, Search, Video, Play, Film, Filter, X, ExternalLink, Compass, SlidersHorizontal, ChevronRight, Bookmark, BookmarkCheck, AlertTriangle } from 'lucide-react';
import { MACHINE_ICONS_LIST as MACHINE_ICONS } from '../utils/equipmentIcons';
import { snapWallEndpoint } from '../utils/wallSnapping';

interface AdminPageProps {
  gyms: Gym[];
  setGyms: React.Dispatch<React.SetStateAction<Gym[]>>;
  onExit: () => void;
}

const useGymHistory = (initialGym: Gym) => {
  const [past, setPast] = useState<Gym[]>([]);
  const [present, setPresent] = useState<Gym>(initialGym);
  const [future, setFuture] = useState<Gym[]>([]);

  const snapshot = useCallback(() => {
    setPast(prev => [...prev, present]);
    setFuture([]);
  }, [present]);

  const update = useCallback((newGym: Gym, saveToHistory = false) => {
    if (saveToHistory) {
      setPast(prev => [...prev, present]);
      setFuture([]);
    }
    setPresent(newGym);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
    setPast(newPast);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, present]);
    setPresent(next);
    setFuture(newFuture);
  }, [future, present]);

  return { gym: present, update, snapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
};

const GymDashboard: React.FC<{ 
  gyms: Gym[], 
  onCreate: () => void, 
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onExit: () => void 
}> = ({ gyms, onCreate, onEdit, onDelete, onExit }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col animate-in fade-in duration-500">
      <header className="h-20 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-8">
         <div className="flex items-center space-x-4">
            <button onClick={onExit} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Gym Management</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Admin Dashboard</p>
            </div>
         </div>
         <button onClick={onCreate} className="flex items-center px-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-900 rounded-lg text-sm font-bold transition-all shadow-lg shadow-lime-900/20">
            <Plus className="w-5 h-5 mr-2" />
            Add New Gym
          </button>
      </header>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {gyms.map(gym => (
            <div key={gym.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 hover:shadow-2xl transition-all group flex flex-col">
               <div className="h-40 bg-slate-950/50 border-b border-slate-800 relative">
                  <div className="absolute inset-0 p-4 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                    <GymMap zones={gym.zones} dimensions={gym.dimensions} entrance={gym.entrance} floorColor={gym.floorColor} annexes={gym.annexes} isThumbnail={true} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />
               </div>
               <div className="p-6 flex-1 flex flex-col">
                 <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-bold text-white leading-tight">{gym.name}</h3>
                   <div className="flex space-x-1">
                      <button onClick={() => onEdit(gym.id)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(gym.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 </div>
                 <div className="flex items-center text-sm text-slate-400 mb-6 mt-auto">
                    <MapPin className="w-4 h-4 mr-1.5 text-slate-500" />
                    <span>{gym.zones.length} Active Zones</span>
                 </div>
                 <button onClick={() => onEdit(gym.id)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm transition-colors flex items-center justify-center border border-slate-700 group-hover:border-slate-600">
                   Open Floor Editor
                 </button>
               </div>
            </div>
          ))}
          <button onClick={onCreate} className="border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-lime-500 hover:border-lime-500/30 hover:bg-slate-900/50 transition-all min-h-[300px]">
             <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 shadow-inner"><Plus className="w-8 h-8" /></div>
             <span className="font-semibold">Create New Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface GymLayoutEditorProps { initialGym: Gym; onSave: (updatedGym: Gym) => Promise<void>; onBack: () => void; }

interface DragState {
  mode: 'move-zone' | 'resize-zone' | 'resize-room' | 'move-annex' | 'resize-annex' | 'move-machine' | 'resize-machine' | 'move-wall' | 'resize-wall-p1' | 'resize-wall-p2' | 'adjust-wall-curve';
  itemId: string | 'main-room';
  zoneId?: string;
  startX: number;
  startY: number;
  initialData: { x: number; y: number; width: number; height: number; };
  initialWallData?: { x1: number; y1: number; x2: number; y2: number; controlX?: number; controlY?: number; };
  handle?: 'right' | 'bottom' | 'top' | 'left' | 'corner' | 'se' | 'sw' | 'ne' | 'nw';
  viewParams?: { viewBox: string, offsetX: number, offsetY: number, width: number, height: number };
}

const ToolButton = ({ active, onClick, icon: Icon, label, description, disabled = false, variant = 'default' }: { active?: boolean, onClick: () => void, icon: any, label: string, description?: string, disabled?: boolean, variant?: 'default' | 'action' | 'highlight' }) => {
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 border text-left group mb-2 ${active ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : variant === 'highlight' ? 'bg-lime-500/10 border-lime-500/20 text-lime-400 hover:bg-lime-500/20' : variant === 'action' ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className={`p-2 rounded-lg mr-3 flex-shrink-0 transition-colors ${active ? 'bg-blue-500 text-white' : variant === 'highlight' ? 'bg-lime-500/20' : 'bg-slate-900 group-hover:bg-slate-800'}`}><Icon className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{label}</div>
        {description && <div className={`text-[10px] truncate ${active ? 'text-blue-200' : 'text-slate-500'}`}>{description}</div>}
      </div>
    </button>
  );
};

const GymLayoutEditor: React.FC<GymLayoutEditorProps> = ({ initialGym, onSave, onBack }) => {
  const { gym, update, snapshot, undo, redo, canUndo, canRedo } = useGymHistory(initialGym);
  const zones = gym.zones;
  const dimensions = gym.dimensions || { width: 780, height: 580 };
  const entrance = gym.entrance || { side: 'bottom', offset: 50, width: 80 };
  const floorColor = gym.floorColor || '#1e293b';
  const annexes = gym.annexes || [];

  const [editMode, setEditMode] = useState<'layout' | 'room' | 'machine'>('layout');
  const [selectedWorkspaceOption, setSelectedWorkspaceOption] = useState<'layout' | 'room' | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [selectedAnnexId, setSelectedAnnexId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipboard, setClipboard] = useState<{ type: 'zone' | 'machine', data: any } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

  // AI Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processUploadedFile = async (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setImportError('Unsupported file format. Please upload a PDF, PNG, or JPG file.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportStatus('Reading uploaded file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          throw new Error('Could not read file data.');
        }

        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) {
          throw new Error('Invalid file encoding.');
        }
        const base64Data = dataUrl.slice(commaIndex + 1);

        setImportStatus('AI is analyzing room boundaries, doors, and walls...');
        const parsedData = await parseFloorPlan(base64Data, file.type);

        if (!parsedData || parsedData.error) {
          throw new Error(parsedData?.error || 'AI analysis failed or confidence was too low.');
        }

        setImportStatus('Converting layout coordinates & mapping equipment...');

        const parsedDimensions = parsedData.dimensions || { width: 780, height: 580 };
        const parsedWalls = (parsedDimensions.walls || []).map((w: any) => ({
          id: w.id || `wall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: w.type === 'curved' ? 'curved' : 'straight',
          wallType: w.wallType || 'exterior',
          x1: Number(w.x1) || 0,
          y1: Number(w.y1) || 0,
          x2: Number(w.x2) || 0,
          y2: Number(w.y2) || 0,
          controlX: w.controlX !== undefined ? Number(w.controlX) : undefined,
          controlY: w.controlY !== undefined ? Number(w.controlY) : undefined,
          thickness: Number(w.thickness) || 8,
          confidence: w.confidence || 'high'
        }));

        // Convert the parsed JSON into our app's Gym model, ensuring IDs are generated
        const generatedGym: Gym = {
          ...gym,
          name: parsedData.name || gym.name,
          dimensions: {
            width: Number(parsedDimensions.width) || 780,
            height: Number(parsedDimensions.height) || 580,
            walls: parsedWalls
          },
          entrance: parsedData.entrance || { side: 'bottom', offset: 50, width: 80 },
          zones: (parsedData.zones || []).map((z: any) => {
            const zoneId = `zone-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            return {
              id: zoneId,
              name: z.name || 'Training Zone',
              type: z.type || 'Machine',
              x: Number(z.x) || 50,
              y: Number(z.y) || 50,
              width: Number(z.width) || 150,
              height: Number(z.height) || 150,
              color: z.color || '#3b82f6',
              icon: z.icon || 'Activity',
              description: z.description || '',
              machines: (z.machines || []).map((m: any) => ({
                id: `mach-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: m.name || 'Machine',
                x: Number(m.x) || 10,
                y: Number(m.y) || 10,
                width: Number(m.width) || 40,
                height: Number(m.height) || 40,
                icon: m.icon || 'Activity',
                longDescription: m.longDescription || '',
                status: m.status || 'active'
              }))
            };
          }),
          annexes: (parsedData.annexes || []).map((a: any) => ({
            id: `annex-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            x: Number(a.x) || 0,
            y: Number(a.y) || 0,
            width: Number(a.width) || 150,
            height: Number(a.height) || 150
          }))
        };

        // Reset inputs
        setWidthInput((generatedGym.dimensions!.width / 10).toString());
        setHeightInput((generatedGym.dimensions!.height / 10).toString());

        // Update editor state (save to history so user can undo!)
        update(generatedGym, true);

        // Instantly focus on floor plan editor so the user can review and edit
        setEditMode('room');
        setSelectedWorkspaceOption('room');
        setSelectedZoneId(null);

        setIsImporting(false);
        setImportStatus('');
      } catch (err: any) {
        console.error('Import processing error:', err);
        setImportError(
          err.message || 
          'The uploaded file is too low quality or complex to be analyzed. Please upload a higher-quality, clearer version.'
        );
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file. Please try again with a different image.');
      setIsImporting(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const triggerImportFlow = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processUploadedFile(file);
    }
  };

  // Active view tab: 'layout' for map designer, 'exercises' for exercise & video library
  const [activeTab, setActiveTab] = useState<'layout' | 'exercises'>('layout');

  // Exercise library state for floor-plan machine placements
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [saveToLibraryStatus, setSaveToLibraryStatus] = useState<'idle' | 'saved' | 'exists'>('idle');

  const [widthInput, setWidthInput] = useState<string>((dimensions.width / 10).toString());
  const [heightInput, setHeightInput] = useState<string>((dimensions.height / 10).toString());

  useEffect(() => {
    const currentVal = parseFloat(widthInput);
    if (isNaN(currentVal) || currentVal !== dimensions.width / 10) {
      setWidthInput((dimensions.width / 10).toString());
    }
  }, [dimensions.width]);

  useEffect(() => {
    const currentVal = parseFloat(heightInput);
    if (isNaN(currentVal) || currentVal !== dimensions.height / 10) {
      setHeightInput((dimensions.height / 10).toString());
    }
  }, [dimensions.height]);

  const handleWidthChange = (val: string) => {
    setWidthInput(val);
    const meters = parseFloat(val);
    if (!isNaN(meters) && meters > 0) {
      const pixels = Math.round(meters * 10);
      update({ ...gym, dimensions: { ...dimensions, width: Math.max(10, Math.min(2500, pixels)) } }, false);
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightInput(val);
    const meters = parseFloat(val);
    if (!isNaN(meters) && meters > 0) {
      const pixels = Math.round(meters * 10);
      update({ ...gym, dimensions: { ...dimensions, height: Math.max(10, Math.min(2500, pixels)) } }, false);
    }
  };

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const fetched = await api.fetchExercises();
        setLibraryExercises(fetched);
      } catch (err) {
        console.error("Failed loading exercises inside AdminPage:", err);
      }
    };
    loadExercises();
  }, [activeTab]);

  const filteredSidebarExercises = libraryExercises.filter(ex => {
    if (!sidebarSearchQuery) return true;
    const query = sidebarSearchQuery.toLowerCase();
    return (
      (ex.name || '').toLowerCase().includes(query) ||
      (ex.equipmentRequired || '').toLowerCase().includes(query) ||
      (ex.targetMuscle || '').toLowerCase().includes(query) ||
      (ex.category || '').toLowerCase().includes(query)
    );
  });

  const addMachine = useCallback(() => {
    if (!selectedZone) return;
    const newMachine: GymMachine = { id: `machine-${Date.now()}`, name: 'Machine', x: 10, y: 10, width: 40, height: 40, icon: 'Dumbbell' };
    const newZones = gym.zones.map(z => {
      if (z.id === selectedZone.id) return { ...z, machines: [...(z.machines || []), newMachine] };
      return z;
    });
    update({ ...gym, zones: newZones }, true);
    setSelectedMachineId(newMachine.id);
  }, [gym, selectedZone, update]);

  const addMachineFromLibrary = useCallback((ex: LibraryExercise) => {
    if (!selectedZone) return;
    
    let defaultIcon = 'Dumbbell';
    const categoryLow = (ex.category || '').toLowerCase();
    const muscleLow = (ex.targetMuscle || '').toLowerCase();
    if (categoryLow.includes('cardio') || muscleLow.includes('cardio')) {
      defaultIcon = 'Activity';
    } else if (categoryLow.includes('mobility') || categoryLow.includes('stretch')) {
      defaultIcon = 'Wind';
    } else if (categoryLow.includes('functional') || categoryLow.includes('athlete')) {
      defaultIcon = 'Zap';
    } else if (muscleLow.includes('core')) {
      defaultIcon = 'Target';
    } else if (ex.equipmentRequired?.toLowerCase().includes('rack') || ex.equipmentRequired?.toLowerCase().includes('rig')) {
      defaultIcon = 'Layers';
    } else if (ex.equipmentRequired?.toLowerCase().includes('box') || ex.equipmentRequired?.toLowerCase().includes('bench')) {
      defaultIcon = 'Box';
    }

    const existingMachines = selectedZone.machines || [];
    const offset = existingMachines.length * 15;
    const x = Math.min(selectedZone.width - 45, 10 + (offset % (selectedZone.width - 50 || 100)));
    const y = Math.min(selectedZone.height - 45, 10 + (Math.floor(offset / (selectedZone.width - 50 || 100)) * 15));

    const newMachine: GymMachine = {
      id: `machine-${Date.now()}`,
      name: ex.name,
      x: Math.max(5, x),
      y: Math.max(5, y),
      width: 40,
      height: 40,
      icon: defaultIcon,
      longDescription: ex.instructions || '',
      videoUrl: ex.videoUrl || ''
    };

    const newZones = gym.zones.map(z => {
      if (z.id === selectedZone.id) return { ...z, machines: [...existingMachines, newMachine] };
      return z;
    });

    update({ ...gym, zones: newZones }, true);
    setSelectedMachineId(newMachine.id);

    // Persist mapped equipmentId back to library if unmapped or has different zone
    if (ex.equipmentId !== selectedZone.id) {
       const updatedEx = { ...ex, equipmentId: selectedZone.id };
       api.saveExercise(updatedEx).catch(e => console.error("Auto mapping error:", e));
       setLibraryExercises(prev => prev.map(item => item.id === ex.id ? updatedEx : item));
    }
  }, [gym, selectedZone, update]);

  const saveMachineToLibrary = useCallback(async () => {
    if (!selectedZone || !selectedMachineId) return;
    const currentMachine = (selectedZone.machines || []).find(m => m.id === selectedMachineId);
    if (!currentMachine || !currentMachine.name?.trim()) return;

    const trimmedName = currentMachine.name.trim();

    // Check if exercise with this name already exists in library (case-insensitive)
    const existingIndex = libraryExercises.findIndex(
      e => e.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    setSavingToLibrary(true);
    try {
      if (existingIndex !== -1) {
        // Update existing library exercise with any new instructions, video URL, equipment mapping
        const existing = libraryExercises[existingIndex];
        const updatedExercise: LibraryExercise = {
          ...existing,
          name: trimmedName,
          equipmentRequired: trimmedName,
          equipmentId: selectedZone.id,
          instructions: currentMachine.longDescription || existing.instructions || '',
          videoUrl: currentMachine.videoUrl || existing.videoUrl || ''
        };
        await api.saveExercise(updatedExercise);
        setLibraryExercises(prev => prev.map(item => item.id === existing.id ? updatedExercise : item));
        setSaveToLibraryStatus('exists');
      } else {
        // Create new library exercise entry
        let category: any = 'Strength';
        const iconName = (currentMachine.icon || '').toLowerCase();
        if (iconName.includes('activity') || iconName.includes('treadmill') || iconName.includes('bike') || iconName.includes('rower') || iconName.includes('elliptical') || iconName.includes('stair') || iconName.includes('ski')) {
          category = 'Cardio';
        } else if (iconName.includes('wind') || iconName.includes('stretch') || iconName.includes('mat')) {
          category = 'Mobility';
        }

        const newExercise: LibraryExercise = {
          id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: trimmedName,
          category,
          targetMuscle: selectedZone.name || 'Full Body',
          equipmentRequired: trimmedName,
          equipmentId: selectedZone.id,
          instructions: currentMachine.longDescription || `Standard training on ${trimmedName}`,
          videoUrl: currentMachine.videoUrl || ''
        };
        await api.createExercise(newExercise);
        setLibraryExercises(prev => [newExercise, ...prev]);
        setSaveToLibraryStatus('saved');
      }

      setTimeout(() => {
        setSaveToLibraryStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('Failed saving machine to library:', err);
    } finally {
      setSavingToLibrary(false);
    }
  }, [selectedZone, selectedMachineId, libraryExercises]);

  const deleteMachine = useCallback(() => {
    if (!selectedZone || !selectedMachineId) return;
    const newZones = gym.zones.map(z => {
      if (z.id === selectedZone.id) return { ...z, machines: (z.machines || []).filter(m => m.id !== selectedMachineId) };
      return z;
    });
    update({ ...gym, zones: newZones }, true);
    setSelectedMachineId(null);
  }, [selectedZone, selectedMachineId, gym, update]);

  const deleteZone = useCallback(() => {
    if (!selectedZoneId) return;
    update({ ...gym, zones: gym.zones.filter(z => z.id !== selectedZoneId) }, true);
    setSelectedZoneId(null);
  }, [selectedZoneId, gym, update]);

  const duplicateAnnex = useCallback((id: string) => {
    const target = (gym.annexes || []).find(a => a.id === id);
    if (!target) return;
    const newAnnex: GymAnnex = {
      ...target,
      id: `annex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name || 'Extension'} (Copy)`,
      x: target.x + 30,
      y: target.y + 30
    };
    update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true);
    setSelectedAnnexId(newAnnex.id);
  }, [gym, update]);

  const deleteAnnex = useCallback((id: string) => {
    update({ ...gym, annexes: (gym.annexes || []).filter(a => a.id !== id) }, true);
    if (selectedAnnexId === id) setSelectedAnnexId(null);
  }, [gym, selectedAnnexId, update]);

  const deleteSelectedWall = useCallback(() => {
    if (!selectedWallId) return;
    const walls = dimensions.walls || [];
    const newWalls = walls.filter(w => w.id !== selectedWallId);
    update({
      ...gym,
      dimensions: {
        ...dimensions,
        walls: newWalls
      }
    }, true);
    setSelectedWallId(null);
  }, [selectedWallId, dimensions, gym, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
         e.preventDefault();
         if (editMode === 'layout' && selectedZone) setClipboard({ type: 'zone', data: selectedZone });
         else if (editMode === 'machine' && selectedMachineId && selectedZone) {
             const m = selectedZone.machines?.find(m => m.id === selectedMachineId);
             if (m) setClipboard({ type: 'machine', data: m });
         } else if (editMode === 'room' && selectedAnnexId) {
             const a = (gym.annexes || []).find(an => an.id === selectedAnnexId);
             if (a) setClipboard({ type: 'annex', data: a });
         }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
         e.preventDefault(); if (!clipboard) return;
         if (clipboard.type === 'zone' && editMode === 'layout') {
             const newZone = { ...clipboard.data, id: `zone-copy-${Date.now()}`, name: `${clipboard.data.name} (Copy)`, x: clipboard.data.x + 20, y: clipboard.data.y + 20 };
             update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
         } else if (clipboard.type === 'machine' && editMode === 'machine' && selectedZone) {
             const newMachine = { ...clipboard.data, id: `machine-copy-${Date.now()}`, name: `${clipboard.data.name} (Copy)`, x: clipboard.data.x + 10, y: clipboard.data.y + 10 };
             const newZones = gym.zones.map(z => { if (z.id === selectedZone.id) return { ...z, machines: [...(z.machines || []), newMachine] }; return z; });
             update({ ...gym, zones: newZones }, true); setSelectedMachineId(newMachine.id);
         } else if (clipboard.type === 'annex' && editMode === 'room') {
             const newAnnex = { ...clipboard.data, id: `annex-copy-${Date.now()}`, name: `${clipboard.data.name} (Copy)`, x: clipboard.data.x + 20, y: clipboard.data.y + 20 };
             update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true); setSelectedAnnexId(newAnnex.id);
         }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (editMode === 'machine' && selectedMachineId) { e.preventDefault(); deleteMachine(); }
        else if (selectedZoneId && editMode === 'layout') { e.preventDefault(); deleteZone(); }
        else if (selectedAnnexId && editMode === 'room') { e.preventDefault(); deleteAnnex(selectedAnnexId); }
        else if (selectedWallId && editMode === 'room') { e.preventDefault(); deleteSelectedWall(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, clipboard, editMode, selectedZoneId, selectedMachineId, selectedAnnexId, selectedWallId, gym, update, selectedZone, deleteZone, deleteMachine, deleteAnnex, deleteSelectedWall]);

  const handleZoneClick = (zone: GymZone) => { if (!dragState && editMode === 'layout') setSelectedZoneId(zone.id); };
  const handleMapClick = () => {
    if (!dragState) {
      if (editMode === 'machine') setSelectedMachineId(null);
      else if (editMode === 'room') setSelectedAnnexId(null);
      else setSelectedZoneId(null);
    }
  };
  const updateZone = (field: keyof GymZone, value: any) => { if (!selectedZoneId) return; const newZones = gym.zones.map(z => z.id === selectedZoneId ? { ...z, [field]: value } : z); update({ ...gym, zones: newZones }, false); };
  
  const addNewZone = () => {
    const newZone: GymZone = { id: `zone-new-${Date.now()}`, name: 'New Area', type: EquipmentType.FUNCTIONAL, x: Math.min(100, dimensions.width / 2 - 50), y: Math.min(100, dimensions.height / 2 - 50), width: 100, height: 100, color: '#84cc16', icon: 'Square', description: '', machines: [] };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addCorridor = () => {
    const newZone: GymZone = { id: `zone-corridor-${Date.now()}`, name: 'Corridor', type: EquipmentType.CORRIDOR, x: 50, y: 50, width: 200, height: 40, color: '#64748b', icon: 'Footprints', description: 'Main walkway', machines: [] };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addReception = () => {
    const newZone: GymZone = { 
      id: `zone-reception-${Date.now()}`, 
      name: 'Front Desk & Reception', 
      type: EquipmentType.RECEPTION, 
      x: 60, y: 60, width: 160, height: 60, 
      color: '#8b5cf6', 
      icon: 'DoorOpen', 
      description: 'Main gym entrance, staff desk, check-in & member assistance.', 
      machines: [
        { id: `m-reception-${Date.now()}`, name: 'Front Desk Counter', x: 10, y: 10, width: 140, height: 40, icon: 'DoorOpen', longDescription: 'Check-in counter and reception desk.' }
      ] 
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addLockers = () => {
    const newZone: GymZone = { 
      id: `zone-lockers-${Date.now()}`, 
      name: 'Locker Rooms', 
      type: EquipmentType.CHANGING, 
      x: 60, y: 60, width: 130, height: 90, 
      color: '#a855f7', 
      icon: 'Lock', 
      description: 'Secure lockers, changing stalls & benches.', 
      machines: [
        { id: `m-lockers-${Date.now()}`, name: 'Locker Bank', x: 10, y: 10, width: 110, height: 35, icon: 'Lock', longDescription: 'Member storage lockers.' }
      ] 
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addRestrooms = () => {
    const newZone: GymZone = { 
      id: `zone-restrooms-${Date.now()}`, 
      name: 'Restrooms & Bathrooms', 
      type: EquipmentType.TOILETS, 
      x: 60, y: 60, width: 120, height: 90, 
      color: '#6366f1', 
      icon: 'Bath', 
      description: 'Clean restrooms, showers & sinks.', 
      machines: [
        { id: `m-bath-${Date.now()}`, name: 'Restroom Facility', x: 10, y: 10, width: 100, height: 35, icon: 'Bath', longDescription: 'Restrooms & private shower stalls.' }
      ] 
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addWaterStation = () => {
    const newZone: GymZone = { 
      id: `zone-water-${Date.now()}`, 
      name: 'Water Station', 
      type: EquipmentType.FACILITY, 
      x: 60, y: 60, width: 70, height: 70, 
      color: '#06b6d4', 
      icon: 'Droplets', 
      description: 'Filtered water refill fountain & cup dispenser.', 
      machines: [
        { id: `m-water-${Date.now()}`, name: 'Water Fountain', x: 10, y: 10, width: 50, height: 50, icon: 'Droplets', longDescription: 'Filtered cold water refill fountain.' }
      ] 
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };
  
  const addAnnex = (placement: 'right' | 'left' | 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom' = 'right') => {
    let x = dimensions.width;
    let y = 0;
    const width = 200;
    const height = 200;
    const existingCount = (gym.annexes || []).length;
    let defaultName = `Extension ${existingCount + 1}`;

    if (placement === 'right') {
      x = dimensions.width;
      y = Math.max(0, Math.round((dimensions.height - height) / 2 / 10) * 10);
      defaultName = `East Wing (Right)`;
    } else if (placement === 'left') {
      x = -width;
      y = Math.max(0, Math.round((dimensions.height - height) / 2 / 10) * 10);
      defaultName = `West Wing (Left)`;
    } else if (placement === 'top') {
      x = Math.max(0, Math.round((dimensions.width - width) / 2 / 10) * 10);
      y = -height;
      defaultName = `North Wing (Top)`;
    } else if (placement === 'bottom') {
      x = Math.max(0, Math.round((dimensions.width - width) / 2 / 10) * 10);
      y = dimensions.height;
      defaultName = `South Wing (Bottom)`;
    } else if (placement === 'top-right') {
      x = dimensions.width;
      y = 0;
      defaultName = `Top-Right Wing`;
    } else if (placement === 'top-left') {
      x = -width;
      y = 0;
      defaultName = `Top-Left Wing`;
    } else if (placement === 'bottom-right') {
      x = dimensions.width;
      y = Math.max(0, dimensions.height - height);
      defaultName = `Bottom-Right Wing`;
    } else if (placement === 'bottom-left') {
      x = -width;
      y = Math.max(0, dimensions.height - height);
      defaultName = `Bottom-Left Wing`;
    } else if (placement === 'custom') {
      x = Math.round((dimensions.width / 4) / 10) * 10;
      y = -height;
      defaultName = `Custom Extension`;
    }

    const newAnnex: GymAnnex = {
      id: `annex-${Date.now()}`,
      name: defaultName,
      x,
      y,
      width,
      height
    };
    update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true);
    setSelectedAnnexId(newAnnex.id);
  };

  const updateAnnexProperty = (id: string, field: keyof GymAnnex, value: any, recordHistory = false) => {
    const newAnnexes = (gym.annexes || []).map(a => a.id === id ? { ...a, [field]: value } : a);
    update({ ...gym, annexes: newAnnexes }, recordHistory);
  };

  const alignAnnex = (id: string, alignTo: 'east' | 'west' | 'north' | 'south' | 'center-x' | 'center-y') => {
    const target = (gym.annexes || []).find(a => a.id === id);
    if (!target) return;
    let newX = target.x;
    let newY = target.y;

    if (alignTo === 'east') {
      newX = dimensions.width;
    } else if (alignTo === 'west') {
      newX = -target.width;
    } else if (alignTo === 'north') {
      newY = -target.height;
    } else if (alignTo === 'south') {
      newY = dimensions.height;
    } else if (alignTo === 'center-x') {
      newX = Math.round((dimensions.width - target.width) / 2 / 10) * 10;
    } else if (alignTo === 'center-y') {
      newY = Math.round((dimensions.height - target.height) / 2 / 10) * 10;
    }

    const newAnnexes = (gym.annexes || []).map(a => a.id === id ? { ...a, x: newX, y: newY } : a);
    update({ ...gym, annexes: newAnnexes }, true);
  };

  const handleSave = async () => { setSaveState('saving'); await onSave(gym); setSaveState('saved'); setTimeout(() => setSaveState('idle'), 2000); };

  const calculateViewParams = (focusedZoneId: string | null = null) => {
    let viewBoxWidth, viewBoxHeight, offsetX, offsetY;
    const PADDING = 150; const minViewWidth = 800; const minViewHeight = 600;
    if (focusedZoneId) {
        const zone = zones.find(z => z.id === focusedZoneId);
        if (zone) {
            const ZOOM_PADDING = 40; const MIN_VIEW_SIZE = 500;
            const targetWidth = zone.width + (ZOOM_PADDING * 2); const targetHeight = zone.height + (ZOOM_PADDING * 2);
            viewBoxWidth = Math.max(targetWidth, MIN_VIEW_SIZE); viewBoxHeight = Math.max(targetHeight, MIN_VIEW_SIZE);
            offsetX = ((viewBoxWidth - zone.width) / 2) - zone.x; offsetY = ((viewBoxHeight - zone.height) / 2) - zone.y;
        } else { viewBoxWidth = 800; viewBoxHeight = 600; offsetX = 0; offsetY = 0; }
    } else {
        let minX = 0;
        let minY = 0;
        let maxX = dimensions.width;
        let maxY = dimensions.height;
        
        annexes.forEach(a => {
            minX = Math.min(minX, a.x);
            minY = Math.min(minY, a.y);
            maxX = Math.max(maxX, a.x + a.width);
            maxY = Math.max(maxY, a.y + a.height);
        });
        
        zones.forEach(z => {
            minX = Math.min(minX, z.x);
            minY = Math.min(minY, z.y);
            maxX = Math.max(maxX, z.x + z.width);
            maxY = Math.max(maxY, z.y + z.height);
        });
        
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        
        viewBoxWidth = Math.max(minViewWidth, totalWidth + PADDING);
        viewBoxHeight = Math.max(minViewHeight, totalHeight + PADDING);
        offsetX = ((viewBoxWidth - totalWidth) / 2) - minX;
        offsetY = ((viewBoxHeight - totalHeight) / 2) - minY;
    }
    return { viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`, offsetX, offsetY, width: viewBoxWidth, height: viewBoxHeight };
  }

  const handleZoneDragStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return; e.preventDefault(); snapshot(); setSelectedZoneId(zone.id);
    setDragState({ mode: 'move-zone', itemId: zone.id, startX: e.clientX, startY: e.clientY, initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height }, viewParams: calculateViewParams(null) });
  };

  const handleZoneResizeStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return; e.preventDefault(); snapshot(); setSelectedZoneId(zone.id);
    setDragState({ mode: 'resize-zone', itemId: zone.id, startX: e.clientX, startY: e.clientY, initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height }, viewParams: calculateViewParams(null) });
  };
  
  const handleMainRoomResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'corner') => {
    if (editMode !== 'room') return; e.preventDefault(); snapshot();
    setDragState({ mode: 'resize-room', itemId: 'main-room', startX: e.clientX, startY: e.clientY, initialData: { x: 0, y: 0, width: dimensions.width, height: dimensions.height }, handle, viewParams: calculateViewParams(null) });
  };

  const handleAnnexDragStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return; e.preventDefault(); snapshot(); setSelectedAnnexId(annex.id);
    setDragState({ mode: 'move-annex', itemId: annex.id, startX: e.clientX, startY: e.clientY, initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }, viewParams: calculateViewParams(null) });
  };

  const handleAnnexResizeStart = (e: React.MouseEvent, annex: GymAnnex, handle: 'se' | 'sw' | 'ne' | 'nw' | 'right' | 'bottom' | 'top' | 'left' | 'corner' = 'se') => {
    if (editMode !== 'room') return; e.preventDefault(); snapshot(); setSelectedAnnexId(annex.id);
    setDragState({ mode: 'resize-annex', itemId: annex.id, startX: e.clientX, startY: e.clientY, initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }, handle, viewParams: calculateViewParams(null) });
  };

  const handleMachineDragStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return; e.preventDefault(); snapshot(); setSelectedMachineId(machine.id);
    setDragState({ mode: 'move-machine', itemId: machine.id, zoneId: zoneId, startX: e.clientX, startY: e.clientY, initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height }, viewParams: calculateViewParams(zoneId) });
  }

  const handleMachineResizeStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return; e.preventDefault(); snapshot(); setSelectedMachineId(machine.id);
    setDragState({ mode: 'resize-machine', itemId: machine.id, zoneId: zoneId, startX: e.clientX, startY: e.clientY, initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height }, viewParams: calculateViewParams(zoneId) });
  }

  const handleWallDragStart = (e: React.MouseEvent, wallId: string, handle: 'p1' | 'p2' | 'control' | 'move') => {
    if (editMode !== 'room') return; e.preventDefault(); snapshot(); setSelectedWallId(wallId);
    const wall = (dimensions.walls || []).find(w => w.id === wallId);
    if (!wall) return;

    let mode: DragState['mode'] = 'move-wall';
    if (handle === 'p1') mode = 'resize-wall-p1';
    else if (handle === 'p2') mode = 'resize-wall-p2';
    else if (handle === 'control') mode = 'adjust-wall-curve';

    setDragState({
      mode,
      itemId: wallId,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: 0, y: 0, width: 0, height: 0 },
      initialWallData: {
        x1: wall.x1,
        y1: wall.y1,
        x2: wall.x2,
        y2: wall.y2,
        controlX: wall.controlX,
        controlY: wall.controlY
      },
      viewParams: calculateViewParams(null)
    });
  };

  const addStraightWall = () => {
    snapshot();
    const walls = dimensions.walls || [];
    const p1Snap = snapWallEndpoint({ x: 150, y: 150 }, walls, { snapThreshold: 25 });
    const p2Snap = snapWallEndpoint({ x: 350, y: 150 }, walls, { snapThreshold: 25, referenceStartPoint: { x: p1Snap.x, y: p1Snap.y } });

    const newWall = {
      id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'straight' as const,
      wallType: 'exterior' as const,
      x1: p1Snap.x,
      y1: p1Snap.y,
      x2: p2Snap.x,
      y2: p2Snap.y,
      thickness: 8,
      confidence: 'high' as const
    };
    update({
      ...gym,
      dimensions: {
        ...dimensions,
        walls: [...walls, newWall]
      }
    }, true);
    setSelectedWallId(newWall.id);
  };

  const addCurvedWall = () => {
    snapshot();
    const walls = dimensions.walls || [];
    const p1Snap = snapWallEndpoint({ x: 150, y: 250 }, walls, { snapThreshold: 25 });
    const p2Snap = snapWallEndpoint({ x: 350, y: 250 }, walls, { snapThreshold: 25, referenceStartPoint: { x: p1Snap.x, y: p1Snap.y } });

    const newWall = {
      id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'curved' as const,
      wallType: 'exterior' as const,
      x1: p1Snap.x,
      y1: p1Snap.y,
      x2: p2Snap.x,
      y2: p2Snap.y,
      controlX: (p1Snap.x + p2Snap.x) / 2,
      controlY: Math.min(p1Snap.y, p2Snap.y) - 50,
      thickness: 8,
      confidence: 'high' as const
    };
    update({
      ...gym,
      dimensions: {
        ...dimensions,
        walls: [...walls, newWall]
      }
    }, true);
    setSelectedWallId(newWall.id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !mapContainerRef.current) return;
      let scaleX = 1, scaleY = 1;
      if (dragState.viewParams) { const rect = mapContainerRef.current.getBoundingClientRect(); scaleX = dragState.viewParams.width / rect.width; scaleY = dragState.viewParams.height / rect.height; }
      const deltaX = (e.clientX - dragState.startX) * scaleX, deltaY = (e.clientY - dragState.startY) * scaleY;
      const snapToGrid = (val: number) => Math.round(val / 10) * 10;
      const SNAP_THRESHOLD = 15;
      const getSnapLines = () => { const xLines = [0, dimensions.width], yLines = [0, dimensions.height]; annexes.forEach(a => { xLines.push(a.x, a.x + a.width); yLines.push(a.y, a.y + a.height); }); return { xLines, yLines }; };
      const snapToEdges = (val: number, lines: number[]) => { let best = null, minDiff = SNAP_THRESHOLD; for (const line of lines) { const diff = Math.abs(val - line); if (diff < minDiff) { minDiff = diff; best = line; } } return best; };
      const { xLines, yLines } = getSnapLines();

      if (dragState.mode === 'move-zone') {
        const newZones = gym.zones.map(z => {
          if (z.id !== dragState.itemId) return z;
          let rawX = dragState.initialData.x + deltaX, rawY = dragState.initialData.y + deltaY;
          const w = dragState.initialData.width, h = dragState.initialData.height;
          let finalX = rawX, snapLeft = snapToEdges(rawX, xLines);
          if (snapLeft !== null) finalX = snapLeft; else { const snapRight = snapToEdges(rawX + w, xLines); if (snapRight !== null) finalX = snapRight - w; else finalX = snapToGrid(rawX); }
          let finalY = rawY, snapTop = snapToEdges(rawY, yLines);
          if (snapTop !== null) finalY = snapTop; else { const snapBottom = snapToEdges(rawY + h, yLines); if (snapBottom !== null) finalY = snapBottom - h; else finalY = snapToGrid(rawY); }
          return { ...z, x: Math.max(0, finalX), y: Math.max(0, finalY) };
        });
        update({ ...gym, zones: newZones }, false);
      } else if (dragState.mode === 'resize-zone') {
        const newZones = gym.zones.map(z => {
          if (z.id !== dragState.itemId) return z;
          let rawWidth = dragState.initialData.width + deltaX, rawHeight = dragState.initialData.height + deltaY;
          if (e.shiftKey) { const ratio = dragState.initialData.width / dragState.initialData.height; if (Math.abs(deltaX) > Math.abs(deltaY)) rawHeight = rawWidth / ratio; else rawWidth = rawHeight * ratio; return { ...z, width: Math.max(40, snapToGrid(rawWidth)), height: Math.max(40, snapToGrid(rawHeight)) }; }
          const currentX = dragState.initialData.x, targetRight = currentX + rawWidth, snapRight = snapToEdges(targetRight, xLines), finalWidth = snapRight !== null ? snapRight - currentX : snapToGrid(rawWidth);
          const currentY = dragState.initialData.y, targetBottom = currentY + rawHeight, snapBottom = snapToEdges(targetBottom, yLines), finalHeight = snapBottom !== null ? snapBottom - currentY : snapToGrid(rawHeight);
          return { ...z, width: Math.max(40, finalWidth), height: Math.max(40, finalHeight) };
        });
        update({ ...gym, zones: newZones }, false);
      } else if (dragState.mode === 'resize-room') {
         let newW = dragState.initialData.width, newH = dragState.initialData.height;
         if (dragState.handle === 'right' || dragState.handle === 'corner') newW = snapToGrid(dragState.initialData.width + deltaX);
         if (dragState.handle === 'bottom' || dragState.handle === 'corner') newH = snapToGrid(dragState.initialData.height + deltaY);
         update({ ...gym, dimensions: { width: Math.max(200, Math.min(2000, newW)), height: Math.max(200, Math.min(2000, newH)) } }, false);
      } else if (dragState.mode === 'move-annex') {
        const w = dragState.initialData.width;
        const h = dragState.initialData.height;
        const rawX = dragState.initialData.x + deltaX;
        const rawY = dragState.initialData.y + deltaY;

        // Smart snap targets around parent room walls
        const xTargets = [
          -w,                                      // Flush against West exterior wall
          0,                                       // Flush against West interior wall
          Math.round((dimensions.width - w) / 2),  // Centered horizontally
          dimensions.width - w,                    // Flush against East interior wall
          dimensions.width                         // Flush against East exterior wall
        ];
        const yTargets = [
          -h,                                       // Flush against North exterior wall
          0,                                        // Flush against North interior wall
          Math.round((dimensions.height - h) / 2),  // Centered vertically
          dimensions.height - h,                    // Flush against South interior wall
          dimensions.height                         // Flush against South exterior wall
        ];

        // Magnetic snap if close to target lines
        let snappedX = rawX;
        for (const target of xTargets) {
          if (Math.abs(rawX - target) <= 12) { snappedX = target; break; }
        }
        if (snappedX === rawX) snappedX = snapToGrid(rawX);

        let snappedY = rawY;
        for (const target of yTargets) {
          if (Math.abs(rawY - target) <= 12) { snappedY = target; break; }
        }
        if (snappedY === rawY) snappedY = snapToGrid(rawY);

        // Attachment Constraint: keep extension connected to parent room bounds
        const minOverlap = 20; // 2m minimum overlap
        const minX = -w + minOverlap;
        const maxX = dimensions.width - minOverlap;
        const minY = -h + minOverlap;
        const maxY = dimensions.height - minOverlap;

        let finalX = Math.max(minX, Math.min(maxX, snappedX));
        let finalY = Math.max(minY, Math.min(maxY, snappedY));

        // If placed on left/right exterior wing, guarantee vertical connection with room
        if (finalX + w <= 0 || finalX >= dimensions.width) {
          finalY = Math.max(-h + minOverlap, Math.min(dimensions.height - minOverlap, finalY));
        }
        // If placed on top/bottom exterior wing, guarantee horizontal connection with room
        if (finalY + h <= 0 || finalY >= dimensions.height) {
          finalX = Math.max(-w + minOverlap, Math.min(dimensions.width - minOverlap, finalX));
        }

        const newAnnexes = (gym.annexes || []).map(a => {
          if (a.id !== dragState.itemId) return a;
          return { ...a, x: finalX, y: finalY };
        });
        update({ ...gym, annexes: newAnnexes }, false);
      } else if (dragState.mode === 'resize-annex') {
        const newAnnexes = (gym.annexes || []).map(a => {
          if (a.id !== dragState.itemId) return a;
          let nx = dragState.initialData.x;
          let ny = dragState.initialData.y;
          let nw = dragState.initialData.width;
          let nh = dragState.initialData.height;

          const handle = dragState.handle || 'se';
          if (handle === 'se' || handle === 'corner') {
            nw = Math.max(30, snapToGrid(dragState.initialData.width + deltaX));
            nh = Math.max(30, snapToGrid(dragState.initialData.height + deltaY));
            if (Math.abs((nx + nw) - dimensions.width) <= 12) nw = dimensions.width - nx;
            if (Math.abs((ny + nh) - dimensions.height) <= 12) nh = dimensions.height - ny;
          } else if (handle === 'sw') {
            const rawW = dragState.initialData.width - deltaX;
            nw = Math.max(30, snapToGrid(rawW));
            nx = dragState.initialData.x + (dragState.initialData.width - nw);
            nh = Math.max(30, snapToGrid(dragState.initialData.height + deltaY));
            if (Math.abs(nx) <= 12) { nw += nx; nx = 0; }
            if (Math.abs((ny + nh) - dimensions.height) <= 12) nh = dimensions.height - ny;
          } else if (handle === 'ne') {
            nw = Math.max(30, snapToGrid(dragState.initialData.width + deltaX));
            const rawH = dragState.initialData.height - deltaY;
            nh = Math.max(30, snapToGrid(rawH));
            ny = dragState.initialData.y + (dragState.initialData.height - nh);
            if (Math.abs((nx + nw) - dimensions.width) <= 12) nw = dimensions.width - nx;
            if (Math.abs(ny) <= 12) { nh += ny; ny = 0; }
          } else if (handle === 'nw') {
            const rawW = dragState.initialData.width - deltaX;
            nw = Math.max(30, snapToGrid(rawW));
            nx = dragState.initialData.x + (dragState.initialData.width - nw);
            const rawH = dragState.initialData.height - deltaY;
            nh = Math.max(30, snapToGrid(rawH));
            ny = dragState.initialData.y + (dragState.initialData.height - nh);
            if (Math.abs(nx) <= 12) { nw += nx; nx = 0; }
            if (Math.abs(ny) <= 12) { nh += ny; ny = 0; }
          } else if (handle === 'right') {
            nw = Math.max(30, snapToGrid(dragState.initialData.width + deltaX));
            if (Math.abs((nx + nw) - dimensions.width) <= 12) nw = dimensions.width - nx;
          } else if (handle === 'bottom') {
            nh = Math.max(30, snapToGrid(dragState.initialData.height + deltaY));
            if (Math.abs((ny + nh) - dimensions.height) <= 12) nh = dimensions.height - ny;
          } else if (handle === 'left') {
            const rawW = dragState.initialData.width - deltaX;
            nw = Math.max(30, snapToGrid(rawW));
            nx = dragState.initialData.x + (dragState.initialData.width - nw);
            if (Math.abs(nx) <= 12) { nw += nx; nx = 0; }
          } else if (handle === 'top') {
            const rawH = dragState.initialData.height - deltaY;
            nh = Math.max(30, snapToGrid(rawH));
            ny = dragState.initialData.y + (dragState.initialData.height - nh);
            if (Math.abs(ny) <= 12) { nh += ny; ny = 0; }
          }

          // Ensure extension attachment to room boundaries
          const minOverlap = 20;
          const minX = -nw + minOverlap;
          const maxX = dimensions.width - minOverlap;
          const minY = -nh + minOverlap;
          const maxY = dimensions.height - minOverlap;

          nx = Math.max(minX, Math.min(maxX, nx));
          ny = Math.max(minY, Math.min(maxY, ny));

          return { ...a, x: nx, y: ny, width: nw, height: nh };
        });
        update({ ...gym, annexes: newAnnexes }, false);
      } else if (dragState.mode === 'move-machine') {
         const newZones = gym.zones.map(z => { if (z.id !== dragState.zoneId) return z; const newMachines = (z.machines || []).map(m => { if (m.id !== dragState.itemId) return m; let nx = snapToGrid(dragState.initialData.x + deltaX), ny = snapToGrid(dragState.initialData.y + deltaY); nx = Math.max(0, Math.min(z.width - m.width, nx)); ny = Math.max(0, Math.min(z.height - m.height, ny)); return { ...m, x: nx, y: ny }; }); return { ...z, machines: newMachines }; });
         update({ ...gym, zones: newZones }, false);
      } else if (dragState.mode === 'resize-machine') {
         const newZones = gym.zones.map(z => { if (z.id !== dragState.zoneId) return z; const newMachines = (z.machines || []).map(m => { if (m.id !== dragState.itemId) return m; let nw = snapToGrid(dragState.initialData.width + deltaX), nh = snapToGrid(dragState.initialData.height + deltaY); return { ...m, width: Math.max(10, nw), height: Math.max(10, nh) }; }); return { ...z, machines: newMachines }; });
         update({ ...gym, zones: newZones }, false);
      } else if (dragState.mode === 'move-wall') {
        const walls = dimensions.walls || [];
        const newWalls = walls.map(w => {
          if (w.id !== dragState.itemId) return w;
          const dx = snapToGrid(dragState.initialWallData!.x1 + deltaX) - dragState.initialWallData!.x1;
          const dy = snapToGrid(dragState.initialWallData!.y1 + deltaY) - dragState.initialWallData!.y1;
          return {
            ...w,
            x1: dragState.initialWallData!.x1 + dx,
            y1: dragState.initialWallData!.y1 + dy,
            x2: dragState.initialWallData!.x2 + dx,
            y2: dragState.initialWallData!.y2 + dy,
            controlX: w.controlX !== undefined ? dragState.initialWallData!.controlX! + dx : undefined,
            controlY: w.controlY !== undefined ? dragState.initialWallData!.controlY! + dy : undefined
          };
        });
        update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, false);
      } else if (dragState.mode === 'resize-wall-p1') {
        const walls = dimensions.walls || [];
        const currentWall = walls.find(w => w.id === dragState.itemId);
        const refStart = currentWall ? { x: currentWall.x2, y: currentWall.y2 } : undefined;
        const candidateP1 = {
          x: dragState.initialWallData!.x1 + deltaX,
          y: dragState.initialWallData!.y1 + deltaY
        };
        const snap = snapWallEndpoint(candidateP1, walls, {
          excludeWallId: dragState.itemId,
          snapThreshold: 18,
          referenceStartPoint: refStart
        });

        const newWalls = walls.map(w => {
          if (w.id !== dragState.itemId) return w;
          return {
            ...w,
            x1: snap.x,
            y1: snap.y
          };
        });
        update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, false);
      } else if (dragState.mode === 'resize-wall-p2') {
        const walls = dimensions.walls || [];
        const currentWall = walls.find(w => w.id === dragState.itemId);
        const refStart = currentWall ? { x: currentWall.x1, y: currentWall.y1 } : undefined;
        const candidateP2 = {
          x: dragState.initialWallData!.x2 + deltaX,
          y: dragState.initialWallData!.y2 + deltaY
        };
        const snap = snapWallEndpoint(candidateP2, walls, {
          excludeWallId: dragState.itemId,
          snapThreshold: 18,
          referenceStartPoint: refStart
        });

        const newWalls = walls.map(w => {
          if (w.id !== dragState.itemId) return w;
          return {
            ...w,
            x2: snap.x,
            y2: snap.y
          };
        });
        update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, false);
      } else if (dragState.mode === 'adjust-wall-curve') {
        const walls = dimensions.walls || [];
        const newWalls = walls.map(w => {
          if (w.id !== dragState.itemId) return w;
          return {
            ...w,
            controlX: snapToGrid((dragState.initialWallData!.controlX ?? ((w.x1 + w.x2) / 2)) + deltaX),
            controlY: snapToGrid((dragState.initialWallData!.controlY ?? ((w.y1 + w.y2) / 2)) + deltaY)
          };
        });
        update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, false);
      }
    };
    const handleMouseUp = () => setDragState(null);
    if (dragState) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, gym, update, dimensions, annexes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 animate-in slide-in-from-right duration-300">
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 flex-shrink-0 z-20">
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => {
              if (selectedWorkspaceOption !== null) {
                setSelectedWorkspaceOption(null);
              } else {
                onBack();
              }
            }} 
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors flex-shrink-0"
            title={selectedWorkspaceOption !== null ? "Back to Task Selection" : "Back to Gym List"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col flex-shrink-0">
            <span className="text-[9px] text-lime-400 font-bold uppercase tracking-widest leading-none mb-1">Editing</span>
            <input 
              value={gym.name} 
              onFocus={() => snapshot()} 
              onChange={(e) => update({ ...gym, name: e.target.value }, false)} 
              className="bg-transparent text-sm font-bold text-white focus:outline-none focus:border-b border-slate-700 hover:border-slate-600 transition-colors w-40 leading-none" 
            />
          </div>

          <div className="flex items-center bg-slate-950/70 p-1 rounded-lg border border-slate-800/80 animate-in fade-in duration-300">
            <button 
              onClick={() => setActiveTab('layout')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'layout' 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Floor Plan & Layout
            </button>
            <button 
              onClick={() => setActiveTab('exercises')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'exercises' 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              Exercise Library (Admin)
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'layout' && selectedWorkspaceOption !== null && (
            <>
              <div className="flex items-center space-x-1 mr-2 border-r border-slate-800 pr-4">
                <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
                <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></button>
              </div>
              <button onClick={handleSave} disabled={saveState !== 'idle'} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all min-w-[140px] justify-center ${saveState === 'saved' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'}`}>
                {saveState === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saveState === 'saved' ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Layout'}
              </button>
            </>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/jpg, application/pdf"
          className="hidden"
        />

        {/* AI Processing Overlay */}
        {isImporting && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-lime-500/10 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-t-lime-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-lime-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Analyzing Floor Plan</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{importStatus}</p>
              </div>
              <div className="text-[10px] text-slate-500 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-850/80 font-mono">
                Detecting walls, rooms, doors & equipment...
              </div>
            </div>
          </div>
        )}

        {/* AI Error Alert Modal */}
        {importError && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-red-400">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Import Failed</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {importError}
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => {
                    setImportError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    setImportError(null);
                    triggerImportFlow();
                  }}
                  className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-slate-950 rounded-lg text-xs font-bold transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layout' ? (
          selectedWorkspaceOption === null ? (
            <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 overflow-y-auto animate-in fade-in duration-300">
              <div className="max-w-5xl w-full space-y-8 text-center py-12">
                <div className="space-y-3">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-lime-500/10 text-lime-400 border border-lime-500/20">
                     <Sparkles className="w-3.5 h-3.5 mr-1.5 text-lime-400 animate-pulse" />
                     Setup Assistant
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                     What would you like to build today?
                  </h1>
                  <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
                     Select a core task below to begin customizing <span className="font-semibold text-lime-400">{gym.name}</span>. You can easily switch between views at any time.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
                  {/* Option 1: Zones and Layout */}
                  <button
                    onClick={() => {
                      setEditMode('layout');
                      setSelectedWorkspaceOption('layout');
                      setSelectedZoneId(null);
                    }}
                    className="group relative bg-slate-900 hover:bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 flex flex-col h-full cursor-pointer focus:outline-none"
                  >
                    <div className="p-3 bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 rounded-xl w-12 h-12 flex items-center justify-center mb-5 transition-all group-hover:scale-110">
                      <Grid className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2 flex items-center">
                      Zones & Equipment Layout
                      <ArrowRightLeft className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 text-blue-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Create specialized training areas like cardio, strength, or active recovery. Draw or place zone layouts, then arrange custom exercise machines and rigs within them.
                    </p>
                    <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-blue-400 transition-colors">
                      <span>MANAGE WORKOUT SECTORS</span>
                      <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded border border-slate-850 group-hover:border-blue-900/50">OPEN BUILDER</span>
                    </div>
                  </button>

                  {/* Option 2: Floor Plan */}
                  <button
                    onClick={() => {
                      setEditMode('room');
                      setSelectedWorkspaceOption('room');
                      setSelectedZoneId(null);
                    }}
                    className="group relative bg-slate-900 hover:bg-slate-900/80 border border-slate-800 hover:border-lime-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-lime-500/5 hover:-translate-y-1 flex flex-col h-full cursor-pointer focus:outline-none"
                  >
                    <div className="p-3 bg-lime-500/10 group-hover:bg-lime-500/20 text-lime-400 rounded-xl w-12 h-12 flex items-center justify-center mb-5 transition-all group-hover:scale-110">
                      <Scaling className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors mb-2 flex items-center">
                      Floor Plan & Dimensions
                      <ArrowRightLeft className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 text-lime-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Adjust the main gym hall boundary dimensions, draw or add custom room extensions (L-shape), choose floor themes and colors, and position the main entrance doorway.
                    </p>
                    <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-lime-400 transition-colors">
                      <span>MANAGE ROOM SIZE & DETAILS</span>
                      <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded border border-slate-850 group-hover:border-lime-900/50">OPEN DESIGNER</span>
                    </div>
                  </button>

                  {/* Option 3: Import Floor Plan with AI */}
                  <div
                    onClick={triggerImportFlow}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`group relative bg-slate-900 border rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl flex flex-col h-full cursor-pointer focus:outline-none ${
                      isDragActive 
                        ? 'border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/10 scale-[1.02]' 
                        : 'border-slate-800 hover:border-purple-500/50 hover:shadow-purple-500/5 hover:-translate-y-1'
                    }`}
                  >
                    <div className={`p-3 rounded-xl w-12 h-12 flex items-center justify-center mb-5 transition-all group-hover:scale-110 ${
                      isDragActive ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20'
                    }`}>
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors mb-2 flex items-center">
                      Import Floor Plan (AI)
                      <ArrowRightLeft className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 text-purple-400" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Upload or drag-and-drop a PDF, JPG, or PNG floor plan. Our AI auto-detects walls, room boundaries, doors, and equipment to create your digital layout instantly.
                    </p>
                    <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-purple-400 transition-colors">
                      <span>AUTO-CONVERT PDF OR IMAGES</span>
                      <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded border border-slate-850 group-hover:border-purple-900/50">UPLOAD FILE</span>
                    </div>
                  </div>

                  {/* Option 4: Exercise & Video Library (Admin Only) */}
                  <button
                    onClick={() => {
                      setActiveTab('exercises');
                      setSelectedWorkspaceOption('layout');
                    }}
                    className="group relative bg-slate-900 hover:bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5 hover:-translate-y-1 flex flex-col h-full cursor-pointer focus:outline-none"
                  >
                    <div className="p-3 bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 rounded-xl w-12 h-12 flex items-center justify-center mb-5 transition-all group-hover:scale-110">
                      <Dumbbell className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors mb-2 flex items-center">
                      Exercise & Video Library
                      <ArrowRightLeft className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 text-amber-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Manage global exercises, assign target muscle groups and gym equipment, add step-by-step instructions, and attach YouTube Shorts demonstration video links.
                    </p>
                    <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-amber-400 transition-colors">
                      <span>ADMIN EXERCISE DATABASE</span>
                      <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded border border-slate-850 group-hover:border-amber-900/50">OPEN LIBRARY</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 flex-shrink-0 shadow-xl overflow-y-auto">
              <div className="p-4 border-b border-slate-800/50">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Editor Modes</h3>
                  <div className="space-y-2">
                       <ToolButton active={editMode === 'layout'} onClick={() => { setEditMode('layout'); setSelectedWorkspaceOption('layout'); setSelectedZoneId(null); }} icon={Grid} label="Zones & Layout" description="Move and edit zones" />
                       <ToolButton active={editMode === 'room'} onClick={() => { setEditMode('room'); setSelectedWorkspaceOption('room'); setSelectedZoneId(null); }} icon={Scaling} label="Floor Plan" description="Adjust room shape" />
                  </div>
              </div>
            <div className="p-4 flex-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  {editMode === 'machine' ? 'Equipment Tools' : 'Creation Tools'}
                </h3>
                <div className="space-y-2">
                    {editMode === 'layout' ? (
                        <div className="space-y-4">
                           <div>
                             <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Workout Areas</h4>
                             <div className="space-y-2">
                               <ToolButton onClick={addNewZone} icon={PlusSquare} label="Add Workout Zone" description="Create a new exercise area" variant="action" />
                               <ToolButton onClick={addCorridor} icon={Footprints} label="Add Walkway" description="Mark non-workout paths" variant="action" />
                             </div>
                           </div>

                           <div>
                             <h4 className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                               <DoorOpen className="w-3.5 h-3.5 text-purple-400" />
                               Fixed Gym Amenities
                             </h4>
                             <div className="space-y-2">
                               <ToolButton onClick={addReception} icon={DoorOpen} label="Front Desk & Reception" description="Entrance desk & check-in" />
                               <ToolButton onClick={addLockers} icon={Lock} label="Locker Rooms" description="Changing rooms & lockers" />
                               <ToolButton onClick={addRestrooms} icon={Bath} label="Restrooms & Bathrooms" description="Toilets & shower rooms" />
                               <ToolButton onClick={addWaterStation} icon={Droplets} label="Water Station" description="Filtered water fountain" />
                             </div>
                           </div>

                           <div className="pt-2">
                             {selectedZone ? ( <ToolButton onClick={() => setEditMode('machine')} icon={Dumbbell} label="Edit Machines" description={`Manage equipment in ${selectedZone.name}`} variant="highlight" /> ) : ( <div className="p-3 rounded-xl border border-dashed border-slate-800 text-center"><p className="text-[10px] text-slate-500">Select a zone on the map to edit its machines.</p></div> )}
                           </div>
                        </div>
                    ) : editMode === 'room' ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                           <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                             <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-lime-400 uppercase tracking-wider">
                               <Compass className="w-3.5 h-3.5" />
                               Add Room Extension
                             </div>
                             <p className="text-[10px] text-slate-400 leading-relaxed">
                               Expand the gym floor plan with side wings, alcoves, and custom annexes:
                             </p>

                             {/* Cardinal Direction Wings */}
                             <div className="grid grid-cols-2 gap-1.5">
                               <button
                                 onClick={() => addAnnex('right')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-all text-left"
                                 title="Add wing to the right / East wall"
                               >
                                 <ArrowRight className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                                 <span className="truncate">Right (East)</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('left')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-all text-left"
                                 title="Add wing to the left / West wall"
                               >
                                 <ArrowLeft className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                                 <span className="truncate">Left (West)</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('top')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-all text-left"
                                 title="Add wing to the top / North wall"
                               >
                                 <ArrowUp className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                                 <span className="truncate">Top (North)</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('bottom')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-all text-left"
                                 title="Add wing to the bottom / South wall"
                               >
                                 <ArrowDown className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                                 <span className="truncate">Bottom (South)</span>
                               </button>
                             </div>

                             {/* Corner Placements */}
                             <div className="grid grid-cols-2 gap-1.5 pt-1">
                               <button
                                 onClick={() => addAnnex('top-right')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-lime-500/40 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all text-left"
                               >
                                 <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                 <span className="truncate">Top-Right</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('top-left')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-lime-500/40 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all text-left"
                               >
                                 <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                 <span className="truncate">Top-Left</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('bottom-right')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-lime-500/40 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all text-left"
                               >
                                 <ArrowDownRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                 <span className="truncate">Bottom-Right</span>
                               </button>

                               <button
                                 onClick={() => addAnnex('bottom-left')}
                                 className="flex items-center gap-1.5 p-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-lime-500/40 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all text-left"
                               >
                                 <ArrowDownLeft className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                 <span className="truncate">Bottom-Left</span>
                               </button>
                             </div>

                             <button
                               onClick={() => addAnnex('custom')}
                               className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-400 rounded-lg text-xs font-bold transition-all mt-1"
                             >
                               <Plus className="w-3.5 h-3.5" />
                               <span>+ Custom Extension</span>
                             </button>
                           </div>

                           <ToolButton onClick={triggerImportFlow} icon={Sparkles} label="Import Floor Plan" description="Upload image/PDF to auto-detect" variant="highlight" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                           <ToolButton onClick={addMachine} icon={Cpu} label="Add Custom Machine" description="Place a generic template item" variant="action" />
                           
                           {/* Add from Exercise Library option */}
                           <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-3 mt-4 animate-in fade-in duration-300">
                             <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-blue-400 uppercase tracking-wider mb-2">
                               <Sparkles className="w-3.5 h-3.5" />
                               Add from Exercise Library
                             </div>
                             <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                               Select an exercise to place on the floor map:
                             </p>

                             {/* Sidebar Exercise Search */}
                             <div className="relative mb-2.5">
                               <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                               <input
                                 type="text"
                                 placeholder="Search exercises..."
                                 value={sidebarSearchQuery}
                                 onChange={(e) => setSidebarSearchQuery(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-850 rounded-lg pl-8 pr-2 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                               />
                             </div>

                             <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                               {filteredSidebarExercises.length === 0 ? (
                                 <p className="text-[10px] text-slate-600 text-center py-2 italic">No matching exercises.</p>
                               ) : (
                                 filteredSidebarExercises.map(ex => (
                                   <button
                                     key={ex.id}
                                     onClick={() => addMachineFromLibrary(ex)}
                                     className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-blue-550/30 text-xs text-slate-300 hover:text-white transition-all flex flex-col gap-0.5 group"
                                     title={`Required: ${ex.equipmentRequired}`}
                                   >
                                     <span className="font-semibold text-[11px] truncate uppercase group-hover:text-blue-400 font-mono transition-colors">{ex.name}</span>
                                     <span className="text-[9px] text-slate-500 truncate">Req: {ex.equipmentRequired || 'Bodyweight'}</span>
                                   </button>
                                 ))
                                )}
                             </div>
                           </div>

                           <div className="h-px bg-slate-800 my-4" />
                           <ToolButton onClick={() => setEditMode('layout')} icon={ArrowLeftCircle} label="Return to Zones" description="Exit machine editor" />
                        </div>
                    )}
                </div>
            </div>
        </aside>
        <div className="flex-1 p-8 bg-slate-950 flex flex-col min-w-0">
          <div ref={mapContainerRef} className={`flex-1 relative border rounded-xl overflow-hidden flex items-center justify-center transition-colors duration-500 shadow-inner ${
            editMode === 'room' ? 'bg-lime-950/5 border-lime-900/30' : 
            editMode === 'machine' ? 'bg-blue-950/5 border-blue-900/30' : 
            'bg-slate-900/50 border-slate-800'
          }`}>
             <div className="absolute inset-0 p-4">
               <GymMap 
                 zones={zones} 
                 dimensions={dimensions} 
                 entrance={entrance} 
                 floorColor={floorColor} 
                 annexes={annexes} 
                 onZoneClick={handleZoneClick} 
                 onMapClick={handleMapClick} 
                 selectedZoneId={selectedZoneId} 
                 selectedAnnexId={selectedAnnexId}
                 onAnnexClick={(annex) => setSelectedAnnexId(annex.id)}
                 focusedZoneId={editMode === 'machine' ? selectedZoneId : null} 
                 isEditable={true} 
                 editMode={editMode} 
                 onZoneDragStart={handleZoneDragStart} 
                 onZoneResizeStart={handleZoneResizeStart} 
                 onMainRoomResizeStart={handleMainRoomResizeStart} 
                 onAnnexDragStart={handleAnnexDragStart} 
                 onAnnexResizeStart={handleAnnexResizeStart} 
                 onMachineDragStart={handleMachineDragStart} 
                 onMachineResizeStart={handleMachineResizeStart} 
                 selectedMachineId={selectedMachineId} 
                 selectedWallId={selectedWallId}
                 onWallClick={setSelectedWallId}
                 onWallDragStart={handleWallDragStart}
                 manualView={dragState?.viewParams}
               />
             </div>

             <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 flex items-center space-x-4 pointer-events-none select-none z-20 backdrop-blur-sm">
                {editMode === 'layout' ? ( 
                  <><span className="flex items-center"><Move className="w-3 h-3 mr-1.5" /> Drag to move</span><span className="w-1 h-1 bg-slate-700 rounded-full"></span><span className="flex items-center"><Maximize2 className="w-3 h-3 mr-1.5" /> Drag corner to resize</span></> 
                ) : editMode === 'room' ? ( 
                  <><span className="flex items-center text-lime-400"><SquareDashed className="w-3 h-3 mr-1.5" /> Drag edges to resize room</span></> 

                ) : ( 
                  <><span className="flex items-center text-blue-400"><Cpu className="w-3 h-3 mr-1.5" /> Drag machines to arrange</span></> 
                )}
              </div>
           </div>
         </div>
         <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto flex-shrink-0 z-10 shadow-xl">
          {editMode === 'layout' && selectedZone && (
            <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
              <div className="flex justify-between items-start"><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Zone Properties</h2></div>
              <div className="space-y-4">
                <div><label className="block text-xs text-slate-500 mb-1.5">Zone Name</label><input type="text" value={selectedZone.name} onFocus={() => snapshot()} onChange={(e) => updateZone('name', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Category / Room Type</label>
                  <select
                    value={selectedZone.type}
                    onFocus={() => snapshot()}
                    onChange={(e) => updateZone('type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    {Object.entries(EquipmentType).map(([key, value]) => (
                      <option key={key} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1.5">Description</label><textarea value={selectedZone.description || ''} onFocus={() => snapshot()} onChange={(e) => updateZone('description', e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none" /></div>
                <div><button onClick={() => setEditMode('machine')} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 hover:border-blue-500/50 rounded flex items-center justify-center transition-all text-xs font-bold uppercase tracking-wide"><Dumbbell className="w-4 h-4 mr-2" />Manage Equipment</button><p className="text-[10px] text-center mt-2 text-slate-500">{selectedZone.machines?.length || 0} machines inside</p></div>
                <div className="h-px bg-slate-800 my-2" />
                <div><label className="block text-xs text-slate-500 mb-1.5">Color Code</label><div className="flex items-center space-x-2"><input type="color" value={selectedZone.color} onFocus={() => snapshot()} onChange={(e) => updateZone('color', e.target.value)} className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded" /><input type="text" value={selectedZone.color} onFocus={() => snapshot()} onChange={(e) => updateZone('color', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none" /></div></div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-800"><button type="button" onClick={deleteZone} className="w-full flex items-center justify-center px-4 py-3 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-900/50 rounded-lg text-sm font-medium transition-all group"><Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />Delete Zone</button></div>
            </div>
          )}
          {editMode === 'layout' && !selectedZone && (
            <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
              <div className="flex justify-between items-start">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Zones & Layout</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-950/40 p-3.5 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-200 mb-1 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-400 animate-pulse" />
                    Layout Design Help
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Set up specific training and functional zones in your gym using instant structures and preset room layouts.
                  </p>
                </div>

                {/* Regular Preset Placement Buttons */}
                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-500 uppercase font-bold">Standard Placement</label>
                  <button
                    type="button"
                    onClick={addNewZone}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center justify-center transition-all text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2 text-slate-400" />
                    Place Rectangle Zone
                  </button>
                  <button
                    type="button"
                    onClick={addCorridor}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center justify-center transition-all text-xs font-semibold"
                  >
                    <Footprints className="w-4 h-4 mr-2 text-slate-400" />
                    Place Walkway Corridor
                  </button>
                </div>
              </div>
            </div>
          )}
          {editMode === 'machine' && selectedZone && (
              <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
                 <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center"><Dumbbell className="w-4 h-4 mr-2" />Equipment Editor</h2></div>
                 <div className="bg-slate-950/50 p-3 rounded border border-slate-800"><p className="text-xs text-slate-400 font-bold mb-1">{selectedZone.name}</p><p className="text-[10px] text-slate-500">Drag items to position. Use toolbar to add.</p></div>
                 {selectedMachineId ? (
                    <div className="space-y-4">
                        <div className="text-xs font-bold text-white border-b border-slate-800 pb-2">Selected Machine</div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-2">Icon</label>
                             <div className="grid grid-cols-4 gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
                                {MACHINE_ICONS.map(({ name, label, icon: Icon }) => {
                                  const currentMachine = (selectedZone.machines || []).find(m => m.id === selectedMachineId);
                                  const isActive = currentMachine?.icon === name;
                                  return (
                                    <button
                                      key={name}
                                      onClick={() => {
                                        snapshot();
                                        const newZones = gym.zones.map(z => {
                                          if (z.id !== selectedZone.id) return z;
                                          return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, icon: name } : m) };
                                        });
                                        update({ ...gym, zones: newZones }, false);
                                      }}
                                      className={`p-2 rounded-md flex items-center justify-center border transition-all ${isActive ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
                                      title={label || name}
                                    >
                                      <Icon size={16} />
                                    </button>
                                  );
                                })}
                             </div>
                        </div>
                        <div><label className="block text-xs text-slate-500 mb-1">Label</label><input value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.name || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, name: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="block text-xs text-slate-500 mb-1">Video URL (YouTube / Shorts)</label><input value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.videoUrl || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, videoUrl: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} placeholder="https://www.youtube.com/watch?v=... or shorts" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="block text-xs text-slate-500 mb-1">Instructions</label><textarea value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.longDescription || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, longDescription: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} rows={4} placeholder="Detailed steps..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none" /></div>

                        {/* Save to Exercise Library action */}
                        {(() => {
                          const currentMachine = (selectedZone.machines || []).find(m => m.id === selectedMachineId);
                          const machineName = (currentMachine?.name || '').trim();
                          const existingInLib = machineName ? libraryExercises.find(e => e.name.trim().toLowerCase() === machineName.toLowerCase()) : null;

                          return (
                            <div className="space-y-2 pt-2 border-t border-slate-800/80">
                              <button
                                onClick={saveMachineToLibrary}
                                disabled={savingToLibrary || !machineName}
                                className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                                  saveToLibraryStatus === 'saved'
                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/20'
                                    : saveToLibraryStatus === 'exists'
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/20'
                                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white'
                                } ${(!machineName || savingToLibrary) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {savingToLibrary ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-blue-400" />
                                    <span>Saving to Library...</span>
                                  </>
                                ) : saveToLibraryStatus === 'saved' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-2 text-white" />
                                    <span>Saved to Exercise Library!</span>
                                  </>
                                ) : saveToLibraryStatus === 'exists' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-2 text-white" />
                                    <span>Updated in Exercise Library!</span>
                                  </>
                                ) : (
                                  <>
                                    <Bookmark className="w-3.5 h-3.5 mr-2 text-blue-400" />
                                    <span>Save to Exercise Library</span>
                                  </>
                                )}
                              </button>

                              {existingInLib ? (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-blue-950/30 border border-blue-900/30 text-[10px] text-blue-300">
                                  <BookmarkCheck className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                                  <span>In Exercise Library (Saving updates existing record)</span>
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-500 px-1 leading-tight">
                                  Stores this machine to your Exercise Library for instant 1-click placement across any zone.
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        <button onClick={deleteMachine} className="w-full flex items-center justify-center px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-xs transition-colors"><Trash2 className="w-3 h-3 mr-2" />Remove Machine</button>
                    </div>
                 ) : ( <div className="text-center py-8 text-slate-600 text-xs">Select a machine to edit details.</div> )}
              </div>
          )}
          {editMode === 'room' && (
             <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
                <div className="flex justify-between items-start"><h2 className="text-sm font-bold text-lime-400 uppercase tracking-wider flex items-center"><LayoutTemplate className="w-4 h-4 mr-2" />Room Configuration</h2></div>
                <div className="space-y-4">
                  <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                     <h3 className="text-xs font-bold text-white mb-2">Main Hall Dimensions (m)</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Width (m)</label>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              inputMode="decimal"
                              value={widthInput} 
                              onFocus={() => snapshot()} 
                              onChange={(e) => handleWidthChange(e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-7 text-sm text-white focus:border-blue-500 focus:outline-none" 
                            />
                            <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Height (m)</label>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              inputMode="decimal"
                              value={heightInput} 
                              onFocus={() => snapshot()} 
                              onChange={(e) => handleHeightChange(e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-7 text-sm text-white focus:border-blue-500 focus:outline-none" 
                            />
                            <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                          </div>
                        </div>
                     </div>
                  </div>
                  {/* Room Extensions (Annexes) Section */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white flex items-center">
                        <LayoutTemplate className="w-4 h-4 mr-1.5 text-lime-400" />
                        Room Extensions ({annexes.length})
                      </h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold">
                        L-shapes & Wings
                      </span>
                    </div>

                    {/* Quick add direction buttons */}
                    <div className="grid grid-cols-4 gap-1">
                      <button type="button" onClick={() => addAnnex('top')} className="py-1.5 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all flex flex-col items-center gap-0.5 active:scale-95" title="Add North (Top) Wing">
                        <ArrowUp className="w-3 h-3 text-lime-400" />
                        <span>Top</span>
                      </button>
                      <button type="button" onClick={() => addAnnex('bottom')} className="py-1.5 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all flex flex-col items-center gap-0.5 active:scale-95" title="Add South (Bottom) Wing">
                        <ArrowDown className="w-3 h-3 text-lime-400" />
                        <span>Bottom</span>
                      </button>
                      <button type="button" onClick={() => addAnnex('left')} className="py-1.5 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all flex flex-col items-center gap-0.5 active:scale-95" title="Add West (Left) Wing">
                        <ArrowLeft className="w-3 h-3 text-lime-400" />
                        <span>Left</span>
                      </button>
                      <button type="button" onClick={() => addAnnex('right')} className="py-1.5 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-lime-500/50 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all flex flex-col items-center gap-0.5 active:scale-95" title="Add East (Right) Wing">
                        <ArrowRight className="w-3 h-3 text-lime-400" />
                        <span>Right</span>
                      </button>
                    </div>

                    {/* Extensions List */}
                    {annexes.length === 0 ? (
                      <div className="p-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-center">
                        <p className="text-[11px] text-slate-500">No extensions added. Add wings to configure L-shaped or extended rooms.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {annexes.map((annex, i) => {
                          const isSelected = selectedAnnexId === annex.id;
                          const displayName = annex.name || `Extension ${i + 1}`;
                          return (
                            <div
                              key={annex.id}
                              onClick={() => setSelectedAnnexId(annex.id)}
                              className={`p-2.5 rounded-lg flex items-center justify-between text-xs border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-lime-500/10 border-lime-500/40 text-white shadow-md'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-lime-400' : 'bg-slate-600'}`} />
                                <div className="truncate">
                                  <div className="font-semibold text-[11px] text-slate-200 truncate">{displayName}</div>
                                  <div className="text-[10px] text-slate-500">{(annex.width / 10).toFixed(1)}m × {(annex.height / 10).toFixed(1)}m · pos: ({(annex.x / 10).toFixed(1)}m, {(annex.y / 10).toFixed(1)}m)</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateAnnex(annex.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-blue-950/40 border border-transparent hover:border-blue-800/50 rounded transition-colors"
                                  title="Duplicate extension"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAnnex(annex.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/50 rounded transition-colors"
                                  title="Delete extension"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Selected Annex Editor Panel */}
                    {selectedAnnexId && (() => {
                      const selectedAnnex = annexes.find(a => a.id === selectedAnnexId);
                      if (!selectedAnnex) return null;
                      return (
                        <div className="bg-slate-950 p-3.5 rounded-lg border border-lime-500/30 space-y-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wider flex items-center gap-1.5">
                              <SlidersHorizontal className="w-3 h-3" />
                              Selected Extension
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedAnnexId(null)}
                              className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold"
                            >
                              Done
                            </button>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">Extension Name</label>
                            <input
                              type="text"
                              value={selectedAnnex.name || ''}
                              placeholder="e.g., Cardio Wing, Free Weights Annex"
                              onFocus={() => snapshot()}
                              onChange={(e) => updateAnnexProperty(selectedAnnex.id, 'name', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:border-lime-500 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">Width (m)</label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="2"
                                  max="100"
                                  value={(selectedAnnex.width / 10)}
                                  onFocus={() => snapshot()}
                                  onChange={(e) => updateAnnexProperty(selectedAnnex.id, 'width', Math.max(20, Math.round((parseFloat(e.target.value) || 2) * 10)))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 pr-7 text-xs text-white focus:border-lime-500 focus:outline-none"
                                />
                                <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">Height (m)</label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="2"
                                  max="100"
                                  value={(selectedAnnex.height / 10)}
                                  onFocus={() => snapshot()}
                                  onChange={(e) => updateAnnexProperty(selectedAnnex.id, 'height', Math.max(20, Math.round((parseFloat(e.target.value) || 2) * 10)))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 pr-7 text-xs text-white focus:border-lime-500 focus:outline-none"
                                />
                                <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">Position X (m)</label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={(selectedAnnex.x / 10)}
                                  onFocus={() => snapshot()}
                                  onChange={(e) => updateAnnexProperty(selectedAnnex.id, 'x', Math.round((parseFloat(e.target.value) || 0) * 10))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 pr-7 text-xs text-white focus:border-lime-500 focus:outline-none"
                                />
                                <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">Position Y (m)</label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={(selectedAnnex.y / 10)}
                                  onFocus={() => snapshot()}
                                  onChange={(e) => updateAnnexProperty(selectedAnnex.id, 'y', Math.round((parseFloat(e.target.value) || 0) * 10))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 pr-7 text-xs text-white focus:border-lime-500 focus:outline-none"
                                />
                                <span className="absolute right-2 text-slate-500 text-[11px] font-semibold select-none pointer-events-none">m</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1.5 uppercase font-semibold">Snap to Wall</label>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'west')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                West Wall
                              </button>
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'east')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                East Wall
                              </button>
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'north')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                North Wall
                              </button>
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'south')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                South Wall
                              </button>
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'center-x')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                Center X
                              </button>
                              <button
                                type="button"
                                onClick={() => alignAnnex(selectedAnnex.id, 'center-y')}
                                className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white"
                              >
                                Center Y
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => duplicateAnnex(selectedAnnex.id)}
                              className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all font-medium"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAnnex(selectedAnnex.id)}
                              className="py-1.5 px-3 bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 hover:border-red-700/60 rounded text-xs text-red-400 hover:text-red-300 flex items-center justify-center gap-1.5 active:scale-95 transition-all font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Walls & Open Barriers Config Section */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white flex items-center">
                        <Scaling className="w-4 h-4 mr-1.5 text-lime-400" />
                        Walls & Openings
                      </h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold">
                        {(dimensions.walls || []).length} active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={addStraightWall}
                        className="py-2 px-2 text-[11px] font-bold bg-slate-950 border border-slate-800 hover:border-lime-500/50 hover:bg-slate-800 rounded-lg text-slate-200 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-lime-400" />
                        + Straight Wall
                      </button>
                      <button
                        onClick={addCurvedWall}
                        className="py-2 px-2 text-[11px] font-bold bg-slate-950 border border-slate-800 hover:border-lime-500/50 hover:bg-slate-800 rounded-lg text-slate-200 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-lime-400" />
                        + Curved Wall
                      </button>
                    </div>

                    {selectedWallId ? (() => {
                      const selectedWall = (dimensions.walls || []).find(w => w.id === selectedWallId);
                      if (!selectedWall) return null;

                      return (
                        <div className="bg-slate-950 p-3 rounded-lg border border-lime-500/20 space-y-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex justify-between items-center pb-1 border-b border-slate-850">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Selected Wall: {selectedWall.type === 'curved' ? 'Curved' : 'Straight'}
                            </span>
                            <button
                              onClick={() => setSelectedWallId(null)}
                              className="text-slate-500 hover:text-slate-200 text-[10px] uppercase font-bold"
                            >
                              Deselect
                            </button>
                          </div>

                          {/* Wall Type selection */}
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-500 uppercase font-bold">Barrier Type</label>
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { value: 'exterior', label: 'Exterior Wall' },
                                { value: 'interior', label: 'Interior Wall' },
                                { value: 'window', label: 'Glass Window' },
                                { value: 'door', label: 'Door / Opening' },
                                { value: 'corridor', label: 'Corridor Divider' }
                              ].map(item => (
                                <button
                                  key={item.value}
                                  onClick={() => {
                                    snapshot();
                                    const newWalls = (dimensions.walls || []).map(w =>
                                      w.id === selectedWallId ? { ...w, wallType: item.value as any } : w
                                    );
                                    update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, true);
                                  }}
                                  className={`text-[10px] py-1 px-1.5 rounded text-left transition-all border ${
                                    selectedWall.wallType === item.value
                                      ? 'bg-blue-950 text-blue-300 border-blue-500/50 font-bold'
                                      : 'bg-slate-900 text-slate-400 border-slate-850 hover:border-slate-700'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Thickness input slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <label className="block text-[10px] text-slate-500 uppercase font-bold">Thickness</label>
                              <span className="text-[10px] text-slate-400">{selectedWall.thickness || 8}px</span>
                            </div>
                            <input
                              type="range"
                              min="4"
                              max="20"
                              value={selectedWall.thickness || 8}
                              onFocus={() => snapshot()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                const newWalls = (dimensions.walls || []).map(w =>
                                  w.id === selectedWallId ? { ...w, thickness: val } : w
                                );
                                update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, false);
                              }}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Low Confidence warning and toggle */}
                          {selectedWall.confidence === 'low' && (
                            <div className="p-2 bg-orange-950/20 border border-orange-500/20 rounded-lg flex items-center justify-between gap-1">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-orange-400 flex items-center">
                                  ⚠️ AI Confidence Low
                                </span>
                                <span className="text-[9px] text-slate-400">Ambiguous in uploaded file</span>
                              </div>
                              <button
                                onClick={() => {
                                  snapshot();
                                  const newWalls = (dimensions.walls || []).map(w =>
                                    w.id === selectedWallId ? { ...w, confidence: 'high' as const } : w
                                  );
                                  update({ ...gym, dimensions: { ...dimensions, walls: newWalls } }, true);
                                }}
                                className="px-2 py-1 bg-orange-500 text-slate-950 font-bold text-[9px] rounded hover:bg-orange-400 transition-colors"
                              >
                                Approve
                              </button>
                            </div>
                          )}

                          {/* Delete wall action */}
                          <button
                            onClick={deleteSelectedWall}
                            className="w-full flex items-center justify-center py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-[10px] font-bold transition-colors"
                          >
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            Remove Barrier Line
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="text-center p-2 rounded-lg bg-slate-950/30 border border-slate-850 text-[10px] text-slate-500 leading-relaxed italic">
                        Tip: Click any wall line or door opening on the map to modify its thickness, type, curves, or delete it!
                      </div>
                    )}
                  </div>

                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><Palette className="w-4 h-4 mr-1.5" />Styles</h3><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Floor Color</label><div className="flex items-center space-x-2"><input type="color" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded" /><input type="text" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none" /></div></div></div>
                  <hr className="border-slate-800" />
                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><DoorOpen className="w-4 h-4 mr-1.5" />Main Entrance</h3><div className="space-y-3"><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Side</label><div className="grid grid-cols-4 gap-2">{['top', 'bottom', 'left', 'right'].map((side) => ( <button key={side} onClick={() => update({ ...gym, entrance: { ...entrance, side: side as any } }, true)} className={`text-xs py-1.5 rounded capitalize border transition-all ${entrance.side === side ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{side}</button> ))}</div></div><div><div className="flex justify-between mb-1"><label className="block text-[10px] text-slate-500 uppercase">Position</label><span className="text-[10px] text-blue-400">{entrance.offset}%</span></div><input type="range" min="0" max="100" value={entrance.offset} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, entrance: { ...entrance, offset: parseInt(e.target.value) } }, false)} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" /></div></div></div>
                </div>
              </div>
          )}

        </div>
        </>
          )
        ) : (
          <ExerciseLibrary gym={gym} />
        )}
      </div>
    </div>
  );
};

const AdminPage: React.FC<AdminPageProps> = ({ gyms, setGyms, onExit }) => {
  const [editingGymId, setEditingGymId] = useState<string | null>(null);
  const handleCreateGym = async () => { const newGym: Gym = { id: `gym-${Date.now()}`, name: 'New Location', zones: [], dimensions: { width: 780, height: 580 }, entrance: { side: 'bottom', offset: 50, width: 80 }, floorColor: '#1e293b', annexes: [] }; await api.createGym(newGym); setGyms(prev => [...prev, newGym]); };
  const handleDeleteGym = async (id: string) => { if (window.confirm('Are you sure you want to delete this gym location?')) { await api.deleteGym(id); setGyms(prev => prev.filter(g => g.id !== id)); if (editingGymId === id) setEditingGymId(null); } };
  const saveGymChanges = async (updatedGym: Gym) => { await api.saveGym(updatedGym); setGyms(prev => prev.map(g => g.id === updatedGym.id ? updatedGym : g)); };
  if (editingGymId) { const gym = gyms.find(g => g.id === editingGymId); if (!gym) { setEditingGymId(null); return null; } return ( <GymLayoutEditor initialGym={gym} onSave={saveGymChanges} onBack={() => setEditingGymId(null)} /> ); }
  return ( <GymDashboard gyms={gyms} onCreate={handleCreateGym} onEdit={setEditingGymId} onDelete={handleDeleteGym} onExit={onExit} /> );
};

export default AdminPage;
