import React from 'react';
import { GymZone, EquipmentType, GymDimensions, GymEntrance, GymAnnex, GymMachine, Language, SketchStroke } from '../types';
import { translations, getGymTranslation } from '../translations';
import { ZoomOut, Settings, Dumbbell, Activity, Zap, Target, Cpu, Layers, Box, Wind, RotateCcw, ArrowUpRight, MoveDown, Circle, Waves, Timer } from 'lucide-react';

// Map icon names to components for dynamic rendering
const ICON_MAP: Record<string, any> = {
  Dumbbell, Activity, Zap, Target, Cpu, Layers, Box, Wind, RotateCcw, ArrowUpRight, MoveDown, Circle, Waves, Timer
};

export interface ViewParams {
  viewBox: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface GymMapProps {
  zones: GymZone[];
  dimensions?: GymDimensions;
  entrance?: GymEntrance;
  floorColor?: string;
  annexes?: GymAnnex[];
  
  onZoneClick?: (zone: GymZone) => void;
  onMapClick?: () => void;
  onMachineClick?: (machine: GymMachine) => void; 

  selectedZoneId?: string | null;
  focusedZoneId?: string | null; 
  
  isEditable?: boolean;
  editMode?: 'layout' | 'room' | 'machine' | 'sketch'; 
  
  onZoneDragStart?: (e: React.MouseEvent, zone: GymZone) => void;
  onZoneResizeStart?: (e: React.MouseEvent, zone: GymZone) => void;

  onMainRoomResizeStart?: (e: React.MouseEvent, handle: 'right' | 'bottom' | 'corner') => void;
  onAnnexDragStart?: (e: React.MouseEvent, annex: GymAnnex) => void;
  onAnnexResizeStart?: (e: React.MouseEvent, annex: GymAnnex) => void;

  onMachineDragStart?: (e: React.MouseEvent, machine: GymMachine, zoneId: string) => void;
  onMachineResizeStart?: (e: React.MouseEvent, machine: GymMachine, zoneId: string) => void;
  selectedMachineId?: string | null;
  
  isThumbnail?: boolean;
  manualView?: ViewParams;
  lang?: Language;

  // Sketch pad extensions
  onSketchUpdate?: (strokes: SketchStroke[]) => void;
  sketchOpacity?: number;
  showSketch?: boolean;
  sketchTool?: 'draw' | 'erase' | 'room' | 'zone';
  sketchColor?: string;
  sketchWidth?: number;
  onSketchRoomCreated?: (x: number, y: number, width: number, height: number) => void;
  onSketchZoneCreated?: (x: number, y: number, width: number, height: number) => void;
}

const GymMap: React.FC<GymMapProps> = ({ 
  zones, 
  dimensions = { width: 780, height: 580 },
  entrance = { side: 'bottom', offset: 50, width: 80 },
  floorColor = '#1e293b',
  annexes = [],
  
  onZoneClick = (_: GymZone) => {}, 
  onMapClick = () => {},
  onMachineClick,

  selectedZoneId = null,
  focusedZoneId = null,
  
  isEditable = false,
  editMode = 'layout',
  
  onZoneDragStart,
  onZoneResizeStart,
  
  onMainRoomResizeStart,
  onAnnexDragStart,
  onAnnexResizeStart,

  onMachineDragStart,
  onMachineResizeStart,
  selectedMachineId,
  
  isThumbnail = false,
  manualView,
  lang = 'et',

  onSketchUpdate,
  sketchOpacity = 0.6,
  showSketch = true,
  sketchTool = 'draw',
  sketchColor = '#10b981',
  sketchWidth = 4,
  onSketchRoomCreated,
  onSketchZoneCreated
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [currentStroke, setCurrentStroke] = React.useState<SketchStroke | null>(null);
  
  const t = translations[lang];
  let viewBoxWidth: number;
  let viewBoxHeight: number;
  let offsetX: number;
  let offsetY: number;

  const focusedZone = zones.find(z => z.id === focusedZoneId);

  const getTotalBounds = () => {
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
    if (showSketch && strokes.length > 0) {
      strokes.forEach(stroke => {
        stroke.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      });
    }

    if (showSketch && currentStroke && currentStroke.points.length > 0) {
      currentStroke.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  };

  if (manualView) {
    viewBoxWidth = manualView.width;
    viewBoxHeight = manualView.height;
    offsetX = manualView.offsetX;
    offsetY = manualView.offsetY;
  } else if (focusedZone && (!isEditable || editMode === 'machine')) {
    const ZOOM_PADDING = 40;
    const MIN_VIEW_SIZE = 500; 
    const targetWidth = focusedZone.width + (ZOOM_PADDING * 2);
    const targetHeight = focusedZone.height + (ZOOM_PADDING * 2);
    viewBoxWidth = Math.max(targetWidth, MIN_VIEW_SIZE);
    viewBoxHeight = Math.max(targetHeight, MIN_VIEW_SIZE);
    offsetX = ((viewBoxWidth - focusedZone.width) / 2) - focusedZone.x;
    offsetY = ((viewBoxHeight - focusedZone.height) / 2) - focusedZone.y;
  } else {
    const totalBounds = getTotalBounds();
    const PADDING = 150;
    const minViewWidth = 800;
    const minViewHeight = 600;
    viewBoxWidth = Math.max(minViewWidth, totalBounds.width + PADDING);
    viewBoxHeight = Math.max(minViewHeight, totalBounds.height + PADDING);
    offsetX = ((viewBoxWidth - totalBounds.width) / 2) - totalBounds.minX;
    offsetY = ((viewBoxHeight - totalBounds.height) / 2) - totalBounds.minY;
  }

  const getEntrancePath = () => {
    const { side, offset, width } = entrance;
    const { width: gymW, height: gymH } = dimensions;
    const pos = offset / 100;
    let x1, y1, x2, y2, labelX, labelY, labelRotation;
    switch (side) {
      case 'top':
        x1 = (gymW * pos) - (width / 2); y1 = 0; x2 = x1 + width; y2 = 0;
        labelX = x1 + width / 2; labelY = y1 - 15; labelRotation = 0;
        break;
      case 'bottom':
        x1 = (gymW * pos) - (width / 2); y1 = gymH; x2 = x1 + width; y2 = gymH;
        labelX = x1 + width / 2; labelY = y2 + 15; labelRotation = 0;
        break;
      case 'left':
        x1 = 0; y1 = (gymH * pos) - (width / 2); x2 = 0; y2 = y1 + width;
        labelX = x1 - 15; labelY = y1 + width / 2; labelRotation = -90;
        break;
      case 'right':
        x1 = gymW; y1 = (gymH * pos) - (width / 2); x2 = gymW; y2 = y1 + width;
        labelX = x1 + 15; labelY = y1 + width / 2; labelRotation = 90;
        break;
    }
    return { x1: x1 ?? 0, y1: y1 ?? 0, x2: x2 ?? 0, y2: y2 ?? 0, labelX: labelX ?? 0, labelY: labelY ?? 0, labelRotation: labelRotation ?? 0 };
  };

  const getSVGCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    
    const scaleX = viewBoxWidth / rect.width;
    const scaleY = viewBoxHeight / rect.height;
    
    const viewBoxX = relativeX * scaleX;
    const viewBoxY = relativeY * scaleY;
    
    const svgX = viewBoxX - offsetX;
    const svgY = viewBoxY - offsetY;
    
    return { x: svgX, y: svgY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isSketchEnabled = isEditable && (
      editMode === 'sketch' || 
      (editMode === 'room' && sketchTool === 'room') || 
      (editMode === 'layout' && sketchTool === 'zone')
    );
    if (!isSketchEnabled) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const coords = getSVGCoords(e);
    
    if (sketchTool === 'erase') {
      const threshold = 18;
      const updatedStrokes = (dimensions.sketchStrokes || []).filter(stroke => {
        const hasClosePoint = stroke.points.some(pt => {
          const dx = pt.x - coords.x;
          const dy = pt.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
        return !hasClosePoint;
      });
      if (onSketchUpdate) {
        onSketchUpdate(updatedStrokes);
      }
      setIsDrawing(true);
    } else {
      const strokeColor = sketchTool === 'room' ? '#10b981' : sketchTool === 'zone' ? '#3b82f6' : sketchColor;
      const strokeWidthVal = sketchTool === 'room' || sketchTool === 'zone' ? 3 : sketchWidth;
      const newStroke: SketchStroke = {
        id: `stroke-${Date.now()}`,
        points: [coords],
        color: strokeColor,
        width: strokeWidthVal
      };
      setCurrentStroke(newStroke);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.stopPropagation();
    e.preventDefault();
    
    const coords = getSVGCoords(e);
    
    if (sketchTool === 'erase') {
      const threshold = 18;
      const updatedStrokes = (dimensions.sketchStrokes || []).filter(stroke => {
        const hasClosePoint = stroke.points.some(pt => {
          const dx = pt.x - coords.x;
          const dy = pt.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
        return !hasClosePoint;
      });
      if (onSketchUpdate) {
        onSketchUpdate(updatedStrokes);
      }
    } else if (currentStroke) {
      const lastPt = currentStroke.points[currentStroke.points.length - 1];
      const dx = coords.x - lastPt.x;
      const dy = coords.y - lastPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 1.5) {
        const updatedStroke = {
          ...currentStroke,
          points: [...currentStroke.points, coords]
        };
        setCurrentStroke(updatedStroke);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentStroke && currentStroke.points.length > 1) {
      if (sketchTool === 'room') {
        const xs = currentStroke.points.map(p => p.x);
        const ys = currentStroke.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        if (w > 15 && h > 15 && onSketchRoomCreated) {
          onSketchRoomCreated(Math.round(minX), Math.round(minY), Math.round(w), Math.round(h));
        }
      } else if (sketchTool === 'zone') {
        const xs = currentStroke.points.map(p => p.x);
        const ys = currentStroke.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        if (w > 15 && h > 15 && onSketchZoneCreated) {
          onSketchZoneCreated(Math.round(minX), Math.round(minY), Math.round(w), Math.round(h));
        }
      } else if (sketchTool !== 'erase') {
        const existingStrokes = dimensions.sketchStrokes || [];
        if (onSketchUpdate) {
          onSketchUpdate([...existingStrokes, currentStroke]);
        }
      }
    }
    setCurrentStroke(null);
  };

  const getPathData = (stroke: SketchStroke) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return '';
    const first = stroke.points[0];
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < stroke.points.length; i++) {
      d += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
    }
    return d;
  };

  const door = getEntrancePath();
  const isRoomEdit = isEditable && editMode === 'room';
  const isLayoutEdit = isEditable && editMode === 'layout';
  const isMachineEdit = isEditable && editMode === 'machine';
  const isSketchEdit = isEditable && editMode === 'sketch';
  const isSketchingActive = isSketchEdit || (isRoomEdit && sketchTool === 'room') || (isLayoutEdit && sketchTool === 'zone');
  
  const handleStyle = "cursor-ew-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const cornerStyle = "cursor-nwse-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const moveStyle = "cursor-move hover:fill-lime-400 fill-white stroke-slate-900";

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden ${isThumbnail ? 'bg-slate-900/50' : 'bg-slate-900 rounded-xl shadow-2xl border border-slate-700'}`}>
      <style>{`
        @keyframes machinePulse {
          0% { stroke-width: 1px; stroke-opacity: 0.5; }
          50% { stroke-width: 4px; stroke-opacity: 1; }
          100% { stroke-width: 1px; stroke-opacity: 0.5; }
        }
        .machine-pulse {
          animation: machinePulse 1.5s infinite;
          stroke: #3b82f6 !important;
        }
      `}</style>
      
      {!isThumbnail && (
        <>
          {(isEditable) && (
             <div className={`absolute top-4 left-4 px-3 py-1 rounded text-xs border z-10 pointer-events-none select-none backdrop-blur-sm shadow-lg
               ${isRoomEdit ? (sketchTool === 'room' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800 animate-pulse' : 'bg-lime-950/90 text-lime-400 border-lime-800') : 
                 isMachineEdit ? 'bg-blue-950/90 text-blue-400 border-blue-800' :
                 isSketchEdit ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800' :
                 isLayoutEdit && sketchTool === 'zone' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800 animate-pulse' :
                 'bg-slate-950/90 text-slate-400 border-slate-700'}
             `}>
               {isRoomEdit ? (sketchTool === 'room' ? 'Drawing Room Shape (Click & Drag)' : 'Room Editor Mode') : 
                isMachineEdit ? 'Machine Editor Mode' : 
                isSketchEdit ? `Sketching Mode (${sketchTool === 'erase' ? 'Eraser' : 'Draft Pencil'})` : 
                isLayoutEdit && sketchTool === 'zone' ? 'Drawing Zone Shape (Click & Drag)' :
                'Layout Editor Mode'}
             </div>
          )}
          {focusedZoneId && !isEditable && (
             <button 
               onClick={(e) => { e.stopPropagation(); onMapClick(); }}
               className="absolute top-4 right-4 z-20 flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg shadow-lg border border-slate-600 transition-colors"
             >
               <ZoomOut className="w-4 h-4" />
               <span className="text-xs font-bold">Zoom Out</span>
             </button>
          )}
        </>
      )}
      
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className={`w-full h-full select-none transition-all duration-700 ease-in-out ${isSketchingActive ? "cursor-crosshair" : isEditable ? 'cursor-default' : isThumbnail ? 'cursor-default' : 'cursor-crosshair'}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (isSketchingActive) {
            e.stopPropagation();
          } else if (isEditable && editMode === 'layout') {
            onMapClick();
          } else if (!isEditable) {
            onMapClick();
          }
        }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(163, 230, 53, 0.3)" />
          </pattern>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
             <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          </pattern>
          <pattern id="machineHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="4" transform="translate(0,0)" fill="white" fillOpacity="0.1" />
          </pattern>
        </defs>
        
        {!isThumbnail && isEditable && (
            <rect width={viewBoxWidth} height={viewBoxHeight} fill={isMachineEdit ? "url(#smallGrid)" : "url(#grid)"} className="pointer-events-none opacity-30" />
        )}

        <g transform={`translate(${offsetX}, ${offsetY})`} className="transition-transform duration-700 ease-in-out">
            {/* 1. Boundary Background Layer: renders a solid outer boundary base for the rooms */}
            <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill={isRoomEdit ? '#84cc16' : '#334155'} stroke={isRoomEdit ? '#84cc16' : '#334155'} strokeWidth={isThumbnail ? 0 : 8} rx="4" className="transition-all duration-300 ease-in-out" />
            {annexes.map((annex) => (
              <rect key={`annex-bg-${annex.id}`} x={annex.x} y={annex.y} width={annex.width} height={annex.height} fill={isRoomEdit ? '#84cc16' : '#334155'} stroke={isRoomEdit ? '#84cc16' : '#334155'} strokeWidth={isThumbnail ? 0 : 8} rx="4" className="transition-all duration-300 ease-in-out" />
            ))}

            {/* 2. Inner Floor Fills Layer: overlays seamless floor fills with no dividing lines */}
            <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill={floorColor} rx="4" className="transition-all duration-300 ease-in-out" />
            {annexes.map((annex) => (
              <rect key={`annex-fg-${annex.id}`} x={annex.x} y={annex.y} width={annex.width} height={annex.height} fill={floorColor} rx="4" className="transition-all duration-300 ease-in-out" />
            ))}

            {/* Sketch strokes render layer */}
            {showSketch && (dimensions.sketchStrokes || []).map((stroke) => (
              <path
                key={stroke.id}
                d={getPathData(stroke)}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={sketchOpacity}
                style={{ transition: 'opacity 0.2s' }}
              />
            ))}
            
            {/* Live active drawing stroke rendering */}
            {showSketch && currentStroke && (
              <>
                <path
                  d={getPathData(currentStroke)}
                  stroke={currentStroke.color}
                  strokeWidth={currentStroke.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={sketchOpacity}
                />
                
                {/* Visual guide bounding rectangle feedback for room and zone sketch creation */}
                {(sketchTool === 'room' || sketchTool === 'zone') && currentStroke.points.length > 1 && (() => {
                  const xs = currentStroke.points.map(p => p.x);
                  const ys = currentStroke.points.map(p => p.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);
                  const w = maxX - minX;
                  const h = maxY - minY;
                  const strokeColor = sketchTool === 'room' ? '#10b981' : '#3b82f6';
                  const fillColor = sketchTool === 'room' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)';
                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={minX}
                        y={minY}
                        width={w}
                        height={h}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                        strokeDasharray="5 3"
                        rx="4"
                      />
                      <rect 
                        x={minX} 
                        y={minY - 24 >= 0 ? minY - 24 : minY + h + 6} 
                        width={130} 
                        height="18" 
                        rx="4" 
                        fill="#0f172a" 
                        fillOpacity="0.95" 
                        stroke={strokeColor} 
                        strokeWidth="1" 
                      />
                      <text
                        x={minX + 8}
                        y={(minY - 24 >= 0 ? minY - 24 : minY + h + 6) + 12}
                        className="text-[10px] font-mono font-bold fill-white"
                      >
                        {sketchTool === 'room' ? '🏠 SKETCH ROOM: ' : '💪 SKETCH ZONE: '}{Math.round(w)}x{Math.round(h)}
                      </text>
                    </g>
                  );
                })()}
              </>
            )}

            {/* 3. Grid overlay & Interactivity on top */}
            <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="url(#grid)" className="pointer-events-none opacity-50"/>
            {annexes.map((annex) => (
              <g key={annex.id}>
                <rect x={annex.x} y={annex.y} width={annex.width} height={annex.height} fill="url(#grid)" className="pointer-events-none opacity-50"/>
                {isRoomEdit && !isThumbnail && (
                  <>
                     <rect x={annex.x - 6} y={annex.y - 6} width="12" height="12" className={moveStyle} onMouseDown={(e) => { e.stopPropagation(); onAnnexDragStart && onAnnexDragStart(e, annex); }} />
                     <rect x={annex.x + annex.width - 6} y={annex.y + annex.height - 6} width="12" height="12" className={cornerStyle} onMouseDown={(e) => { e.stopPropagation(); onAnnexResizeStart && onAnnexResizeStart(e, annex); }} />
                  </>
                )}
              </g>
            ))}
            {isRoomEdit && !isThumbnail && (
               <>
                 <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="url(#dotGrid)" className="pointer-events-none opacity-100"/>
                 <rect x={dimensions.width - 4} y={dimensions.height / 2 - 20} width="8" height="40" rx="4" className={handleStyle} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'right'); }} />
                 <rect x={dimensions.width / 2 - 20} y={dimensions.height - 4} width="40" height="8" rx="4" className={`cursor-ns-resize hover:fill-lime-400 fill-white stroke-slate-900`} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'bottom'); }} />
                 <rect x={dimensions.width - 8} y={dimensions.height - 8} width="16" height="16" rx="2" className={cornerStyle} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'corner'); }} />
               </>
            )}
            <path d={`M ${door.x1} ${door.y1} L ${door.x2} ${door.y2}`} stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
            {!isThumbnail && (
              <text x={door.labelX} y={door.labelY} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${door.labelRotation}, ${door.labelX}, ${door.labelY})`} fill="#64748b" fontSize="12" fontFamily="sans-serif" fontWeight="bold" className="select-none pointer-events-none">ENTRANCE</text>
            )}

            <g style={{ opacity: isRoomEdit ? 0.3 : 1, pointerEvents: isRoomEdit ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
              {zones.map((zone) => {
                const isSelected = selectedZoneId === zone.id;
                const isFocused = focusedZoneId === zone.id;
                const isStructure = zone.type === EquipmentType.CORRIDOR || zone.type === EquipmentType.FACILITY;
                const zoneOpacity = focusedZoneId ? (isFocused ? 1 : 0.05) : (selectedZoneId && !isSelected ? 0.4 : 1);

                return (
                  <g
                    key={zone.id}
                    onClick={(e) => {
                      if (!isThumbnail) {
                        e.stopPropagation();
                        if (!isMachineEdit) onZoneClick(zone);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!isThumbnail && isLayoutEdit && onZoneDragStart) onZoneDragStart(e, zone);
                    }}
                    className={`transition-all duration-500 ease-in-out ${isThumbnail ? '' : isLayoutEdit ? 'cursor-move' : isMachineEdit && isFocused ? 'cursor-default' : 'cursor-pointer'}`}
                    style={{ opacity: zoneOpacity, filter: isSelected ? 'drop-shadow(0 0 8px rgba(0,0,0,0.6))' : 'none' }}
                  >
                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <rect
                        x={zone.x - 4} y={zone.y - 4} width={zone.width + 8} height={zone.height + 8}
                        fill="none" stroke="#a3e635" strokeWidth="2" strokeDasharray="8 4" rx={isStructure ? 2 : 6}
                        className="animate-pulse pointer-events-none opacity-80"
                      />
                    )}
                    <rect
                      x={zone.x} y={zone.y} width={zone.width} height={zone.height}
                      fill={zone.color} fillOpacity={isStructure ? 0.25 : (isFocused || isMachineEdit ? 0.15 : 0.35)} 
                      stroke={zone.color} strokeWidth={isThumbnail ? 4 : (isSelected || isFocused ? 2 : 1)} 
                      rx={isStructure ? 0 : 4} 
                    />
                    
                    {((isFocused && !isStructure && !isEditable) || (isMachineEdit && isFocused)) && zone.machines && (
                      <g className="animate-in fade-in zoom-in duration-300">
                        {zone.machines.map(machine => {
                          const isMachineSelected = selectedMachineId === machine.id;
                          const MachineIcon = machine.icon ? ICON_MAP[machine.icon] : null;

                          return (
                            <g 
                               key={machine.id} 
                               transform={`translate(${zone.x + machine.x}, ${zone.y + machine.y})`}
                               onMouseDown={(e) => {
                                 if (isMachineEdit && onMachineDragStart) {
                                   e.stopPropagation();
                                   onMachineDragStart(e, machine, zone.id);
                                 }
                               }}
                               onClick={(e) => {
                                 if (!isEditable && onMachineClick) {
                                     e.stopPropagation();
                                     onMachineClick(machine);
                                 }
                               }}
                               className={`${isMachineEdit ? 'cursor-move' : !isEditable ? 'cursor-pointer hover:opacity-80' : ''}`}
                            >
                              <rect 
                                width={machine.width} height={machine.height} 
                                fill={zone.color} fillOpacity={0.8}
                                stroke={isMachineSelected ? "#3b82f6" : "white"} 
                                strokeWidth={isMachineSelected ? 2 : 1} 
                                strokeOpacity={isMachineSelected ? 1 : 0.5}
                                rx="2"
                                className={isMachineSelected && !isEditable ? 'machine-pulse' : ''}
                              />
                              <rect width={machine.width} height={machine.height} fill="url(#machineHatch)" rx="2" className="pointer-events-none"/>
                              
                              <g transform={`translate(${machine.width / 2}, ${machine.height / 2})`} className="pointer-events-none">
                                {MachineIcon ? (
                                  <g transform={`scale(${Math.min(machine.width, machine.height) / 48}) translate(-12, -12)`}>
                                    <MachineIcon size={24} color="white" />
                                  </g>
                                ) : (
                                  machine.height > 20 && machine.width > 20 && (
                                    <text 
                                      textAnchor="middle" dominantBaseline="middle" 
                                      fontSize={Math.min(10, machine.width/4)} fill="white" fontWeight="bold" 
                                      className="drop-shadow-sm select-none"
                                    >
                                      {getGymTranslation(machine.name, lang).substring(0, 3).toUpperCase()}
                                    </text>
                                  )
                                )}
                              </g>

                              {isMachineEdit && isMachineSelected && (
                                <rect
                                  x={machine.width - 6} y={machine.height - 6} width="6" height="6"
                                  fill="#3b82f6"
                                  className="cursor-nwse-resize"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if(onMachineResizeStart) onMachineResizeStart(e, machine, zone.id);
                                  }}
                                />
                              )}
                            </g>
                          )
                        })}
                      </g>
                    )}

                    {!isThumbnail && !isStructure && !isFocused && !isMachineEdit && (
                      <rect
                        x={zone.x + 10} y={zone.y + 10} width={Math.max(0, zone.width - 20)} height={Math.max(0, zone.height - 20)}
                        fill="none" stroke={zone.color} strokeWidth="1" strokeDasharray="4 4" rx="2"
                        className="pointer-events-none" 
                      />
                    )}

                    {!isThumbnail && (!isFocused || isStructure) && (
                      <text
                        x={zone.x + zone.width / 2} y={zone.y + zone.height / 2}
                        fill="white" fontSize="14" fontWeight="600" textAnchor="middle" alignmentBaseline="middle"
                        className="pointer-events-none drop-shadow-md select-none"
                        style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
                      >
                        {getGymTranslation(zone.name, lang)}
                      </text>
                    )}
                    
                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <rect
                        x={zone.x + zone.width - 12} y={zone.y + zone.height - 12} width="12" height="12"
                        fill="white" stroke="#0f172a" strokeWidth="1"
                        className="cursor-nwse-resize hover:fill-lime-400"
                        onMouseDown={(e) => { e.stopPropagation(); if (onZoneResizeStart) onZoneResizeStart(e, zone); }}
                      />
                    )}
                  </g>
                );
              })}
            </g>
        </g>
      </svg>
    </div>
  );
};

export default GymMap;