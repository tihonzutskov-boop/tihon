
import React from 'react';
import { GymZone, EquipmentType, GymDimensions, GymEntrance } from '../types';

interface GymMapProps {
  zones: GymZone[];
  dimensions?: GymDimensions;
  entrance?: GymEntrance;
  floorColor?: string;
  onZoneClick?: (zone: GymZone) => void;
  onMapClick?: () => void;
  selectedZoneId?: string | null;
  isEditable?: boolean;
  onZoneDragStart?: (e: React.MouseEvent, zone: GymZone) => void;
  onZoneResizeStart?: (e: React.MouseEvent, zone: GymZone) => void;
  isThumbnail?: boolean;
}

const GymMap: React.FC<GymMapProps> = ({ 
  zones, 
  dimensions = { width: 780, height: 580 },
  entrance = { side: 'bottom', offset: 50, width: 80 },
  floorColor = '#1e293b',
  onZoneClick = (_: GymZone) => {}, 
  onMapClick = () => {},
  selectedZoneId = null, 
  isEditable = false,
  onZoneDragStart,
  onZoneResizeStart,
  isThumbnail = false
}) => {
  
  // Center the gym floor within the 800x600 viewBox
  const offsetX = (800 - dimensions.width) / 2;
  const offsetY = (600 - dimensions.height) / 2;

  // Calculate Entrance Coordinates
  const getEntrancePath = () => {
    const { side, offset, width } = entrance;
    const { width: gymW, height: gymH } = dimensions;
    // Entrance coordinates are relative to the gym floor (0,0)
    
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

  return (
    <div className={`w-full h-full relative overflow-hidden ${isThumbnail ? 'bg-slate-900/50' : 'bg-slate-900 rounded-xl shadow-2xl border border-slate-700'}`}>
      {!isThumbnail && (
        <div className="absolute top-4 left-4 bg-slate-950/90 px-3 py-1 rounded text-xs text-slate-400 border border-slate-700 z-10 pointer-events-none select-none backdrop-blur-sm">
          {isEditable ? 'Editor Mode' : 'Interactive Gym Floor'}
        </div>
      )}
      
      <svg
        viewBox="0 0 800 600"
        className={`w-full h-full select-none ${isEditable ? 'cursor-default' : isThumbnail ? 'cursor-default' : 'cursor-crosshair'}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => {
          // Detect click on background
          if (e.target === e.currentTarget || (e.target as Element).tagName === 'rect') {
             // Let click handler handle it
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
        </defs>
        
        {/* Helper grid for the void area */}
        {!isThumbnail && isEditable && (
            <rect width="800" height="600" fill="url(#grid)" className="pointer-events-none opacity-30" />
        )}

        {/* Group centered in the canvas */}
        <g transform={`translate(${offsetX}, ${offsetY})`}>
            
            {/* The Gym Floor */}
            <rect 
              x="0" 
              y="0" 
              width={dimensions.width} 
              height={dimensions.height} 
              fill={floorColor}
              stroke="#334155" 
              strokeWidth={isThumbnail ? 0 : 4} 
              rx="4"
              className="pointer-events-auto"
              // Add a subtle grid pattern on the floor itself
            />
            
            {/* Floor Grid Overlay */}
            <rect 
                x="0" y="0" width={dimensions.width} height={dimensions.height}
                fill="url(#grid)" 
                className="pointer-events-none opacity-50"
            />

            {/* Door */}
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

            {/* Zones */}
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
                    if (!isThumbnail && isEditable && onZoneDragStart) {
                      onZoneDragStart(e, zone);
                    }
                  }}
                  className={`transition-all duration-300 ${isThumbnail ? '' : isEditable ? 'cursor-move' : 'cursor-pointer'}`}
                  style={{
                    opacity: selectedZoneId && !isSelected ? 0.4 : 1,
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(0,0,0,0.6))' : 'none',
                  }}
                >
                  {/* Animated Selection Border (Edit Mode) */}
                  {isSelected && isEditable && !isThumbnail && (
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
                  
                  {/* Resize Handle (Edit Mode) */}
                  {isSelected && isEditable && !isThumbnail && (
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
      </svg>
    </div>
  );
};

export default GymMap;
