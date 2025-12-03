
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GymZone, EquipmentType, Gym, GymDimensions, GymEntrance, GymAnnex } from '../types';
import GymMap from './GymMap';
import { api } from '../services/api';
import { ArrowLeft, Plus, Trash2, Move, Maximize2, MousePointer2, Save, Loader2, Check, Edit3, Footprints, MapPin, LayoutTemplate, DoorOpen, Palette, BoxSelect, SquareDashed } from 'lucide-react';

interface AdminPageProps {
  gyms: Gym[];
  setGyms: React.Dispatch<React.SetStateAction<Gym[]>>;
  onExit: () => void;
}

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
  gym: Gym;
  setGymZones: (zonesOrUpdater: GymZone[] | ((prev: GymZone[]) => GymZone[])) => void;
  setGymDimensions: (dims: GymDimensions) => void;
  setGymEntrance: (ent: GymEntrance) => void;
  setGymAnnexes: (annexesOrUpdater: GymAnnex[] | ((prev: GymAnnex[]) => GymAnnex[])) => void;
  updateGymName: (name: string) => void;
  updateFloorColor: (color: string) => void;
  onBack: () => void;
  onSaveTrigger: () => Promise<void>;
}

interface DragState {
  mode: 'move-zone' | 'resize-zone' | 'resize-room' | 'move-annex' | 'resize-annex';
  itemId: string | 'main-room';
  startX: number;
  startY: number;
  initialData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  handle?: 'right' | 'bottom' | 'corner'; // specific for room resizing
}

const GymLayoutEditor: React.FC<GymLayoutEditorProps> = ({ 
  gym, 
  setGymZones, 
  setGymDimensions,
  setGymEntrance,
  setGymAnnexes,
  updateGymName,
  updateFloorColor,
  onBack,
  onSaveTrigger
}) => {
  const zones = gym.zones;
  const dimensions = gym.dimensions || { width: 780, height: 580 };
  const entrance = gym.entrance || { side: 'bottom', offset: 50, width: 80 };
  const floorColor = gym.floorColor || '#1e293b';
  const annexes = gym.annexes || [];

  const [editMode, setEditMode] = useState<'layout' | 'room'>('layout');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const selectedZone = zones.find(z => z.id === selectedZoneId) || null;

  const handleZoneClick = (zone: GymZone) => {
    if (!dragState && editMode === 'layout') {
      setSelectedZoneId(zone.id);
    }
  };

  const handleMapClick = () => {
    if (!dragState) {
      setSelectedZoneId(null);
    }
  }

  const updateZone = (field: keyof GymZone, value: any) => {
    if (!selectedZoneId) return;
    setGymZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, [field]: value } : z));
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
      description: ''
    };
    setGymZones(prev => [...prev, newZone]);
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
      description: 'Main walkway'
    };
    setGymZones(prev => [...prev, newZone]);
    setSelectedZoneId(newZone.id);
  };
  
  const addAnnex = () => {
    const newAnnex: GymAnnex = {
       id: `annex-${Date.now()}`,
       x: dimensions.width, // default to right side
       y: 0,
       width: 200,
       height: 200
    };
    setGymAnnexes(prev => [...prev, newAnnex]);
  };

  const deleteAnnex = (id: string) => {
     if(window.confirm('Delete this room extension?')) {
        setGymAnnexes(prev => prev.filter(a => a.id !== id));
     }
  };

  // Robust delete function
  const deleteZone = useCallback(() => {
    if (!selectedZoneId) return;
    
    if (window.confirm('Are you sure you want to delete this zone?')) {
      setGymZones(prev => prev.filter(z => z.id !== selectedZoneId));
      setSelectedZoneId(null);
    }
  }, [selectedZoneId, setGymZones]);

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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
        e.preventDefault();
        deleteZone();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoneId, deleteZone]);

  const handleSave = async () => {
    setSaveState('saving');
    await onSaveTrigger();
    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
    }, 2000);
  };

  // --- Drag & Resize Logic ---
  
  const handleZoneDragStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return;
    e.preventDefault(); 
    setSelectedZoneId(zone.id);
    setDragState({
      mode: 'move-zone',
      itemId: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
    });
  };

  const handleZoneResizeStart = (e: React.MouseEvent, zone: GymZone) => {
    if (editMode !== 'layout') return;
    e.preventDefault();
    setSelectedZoneId(zone.id);
    setDragState({
      mode: 'resize-zone',
      itemId: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
    });
  };
  
  const handleMainRoomResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'corner') => {
    if (editMode !== 'room') return;
    e.preventDefault();
    setDragState({
       mode: 'resize-room',
       itemId: 'main-room',
       startX: e.clientX,
       startY: e.clientY,
       initialData: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
       handle
    });
  };

  const handleAnnexDragStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return;
    e.preventDefault();
    setDragState({
      mode: 'move-annex',
      itemId: annex.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }
    });
  };

  const handleAnnexResizeStart = (e: React.MouseEvent, annex: GymAnnex) => {
    if (editMode !== 'room') return;
    e.preventDefault();
    setDragState({
      mode: 'resize-annex',
      itemId: annex.id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: annex.x, y: annex.y, width: annex.width, height: annex.height }
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !mapContainerRef.current) return;

      // Calculate total bounds to ensure scaling matches GymMap
      let maxX = dimensions.width;
      let maxY = dimensions.height;
      annexes.forEach(a => {
         maxX = Math.max(maxX, a.x + a.width);
         maxY = Math.max(maxY, a.y + a.height);
      });
      
      const PADDING = 150;
      const minViewWidth = 800;
      const minViewHeight = 600;
      const viewBoxWidth = Math.max(minViewWidth, maxX + PADDING);
      const viewBoxHeight = Math.max(minViewHeight, maxY + PADDING);

      const rect = mapContainerRef.current.getBoundingClientRect();
      const scaleX = viewBoxWidth / rect.width;
      const scaleY = viewBoxHeight / rect.height;

      const deltaX = (e.clientX - dragState.startX) * scaleX;
      const deltaY = (e.clientY - dragState.startY) * scaleY;

      const snap = (val: number) => Math.round(val / 10) * 10;

      // Handle Zone Dragging
      if (dragState.mode === 'move-zone') {
        setGymZones(prev => prev.map(z => {
          if (z.id !== dragState.itemId) return z;
          let newX = snap(dragState.initialData.x + deltaX);
          let newY = snap(dragState.initialData.y + deltaY);
          // Simplified bounds check - allows placing zones in annexes too technically, 
          // or we can remove bounds check to allow freedom
          newX = Math.max(0, newX); 
          newY = Math.max(0, newY);
          return { ...z, x: newX, y: newY };
        }));
      } 
      // Handle Zone Resizing
      else if (dragState.mode === 'resize-zone') {
        setGymZones(prev => prev.map(z => {
          if (z.id !== dragState.itemId) return z;
          let rawWidth = dragState.initialData.width + deltaX;
          let rawHeight = dragState.initialData.height + deltaY;
          if (e.shiftKey) {
             const ratio = dragState.initialData.width / dragState.initialData.height;
             if (Math.abs(deltaX) > Math.abs(deltaY)) {
                rawHeight = rawWidth / ratio;
             } else {
                rawWidth = rawHeight * ratio;
             }
          }
          return { ...z, width: Math.max(40, snap(rawWidth)), height: Math.max(40, snap(rawHeight)) };
        }));
      }
      // Handle Main Room Resizing
      else if (dragState.mode === 'resize-room') {
         let newW = dragState.initialData.width;
         let newH = dragState.initialData.height;
         
         if (dragState.handle === 'right' || dragState.handle === 'corner') {
            newW = snap(dragState.initialData.width + deltaX);
         }
         if (dragState.handle === 'bottom' || dragState.handle === 'corner') {
            newH = snap(dragState.initialData.height + deltaY);
         }
         
         setGymDimensions({ 
            width: Math.max(200, Math.min(2000, newW)), 
            height: Math.max(200, Math.min(2000, newH)) 
         });
      }
      // Handle Annex Moving
      else if (dragState.mode === 'move-annex') {
        setGymAnnexes(prev => prev.map(a => {
           if (a.id !== dragState.itemId) return a;
           const newX = snap(dragState.initialData.x + deltaX);
           const newY = snap(dragState.initialData.y + deltaY);
           return { ...a, x: newX, y: newY };
        }));
      }
      // Handle Annex Resizing
      else if (dragState.mode === 'resize-annex') {
        setGymAnnexes(prev => prev.map(a => {
           if (a.id !== dragState.itemId) return a;
           const newW = snap(dragState.initialData.width + deltaX);
           const newH = snap(dragState.initialData.height + deltaY);
           return { ...a, width: Math.max(50, newW), height: Math.max(50, newH) };
        }));
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
  }, [dragState, setGymZones, setGymDimensions, setGymAnnexes, dimensions, annexes]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 animate-in slide-in-from-right duration-300">
      {/* Editor Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 flex-shrink-0">
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
              onChange={(e) => updateGymName(e.target.value)}
              className="bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b border-slate-600 hover:border-slate-700 transition-colors w-64"
            />
          </div>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
           <button 
             onClick={() => { setEditMode('layout'); setSelectedZoneId(null); }}
             className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${editMode === 'layout' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <BoxSelect className="w-3.5 h-3.5 mr-2" />
             Zones
           </button>
           <button 
             onClick={() => { setEditMode('room'); setSelectedZoneId(null); }}
             className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${editMode === 'room' ? 'bg-lime-900/40 text-lime-400 border border-lime-900/50 shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <SquareDashed className="w-3.5 h-3.5 mr-2" />
             Room Shape
           </button>
        </div>

        <div className="flex items-center space-x-3">
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
          
          {editMode === 'layout' && (
            <>
              <button 
                onClick={addCorridor}
                className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                title="Add Corridor / Walkway"
              >
                <Footprints className="w-4 h-4 mr-2" />
                Add Corridor
              </button>

              <button 
                onClick={addNewZone}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Zone
              </button>
            </>
          )}
          
          {editMode === 'room' && (
             <button 
               onClick={addAnnex}
               className="flex items-center px-4 py-2 bg-lime-600 hover:bg-lime-500 text-slate-900 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-lime-900/20"
             >
               <Plus className="w-4 h-4 mr-2" />
               Add Extension
             </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Map Area */}
        <div className="flex-1 p-8 bg-slate-950 flex flex-col">
          <div 
            ref={mapContainerRef}
            className={`flex-1 relative border rounded-xl overflow-hidden flex items-center justify-center transition-colors duration-500
              ${editMode === 'room' ? 'bg-lime-950/5 border-lime-900/30' : 'bg-slate-900/50 border-slate-800'}
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
                 isEditable={true}
                 editMode={editMode}
                 onZoneDragStart={handleZoneDragStart}
                 onZoneResizeStart={handleZoneResizeStart}
                 onMainRoomResizeStart={handleMainRoomResizeStart}
                 onAnnexDragStart={handleAnnexDragStart}
                 onAnnexResizeStart={handleAnnexResizeStart}
               />
             </div>
             <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-950/80 px-2 py-1 rounded border border-slate-800 flex items-center space-x-3 pointer-events-none select-none z-20">
               {editMode === 'layout' ? (
                 <>
                   <span className="flex items-center"><Move className="w-3 h-3 mr-1" /> Drag to move zone</span>
                   <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                   <span className="flex items-center"><Maximize2 className="w-3 h-3 mr-1" /> Drag corner to resize</span>
                 </>
               ) : (
                 <>
                   <span className="flex items-center text-lime-400"><SquareDashed className="w-3 h-3 mr-1" /> Drag edges to resize room</span>
                   <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                   <span className="flex items-center text-lime-400"><Plus className="w-3 h-3 mr-1" /> Add Extension to create shapes</span>
                 </>
               )}
             </div>
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
          {/* CONTENT SWITCHING BASED ON MODE AND SELECTION */}
          
          {editMode === 'layout' && selectedZone && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Zone Properties</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Zone Name</label>
                  <input 
                    type="text" 
                    value={selectedZone.name}
                    onChange={(e) => updateZone('name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Description / Metadata</label>
                  <textarea 
                    value={selectedZone.description || ''}
                    onChange={(e) => updateZone('description', e.target.value)}
                    rows={3}
                    placeholder="E.g. Main corridor to weights area..."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Type</label>
                  <select 
                    value={selectedZone.type}
                    onChange={(e) => updateZone('type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    {Object.values(EquipmentType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Color Code</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="color" 
                      value={selectedZone.color}
                      onChange={(e) => updateZone('color', e.target.value)}
                      className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded"
                    />
                    <input 
                      type="text" 
                      value={selectedZone.color}
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
                <button onClick={() => setEditMode('room')} className="mt-4 text-xs text-lime-500 hover:underline">
                  Switch to Room Editor
                </button>
             </div>
          )}
          
          {editMode === 'room' && (
             <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                   <h2 className="text-sm font-bold text-lime-400 uppercase tracking-wider flex items-center">
                     <LayoutTemplate className="w-4 h-4 mr-2" />
                     Room Configuration
                   </h2>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed">
                  Adjust the room shape, extensions, and structural appearance.
                </p>

                <div className="space-y-4">
                  <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                     <h3 className="text-xs font-bold text-white mb-2">Main Hall Dimensions</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Width</label>
                          <input 
                            type="number" 
                            value={dimensions.width}
                            onChange={(e) => setGymDimensions({ ...dimensions, width: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase">Height</label>
                          <input 
                            type="number" 
                            value={dimensions.height}
                            onChange={(e) => setGymDimensions({ ...dimensions, height: Math.max(200, Math.min(2000, parseInt(e.target.value) || 400)) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                     </div>
                  </div>
                  
                  {annexes.length > 0 && (
                     <div className="space-y-2">
                        <h3 className="text-xs font-bold text-white">Extensions (Annexes)</h3>
                        {annexes.map((annex, i) => (
                          <div key={annex.id} className="bg-slate-800 p-2 rounded flex justify-between items-center text-xs">
                             <span className="text-slate-300">Ext {i+1} ({annex.width}x{annex.height})</span>
                             <button onClick={() => deleteAnnex(annex.id)} className="text-slate-500 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        ))}
                     </div>
                  )}

                  <hr className="border-slate-800" />
                  
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
                           onChange={(e) => updateFloorColor(e.target.value)}
                           className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded"
                         />
                         <input 
                           type="text" 
                           value={floorColor}
                           onChange={(e) => updateFloorColor(e.target.value)}
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
                                onClick={() => setGymEntrance({ ...entrance, side: side as any })}
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
                            onChange={(e) => setGymEntrance({ ...entrance, offset: parseInt(e.target.value) })}
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

  const saveGymChanges = async (gym: Gym) => {
    await api.saveGym(gym);
  };

  if (editingGymId) {
    const gym = gyms.find(g => g.id === editingGymId);
    if (!gym) {
      setEditingGymId(null);
      return null;
    }

    // Helper to update zones for the specific gym being edited
    const setGymZones = (zonesOrUpdater: GymZone[] | ((prev: GymZone[]) => GymZone[])) => {
      setGyms(prevGyms => prevGyms.map(g => {
        if (g.id !== editingGymId) return g;
        
        const newZones = typeof zonesOrUpdater === 'function' 
          ? zonesOrUpdater(g.zones) 
          : zonesOrUpdater;
          
        return { ...g, zones: newZones };
      }));
    };

    const setGymDimensions = (dims: GymDimensions) => {
      setGyms(prev => prev.map(g => g.id === editingGymId ? { ...g, dimensions: dims } : g));
    };

    const setGymEntrance = (ent: GymEntrance) => {
      setGyms(prev => prev.map(g => g.id === editingGymId ? { ...g, entrance: ent } : g));
    };
    
    const setGymAnnexes = (annexesOrUpdater: GymAnnex[] | ((prev: GymAnnex[]) => GymAnnex[])) => {
       setGyms(prevGyms => prevGyms.map(g => {
         if (g.id !== editingGymId) return g;
         const newAnnexes = typeof annexesOrUpdater === 'function' 
            ? annexesOrUpdater(g.annexes || []) 
            : annexesOrUpdater;
         return { ...g, annexes: newAnnexes };
       }));
    }

    const updateGymName = (name: string) => {
      setGyms(prev => prev.map(g => g.id === editingGymId ? { ...g, name } : g));
    }

    const updateFloorColor = (color: string) => {
      setGyms(prev => prev.map(g => g.id === editingGymId ? { ...g, floorColor: color } : g));
    }

    return (
      <GymLayoutEditor 
        gym={gym} 
        setGymZones={setGymZones}
        setGymDimensions={setGymDimensions}
        setGymEntrance={setGymEntrance}
        setGymAnnexes={setGymAnnexes}
        updateGymName={updateGymName}
        updateFloorColor={updateFloorColor}
        onBack={() => setEditingGymId(null)}
        onSaveTrigger={() => saveGymChanges(gym)} 
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
