
import React from 'react';
import { GymZone, EquipmentType, GymDimensions, GymEntrance, GymAnnex } from '../types';

interface GymMapProps {
  zones: GymZone[];
  dimensions?: GymDimensions;
  entrance?: GymEntrance;
  floorColor?: string;
  annexes?: GymAnnex[];
  
  onZoneClick?: (zone: GymZone) => void;
  onMapClick?: () => void;
  selectedZoneId?: string | null;
  
  isEditable?: boolean;
  editMode?: 'layout' | 'room'; // 'layout' for zones, 'room' for structure
  
  // Zone Interactions
  onZoneDragStart?: (e: React.MouseEvent, zone: GymZone) => void;
  onZoneResizeStart?: (e: React.MouseEvent, zone: GymZone) => void;

  // Room Interactions
  onMainRoomResizeStart?: (e: React.MouseEvent, handle: 'right' | 'bottom' | 'corner') => void;
  onAnnexDragStart?: (e: React.MouseEvent, annex: GymAnnex) => void;
  onAnnexResizeStart?: (e: React.MouseEvent, annex: GymAnnex) => void;
  
  isThumbnail?: boolean;
}

const GymMap: React.FC<GymMapProps> = ({ 
  zones, 
  dimensions = { width: 780, height: 580 },
  entrance = { side: 'bottom', offset: 50, width: 80 },
  floorColor = '#1e293b',
  annexes = [],
  
  onZoneClick = (_: GymZone) => {}, 
  onMapClick = () => {},
  selectedZoneId = null, 
  
  isEditable = false,
  editMode = 'layout',
  
  onZoneDragStart,
  onZoneResizeStart,
  
  onMainRoomResizeStart,
  onAnnexDragStart,
  onAnnexResizeStart,
  
  isThumbnail = false
}) => {
  
  // Helper to calculate total bounding box (Main Room + Annexes)
  const getTotalBounds = () => {
    let maxX = dimensions.width;
    let maxY = dimensions.height;
    
    annexes.forEach(a => {
      maxX = Math.max(maxX, a.x + a.width);
      maxY = Math.max(maxY, a.y + a.height);
    });
    
    return { width: maxX, height: maxY };
  };

  const totalBounds = getTotalBounds();

  // Dynamic ViewBox Calculation
  const PADDING = 150;
  const minViewWidth = 800;
  const minViewHeight = 600;

  const viewBoxWidth = Math.max(minViewWidth, totalBounds.width + PADDING);
  const viewBoxHeight = Math.max(minViewHeight, totalBounds.height + PADDING);

  // Center the entire gym structure within the dynamic viewBox
  const offsetX = (viewBoxWidth - totalBounds.width) / 2;
  const offsetY = (viewBoxHeight - totalBounds.height) / 2;

  // Calculate Entrance Coordinates (Relative to Main Room)
  const getEntrancePath = () => {
    const { side, offset, width } = entrance;
    const { width: gymW, height: gymH } = dimensions;
    
    // Offset is percentage (0-100)
    const pos = offset / 100;

    let x1, y1, x2, y2, labelX, labelY, labelRotation;

    switch (side) {
      case 'top':
        x1 = (gymW * pos) - (width / 2);
        y1 = 0;
        x2 = x1 + width;
        y2 = 0;
        labelX = x1 + width / 2;
        labelY = y1 - 15;
        labelRotation = 0;
        break;
      case 'bottom':
        x1 = (gymW * pos) - (width / 2);
        y1 = gymH;
        x2 = x1 + width;
        y2 = gymH;
        labelX = x1 + width / 2;
        labelY = y2 + 15;
        labelRotation = 0;
        break;
      case 'left':
        x1 = 0;
        y1 = (gymH * pos) - (width / 2);
        x2 = 0;
        y2 = y1 + width;
        labelX = x1 - 15;
        labelY = y1 + width / 2;
        labelRotation = -90;
        break;
      case 'right':
        x1 = gymW;
        y1 = (gymH * pos) - (width / 2);
        x2 = gymW;
        y2 = y1 + width;
        labelX = x1 + 15;
        labelY = y1 + width / 2;
        labelRotation = 90;
        break;
    }

    return { x1, y1, x2, y2, labelX, labelY, labelRotation };
  };

  const door = getEntrancePath();
  const isRoomEdit = isEditable && editMode === 'room';
  const isLayoutEdit = isEditable && editMode === 'layout';

  // Handle styles
  const handleStyle = "cursor-ew-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const cornerStyle = "cursor-nwse-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const moveStyle = "cursor-move hover:fill-lime-400 fill-white stroke-slate-900";

  return (
    <div className={`w-full h-full relative overflow-hidden ${isThumbnail ? 'bg-slate-900/50' : 'bg-slate-900 rounded-xl shadow-2xl border border-slate-700'}`}>
      {!isThumbnail && (
        <div className={`absolute top-4 left-4 px-3 py-1 rounded text-xs border z-10 pointer-events-none select-none backdrop-blur-sm shadow-lg
          ${isRoomEdit ? 'bg-lime-950/90 text-lime-400 border-lime-800' : 'bg-slate-950/90 text-slate-400 border-slate-700'}
        `}>
          {isRoomEdit ? 'Room Editor Mode' : isLayoutEdit ? 'Layout Editor Mode' : 'Interactive Gym Floor'}
        </div>
      )}
      
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className={`w-full h-full select-none ${isEditable ? 'cursor-default' : isThumbnail ? 'cursor-default' : 'cursor-crosshair'}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).tagName === 'rect') {
             // Let click handler handle background clicks
          }
        }}
        onClick={() => {
          onMapClick();
        }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          {/* Dot pattern for editing feedback */}
          <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(163, 230, 53, 0.3)" />
          </pattern>
        </defs>
        
        {/* Helper grid for the void area */}
        {!isThumbnail && isEditable && (
            <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#grid)" className="pointer-events-none opacity-30" />
        )}

        {/* Group centered in the canvas */}
        <g transform={`translate(${offsetX}, ${offsetY})`}>
            
            {/* --- Floor Structure Layer --- */}
            
            {/* Main Room Floor */}
            <rect 
              x="0" 
              y="0" 
              width={dimensions.width} 
              height={dimensions.height} 
              fill={floorColor}
              stroke={isRoomEdit ? '#84cc16' : '#334155'} 
              strokeWidth={isThumbnail ? 0 : 4} 
              rx="4"
              className="transition-all duration-300 ease-in-out"
            />

            {/* Annexes (Extensions) */}
            {annexes.map((annex) => (
              <g key={annex.id}>
                <rect
                  x={annex.x}
                  y={annex.y}
                  width={annex.width}
                  height={annex.height}
                  fill={floorColor}
                  stroke={isRoomEdit ? '#84cc16' : '#334155'}
                  strokeWidth={isThumbnail ? 0 : 4}
                  rx="4"
                  className="transition-all duration-300"
                />
                {/* Annex Grid Overlay */}
                <rect 
                  x={annex.x} y={annex.y} width={annex.width} height={annex.height}
                  fill="url(#grid)" 
                  className="pointer-events-none opacity-50"
                />
                
                {/* Annex Interactive Handles (Room Edit Mode Only) */}
                {isRoomEdit && !isThumbnail && (
                  <>
                     {/* Move Handle (Top-Left) */}
                     <rect
                       x={annex.x - 6}
                       y={annex.y - 6}
                       width="12"
                       height="12"
                       className={moveStyle}
                       onMouseDown={(e) => { e.stopPropagation(); onAnnexDragStart && onAnnexDragStart(e, annex); }}
                     />
                     {/* Resize Handle (Bottom-Right) */}
                     <rect
                       x={annex.x + annex.width - 6}
                       y={annex.y + annex.height - 6}
                       width="12"
                       height="12"
                       className={cornerStyle}
                       onMouseDown={(e) => { e.stopPropagation(); onAnnexResizeStart && onAnnexResizeStart(e, annex); }}
                     />
                  </>
                )}
              </g>
            ))}
            
            {/* Main Floor Grid Overlay */}
            <rect 
                x="0" y="0" width={dimensions.width} height={dimensions.height}
                fill="url(#grid)" 
                className="pointer-events-none opacity-50"
            />
            
            {/* --- Room Edit Mode Controls (Main Room) --- */}
            {isRoomEdit && !isThumbnail && (
               <>
                 {/* Visual Border Highlight */}
                 <rect 
                    x="0" y="0" width={dimensions.width} height={dimensions.height}
                    fill="url(#dotGrid)"
                    className="pointer-events-none opacity-100"
                 />
                 
                 {/* Right Edge Resize Handle */}
                 <rect
                   x={dimensions.width - 4}
                   y={dimensions.height / 2 - 20}
                   width="8"
                   height="40"
                   rx="4"
                   className={handleStyle}
                   onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'right'); }}
                 />
                 
                 {/* Bottom Edge Resize Handle */}
                 <rect
                   x={dimensions.width / 2 - 20}
                   y={dimensions.height - 4}
                   width="40"
                   height="8"
                   rx="4"
                   className={`cursor-ns-resize hover:fill-lime-400 fill-white stroke-slate-900`}
                   onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'bottom'); }}
                 />
                 
                 {/* Corner Resize Handle */}
                 <rect
                   x={dimensions.width - 8}
                   y={dimensions.height - 8}
                   width="16"
                   height="16"
                   rx="2"
                   className={cornerStyle}
                   onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'corner'); }}
                 />
               </>
            )}

            {/* Entrance */}
            <path 
              d={`M ${door.x1} ${door.y1} L ${door.x2} ${door.y2}`} 
              stroke="#0f172a" 
              strokeWidth="8" 
              strokeLinecap="round"
            />
            
            {!isThumbnail && (
              <text 
                x={door.labelX} 
                y={door.labelY} 
                textAnchor="middle" 
                dominantBaseline="middle"
                transform={`rotate(${door.labelRotation}, ${door.labelX}, ${door.labelY})`}
                fill="#64748b" 
                fontSize="12" 
                fontFamily="sans-serif"
                fontWeight="bold"
                className="select-none pointer-events-none"
              >
                ENTRANCE
              </text>
            )}

            {/* --- Equipment Zones Layer --- */}
            <g style={{ opacity: isRoomEdit ? 0.3 : 1, pointerEvents: isRoomEdit ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
              {zones.map((zone) => {
                const isSelected = selectedZoneId === zone.id;
                const isStructure = zone.type === EquipmentType.CORRIDOR || zone.type === EquipmentType.FACILITY;
                
                return (
                  <g
                    key={zone.id}
                    onClick={(e) => {
                      if (!isThumbnail) {
                        e.stopPropagation();
                        onZoneClick(zone);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!isThumbnail && isLayoutEdit && onZoneDragStart) {
                        onZoneDragStart(e, zone);
                      }
                    }}
                    className={`transition-all duration-300 ${isThumbnail ? '' : isLayoutEdit ? 'cursor-move' : 'cursor-pointer'}`}
                    style={{
                      opacity: selectedZoneId && !isSelected ? 0.4 : 1,
                      filter: isSelected ? 'drop-shadow(0 0 8px rgba(0,0,0,0.6))' : 'none',
                    }}
                  >
                    {/* Animated Selection Border (Edit Mode) */}
                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <rect
                        x={zone.x - 4}
                        y={zone.y - 4}
                        width={zone.width + 8}
                        height={zone.height + 8}
                        fill="none"
                        stroke="#a3e635" 
                        strokeWidth="2"
                        strokeDasharray="8 4"
                        rx={isStructure ? 2 : 6}
                        className="animate-pulse pointer-events-none opacity-80"
                      />
                    )}

                    {/* Zone Area */}
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      fill={zone.color}
                      fillOpacity={isStructure ? 0.25 : 0.35} 
                      stroke={zone.color}
                      strokeWidth={isThumbnail ? 4 : (isSelected ? 2 : 1)} 
                      rx={isStructure ? 0 : 4} 
                    />
                    
                    {/* Equipment Representation - Hide for structures */}
                    {!isThumbnail && !isStructure && (
                      <rect
                        x={zone.x + 10}
                        y={zone.y + 10}
                        width={Math.max(0, zone.width - 20)}
                        height={Math.max(0, zone.height - 20)}
                        fill="none"
                        stroke={zone.color}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        rx="2"
                        className="pointer-events-none" 
                      />
                    )}

                    {/* Label - Hidden in thumbnail */}
                    {!isThumbnail && (
                      <text
                        x={zone.x + zone.width / 2}
                        y={zone.y + zone.height / 2}
                        fill="white"
                        fontSize="14"
                        fontWeight="600"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className="pointer-events-none drop-shadow-md select-none"
                        style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
                      >
                        {zone.name}
                      </text>
                    )}
                    
                    {/* Resize Handle (Layout Mode) */}
                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <rect
                        x={zone.x + zone.width - 12}
                        y={zone.y + zone.height - 12}
                        width="12"
                        height="12"
                        fill="white"
                        stroke="#0f172a"
                        strokeWidth="1"
                        className="cursor-nwse-resize hover:fill-lime-400"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (onZoneResizeStart) onZoneResizeStart(e, zone);
                        }}
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
