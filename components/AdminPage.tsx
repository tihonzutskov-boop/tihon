
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GymZone, EquipmentType, Gym, GymDimensions, GymEntrance, GymAnnex, GymMachine } from '../types';
import GymMap from './GymMap';
import { api } from '../services/api';
import { ArrowLeft, Plus, Trash2, Move, Maximize2, MousePointer2, Save, Loader2, Check, Edit3, Footprints, MapPin, LayoutTemplate, DoorOpen, Palette, BoxSelect, SquareDashed, Undo2, Redo2, Scaling, Grid, PlusSquare, ArrowRightLeft, Cpu, ArrowLeftCircle } from 'lucide-react';

interface AdminPageProps {
  gyms: Gym[];
  setGyms: React.Dispatch<React.SetStateAction<Gym[]>>;
  onExit: () => void;
}

// --- History Hook ---
const useGymHistory = (initialGym: Gym) => {
  const [past, setPast] = useState<Gym[]>([]);
  const [present, setPresent] = useState<Gym>(initialGym);
  const [future, setFuture] = useState<Gym[]>([]);

  // Call this to record a significant change (e.g., before drag start, or on specific button click)
  const snapshot = useCallback(() => {
    setPast(prev => [...prev, present]);
    setFuture([]);
  }, [present]);

  // Call this to update state. 
  // If saveToHistory is true, it snapshots the *previous* state before applying new.
  // useful for one-off actions like "Add Zone"
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

  return {
    gym: present,
    update,
    snapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
};

// --- Gym Dashboard Component ---
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
            <button 
              onClick={onExit}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Gym Management</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Admin Dashboard</p>
            </div>
         </div>
         <button 
            onClick={onCreate}
            className="flex items-center px-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-900 rounded-lg text-sm font-bold transition-all shadow-lg shadow-lime-900/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Gym
          </button>
      </header>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {gyms.map(gym => (
            <div key={gym.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 hover:shadow-2xl transition-all group flex flex-col">
               {/* Map Preview Header */}
               <div className="h-40 bg-slate-950/50 border-b border-slate-800 relative">
                  <div className="absolute inset-0 p-4 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                    <GymMap 
                      zones={gym.zones} 
                      dimensions={gym.dimensions} 
                      entrance={gym.entrance} 
                      floorColor={gym.floorColor}
                      annexes={gym.annexes}
                      isThumbnail={true} 
                    />
                  </div>
                  {/* Overlay Gradient for Text Contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />
               </div>

               <div className="p-6 flex-1 flex flex-col">
                 <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-bold text-white leading-tight">{gym.name}</h3>
                   <div className="flex space-x-1">
                      <button 
                        onClick={() => onEdit(gym.id)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Layout"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(gym.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete Gym"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 </div>
                 
                 <div className="flex items-center text-sm text-slate-400 mb-6 mt-auto">
                    <MapPin className="w-4 h-4 mr-1.5 text-slate-500" />
                    <span>{gym.zones.length} Active Zones</span>
                 </div>

                 <button 
                   onClick={() => onEdit(gym.id)}
                   className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm transition-colors flex items-center justify-center border border-slate-700 group-hover:border-slate-600"
                 >
                   Open Floor Editor
                 </button>
               </div>
            </div>
          ))}
          
          <button 
             onClick={onCreate}
             className="border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-lime-500 hover:border-lime-500/30 hover:bg-slate-900/50 transition-all min-h-[300px]"
          >
             <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 shadow-inner">
               <Plus className="w-8 h-8" />
             </div>
             <span className="font-semibold">Create New Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Single Gym Editor Component ---
interface GymLayoutEditorProps {
  initialGym: Gym;
  onSave: (updatedGym: Gym) => Promise<void>;
  onBack: () => void;
}

interface DragState {
  mode: 'move-zone' | 'resize-zone' | 'resize-room' | 'move-annex' | 'resize-annex' | 'move-machine' | 'resize-machine';
  itemId: string | 'main-room';
  zoneId?: string; // For machine dragging
  startX: number;
  startY: number;
  initialData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  handle?: 'right' | 'bottom' | 'corner'; // specific for room resizing
  viewParams?: { viewBox: string, offsetX: number, offsetY: number, width: number, height: number }; // snapshot of view for locking
}

// Helper UI Component for Tool Buttons
const ToolButton = ({ active, onClick, icon: Icon, label, disabled = false, highlight = false }: { active?: boolean, onClick: () => void, icon: any, label: string, disabled?: boolean, highlight?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 group border
      ${active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 border-blue-500 ring-1 ring-blue-400' 
        : highlight 
          ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 border-blue-900/30'
          : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border-transparent hover:border-slate-700'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
    `}
  >
    <Icon className={`w-6 h-6 mb-1.5 ${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
    <span className="text-[10px] font-medium tracking-wide">{label}</span>
    {active && <div className="absolute inset-x-0 -bottom-px h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />}
  </button>
);


const GymLayoutEditor: React.FC<GymLayoutEditorProps> = ({ 
  initialGym,
  onSave,
  onBack
}) => {
  // Use History Hook for state management
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
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      // Alternate Redo (Ctrl+Y)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleZoneClick = (zone: GymZone) => {
    if (!dragState && editMode === 'layout') {
      setSelectedZoneId(zone.id);
    }
  };

  const handleMapClick = () => {
    if (!dragState) {
      if (editMode === 'machine') {
         setSelectedMachineId(null);
      } else {
         setSelectedZoneId(null);
      }
    }
  }

  const updateZone = (field: keyof GymZone, value: any) => {
    if (!selectedZoneId) return;
    const newZones = gym.zones.map(z => z.id === selectedZoneId ? { ...z, [field]: value } : z);
    update({ ...gym, zones: newZones }, false); // Input fields snapshot on focus
  };

  const addNewZone = () => {
    const newZone: GymZone = {
      id: `zone-new-${Date.now()}`,
      name: 'New Area',
      type: EquipmentType.FUNCTIONAL,
      // Default to center-ish relative coords
      x: Math.min(100, dimensions.width / 2 - 50),
      y: Math.min(100, dimensions.height / 2 - 50),
      width: 100,
      height: 100,
      color: '#94a3b8',
      icon: 'Square',
      description: '',
      machines: []
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true);
    setSelectedZoneId(newZone.id);
  };

  const addCorridor = () => {
    const newZone: GymZone = {
      id: `zone-corridor-${Date.now()}`,
      name: 'Corridor',
      type: EquipmentType.CORRIDOR,
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      color: '#64748b',
      icon: 'Footprints',
      description: 'Main walkway',
      machines: []
    };
    update({ ...gym, zones: [...gym.zones, newZone] }, true);
    setSelectedZoneId(newZone.id);
  };

  const addMachine = () => {
    if (!selectedZone) return;
    const newMachine: GymMachine = {
      id: `machine-${Date.now()}`,
      name: 'Machine',
      x: 10,
      y: 10,
      width: 40,
      height: 40
    };
    
    const newZones = gym.zones.map(z => {
      if (z.id === selectedZone.id) {
        return { ...z, machines: [...(z.machines || []), newMachine] };
      }
      return z;
    });

    update({ ...gym, zones: newZones }, true);
    setSelectedMachineId(newMachine.id);
  };

  const deleteMachine = useCallback(() => {
    if (!selectedZone || !selectedMachineId) return;
    if (window.confirm('Delete this machine?')) {
        const newZones = gym.zones.map(z => {
            if(z.id === selectedZone.id) {
                return { ...z, machines: (z.machines || []).filter(m => m.id !== selectedMachineId) };
            }
            return z;
        });
        update({ ...gym, zones: newZones }, true);
        setSelectedMachineId(null);
    }
  }, [selectedZone, selectedMachineId, gym, update]);
  
  const addAnnex = () => {
    const newAnnex: GymAnnex = {
       id: `annex-${Date.now()}`,
       x: dimensions.width, // default to right side
       y: 0,
       width: 200,
       height: 200
    };
    update({ ...gym, annexes: [...(gym.annexes || []), newAnnex] }, true);
  };

  const deleteAnnex = (id: string) => {
     if(window.confirm('Delete this room extension?')) {
        update({ ...gym, annexes: (gym.annexes || []).filter(a => a.id !== id) }, true);
     }
  };

  // Robust delete function
  const deleteZone = useCallback(() => {
    if (!selectedZoneId) return;
    
    if (window.confirm('Are you sure you want to delete this zone?')) {
      update({ ...gym, zones: gym.zones.filter(z => z.id !== selectedZoneId) }, true);
      setSelectedZoneId(null);
    }
  }, [selectedZoneId, gym, update]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteZone();
  };

  // Keyboard support for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent deleting if user is typing in an input field
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (editMode === 'machine' && selectedMachineId) {
             e.preventDefault();
             deleteMachine();
        } else if (selectedZoneId && editMode === 'layout') {
             e.preventDefault();
             deleteZone();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoneId, selectedMachineId, deleteZone, deleteMachine, editMode]);

  const handleSave = async () => {
    setSaveState('saving');
    await onSave(gym);
    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
    }, 2000);
  };

  // Helpers to snapshot view state for manual view locking
  const calculateViewParams = (focusedZoneId: string | null = null) => {
    let viewBoxWidth, viewBoxHeight, offsetX, offsetY;
    const PADDING = 150;
    const minViewWidth = 800;
    const minViewHeight = 600;

    if (focusedZoneId) {
        // Calculate view for Zoomed Zone (copied logic from GymMap)
        const zone = zones.find(z => z.id === focusedZoneId);
        if (zone) {
            const ZOOM_PADDING = 40;
            const MIN_VIEW_SIZE = 500;
            const targetWidth = zone.width + (ZOOM_PADDING * 2);
            const targetHeight = zone.height + (ZOOM_PADDING * 2);
            
            viewBoxWidth = Math.max(targetWidth, MIN_VIEW_SIZE);
            viewBoxHeight = Math.max(targetHeight, MIN_VIEW_SIZE);
            offsetX = ((viewBoxWidth - zone.width) / 2) - zone.x;
            offsetY = ((viewBoxHeight - zone.height) / 2) - zone.y;
        } else {
             // fallback
             viewBoxWidth = 800; viewBoxHeight = 600; offsetX = 0; offsetY = 0;
        }
    } else {
        // Calculate view for Full Map
        let maxX = dimensions.width;
        let maxY = dimensions.height;
        annexes.forEach(a => {
            maxX = Math.max(maxX, a.x + a.width);
            maxY = Math.max(maxY, a.y + a.height);
        });
        
        viewBoxWidth = Math.max(minViewWidth, maxX + PADDING);
        viewBoxHeight = Math.max(minViewHeight, maxY + PADDING);

        offsetX = (viewBoxWidth - maxX) / 2;
        offsetY = (viewBoxHeight - maxY) / 2;
    }

    return {
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
      offsetX,
      offsetY,
      width: viewBoxWidth,
      height: viewBoxHeight
    };
  }

  // --- Drag & Resize Logic ---
  
  const handleZoneDragStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return;
    e.preventDefault(); 
    snapshot(); // Save state before drag
    setSelectedZoneId(zone.id);
    
    const viewParams = calculateViewParams(null);

    setDragState({
      mode: 'move-zone',
      itemId: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height },
      viewParams
    });
  };

  const handleZoneResizeStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return;
    e.preventDefault();
    snapshot(); // Save state before resize
    setSelectedZoneId(zone.id);

    const viewParams = calculateViewParams(null);

    setDragState({
      mode: 'resize-zone',
      itemId: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height },
      viewParams
    });
  };
  
  const handleMainRoomResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'corner') => {
    if (editMode !== 'room') return;
    e.preventDefault();
    snapshot(); // Save state before room resize

    const viewParams = calculateViewParams(null);

    setDragState({
       mode: 'resize-room',
       itemId: 'main-room',
       startX: e.clientX,
       startY: e.clientY,
       initialData: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
       handle,
       viewParams
    });
  };

  const handleAnnexDragStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return;
    e.preventDefault();
    snapshot(); // Save state before annex move
    
    const viewParams = calculateViewParams(null);

    setDragState({
      mode: 'move-annex',
      itemId: annex.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height },
      viewParams
    });
  };

  const handleAnnexResizeStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return;
    e.preventDefault();
    snapshot(); // Save state before annex resize

    const viewParams = calculateViewParams(null);

    setDragState({
      mode: 'resize-annex',
      itemId: annex.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height },
      viewParams
    });
  };

  const handleMachineDragStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return;
    e.preventDefault();
    snapshot();
    setSelectedMachineId(machine.id);

    // Calculate view params for the ZOOMED state
    const viewParams = calculateViewParams(zoneId);

    setDragState({
       mode: 'move-machine',
       itemId: machine.id,
       zoneId: zoneId,
       startX: e.clientX,
       startY: e.clientY,
       initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height },
       viewParams
    });
  }

  const handleMachineResizeStart = (e: React.MouseEvent, machine: GymMachine, zoneId: string) => {
    if (editMode !== 'machine') return;
    e.preventDefault();
    snapshot();
    setSelectedMachineId(machine.id);

    // Calculate view params for the ZOOMED state
    const viewParams = calculateViewParams(zoneId);

    setDragState({
       mode: 'resize-machine',
       itemId: machine.id,
       zoneId: zoneId,
       startX: e.clientX,
       startY: e.clientY,
       initialData: { x: machine.x, y: machine.y, width: machine.width, height: machine.height },
       viewParams
    });
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !mapContainerRef.current) return;
      
      // Use locked view params if available to prevent jitter
      let scaleX = 1;
      let scaleY = 1;
      
      if (dragState.viewParams) {
          const rect = mapContainerRef.current.getBoundingClientRect();
          scaleX = dragState.viewParams.width / rect.width;
          scaleY = dragState.viewParams.height / rect.height;
      }

      const deltaX = (e.clientX - dragState.startX) * scaleX;
      const deltaY = (e.clientY - dragState.startY) * scaleY;

      // --- Snapping Logic ---
      const snapToGrid = (val: number) => Math.round(val / 10) * 10;
      const SNAP_THRESHOLD = 15;

      const getSnapLines = () => {
         const xLines = [0, dimensions.width];
         const yLines = [0, dimensions.height];
         annexes.forEach(a => {
            xLines.push(a.x, a.x + a.width);
            yLines.push(a.y, a.y + a.height);
         });
         return { xLines, yLines };
      };

      const snapToEdges = (val: number, lines: number[]) => {
         let best = null;
         let minDiff = SNAP_THRESHOLD;
         for (const line of lines) {
            const diff = Math.abs(val - line);
            if (diff < minDiff) {
               minDiff = diff;
               best = line;
            }
         }
         return best;
      };

      const { xLines, yLines } = getSnapLines();


      // Handle Zone Dragging
      if (dragState.mode === 'move-zone') {
        const newZones = gym.zones.map(z => {
          if (z.id !== dragState.itemId) return z;
          
          let rawX = dragState.initialData.x + deltaX;
          let rawY = dragState.initialData.y + deltaY;
          const w = dragState.initialData.width;
          const h = dragState.initialData.height;

          // X Snapping
          let finalX = rawX;
          const snapLeft = snapToEdges(rawX, xLines);
          if (snapLeft !== null) {
             finalX = snapLeft;
          } else {
             const snapRight = snapToEdges(rawX + w, xLines);
             if (snapRight !== null) finalX = snapRight - w;
             else finalX = snapToGrid(rawX);
          }

          // Y Snapping
          let finalY = rawY;
          const snapTop = snapToEdges(rawY, yLines);
          if (snapTop !== null) {
             finalY = snapTop;
          } else {
             const snapBottom = snapToEdges(rawY + h, yLines);
             if (snapBottom !== null) finalY = snapBottom - h;
             else finalY = snapToGrid(rawY);
          }

          return { ...z, x: Math.max(0, finalX), y: Math.max(0, finalY) };
        });
        update({ ...gym, zones: newZones }, false);
      } 
      // Handle Zone Resizing
      else if (dragState.mode === 'resize-zone') {
        const newZones = gym.zones.map(z => {
          if (z.id !== dragState.itemId) return z;
          
          let rawWidth = dragState.initialData.width + deltaX;
          let rawHeight = dragState.initialData.height + deltaY;
          
          if (e.shiftKey) {
             const ratio = dragState.initialData.width / dragState.initialData.height;
             if (Math.abs(deltaX) > Math.abs(deltaY)) rawHeight = rawWidth / ratio;
             else rawWidth = rawHeight * ratio;
             return { ...z, width: Math.max(40, snapToGrid(rawWidth)), height: Math.max(40, snapToGrid(rawHeight)) };
          }

          // Width Snapping
          const currentX = dragState.initialData.x;
          const targetRight = currentX + rawWidth;
          const snapRight = snapToEdges(targetRight, xLines);
          const finalWidth = snapRight !== null ? snapRight - currentX : snapToGrid(rawWidth);

          // Height Snapping
          const currentY = dragState.initialData.y;
          const targetBottom = currentY + rawHeight;
          const snapBottom = snapToEdges(targetBottom, yLines);
          const finalHeight = snapBottom !== null ? snapBottom - currentY : snapToGrid(rawHeight);

          return { ...z, width: Math.max(40, finalWidth), height: Math.max(40, finalHeight) };
        });
        update({ ...gym, zones: newZones }, false);
      }
      // Handle Main Room Resizing
      else if (dragState.mode === 'resize-room') {
         let newW = dragState.initialData.width;
         let newH = dragState.initialData.height;
         
         if (dragState.handle === 'right' || dragState.handle === 'corner') {
            newW = snapToGrid(dragState.initialData.width + deltaX);
         }
         if (dragState.handle === 'bottom' || dragState.handle === 'corner') {
            newH = snapToGrid(dragState.initialData.height + deltaY);
         }
         update({ ...gym, dimensions: { width: Math.max(200, Math.min(2000, newW)), height: Math.max(200, Math.min(2000, newH)) } }, false);
      }
      // Handle Annex Moving
      else if (dragState.mode === 'move-annex') {
        const newAnnexes = (gym.annexes || []).map(a => {
           if (a.id !== dragState.itemId) return a;
           return { ...a, x: snapToGrid(dragState.initialData.x + deltaX), y: snapToGrid(dragState.initialData.y + deltaY) };
        });
        update({ ...gym, annexes: newAnnexes }, false);
      }
      // Handle Annex Resizing
      else if (dragState.mode === 'resize-annex') {
        const newAnnexes = (gym.annexes || []).map(a => {
           if (a.id !== dragState.itemId) return a;
           return { ...a, width: Math.max(50, snapToGrid(dragState.initialData.width + deltaX)), height: Math.max(50, snapToGrid(dragState.initialData.height + deltaY)) };
        });
        update({ ...gym, annexes: newAnnexes }, false);
      }
      // Handle Machine Moving
      else if (dragState.mode === 'move-machine') {
         const newZones = gym.zones.map(z => {
             if (z.id !== dragState.zoneId) return z;
             
             const newMachines = (z.machines || []).map(m => {
                 if (m.id !== dragState.itemId) return m;
                 // Machines don't need intense edge snapping, just grid
                 let nx = snapToGrid(dragState.initialData.x + deltaX);
                 let ny = snapToGrid(dragState.initialData.y + deltaY);
                 // Keep inside zone
                 nx = Math.max(0, Math.min(z.width - m.width, nx));
                 ny = Math.max(0, Math.min(z.height - m.height, ny));
                 
                 return { ...m, x: nx, y: ny };
             });
             return { ...z, machines: newMachines };
         });
         update({ ...gym, zones: newZones }, false);
      }
      // Handle Machine Resizing
      else if (dragState.mode === 'resize-machine') {
         const newZones = gym.zones.map(z => {
             if (z.id !== dragState.zoneId) return z;
             
             const newMachines = (z.machines || []).map(m => {
                 if (m.id !== dragState.itemId) return m;
                 let nw = snapToGrid(dragState.initialData.width + deltaX);
                 let nh = snapToGrid(dragState.initialData.height + deltaY);
                 
                 return { ...m, width: Math.max(10, nw), height: Math.max(10, nh) };
             });
             return { ...z, machines: newMachines };
         });
         update({ ...gym, zones: newZones }, false);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, gym, update, dimensions, annexes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 animate-in slide-in-from-right duration-300">
      {/* Editor Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 flex-shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] text-lime-400 font-bold uppercase tracking-widest">Editing</span>
            <input 
              value={gym.name}
              onFocus={() => snapshot()}
              onChange={(e) => update({ ...gym, name: e.target.value }, false)}
              className="bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b border-slate-600 hover:border-slate-700 transition-colors w-64"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Undo / Redo Controls */}
          <div className="flex items-center space-x-1 mr-2 border-r border-slate-800 pr-4">
            <button 
              onClick={undo}
              disabled={!canUndo}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={!canRedo}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={handleSave}
            disabled={saveState !== 'idle'}
            className={`
              flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all min-w-[140px] justify-center
              ${saveState === 'saved' 
                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'}
            `}
          >
            {saveState === 'saving' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saveState === 'saved' ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Layout'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT TOOLBAR / MENU */}
        <aside className="w-24 bg-slate-900 border-r border-slate-800 flex flex-col py-6 z-10 flex-shrink-0 shadow-xl overflow-y-auto">
            {/* Section: Mode */}
            {editMode !== 'machine' && (
                <div className="px-3 mb-6">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Editor Mode</h3>
                    <div className="space-y-2">
                        <ToolButton 
                            active={editMode === 'layout'}
                            onClick={() => { setEditMode('layout'); setSelectedZoneId(null); }}
                            icon={Grid}
                            label="Layout"
                        />
                        <ToolButton 
                            active={editMode === 'room'}
                            onClick={() => { setEditMode('room'); setSelectedZoneId(null); }}
                            icon={Scaling}
                            label="Structure"
                        />
                    </div>
                </div>
            )}
            
            {editMode !== 'machine' && <div className="mx-4 h-px bg-slate-800 mb-6" />}

            {/* Section: Tools */}
            <div className="px-3 flex-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Toolkit</h3>
                <div className="space-y-2">
                    {editMode === 'layout' ? (
                        <>
                           <ToolButton 
                              onClick={addNewZone} 
                              icon={PlusSquare} 
                              label="Add Zone" 
                           />
                           <ToolButton 
                              onClick={addCorridor} 
                              icon={Footprints} 
                              label="Walkway" 
                           />
                           {selectedZone && (
                               <ToolButton 
                                  highlight
                                  onClick={() => setEditMode('machine')} 
                                  icon={Cpu} 
                                  label="Edit Equipment" 
                               />
                           )}
                        </>
                    ) : editMode === 'room' ? (
                        <>
                           <ToolButton 
                              onClick={addAnnex} 
                              icon={Plus} 
                              label="Add Annex" 
                           />
                        </>
                    ) : (
                         /* Machine Edit Mode Tools */
                        <>
                           <ToolButton 
                              onClick={() => setEditMode('layout')}
                              icon={ArrowLeftCircle} 
                              label="Back" 
                           />
                           <div className="h-px bg-slate-800 my-2" />
                           <ToolButton 
                              onClick={addMachine} 
                              icon={Cpu} 
                              label="Add Machine" 
                              highlight
                           />
                        </>
                    )}
                </div>
            </div>
        </aside>

        {/* Main Map Area */}
        <div className="flex-1 p-8 bg-slate-950 flex flex-col min-w-0">
          <div 
            ref={mapContainerRef}
            className={`flex-1 relative border rounded-xl overflow-hidden flex items-center justify-center transition-colors duration-500 shadow-inner
              ${editMode === 'room' ? 'bg-lime-950/5 border-lime-900/30' : 
                editMode === 'machine' ? 'bg-blue-950/5 border-blue-900/30' :
                'bg-slate-900/50 border-slate-800'}
            `}
          >
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
                 focusedZoneId={editMode === 'machine' ? selectedZoneId : null} // Auto-zoom to selected zone in machine mode
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
               />
             </div>
             
             {/* Bottom Helper Bar */}
             <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 flex items-center space-x-4 pointer-events-none select-none z-20 backdrop-blur-sm">
               {editMode === 'layout' ? (
                 <>
                   <span className="flex items-center"><Move className="w-3 h-3 mr-1.5" /> Drag to move</span>
                   <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                   <span className="flex items-center"><Maximize2 className="w-3 h-3 mr-1.5" /> Drag corner to resize</span>
                 </>
               ) : editMode === 'room' ? (
                 <>
                   <span className="flex items-center text-lime-400"><SquareDashed className="w-3 h-3 mr-1.5" /> Drag edges to resize room</span>
                 </>
               ) : (
                 <>
                    <span className="flex items-center text-blue-400"><Cpu className="w-3 h-3 mr-1.5" /> Drag machines to arrange</span>
                 </>
               )}
             </div>
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto flex-shrink-0 z-10 shadow-xl">
          {/* CONTENT SWITCHING BASED ON MODE AND SELECTION */}
          
          {editMode === 'layout' && selectedZone && (
            <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
              <div className="flex justify-between items-start">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Zone Properties</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Zone Name</label>
                  <input 
                    type="text" 
                    value={selectedZone.name}
                    onFocus={() => snapshot()}
                    onChange={(e) => updateZone('name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Description</label>
                  <textarea 
                    value={selectedZone.description || ''}
                    onFocus={() => snapshot()}
                    onChange={(e) => updateZone('description', e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                    <button 
                        onClick={() => setEditMode('machine')}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 hover:border-blue-500/50 rounded flex items-center justify-center transition-all text-xs font-bold uppercase tracking-wide"
                    >
                        <Cpu className="w-4 h-4 mr-2" />
                        Manage Equipment
                    </button>
                    <p className="text-[10px] text-center mt-2 text-slate-500">
                        {selectedZone.machines?.length || 0} machines inside
                    </p>
                </div>
                <div className="h-px bg-slate-800 my-2" />
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Color Code</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="color" 
                      value={selectedZone.color}
                      onFocus={() => snapshot()}
                      onChange={(e) => updateZone('color', e.target.value)}
                      className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded"
                    />
                    <input 
                      type="text" 
                      value={selectedZone.color}
                      onFocus={() => snapshot()}
                      onChange={(e) => updateZone('color', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button 
                  type="button"
                  onClick={handleDeleteClick}
                  className="w-full flex items-center justify-center px-4 py-3 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-900/50 rounded-lg text-sm font-medium transition-all group"
                >
                  <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  Delete Zone
                </button>
              </div>
            </div>
          )}

          {editMode === 'layout' && !selectedZone && (
             <div className="p-6 flex flex-col items-center justify-center h-full text-center text-slate-500">
                <MousePointer2 className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Select a zone on the map to edit its properties.</p>
             </div>
          )}

          {editMode === 'machine' && selectedZone && (
              <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
                 <div className="flex items-center justify-between">
                     <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center">
                        <Cpu className="w-4 h-4 mr-2" />
                        Equipment Editor
                     </h2>
                 </div>
                 <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                    <p className="text-xs text-slate-400 font-bold mb-1">{selectedZone.name}</p>
                    <p className="text-[10px] text-slate-500">Drag items to position. Use toolbar to add.</p>
                 </div>
                 
                 {selectedMachineId ? (
                    <div className="space-y-4">
                        <div className="text-xs font-bold text-white border-b border-slate-800 pb-2">Selected Machine</div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">Label</label>
                             <input 
                                value={(selectedZone.machines || []).find(m => m.id === selectedMachineId)?.name || ''}
                                onFocus={() => snapshot()}
                                onChange={(e) => {
                                    const newZones = gym.zones.map(z => {
                                        if (z.id !== selectedZone.id) return z;
                                        return { ...z, machines: (z.machines || []).map(m => m.id === selectedMachineId ? { ...m, name: e.target.value } : m) };
                                    });
                                    update({ ...gym, zones: newZones }, false);
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                             />
                        </div>
                        <button 
                            onClick={deleteMachine}
                            className="w-full flex items-center justify-center px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-xs transition-colors"
                        >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Remove Machine
                        </button>
                    </div>
                 ) : (
                    <div className="text-center py-8 text-slate-600 text-xs">
                        Select a machine to edit details.
                    </div>
                 )}
              </div>
          )}
          
          {editMode === 'room' && (
             <div className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-300">
                <div className="flex justify-between items-start">
                   <h2 className="text-sm font-bold text-lime-400 uppercase tracking-wider flex items-center">
                     <LayoutTemplate className="w-4 h-4 mr-2" />
                     Room Configuration
                   </h2>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                     <h3 className="text-xs font-bold text-white mb-2">Main Hall Dimensions</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Width</label>
                          <input 
                            type="number" 
                            value={dimensions.width}
                            onFocus={() => snapshot()}
                            onChange={(e) => update({ ...gym, dimensions: { ...dimensions, width: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) } }, false)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Height</label>
                          <input 
                            type="number" 
                            value={dimensions.height}
                            onFocus={() => snapshot()}
                            onChange={(e) => update({ ...gym, dimensions: { ...dimensions, height: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) } }, false)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                     </div>
                  </div>
                  
                  {annexes.length > 0 && (
                     <div className="space-y-2">
                        <h3 className="text-xs font-bold text-white">Extensions (Annexes)</h3>
                        {annexes.map((annex, i) => (
                          <div key={annex.id} className="bg-slate-800 p-2 rounded flex justify-between items-center text-xs border border-slate-700">
                             <span className="text-slate-300">Ext {i+1} ({annex.width}x{annex.height})</span>
                             <button onClick={() => deleteAnnex(annex.id)} className="text-slate-500 hover:text-red-400 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        ))}
                     </div>
                  )}
                  
                  <div>
                     <h3 className="text-xs font-bold text-white mb-3 flex items-center">
                       <Palette className="w-4 h-4 mr-1.5" />
                       Styles
                     </h3>
                     <div>
                       <label className="block text-[10px] text-slate-500 mb-1 uppercase">Floor Color</label>
                       <div className="flex items-center space-x-2">
                         <input 
                           type="color" 
                           value={floorColor}
                           onFocus={() => snapshot()}
                           onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)}
                           className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded"
                         />
                         <input 
                           type="text" 
                           value={floorColor}
                           onFocus={() => snapshot()}
                           onChange={(e) => update({ ...gym, floorColor: e.target.value }, false)}
                           className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-mono text-white focus:border-blue-500 focus:outline-none"
                         />
                       </div>
                     </div>
                  </div>

                  <hr className="border-slate-800" />
                  
                  <div>
                     <h3 className="text-xs font-bold text-white mb-3 flex items-center">
                       <DoorOpen className="w-4 h-4 mr-1.5" />
                       Main Entrance
                     </h3>
                     
                     <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Side</label>
                          <div className="grid grid-cols-4 gap-2">
                            {['top', 'bottom', 'left', 'right'].map((side) => (
                              <button
                                key={side}
                                onClick={() => update({ ...gym, entrance: { ...entrance, side: side as any } }, true)}
                                className={`
                                  text-xs py-1.5 rounded capitalize border transition-all
                                  ${entrance.side === side 
                                    ? 'bg-blue-600 text-white border-blue-500' 
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}
                                `}
                              >
                                {side}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="block text-[10px] text-slate-500 uppercase">Position</label>
                            <span className="text-[10px] text-blue-400">{entrance.offset}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            value={entrance.offset}
                            onFocus={() => snapshot()}
                            onChange={(e) => update({ ...gym, entrance: { ...entrance, offset: parseInt(e.target.value) } }, false)}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>
                     </div>
                  </div>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

// --- Main AdminPage Container ---
const AdminPage: React.FC<AdminPageProps> = ({ gyms, setGyms, onExit }) => {
  const [editingGymId, setEditingGymId] = useState<string | null>(null);

  const handleCreateGym = async () => {
    const newGym: Gym = {
      id: `gym-${Date.now()}`,
      name: 'New Location',
      zones: [],
      dimensions: { width: 780, height: 580 },
      entrance: { side: 'bottom', offset: 50, width: 80 },
      floorColor: '#1e293b',
      annexes: []
    };
    
    // Save to backend immediately
    await api.createGym(newGym);
    setGyms(prev => [...prev, newGym]);
  };

  const handleDeleteGym = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this gym location? This action cannot be undone.')) {
      await api.deleteGym(id);
      setGyms(prev => prev.filter(g => g.id !== id));
      if (editingGymId === id) setEditingGymId(null);
    }
  };

  const saveGymChanges = async (updatedGym: Gym) => {
    // 1. Update backend
    await api.saveGym(updatedGym);
    // 2. Update local app state to match
    setGyms(prev => prev.map(g => g.id === updatedGym.id ? updatedGym : g));
  };

  if (editingGymId) {
    const gym = gyms.find(g => g.id === editingGymId);
    if (!gym) {
      setEditingGymId(null);
      return null;
    }

    return (
      <GymLayoutEditor 
        initialGym={gym} 
        onSave={saveGymChanges}
        onBack={() => setEditingGymId(null)}
      />
    );
  }

  return (
    <GymDashboard 
      gyms={gyms} 
      onCreate={handleCreateGym} 
      onEdit={setEditingGymId}
      onDelete={handleDeleteGym}
      onExit={onExit} 
    />
  );
};

export default AdminPage;
