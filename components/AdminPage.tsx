
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GymZone, EquipmentType, Gym, GymDimensions, GymEntrance, GymAnnex, GymMachine } from '../types';
import GymMap from './GymMap';
import { api } from '../services/api';
import { ArrowLeft, Plus, Trash2, Move, Maximize2, MousePointer2, Save, Loader2, Check, Edit3, Footprints, MapPin, LayoutTemplate, DoorOpen, Palette, BoxSelect, SquareDashed, Undo2, Redo2, Scaling, Grid, PlusSquare, ArrowRightLeft, Cpu, ArrowLeftCircle, Copy, ClipboardPaste, Dumbbell, Activity, Zap, Target, Layers, Box, Wind, RotateCcw, ArrowUpRight, MoveDown, Circle, Waves, Timer } from 'lucide-react';

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

  const [editMode, setEditMode] = useState<'layout' | 'room' | 'machine'>('layout');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipboard, setClipboard] = useState<{ type: 'zone' | 'machine', data: any } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

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
        let maxX = dimensions.width; let maxY = dimensions.height;
        annexes.forEach(a => { maxX = Math.max(maxX, a.x + a.width); maxY = Math.max(maxY, a.y + a.height); });
        viewBoxWidth = Math.max(minViewWidth, maxX + PADDING); viewBoxHeight = Math.max(minViewHeight, maxY + PADDING);
        offsetX = (viewBoxWidth - maxX) / 2; offsetY = (viewBoxHeight - maxY) / 2;
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
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex flex-col"><span className="text-[10px] text-lime-400 font-bold uppercase tracking-widest">Editing</span><input value={gym.name} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, name: e.target.value }, false)} className="bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b border-slate-600 hover:border-slate-700 transition-colors w-64" /></div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 mr-2 border-r border-slate-800 pr-4">
            <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></button>
          </div>
          <button onClick={handleSave} disabled={saveState !== 'idle'} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all min-w-[140px] justify-center ${saveState === 'saved' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'}`}>
            {saveState === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saveState === 'saved' ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Layout'}
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 flex-shrink-0 shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-slate-800/50">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Editor Modes</h3>
                <div className="space-y-2">
                     <ToolButton active={editMode === 'layout'} onClick={() => { setEditMode('layout'); setSelectedZoneId(null); }} icon={Grid} label="Zones & Layout" description="Move and edit zones" />
                     <ToolButton active={editMode === 'room'} onClick={() => { setEditMode('room'); setSelectedZoneId(null); }} icon={Scaling} label="Floor Plan" description="Adjust room shape" />
                </div>
            </div>
            <div className="p-4 flex-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{editMode === 'machine' ? 'Equipment Tools' : 'Creation Tools'}</h3>
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
                    ) : (
                        <>
                           <ToolButton onClick={addMachine} icon={Cpu} label="Add Machine" description="Place new equipment item" variant="highlight" />
                           <div className="h-px bg-slate-800 my-4" />
                           <ToolButton onClick={() => setEditMode('layout')} icon={ArrowLeftCircle} label="Return to Zones" description="Exit machine editor" />
                        </>
                    )}
                </div>
            </div>
        </aside>
        <div className="flex-1 p-8 bg-slate-950 flex flex-col min-w-0">
          <div ref={mapContainerRef} className={`flex-1 relative border rounded-xl overflow-hidden flex items-center justify-center transition-colors duration-500 shadow-inner ${editMode === 'room' ? 'bg-lime-950/5 border-lime-900/30' : editMode === 'machine' ? 'bg-blue-950/5 border-blue-900/30' : 'bg-slate-900/50 border-slate-800'}`}>
             <div className="absolute inset-0 p-4"><GymMap zones={zones} dimensions={dimensions} entrance={entrance} floorColor={floorColor} annexes={annexes} onZoneClick={handleZoneClick} onMapClick={handleMapClick} selectedZoneId={selectedZoneId} focusedZoneId={editMode === 'machine' ? selectedZoneId : null} isEditable={true} editMode={editMode} onZoneDragStart={handleZoneDragStart} onZoneResizeStart={handleZoneResizeStart} onMainRoomResizeStart={handleMainRoomResizeStart} onAnnexDragStart={handleAnnexDragStart} onAnnexResizeStart={handleAnnexResizeStart} onMachineDragStart={handleMachineDragStart} onMachineResizeStart={handleMachineResizeStart} selectedMachineId={selectedMachineId} manualView={dragState?.viewParams} /></div>
             <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 flex items-center space-x-4 pointer-events-none select-none z-20 backdrop-blur-sm">
               {editMode === 'layout' ? ( <><span className="flex items-center"><Move className="w-3 h-3 mr-1.5" /> Drag to move</span><span className="w-1 h-1 bg-slate-700 rounded-full"></span><span className="flex items-center"><Maximize2 className="w-3 h-3 mr-1.5" /> Drag corner to resize</span></> ) : editMode === 'room' ? ( <><span className="flex items-center text-lime-400"><SquareDashed className="w-3 h-3 mr-1.5" /> Drag edges to resize room</span></> ) : ( <><span className="flex items-center text-blue-400"><Cpu className="w-3 h-3 mr-1.5" /> Drag machines to arrange</span></> )}
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
                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><Palette className="w-4 h-4 mr-1.5" />Styles</h3><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Floor Color</label><div className="flex items-center space-x-2"><input type="color" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded" /><input type="text" value={floorColor} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none" /></div></div></div>
                  <hr className="border-slate-800" />
                  <div><h3 className="text-xs font-bold text-white mb-3 flex items-center"><DoorOpen className="w-4 h-4 mr-1.5" />Main Entrance</h3><div className="space-y-3"><div><label className="block text-[10px] text-slate-500 mb-1 uppercase">Side</label><div className="grid grid-cols-4 gap-2">{['top', 'bottom', 'left', 'right'].map((side) => ( <button key={side} onClick={() => update({ ...gym, entrance: { ...entrance, side: side as any } }, true)} className={`text-xs py-1.5 rounded capitalize border transition-all ${entrance.side === side ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{side}</button> ))}</div></div><div><div className="flex justify-between mb-1"><label className="block text-[10px] text-slate-500 uppercase">Position</label><span className="text-[10px] text-blue-400">{entrance.offset}%</span></div><input type="range" min="0" max="100" value={entrance.offset} onFocus={() => snapshot()} onChange={(e) => update({ ...gym, entrance: { ...entrance, offset: parseInt(e.target.value) } }, false)} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" /></div></div></div>
                </div>
             </div>
          )}
        </div>
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
