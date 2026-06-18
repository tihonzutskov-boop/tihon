
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GymZone, EquipmentType, Gym, GymDimensions, GymEntrance, GymAnnex, GymMachine, LibraryExercise } from '../types';
import GymMap from './GymMap';
import ExerciseLibrary from './ExerciseLibrary';
import { api } from '../services/api';
import { ArrowLeft, Plus, Trash2, Move, Maximize2, MousePointer2, Save, Loader2, Check, Edit3, Eraser, Eye, EyeOff, Brush, Footprints, MapPin, LayoutTemplate, DoorOpen, Palette, BoxSelect, SquareDashed, Undo2, Redo2, Scaling, Grid, PlusSquare, ArrowRightLeft, Cpu, ArrowLeftCircle, Copy, ClipboardPaste, Dumbbell, Activity, Zap, Target, Layers, Box, Wind, RotateCcw, ArrowUpRight, MoveDown, Circle, Waves, Timer, Sparkles, Search, Video, Play, Film, Filter, X, ExternalLink } from 'lucide-react';

const MACHINE_ICONS = [
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Activity', icon: Activity },
  { name: 'Zap', icon: Zap },
  { name: 'Target', icon: Target },
  { name: 'Cpu', icon: Cpu },
  { name: 'Layers', icon: Layers },
  { name: 'Box', icon: Box },
  { name: 'Wind', icon: Wind },
  { name: 'RotateCcw', icon: RotateCcw },
  { name: 'ArrowUpRight', icon: ArrowUpRight },
  { name: 'MoveDown', icon: MoveDown },
  { name: 'Circle', icon: Circle },
  { name: 'Waves', icon: Waves },
  { name: 'Timer', icon: Timer },
];

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
  mode: 'move-zone' | 'resize-zone' | 'resize-room' | 'move-annex' | 'resize-annex' | 'move-machine' | 'resize-machine';
  itemId: string | 'main-room';
  zoneId?: string;
  startX: number;
  startY: number;
  initialData: { x: number; y: number; width: number; height: number; };
  handle?: 'right' | 'bottom' | 'corner';
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

  const [editMode, setEditMode] = useState<'layout' | 'room' | 'machine' | 'sketch'>('layout');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipboard, setClipboard] = useState<{ type: 'zone' | 'machine', data: any } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

  // Sketch pad controls
  const [sketchTool, setSketchTool] = useState<'draw' | 'erase' | 'room' | 'zone'>('draw');
  const [sketchColor, setSketchColor] = useState<string>('#10b981');
  const [sketchWidth, setSketchWidth] = useState<number>(4);
  const [sketchOpacity, setSketchOpacity] = useState<number>(0.6);
  const [showSketch, setShowSketch] = useState<boolean>(true);

  // Active view tab: 'layout' for map designer, 'exercises' for exercise & video library
  const [activeTab, setActiveTab] = useState<'layout' | 'exercises'>('layout');

  // Exercise library state for floor-plan machine placements
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');

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

  const deleteMachine = useCallback(() => {
    if (!selectedZone || !selectedMachineId) return;
    if (window.confirm('Delete this machine?')) {
        const newZones = gym.zones.map(z => {
            if(z.id === selectedZone.id) return { ...z, machines: (z.machines || []).filter(m => m.id !== selectedMachineId) };
            return z;
        });
        update({ ...gym, zones: newZones }, true);
        setSelectedMachineId(null);
    }
  }, [selectedZone, selectedMachineId, gym, update]);

  const deleteZone = useCallback(() => {
    if (!selectedZoneId) return;
    if (window.confirm('Are you sure you want to delete this zone?')) {
      update({ ...gym, zones: gym.zones.filter(z => z.id !== selectedZoneId) }, true);
      setSelectedZoneId(null);
    }
  }, [selectedZoneId, gym, update]);

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
         }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (editMode === 'machine' && selectedMachineId) { e.preventDefault(); deleteMachine(); }
        else if (selectedZoneId && editMode === 'layout') { e.preventDefault(); deleteZone(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, clipboard, editMode, selectedZoneId, selectedMachineId, gym, update, selectedZone, deleteZone, deleteMachine]);

  const handleZoneClick = (zone: GymZone) => { if (!dragState && editMode === 'layout') setSelectedZoneId(zone.id); };
  const handleMapClick = () => { if (!dragState) { editMode === 'machine' ? setSelectedMachineId(null) : setSelectedZoneId(null); } }
  const updateZone = (field: keyof GymZone, value: any) => { if (!selectedZoneId) return; const newZones = gym.zones.map(z => z.id === selectedZoneId ? { ...z, [field]: value } : z); update({ ...gym, zones: newZones }, false); };
  
  const addNewZone = () => {
    const newZone: GymZone = { id: `zone-new-${Date.now()}`, name: 'New Area', type: EquipmentType.FUNCTIONAL, x: Math.min(100, dimensions.width / 2 - 50), y: Math.min(100, dimensions.height / 2 - 50), width: 100, height: 100, color: '#94a3b8', icon: 'Square', description: '', machines: [] };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };

  const addCorridor = () => {
    const newZone: GymZone = { id: `zone-corridor-${Date.now()}`, name: 'Corridor', type: EquipmentType.CORRIDOR, x: 50, y: 50, width: 200, height: 40, color: '#64748b', icon: 'Footprints', description: 'Main walkway', machines: [] };
    update({ ...gym, zones: [...gym.zones, newZone] }, true); setSelectedZoneId(newZone.id);
  };
  
  const addAnnex = () => {
    const newAnnex: GymAnnex = { id: `annex-${Date.now()}`, x: dimensions.width, y: 0, width: 200, height: 200 };
    update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true);
  };

  const handleSketchRoomCreated = (x: number, y: number, w: number, h: number) => {
    snapshot();
    const newAnnex: GymAnnex = { id: `annex-${Date.now()}`, x, y, width: w, height: h };
    update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true);
    // Stay in room sketch mode so they can keep drawing if they want, but regular selection works too
  };

  const handleSketchZoneCreated = (x: number, y: number, w: number, h: number) => {
    snapshot();
    const newZone: GymZone = { 
      id: `zone-new-${Date.now()}`, 
      name: 'Sketched Area', 
      type: EquipmentType.FUNCTIONAL, 
      x, 
      y, 
      width: w, 
      height: h, 
      color: '#3b82f6', 
      icon: 'Square', 
      description: 'Freehand sketched area', 
      machines: [] 
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true);
    setSelectedZoneId(newZone.id);
  };

  const deleteAnnex = (id: string) => { if(window.confirm('Delete this room extension?')) update({ ...gym, annexes: (gym.annexes || []).filter(a => a.id !== id) }, true); };
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

        const strokes = dimensions.sketchStrokes || [];
        if (strokes.length > 0) {
            strokes.forEach(stroke => {
                stroke.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            });
        }
        
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
    if (editMode !== 'room') return; e.preventDefault(); snapshot();
    setDragState({ mode: 'move-annex', itemId: annex.id, startX: e.clientX, startY: e.clientY, initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }, viewParams: calculateViewParams(null) });
  };

  const handleAnnexResizeStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return; e.preventDefault(); snapshot();
    setDragState({ mode: 'resize-annex', itemId: annex.id, startX: e.clientX, startY: e.clientY, initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }, viewParams: calculateViewParams(null) });
  };

  const handleMachineDragStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return; e.preventDefault(); snapshot(); setSelectedMachineId(machine.id);
    setDragState({ mode: 'move-machine', itemId: machine.id, zoneId: zoneId, startX: e.clientX, startY: e.clientY, initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height }, viewParams: calculateViewParams(zoneId) });
  }

  const handleMachineResizeStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return; e.preventDefault(); snapshot(); setSelectedMachineId(machine.id);
    setDragState({ mode: 'resize-machine', itemId: machine.id, zoneId: zoneId, startX: e.clientX, startY: e.clientY, initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height }, viewParams: calculateViewParams(zoneId) });
  }

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
        const newAnnexes = (gym.annexes || []).map(a => { if (a.id !== dragState.itemId) return a; return { ...a, x: snapToGrid(dragState.initialData.x + deltaX), y: snapToGrid(dragState.initialData.y + deltaY) }; });
        update({ ...gym, annexes: newAnnexes }, false);
      } else if (dragState.mode === 'resize-annex') {
        const newAnnexes = (gym.annexes || []).map(a => { if (a.id !== dragState.itemId) return a; return { ...a, width: Math.max(50, snapToGrid(dragState.initialData.width + deltaX)), height: Math.max(50, snapToGrid(dragState.initialData.height + deltaY)) }; });
        update({ ...gym, annexes: newAnnexes }, false);
      } else if (dragState.mode === 'move-machine') {
         const newZones = gym.zones.map(z => { if (z.id !== dragState.zoneId) return z; const newMachines = (z.machines || []).map(m => { if (m.id !== dragState.itemId) return m; let nx = snapToGrid(dragState.initialData.x + deltaX), ny = snapToGrid(dragState.initialData.y + deltaY); nx = Math.max(0, Math.min(z.width - m.width, nx)); ny = Math.max(0, Math.min(z.height - m.height, ny)); return { ...m, x: nx, y: ny }; }); return { ...z, machines: newMachines }; });
         update({ ...gym, zones: newZones }, false);
      } else if (dragState.mode === 'resize-machine') {
         const newZones = gym.zones.map(z => { if (z.id !== dragState.zoneId) return z; const newMachines = (z.machines || []).map(m => { if (m.id !== dragState.itemId) return m; let nw = snapToGrid(dragState.initialData.width + deltaX), nh = snapToGrid(dragState.initialData.height + deltaY); return { ...m, width: Math.max(10, nw), height: Math.max(10, nh) }; }); return { ...z, machines: newMachines }; });
         update({ ...gym, zones: newZones }, false);
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
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors flex-shrink-0">
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

          <div className="flex items-center bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
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
              Exercise & Video Library
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'layout' && (
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
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'layout' ? (
          <>
            <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 flex-shrink-0 shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-slate-800/50">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Editor Modes</h3>
                <div className="space-y-2">
                     <ToolButton active={editMode === 'layout'} onClick={() => { setEditMode('layout'); setSelectedZoneId(null); }} icon={Grid} label="Zones & Layout" description="Move and edit zones" />
                     <ToolButton active={editMode === 'room'} onClick={() => { setEditMode('room'); setSelectedZoneId(null); }} icon={Scaling} label="Floor Plan" description="Adjust room shape" />
                     <ToolButton active={editMode === 'sketch'} onClick={() => { setEditMode('sketch'); setSelectedZoneId(null); }} icon={Edit3} label="Sketch Guide" description="Freehand draw custom layout" />
                </div>
            </div>
            <div className="p-4 flex-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  {editMode === 'machine' ? 'Equipment Tools' : editMode === 'sketch' ? 'Sketch Tools' : 'Creation Tools'}
                </h3>
                <div className="space-y-2">
                    {editMode === 'layout' ? (
                        <>
                           <ToolButton onClick={addNewZone} icon={PlusSquare} label="Add Zone" description="Create a new workout area" variant="action" />
                           <ToolButton onClick={addCorridor} icon={Footprints} label="Add Walkway" description="Mark non-workout paths" variant="action" />
                           <div className="h-4" />
                           {selectedZone ? ( <ToolButton onClick={() => setEditMode('machine')} icon={Dumbbell} label="Edit Machines" description={`Manage equipment in ${selectedZone.name}`} variant="highlight" /> ) : ( <div className="p-3 rounded-xl border border-dashed border-slate-800 text-center"><p className="text-[10px] text-slate-500">Select a zone on the map to edit its machines.</p></div> )}
                        </>
                    ) : editMode === 'room' ? (
                        <>
                           <ToolButton onClick={addAnnex} icon={Plus} label="Add Extension" description="Add an annex room (L-shape)" variant="action" />
                        </>
                    ) : editMode === 'sketch' ? (
                        <div className="p-3.5 rounded-xl border border-dashed border-emerald-800 bg-emerald-950/20 text-center animate-in fade-in duration-300">
                          <p className="text-[11px] text-emerald-400 font-semibold mb-1">Canvas Draftpad Is Active</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">Simply click and drag directly on the gym floor map to draw blueprint outlines or annotations. Swap to eraser on the right menu to delete lines!</p>
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
            editMode === 'sketch' ? 'bg-emerald-950/5 border-emerald-900/30' :
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
                 manualView={dragState?.viewParams}
                 
                 onSketchUpdate={(strokes) => { update({ ...gym, dimensions: { ...dimensions, sketchStrokes: strokes } }, true); }}
                  onSketchRoomCreated={handleSketchRoomCreated}
                  onSketchZoneCreated={handleSketchZoneCreated}
                 sketchOpacity={sketchOpacity}
                 showSketch={showSketch}
                 sketchTool={sketchTool}
                 sketchColor={sketchColor}
                 sketchWidth={sketchWidth}
               />
             </div>
             <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 flex items-center space-x-4 pointer-events-none select-none z-20 backdrop-blur-sm">
               {editMode === 'layout' ? ( 
                 <><span className="flex items-center"><Move className="w-3 h-3 mr-1.5" /> Drag to move</span><span className="w-1 h-1 bg-slate-700 rounded-full"></span><span className="flex items-center"><Maximize2 className="w-3 h-3 mr-1.5" /> Drag corner to resize</span></> 
               ) : editMode === 'room' ? ( 
                 <><span className="flex items-center text-lime-400"><SquareDashed className="w-3 h-3 mr-1.5" /> Drag edges to resize room</span></> 
               ) : editMode === 'sketch' ? (
                 <><span className="flex items-center text-emerald-400"><Edit3 className="w-3 h-3 mr-1.5" /> Pencil Drawing Mode</span><span className="w-1 h-1 bg-slate-700 rounded-full"></span><span className="flex items-center text-slate-400">Click and drag inside floor boundary to sketch layout draft</span></>
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
                    Set up specific training and functional zones in your gym using instant structures or custom shape sketches.
                  </p>
                </div>

                {/* Draw Zone Feature via Sketching */}
                <div className="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 shadow-md">
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Brush className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Sketch a New Zone</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Click-and-drag drawing directly on the gym floor map to outline custom shapes instantly!</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setSketchTool(sketchTool === 'zone' ? 'draw' : 'zone')}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center text-xs font-bold gap-2 border transition-all ${
                      sketchTool === 'zone'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50 animate-pulse'
                        : 'bg-slate-900 text-blue-400 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {sketchTool === 'zone' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        sketch mode active...
                      </>
                    ) : (
                      <>
                        <Brush className="w-3.5 h-3.5" />
                        Sketch Zone Outline
                      </>
                    )}
                  </button>
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
                                {MACHINE_ICONS.map(({ name, icon: Icon }) => {
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
                                      title={name}
                                    >
                                      <Icon size={16} />
                                    </button>
                                  );
                                })}
                             </div>
                        </div>
                        <div><label className="block text-xs text-slate-500 mb-1">Label</label><input value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.name || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, name: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="block text-xs text-slate-500 mb-1">Video URL (YouTube)</label><input value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.videoUrl || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, videoUrl: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} placeholder="https://youtube.com/..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="block text-xs text-slate-500 mb-1">Instructions</label><textarea value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.longDescription || ''} onFocus={() => snapshot()} onChange={(e) => { const newZones = gym.zones.map(z => { if (z.id !== selectedZone.id) return z; return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, longDescription: e.target.value } : m) }; }); update({ ...gym, zones: newZones }, false); }} rows={4} placeholder="Detailed steps..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none" /></div>
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
                     <h3 className="text-xs font-bold text-white mb-2">Main Hall Dimensions</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Width</label><input type="number" value={dimensions.width} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, dimensions: { ...dimensions, width: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) } }, false)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Height</label><input type="number" value={dimensions.height} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, dimensions: { ...dimensions, height: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) } }, false)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></div>
                     </div>
                  </div>
                  {annexes.length > 0 && ( <div className="space-y-2"><h3 className="text-xs font-bold text-white">Extensions</h3>{annexes.map((annex, i) => ( <div key={annex.id} className="bg-slate-800 p-2 rounded flex justify-between items-center text-xs border border-slate-700"><span className="text-slate-300">Ext {i+1} ({annex.width}x{annex.height})</span><button onClick={() => deleteAnnex(annex.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button></div> ))}</div> )}
                  
                  {/* Sketch Room shape tool option */}
                  <div className="p-4 rounded-xl border border-lime-800/40 bg-lime-950/20 shadow-md">
                    <div className="flex items-start space-x-3 mb-3">
                      <div className="p-2 bg-lime-500/10 rounded-lg text-lime-400">
                        <Brush className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Sketch Room Shape</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Draw floor additions freehand on the map to place extension zones instantly.</p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setSketchTool(sketchTool === 'room' ? 'draw' : 'room')}
                      className={`w-full py-2.5 rounded-lg flex items-center justify-center text-xs font-bold gap-2 border transition-all ${
                        sketchTool === 'room'
                          ? 'bg-lime-600 text-white border-lime-500 shadow-md shadow-lime-950/50 animate-pulse'
                          : 'bg-slate-900 text-lime-400 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {sketchTool === 'room' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          sketch mode active...
                        </>
                      ) : (
                        <>
                          <Brush className="w-3.5 h-3.5" />
                          Draw Room Layout
                        </>
                      )}
                    </button>
                  </div>
                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><Palette className="w-4 h-4 mr-1.5" />Styles</h3><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Floor Color</label><div className="flex items-center space-x-2"><input type="color" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded" /><input type="text" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none" /></div></div></div>
                  <hr className="border-slate-800" />
                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><DoorOpen className="w-4 h-4 mr-1.5" />Main Entrance</h3><div className="space-y-3"><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Side</label><div className="grid grid-cols-4 gap-2">{['top', 'bottom', 'left', 'right'].map((side) => ( <button key={side} onClick={() => update({ ...gym, entrance: { ...entrance, side: side as any } }, true)} className={`text-xs py-1.5 rounded capitalize border transition-all ${entrance.side === side ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{side}</button> ))}</div></div><div><div className="flex justify-between mb-1"><label className="block text-[10px] text-slate-500 uppercase">Position</label><span className="text-[10px] text-blue-400">{entrance.offset}%</span></div><input type="range" min="0" max="100" value={entrance.offset} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, entrance: { ...entrance, offset: parseInt(e.target.value) } }, false)} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" /></div></div></div>
                </div>
              </div>
          )}
          {editMode === 'sketch' && (
             <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
                <div className="flex justify-between items-start">
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                    <Brush className="w-4 h-4 mr-2" />
                    Sketch Blueprint
                  </h2>
                </div>
                
                <div className="space-y-4">
                  {/* Tool Brush vs Eraser toggle */}
                  <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                    <label className="block text-[10px] text-slate-500 mb-2 uppercase font-bold">Drawing Tool</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSketchTool('draw')}
                        className={`py-2 rounded flex items-center justify-center text-xs font-semibold gap-1.5 border transition-all ${
                          sketchTool === 'draw' 
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Pencil Brush
                      </button>
                      <button
                        onClick={() => setSketchTool('erase')}
                        className={`py-2 rounded flex items-center justify-center text-xs font-semibold gap-1.5 border transition-all ${
                          sketchTool === 'erase' 
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        Eraser Mode
                      </button>
                    </div>
                  </div>

                  {/* Show/Hide Sketch layers */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/30 rounded border border-slate-800/80">
                    <span className="text-xs text-slate-300 flex items-center">
                      {showSketch ? <Eye className="w-4 h-4 mr-2 text-emerald-400" /> : <EyeOff className="w-4 h-4 mr-2 text-slate-500" />}
                      Show Sketch Overlay
                    </span>
                    <button
                      onClick={() => setShowSketch(!showSketch)}
                      className={`px-3 py-1 rounded text-[11px] font-bold border transition-all ${
                        showSketch 
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800 font-bold' 
                          : 'bg-slate-950 text-slate-500 border-slate-800/80'
                      }`}
                    >
                      {showSketch ? 'VISIBLE' : 'HIDDEN'}
                    </button>
                  </div>

                  {/* Brush Color Presets */}
                  {sketchTool === 'draw' && (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold">Brush Color</label>
                      <div className="flex items-center justify-between gap-1 p-2 bg-slate-950 rounded border border-slate-800">
                        {[
                          { color: '#10b981', label: 'Green' },
                          { color: '#3b82f6', label: 'Blue' },
                          { color: '#f97316', label: 'Orange' },
                          { color: '#ec4899', label: 'Rose' },
                          { color: '#ffffff', label: 'White' }
                        ].map((c) => {
                          const isSelected = sketchColor === c.color;
                          return (
                            <button
                              key={c.color}
                              onClick={() => setSketchColor(c.color)}
                              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center`}
                              style={{ 
                                backgroundColor: c.color, 
                                borderColor: isSelected ? '#ffffff' : 'transparent',
                                boxShadow: isSelected ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none' 
                              }}
                              title={c.label}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 mix-blend-difference" />}
                            </button>
                          );
                        })}
                        
                        {/* Custom Color Pipette */}
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-700 flex items-center justify-center">
                          <input 
                            type="color" 
                            value={sketchColor} 
                            onChange={(e) => setSketchColor(e.target.value)} 
                            className="absolute inset-0 cursor-pointer opacity-0" 
                          />
                          <Palette className="w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Brush Thickness Slider */}
                  {sketchTool === 'draw' && (
                    <div className="space-y-1.5 bg-slate-950/30 p-3 rounded border border-slate-800/60">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                        <span>Brush Size</span>
                        <span className="font-mono text-emerald-400">{sketchWidth}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="2" 
                        max="24" 
                        step="1"
                        value={sketchWidth} 
                        onChange={(e) => setSketchWidth(parseInt(e.target.value))} 
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full" 
                      />
                    </div>
                  )}

                  {/* Sketch Opacity Slider */}
                  <div className="space-y-1 rounded bg-slate-950/30 p-3 border border-slate-800/60">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                      <span>Sketch Opacity</span>
                      <span className="font-mono text-emerald-400">{Math.round(sketchOpacity * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1.0" 
                      step="0.05"
                      value={sketchOpacity} 
                      onChange={(e) => setSketchOpacity(parseFloat(e.target.value))} 
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full" 
                    />
                  </div>

                  <hr className="border-slate-800/60" />

                  {/* Clean brush strokes operations */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-500 uppercase font-bold">Blueprint Actions</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const strokes = dimensions.sketchStrokes || [];
                          if (strokes.length > 0) {
                            snapshot();
                            const updated = strokes.slice(0, -1);
                            update({ ...gym, dimensions: { ...dimensions, sketchStrokes: updated } }, true);
                          }
                        }}
                        disabled={!(dimensions.sketchStrokes && dimensions.sketchStrokes.length > 0)}
                        className={`py-2 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                          dimensions.sketchStrokes && dimensions.sketchStrokes.length > 0
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer text-xs font-semibold'
                            : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
                        }`}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo Line
                      </button>
                      
                      <button
                        onClick={() => {
                          if (window.confirm('Erase all drawing strokes on your blueprint?')) {
                            snapshot();
                            update({ ...gym, dimensions: { ...dimensions, sketchStrokes: [] } }, true);
                          }
                        }}
                        disabled={!(dimensions.sketchStrokes && dimensions.sketchStrokes.length > 0)}
                        className={`py-2 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                          dimensions.sketchStrokes && dimensions.sketchStrokes.length > 0
                            ? 'bg-red-950/30 hover:bg-red-900/40 text-red-400 border-red-900/30 cursor-pointer text-xs font-semibold'
                            : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Sketch
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          )}
        </div>
        </>
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
