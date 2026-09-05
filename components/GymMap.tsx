import React, { useState } from 'react';
import { GymZone, EquipmentType, GymDimensions, GymEntrance, GymAnnex, GymMachine, Language } from '../types';
import { translations, getGymTranslation } from '../translations';
import { isExerciseAvailableInZone } from '../utils/exerciseMatcher';
import { ZoomOut, Settings, Dumbbell, Activity, Zap, Target, Cpu, Layers, Box, Wind, RotateCcw, ArrowUpRight, MoveDown, Circle, Waves, Timer, ZoomIn, Minus, Plus, Maximize2, Search, X, MapPin, Play, Sparkles, Filter, ChevronRight, ChevronLeft, DoorOpen, Lock, Bath, Droplets, ShieldCheck, Sprout, Anchor, Repeat, ChevronsRight } from 'lucide-react';
import { ICON_MAP, getEquipmentIcon, getTaxonomyColor, isBeginnerFriendly, isAmenityZone, getAmenityStyleConfig, getZoneVisualCategory, VISUAL_CATEGORY_STYLES, ZoneVisualCategory, getZoneThemeStyle } from '../utils/equipmentIcons';

function renderStaircase(x1: number, y1: number, x2: number, y2: number, thickness: number, strokeColor: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular vector
  const px = -uy;
  const py = ux;

  const stepCount = Math.max(3, Math.floor(len / 14));
  const steps: React.ReactNode[] = [];

  // Draw outer borders
  steps.push(
    <line
      key="border"
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={strokeColor}
      strokeWidth={thickness}
      strokeLinecap="square"
      opacity="0.3"
    />
  );

  // Draw step lines across the thickness
  for (let i = 0; i <= stepCount; i++) {
    const t = i / stepCount;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const sx1 = cx - px * (thickness / 2);
    const sy1 = cy - py * (thickness / 2);
    const sx2 = cx + px * (thickness / 2);
    const sy2 = cy + py * (thickness / 2);

    steps.push(
      <line
        key={`step-${i}`}
        x1={sx1}
        y1={sy1}
        x2={sx2}
        y2={sy2}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
    );
  }

  // Draw center arrow representing ascending line
  const midX = x1 + dx * 0.5;
  const midY = y1 + dy * 0.5;
  const arrLen = Math.min(15, len * 0.25);
  const ax = midX + ux * arrLen;
  const ay = midY + uy * arrLen;

  // Arrowhead segments
  const arrowAngle = 0.5; // rad
  const ap1x = ax - ux * Math.cos(arrowAngle) * 5 + px * Math.sin(arrowAngle) * 5;
  const ap1y = ay - uy * Math.cos(arrowAngle) * 5 + py * Math.sin(arrowAngle) * 5;
  const ap2x = ax - ux * Math.cos(arrowAngle) * 5 - px * Math.sin(arrowAngle) * 5;
  const ap2y = ay - uy * Math.cos(arrowAngle) * 5 - py * Math.sin(arrowAngle) * 5;

  steps.push(
    <g key="arrow" opacity="0.8">
      <line x1={midX - ux * arrLen} y1={midY - uy * arrLen} x2={ax} y2={ay} stroke="#f59e0b" strokeWidth="1.5" />
      <polygon points={`${ax},${ay} ${ap1x},${ap1y} ${ap2x},${ap2y}`} fill="#f59e0b" />
    </g>
  );

  return <g>{steps}</g>;
}

function renderElevator(x1: number, y1: number, x2: number, y2: number, thickness: number, strokeColor: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const halfT = Math.max(12, thickness * 1.5); // box width
  const bx1 = x1 - px * halfT;
  const by1 = y1 - py * halfT;
  const bx2 = x1 + px * halfT;
  const by2 = y1 + py * halfT;
  const bx3 = x2 + px * halfT;
  const by3 = y2 + py * halfT;
  const bx4 = x2 - px * halfT;
  const by4 = y2 - py * halfT;

  return (
    <g>
      {/* Elevator Shaft Box */}
      <polygon
        points={`${bx1},${by1} ${bx2},${by2} ${bx3},${by3} ${bx4},${by4}`}
        fill="#1e293b"
        fillOpacity="0.8"
        stroke={strokeColor}
        strokeWidth="2"
      />
      {/* Crossing Lines (X) representing shaft */}
      <line x1={bx1} y1={by1} x2={bx3} y2={by3} stroke={strokeColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      <line x1={bx2} y1={by2} x2={bx4} y2={by4} stroke={strokeColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      {/* Sliding Door line */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="2.5" />
      {/* Dynamic elevator icon symbol in center */}
      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`} opacity="0.8">
        <rect x="-6" y="-6" width="12" height="12" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="-3" y1="-3" x2="3" y2="-3" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="-3" y1="3" x2="3" y2="3" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="3" y1="-3" x2="3" y2="3" stroke="#e2e8f0" strokeWidth="1" />
      </g>
    </g>
  );
}

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
  onHighlightMachine?: (machine: GymMachine) => void;

  selectedZoneId?: string | null;
  focusedZoneId?: string | null; 
  
  isEditable?: boolean;
  editMode?: 'layout' | 'room' | 'machine'; 
  
  onZoneDragStart?: (e: React.MouseEvent, zone: GymZone) => void;
  onZoneResizeStart?: (e: React.MouseEvent, zone: GymZone, handle?: 'se' | 'sw' | 'ne' | 'nw') => void;

  onMainRoomResizeStart?: (e: React.MouseEvent, handle: 'left' | 'right' | 'top' | 'bottom' | 'corner') => void;
  onAnnexDragStart?: (e: React.MouseEvent, annex: GymAnnex) => void;
  onAnnexResizeStart?: (e: React.MouseEvent, annex: GymAnnex, handle?: 'se' | 'sw' | 'ne' | 'nw' | 'right' | 'bottom' | 'top' | 'left' | 'corner') => void;
  selectedAnnexId?: string | null;
  onAnnexClick?: (annex: GymAnnex) => void;

  onMachineDragStart?: (e: React.MouseEvent, machine: GymMachine, zoneId: string) => void;
  onMachineResizeStart?: (e: React.MouseEvent, machine: GymMachine, zoneId: string) => void;
  selectedMachineId?: string | null;

  // Architectural Walls support
  selectedWallId?: string | null;
  onWallClick?: (wallId: string) => void;
  onWallDragStart?: (e: React.MouseEvent, wallId: string, handle: 'p1' | 'p2' | 'control' | 'move') => void;
  
  isThumbnail?: boolean;
  manualView?: ViewParams;
  lang?: Language;
  hideSearch?: boolean;
}

const GymMap: React.FC<GymMapProps> = ({ 
  zones, 
  dimensions = { width: 780, height: 580, x: 0, y: 0, walls: [], hallways: [], nodes: [] },
  entrance = { side: 'bottom', offset: 50, width: 80 },
  floorColor = '#1e293b',
  annexes = [],
  
  onZoneClick = (_: GymZone) => {},
  onMapClick = () => {},
  onMachineClick,
  onHighlightMachine,

  selectedZoneId = null,
  focusedZoneId = null,
  
  isEditable = false,
  editMode = 'layout',
  
  onZoneDragStart,
  onZoneResizeStart,
  
  onMainRoomResizeStart,
  onAnnexDragStart,
  onAnnexResizeStart,
  selectedAnnexId = null,
  onAnnexClick,

  onMachineDragStart,
  onMachineResizeStart,
  selectedMachineId,

  selectedWallId = null,
  onWallClick,
  onWallDragStart,
  
  isThumbnail = false,
  manualView,
  lang = 'en' as Language,
  hideSearch = false
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Exercise & Equipment Locating State
  const [mapSearchQuery, setMapSearchQuery] = React.useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = React.useState('All');
  const [activePopoverZone, setActivePopoverZone] = React.useState<GymZone | null>(null);
  // Zone popover starts compact (name + count) and expands to the full
  // equipment card only once the user explicitly asks for it.
  const [popoverExpanded, setPopoverExpanded] = React.useState(false);
  // Machine the user is currently hovering/tapping in the focused-zone view —
  // drives the name tooltip + glow highlight independent of selectedMachineId.
  const [hoveredMachineId, setHoveredMachineId] = React.useState<string | null>(null);

  // Fully exits the focused-zone view: closes the popover and zooms back out.
  const handleExitZone = React.useCallback(() => {
    setActivePopoverZone(null);
    setPopoverExpanded(false);
    onMapClick();
  }, [onMapClick]);

  // Clear search state when hideSearch or other windows open
  React.useEffect(() => {
    if (hideSearch) {
      setMapSearchQuery('');
      setSelectedMuscleFilter('All');
      setActivePopoverZone(null);
      setPopoverExpanded(false);
    }
  }, [hideSearch]);

  // Compute matching zones for live floor plan search & muscle filtering
  const matchingZoneIds = React.useMemo(() => {
    const query = mapSearchQuery.trim().toLowerCase();
    const muscle = selectedMuscleFilter.toLowerCase();
    const isFiltered = query.length > 0 || selectedMuscleFilter !== 'All';

    if (!isFiltered) return new Set<string>();

    const matched = new Set<string>();

    zones.forEach(zone => {
      const zName = getGymTranslation(zone.name, lang).toLowerCase();
      const zDesc = getGymTranslation(zone.description || '', lang).toLowerCase();
      const zType = (zone.type || '').toLowerCase();
      const machineNames = (zone.machines || []).map(m => getGymTranslation(m.name, lang).toLowerCase()).join(' ');

      // Muscle group heuristic match
      let matchesMuscle = true;
      if (selectedMuscleFilter !== 'All') {
        if (muscle === 'chest') matchesMuscle = zName.includes('chest') || zName.includes('bench') || zDesc.includes('chest') || zDesc.includes('bench') || machineNames.includes('press') || machineNames.includes('fly');
        else if (muscle === 'back') matchesMuscle = zName.includes('back') || zName.includes('pull') || zName.includes('row') || zDesc.includes('row') || zDesc.includes('lat') || machineNames.includes('row') || machineNames.includes('pulldown');
        else if (muscle === 'legs') matchesMuscle = zName.includes('leg') || zName.includes('squat') || zName.includes('rack') || zDesc.includes('quad') || machineNames.includes('leg') || machineNames.includes('press') || machineNames.includes('extension');
        else if (muscle === 'shoulders') matchesMuscle = zName.includes('shoulder') || zName.includes('press') || machineNames.includes('shoulder') || machineNames.includes('delt');
        else if (muscle === 'arms') matchesMuscle = zName.includes('bicep') || zName.includes('tricep') || zName.includes('arm') || zName.includes('cable') || machineNames.includes('curl') || machineNames.includes('tricep');
        else if (muscle === 'cardio') matchesMuscle = zType.includes('cardio') || zName.includes('cardio') || zName.includes('treadmill') || zName.includes('bike') || zName.includes('row') || machineNames.includes('treadmill') || machineNames.includes('bike');
      }

      // Text query match
      let matchesText = true;
      if (query) {
        const matchesZoneText = zName.includes(query) || zDesc.includes(query) || zType.includes(query) || machineNames.includes(query);
        const dummyEx = { id: 'search-query', name: query, targetMuscle: selectedMuscleFilter !== 'All' ? selectedMuscleFilter : 'Full Body', equipmentRequired: query, category: 'Strength', instructions: '' };
        const matchesExerciseInZone = isExerciseAvailableInZone(dummyEx, zone);
        matchesText = matchesZoneText || matchesExerciseInZone;
      }

      if (matchesMuscle && matchesText) {
        matched.add(zone.id);
      }
    });

    return matched;
  }, [mapSearchQuery, selectedMuscleFilter, zones, lang]);

  // Persistence Scope prefix to separate admin and user views
  const storagePrefix = isEditable ? 'admin' : 'user';

  // State values for active zoom & pan
  const [zoomScale, setZoomScale] = React.useState<number>(() => {
    if (isThumbnail) return 1;
    const saved = sessionStorage.getItem(`gym_map_zoom_scale_${storagePrefix}`);
    return saved ? parseFloat(saved) : 1;
  });

  const [panX, setPanX] = React.useState<number>(() => {
    if (isThumbnail) return 0;
    const saved = sessionStorage.getItem(`gym_map_pan_x_${storagePrefix}`);
    return saved ? parseFloat(saved) : 0;
  });

  const [panY, setPanY] = React.useState<number>(() => {
    if (isThumbnail) return 0;
    const saved = sessionStorage.getItem(`gym_map_pan_y_${storagePrefix}`);
    return saved ? parseFloat(saved) : 0;
  });

  const [isPanning, setIsPanning] = React.useState(false);

  // Animation flag & interaction refs
  const panStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStartRef = React.useRef<{
    x1: number; y1: number; x2: number; y2: number;
    distance: number; cx: number; cy: number;
    panX: number; panY: number; scale: number;
  } | null>(null);
  const touchSingleRef = React.useRef<{ x: number; y: number; panX: number; panY: number; } | null>(null);
  const wasDraggedRef = React.useRef(false);

  // Sync zoom/pan state into SessionStorage "while they remain on the page"
  React.useEffect(() => {
    if (isThumbnail) return;
    sessionStorage.setItem(`gym_map_zoom_scale_${storagePrefix}`, zoomScale.toString());
    sessionStorage.setItem(`gym_map_pan_x_${storagePrefix}`, panX.toString());
    sessionStorage.setItem(`gym_map_pan_y_${storagePrefix}`, panY.toString());
  }, [zoomScale, panX, panY, isThumbnail, storagePrefix]);

  const clampPan = React.useCallback((x: number, y: number, scale: number) => {
    const container = containerRef.current;
    if (!container) return { x, y };
    const rect = container.getBoundingClientRect();
    
    // Bounds: Prevent the floor map from sliding entirely out of view
    const limitMarginWidth = rect.width * 0.9;
    const limitMarginHeight = rect.height * 0.9;

    const maxPanX = limitMarginWidth;
    const minPanX = -limitMarginWidth * scale;
    const maxPanY = limitMarginHeight;
    const minPanY = -limitMarginHeight * scale;

    return {
      x: Math.min(Math.max(x, minPanX), maxPanX),
      y: Math.min(Math.max(y, minPanY), maxPanY)
    };
  }, []);

  const handleZoom = React.useCallback((factor: number, clientX?: number, clientY?: number) => {
    if (isThumbnail) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const pivotX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const pivotY = clientY !== undefined ? clientY - rect.top : rect.height / 2;

    const newScale = Math.min(Math.max(zoomScale * factor, 0.4), 10);

    // Zoom centered around cursor/pivot algorithm
    const newPanX = pivotX - (pivotX - panX) * (newScale / zoomScale);
    const newPanY = pivotY - (pivotY - panY) * (newScale / zoomScale);

    const clamped = clampPan(newPanX, newPanY, newScale);

    setZoomScale(newScale);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }, [zoomScale, panX, panY, isThumbnail, clampPan]);

  // Handle active wheel scroll zooming natively with passive: false to prevent scrolling parent container
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || isThumbnail) return;

    const handleContainerWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      handleZoom(factor, e.clientX, e.clientY);
    };

    container.addEventListener('wheel', handleContainerWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleContainerWheel);
    };
  }, [handleZoom, isThumbnail]);

  const handleMouseDownForPan = (e: React.MouseEvent) => {
    if (isThumbnail) return;

    // Check click target to prevent drag conflicts with zone/machine coordinates
    const targetElement = e.target as SVGElement;
    const isBgClick = targetElement && (
      targetElement.tagName === 'svg' ||
      targetElement.id === 'grid' ||
      targetElement.id === 'smallGrid' ||
      targetElement.id === 'dotGrid' ||
      targetElement.getAttribute('fill') === 'url(#grid)' ||
      targetElement.getAttribute('fill') === 'url(#smallGrid)' ||
      targetElement.getAttribute('id')?.includes('annex-bg') ||
      targetElement.getAttribute('id')?.includes('annex-fg') ||
      targetElement.getAttribute('rx') === '4' // floor backgrounds
    );

    const shouldPan = !isEditable || e.button === 1 || isBgClick;
    if (!shouldPan) return;

    setIsPanning(true);
    wasDraggedRef.current = false;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panX,
      panY: panY
    };
  };

  const handleMouseMoveForPan = (e: React.MouseEvent) => {
    if (!isPanning) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      wasDraggedRef.current = true;
    }

    const targetPanX = panStartRef.current.panX + dx;
    const targetPanY = panStartRef.current.panY + dy;

    const clamped = clampPan(targetPanX, targetPanY, zoomScale);
    setPanX(clamped.x);
    setPanY(clamped.y);
  };

  const handleMouseUpForPan = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Touch gesture support: Pinch, drag-to-pan in responsive environments
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isThumbnail) return;

    const container = containerRef.current;
    if (!container) return;

    wasDraggedRef.current = false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchSingleRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: panX,
        panY: panY
      };
      touchStartRef.current = null;
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;

      touchStartRef.current = {
        x1: t1.clientX,
        y1: t1.clientY,
        x2: t2.clientX,
        y2: t2.clientY,
        distance: dist,
        cx: cx,
        cy: cy,
        panX: panX,
        panY: panY,
        scale: zoomScale
      };
      touchSingleRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isThumbnail) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (e.touches.length === 1 && touchSingleRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchSingleRef.current.x;
      const dy = touch.clientY - touchSingleRef.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        wasDraggedRef.current = true;
      }

      const targetX = touchSingleRef.current.panX + dx;
      const targetY = touchSingleRef.current.panY + dy;

      const clamped = clampPan(targetX, targetY, zoomScale);
      setPanX(clamped.x);
      setPanY(clamped.y);
    } else if (e.touches.length === 2 && touchStartRef.current) {
      wasDraggedRef.current = true;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;

      const scaleFactor = dist / touchStartRef.current.distance;
      let newScale = touchStartRef.current.scale * scaleFactor;
      newScale = Math.min(Math.max(newScale, 0.4), 10);

      const pivotX = cx - rect.left;
      const pivotY = cy - rect.top;

      const startValuePanX = touchStartRef.current.panX;
      const startValuePanY = touchStartRef.current.panY;
      const startScale = touchStartRef.current.scale;

      const basePosPanX = pivotX - (pivotX - startValuePanX) * (newScale / startScale);
      const basePosPanY = pivotY - (pivotY - startValuePanY) * (newScale / startScale);

      const dragMoveX = cx - touchStartRef.current.cx;
      const dragMoveY = cy - touchStartRef.current.cy;

      const clamped = clampPan(basePosPanX + dragMoveX, basePosPanY + dragMoveY, newScale);
      setZoomScale(newScale);
      setPanX(clamped.x);
      setPanY(clamped.y);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    touchSingleRef.current = null;
    // reset dragged context with a minor delayed timing buffer
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 100);
  };

  const t = translations[lang];
  let viewBoxWidth: number;
  let viewBoxHeight: number;
  let offsetX: number;
  let offsetY: number;

  const focusedZone = zones.find(z => z.id === (focusedZoneId || selectedZoneId));

  // Reset zoom & pan to center when focused zone or selected zone changes
  React.useEffect(() => {
    if (focusedZoneId || selectedZoneId) {
      setPanX(0);
      setPanY(0);
      setZoomScale(1);
    }
  }, [focusedZoneId, selectedZoneId]);

  const getTotalBounds = () => {
    // Dragging the left/top wall outward moves the room's origin negative;
    // starting the bounds at a hardcoded 0 would clip that part of the room
    // out of the viewBox instead of scrolling the view to include it.
    const roomX = dimensions.x || 0;
    const roomY = dimensions.y || 0;
    let minX = roomX;
    let minY = roomY;
    let maxX = roomX + dimensions.width;
    let maxY = roomY + dimensions.height;

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

    // In the non-editable user view, clicking a zone also opens the zone-info
    // popover card anchored to the bottom of the screen. Reserve extra room
    // there instead of centering the zone, so the card never renders on top
    // of it — the zone sits near the top of the view with the popover's
    // space left empty below, rather than the two overlapping.
    const POPOVER_RESERVE = !isEditable ? 260 : 0;
    viewBoxHeight = Math.max(targetHeight, MIN_VIEW_SIZE) + POPOVER_RESERVE;
    offsetX = ((viewBoxWidth - focusedZone.width) / 2) - focusedZone.x;
    offsetY = POPOVER_RESERVE > 0
      ? ZOOM_PADDING - focusedZone.y
      : ((viewBoxHeight - focusedZone.height) / 2) - focusedZone.y;
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
    // The left/top walls can now sit away from (0,0), so the entrance has to
    // be placed relative to the room's actual origin, not the canvas origin.
    const roomX = dimensions.x || 0;
    const roomY = dimensions.y || 0;
    const pos = offset / 100;
    let x1, y1, x2, y2, labelX, labelY, labelRotation;
    switch (side) {
      case 'top':
        x1 = roomX + (gymW * pos) - (width / 2); y1 = roomY; x2 = x1 + width; y2 = roomY;
        labelX = x1 + width / 2; labelY = y1 - 15; labelRotation = 0;
        break;
      case 'bottom':
        x1 = roomX + (gymW * pos) - (width / 2); y1 = roomY + gymH; x2 = x1 + width; y2 = roomY + gymH;
        labelX = x1 + width / 2; labelY = y2 + 15; labelRotation = 0;
        break;
      case 'left':
        x1 = roomX; y1 = roomY + (gymH * pos) - (width / 2); x2 = roomX; y2 = y1 + width;
        labelX = x1 - 15; labelY = y1 + width / 2; labelRotation = -90;
        break;
      case 'right':
        x1 = roomX + gymW; y1 = roomY + (gymH * pos) - (width / 2); x2 = roomX + gymW; y2 = y1 + width;
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
    
    const svgX = (viewBoxX - panX) / zoomScale - offsetX;
    const svgY = (viewBoxY - panY) / zoomScale - offsetY;
    
    return { x: svgX, y: svgY };
  };

  const door = getEntrancePath();
  const isRoomEdit = isEditable && editMode === 'room';
  const isLayoutEdit = isEditable && editMode === 'layout';
  const isMachineEdit = isEditable && editMode === 'machine';
  
  const handleStyle = "cursor-ew-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const cornerStyle = "cursor-nwse-resize hover:fill-lime-400 fill-white stroke-slate-900";
  const moveStyle = "cursor-move hover:fill-lime-400 fill-white stroke-slate-900";

  const scaleParams = (() => {
    if (isThumbnail) return null;
    const targetPx = 60;
    const rawMeters = targetPx / (10 * zoomScale);
    const niceMeters = [0.5, 1, 2, 5, 10, 20, 50, 100];
    const closest = niceMeters.reduce((prev, curr) => 
      Math.abs(curr - rawMeters) < Math.abs(prev - rawMeters) ? curr : prev
    );
    const barWidthPx = closest * 10 * zoomScale;
    return { meters: closest, widthPx: barWidthPx };
  })();

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden flex flex-col ${isThumbnail ? 'bg-slate-900/50' : 'bg-slate-900 rounded-xl border border-slate-800'}`}>
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
        @keyframes machineGlowWhite {
          0%, 100% { stroke-width: 2px; stroke-opacity: 0.7; filter: drop-shadow(0 0 3px rgba(255,255,255,0.6)); }
          50% { stroke-width: 4px; stroke-opacity: 1; filter: drop-shadow(0 0 10px rgba(255,255,255,1)); }
        }
        .machine-glow-white {
          animation: machineGlowWhite 1.3s ease-in-out infinite;
          stroke: #ffffff !important;
        }
        @keyframes machineGlowLime {
          0%, 100% { stroke-width: 2px; stroke-opacity: 0.85; filter: drop-shadow(0 0 4px rgba(163,230,53,0.7)); }
          50% { stroke-width: 3px; stroke-opacity: 1; filter: drop-shadow(0 0 14px rgba(163,230,53,1)); }
        }
        .machine-glow-lime {
          animation: machineGlowLime 1.3s ease-in-out infinite;
          stroke: #a3e635 !important;
        }
        @keyframes spotlightRing {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        .spotlight-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: spotlightRing 1.8s ease-out infinite;
          stroke: #a3e635;
          fill: none;
          pointer-events: none;
        }
      `}</style>

      {!isThumbnail && (
        <>
          {(isEditable) && (
             <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-lg text-xs font-bold border z-10 pointer-events-none select-none backdrop-blur-md shadow-lg
               ${isRoomEdit ? 'bg-lime-950/90 text-lime-400 border-lime-800' : 
                 isMachineEdit ? 'bg-blue-950/90 text-blue-400 border-blue-800' :
                 'bg-slate-950/90 text-slate-300 border-slate-700'}
             `}>
               {isRoomEdit ? 'Room Editor Mode' : 
                isMachineEdit ? 'Machine Editor Mode' : 
                'Layout Editor Mode'}
             </div>
          )}

        </>
      )}
      
      <div className="w-full flex-1 relative overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className={`w-full h-full select-none ${isThumbnail ? '' : 'touch-none'} ${
            isPanning ? 'cursor-grabbing' :
            isThumbnail ? 'cursor-default' :
            'cursor-grab'
          }`}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDownForPan}
          onMouseMove={handleMouseMoveForPan}
          onMouseUp={handleMouseUpForPan}
          onMouseLeave={handleMouseUpForPan}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClick={(e) => {
            if (wasDraggedRef.current) {
              wasDraggedRef.current = false;
              e.stopPropagation();
              return;
            }
            handleExitZone();
          }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
            <pattern id="floorGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.8" />
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
            <pattern id="amenityDots" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.25)" />
            </pattern>
            <pattern id="amenityHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            </pattern>
            {/* Diagonal sheen for the "glass" training-zone fill — a soft
                highlight sweep implying a glossy translucent panel. */}
            <linearGradient id="zoneGlassSheen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.03" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {!isThumbnail && isEditable && (
              <rect width={viewBoxWidth} height={viewBoxHeight} fill={isMachineEdit ? "url(#smallGrid)" : "url(#grid)"} className="pointer-events-none opacity-30" />
          )}

          <g
            transform={isThumbnail ? `translate(${offsetX}, ${offsetY})` : `translate(${panX}, ${panY}) scale(${zoomScale}) translate(${offsetX}, ${offsetY})`}
            className={isThumbnail ? "transition-transform duration-700 ease-in-out" : "transition-none"}
          >
            {/* 1. Dark Blueprint Floor Base & Outer Room Boundary matching picture */}
            {(() => {
              const effectiveFloorColor = (floorColor && floorColor !== '#ffffff') ? floorColor : '#141d2f';
              // The left/top walls are draggable, so the room's top-left
              // corner is no longer always (0,0) — fall back to 0 for gyms
              // saved before that origin existed.
              const roomX = dimensions.x || 0;
              const roomY = dimensions.y || 0;
              return (
                <>
                  <rect
                    x={roomX}
                    y={roomY}
                    width={dimensions.width}
                    height={dimensions.height}
                    fill={effectiveFloorColor}
                    stroke={isRoomEdit ? '#84cc16' : '#233554'}
                    strokeWidth={isThumbnail ? 0 : (isRoomEdit ? 4 : 1.5)}
                    rx="10"
                    className="transition-all duration-300 ease-in-out"
                  />
                  {/* Subtle Grid Layer over gym floor */}
                  <rect
                    x={roomX}
                    y={roomY}
                    width={dimensions.width}
                    height={dimensions.height}
                    fill="url(#floorGrid)"
                    rx="10"
                    className="pointer-events-none"
                  />
                  {annexes.map((annex) => {
                    const isSelected = isRoomEdit && selectedAnnexId === annex.id;
                    return (
                      <g key={`annex-group-${annex.id}`}>
                        <rect 
                          x={annex.x} 
                          y={annex.y} 
                          width={annex.width} 
                          height={annex.height} 
                          fill={annex.color || effectiveFloorColor} 
                          stroke={isRoomEdit ? (isSelected ? '#a3e635' : '#84cc16') : '#233554'} 
                          strokeWidth={isThumbnail ? 0 : (isSelected ? 4 : 1.5)} 
                          rx="10" 
                          className="transition-all duration-300 ease-in-out" 
                        />
                        <rect
                          x={annex.x}
                          y={annex.y}
                          width={annex.width}
                          height={annex.height}
                          fill="url(#floorGrid)"
                          rx="10"
                          className="pointer-events-none"
                        />
                      </g>
                    );
                  })}
                </>
              );
            })()}

            {/* Architectural Walls & Portals Layer */}
            {(dimensions.walls || []).map((wall) => {
              const isSelected = selectedWallId === wall.id;
              const isCurved = wall.type === 'curved';
              const ctrlX = wall.controlX ?? ((wall.x1 + wall.x2) / 2);
              const ctrlY = wall.controlY ?? ((wall.y1 + wall.y2) / 2);

              // Path data
              const d = isCurved
                ? `M ${wall.x1} ${wall.y1} Q ${ctrlX} ${ctrlY} ${wall.x2} ${wall.y2}`
                : `M ${wall.x1} ${wall.y1} L ${wall.x2} ${wall.y2}`;

              // Styles based on type
              let strokeColor = '#334155';
              let strokeWidth = wall.thickness || 8;
              let strokeDash = undefined;

              if (wall.wallType === 'exterior') {
                strokeColor = '#1e293b';
                strokeWidth = wall.thickness || 10;
              } else if (wall.wallType === 'interior') {
                strokeColor = '#475569';
                strokeWidth = wall.thickness || 6;
              } else if (wall.wallType === 'window') {
                strokeColor = '#38bdf8';
                strokeWidth = wall.thickness || 5;
                strokeDash = '8 2'; // window panes
              } else if (wall.wallType === 'door') {
                strokeColor = '#f59e0b';
                strokeWidth = wall.thickness || 6;
              } else if (wall.wallType === 'corridor') {
                strokeColor = '#94a3b8';
                strokeWidth = wall.thickness || 4;
                strokeDash = '6 4';
              } else if (wall.wallType === 'staircase') {
                strokeColor = '#64748b';
                strokeWidth = wall.thickness || 14;
              } else if (wall.wallType === 'elevator') {
                strokeColor = '#475569';
                strokeWidth = wall.thickness || 16;
              }

              // Low confidence feedback
              const isLowConfidence = wall.confidence === 'low';
              if (isLowConfidence) {
                strokeColor = '#f97316'; // warning orange
                strokeDash = '4 4';
              }

              return (
                <g key={wall.id}>
                  {/* Interactive selection helper (invisible wider line) */}
                  {!isThumbnail && isRoomEdit && (
                    <path
                      d={d}
                      stroke="transparent"
                      strokeWidth="24"
                      fill="none"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWallClick && onWallClick(wall.id);
                      }}
                      onMouseDown={(e) => {
                        if (isRoomEdit && onWallDragStart) {
                          e.stopPropagation();
                          onWallDragStart(e, wall.id, 'move');
                        }
                      }}
                    />
                  )}

                  {/* Main Wall Line / Custom Visualizer */}
                  {wall.wallType === 'staircase' ? (
                    <g 
                      onClick={(e) => {
                        if (!isThumbnail && isRoomEdit) {
                          e.stopPropagation();
                          onWallClick && onWallClick(wall.id);
                        }
                      }}
                      className={isRoomEdit && !isThumbnail ? 'cursor-pointer' : ''}
                      style={{ filter: isSelected ? 'drop-shadow(0 0 4px #84cc16)' : 'none' }}
                    >
                      {renderStaircase(wall.x1, wall.y1, wall.x2, wall.y2, strokeWidth, strokeColor)}
                    </g>
                  ) : wall.wallType === 'elevator' ? (
                    <g 
                      onClick={(e) => {
                        if (!isThumbnail && isRoomEdit) {
                          e.stopPropagation();
                          onWallClick && onWallClick(wall.id);
                        }
                      }}
                      className={isRoomEdit && !isThumbnail ? 'cursor-pointer' : ''}
                      style={{ filter: isSelected ? 'drop-shadow(0 0 4px #84cc16)' : 'none' }}
                    >
                      {renderElevator(wall.x1, wall.y1, wall.x2, wall.y2, strokeWidth, strokeColor)}
                    </g>
                  ) : (
                    <path
                      d={d}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      className={isRoomEdit && !isThumbnail ? 'cursor-pointer hover:stroke-lime-400 transition-colors' : ''}
                      style={{ filter: isSelected ? 'drop-shadow(0 0 4px #84cc16)' : 'none' }}
                      onClick={(e) => {
                        if (!isThumbnail && isRoomEdit) {
                          e.stopPropagation();
                          onWallClick && onWallClick(wall.id);
                        }
                      }}
                    />
                  )}

                  {/* If window, draw a subtle inner glass highlight line */}
                  {wall.wallType === 'window' && (
                    <path
                      d={d}
                      stroke="#e0f2fe"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Low confidence visual indicator icon */}
                  {isLowConfidence && !isThumbnail && (
                    <g transform={`translate(${(wall.x1 + wall.x2) / 2}, ${(wall.y1 + wall.y2) / 2 - 12})`} className="pointer-events-none">
                      <circle cx="0" cy="0" r="7" fill="#f97316" />
                      <text x="0" y="3" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">?</text>
                    </g>
                  )}

                  {/* Interactive Handles for editing endpoints & control points when selected */}
                  {isSelected && isRoomEdit && !isThumbnail && (
                    <g>
                      {/* End Point 1 */}
                      <circle
                        cx={wall.x1}
                        cy={wall.y1}
                        r="8"
                        fill="#a3e635"
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="cursor-move shadow hover:scale-125 transition-transform"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onWallDragStart && onWallDragStart(e, wall.id, 'p1');
                        }}
                      />
                      {/* End Point 2 */}
                      <circle
                        cx={wall.x2}
                        cy={wall.y2}
                        r="8"
                        fill="#a3e635"
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="cursor-move shadow hover:scale-125 transition-transform"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onWallDragStart && onWallDragStart(e, wall.id, 'p2');
                        }}
                      />
                      {/* Bezier Control Point (if curved, or always show for curved/potential curve editing) */}
                      {isCurved && (
                        <>
                          {/* Dashed lines to control point */}
                          <line x1={wall.x1} y1={wall.y1} x2={ctrlX} y2={ctrlY} stroke="#84cc16" strokeDasharray="3 3" strokeWidth="1" />
                          <line x1={wall.x2} y1={wall.y2} x2={ctrlX} y2={ctrlY} stroke="#84cc16" strokeDasharray="3 3" strokeWidth="1" />
                          <circle
                            cx={ctrlX}
                            cy={ctrlY}
                            r="7"
                            fill="#3b82f6"
                            stroke="#0f172a"
                            strokeWidth="2"
                            className="cursor-move shadow hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onWallDragStart && onWallDragStart(e, wall.id, 'control');
                            }}
                          />
                        </>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* 3. Grid overlay & Interactivity on top */}
            <rect x={dimensions.x || 0} y={dimensions.y || 0} width={dimensions.width} height={dimensions.height} fill="url(#grid)" className="pointer-events-none opacity-50"/>
            {annexes.map((annex, i) => {
              const isSelected = isRoomEdit && selectedAnnexId === annex.id;
              const displayName = annex.name || `Extension ${i + 1}`;
              return (
                <g key={annex.id}>
                  <rect x={annex.x} y={annex.y} width={annex.width} height={annex.height} fill="url(#grid)" className="pointer-events-none opacity-50"/>
                  {isRoomEdit && !isThumbnail && (
                    <>
                      {/* Interactive Drag & Select Body Area */}
                      <rect
                        x={annex.x}
                        y={annex.y}
                        width={annex.width}
                        height={annex.height}
                        fill={isSelected ? '#84cc16' : '#38bdf8'}
                        fillOpacity={isSelected ? 0.14 : 0.001}
                        stroke={isSelected ? '#a3e635' : '#64748b'}
                        strokeWidth={isSelected ? 2.5 : 1.2}
                        strokeDasharray={isSelected ? undefined : '6 4'}
                        className={`transition-colors ${isSelected ? 'cursor-move' : 'cursor-pointer hover:stroke-lime-400 hover:fill-lime-400/10'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (onAnnexClick) onAnnexClick(annex);
                          if (onAnnexDragStart) onAnnexDragStart(e, annex);
                        }}
                      />

                      {/* Dimension and Label Tag on the annex */}
                      <g className="pointer-events-none select-none">
                        <rect
                          x={annex.x + 8}
                          y={annex.y + 8}
                          width={Math.min(Math.max(annex.width - 16, 60), Math.max(130, displayName.length * 7 + 85))}
                          height="22"
                          rx="4"
                          fill="#090d16"
                          fillOpacity="0.9"
                          stroke={isSelected ? '#84cc16' : '#334155'}
                          strokeWidth={isSelected ? '1.5' : '1'}
                        />
                        <text
                          x={annex.x + 14}
                          y={annex.y + 22}
                          fill={isSelected ? '#a3e635' : '#cbd5e1'}
                          fontSize="9.5"
                          fontWeight="bold"
                        >
                          {displayName} ({(annex.width / 10).toFixed(1)}m × {(annex.height / 10).toFixed(1)}m)
                        </text>
                      </g>

                      {/* Resize & Transform Handles (Displayed prominently when selected) */}
                      {isSelected && (
                        <g>
                          {/* NW (Top-Left) Corner Handle */}
                          <rect
                            x={annex.x - 6}
                            y={annex.y - 6}
                            width="12"
                            height="12"
                            rx="2"
                            className="cursor-nwse-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize (Top-Left)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'nw');
                            }}
                          />

                          {/* NE (Top-Right) Corner Handle */}
                          <rect
                            x={annex.x + annex.width - 6}
                            y={annex.y - 6}
                            width="12"
                            height="12"
                            rx="2"
                            className="cursor-nesw-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize (Top-Right)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'ne');
                            }}
                          />

                          {/* SE (Bottom-Right) Corner Handle */}
                          <rect
                            x={annex.x + annex.width - 6}
                            y={annex.y + annex.height - 6}
                            width="12"
                            height="12"
                            rx="2"
                            className="cursor-nwse-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize (Bottom-Right)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'se');
                            }}
                          />

                          {/* SW (Bottom-Left) Corner Handle */}
                          <rect
                            x={annex.x - 6}
                            y={annex.y + annex.height - 6}
                            width="12"
                            height="12"
                            rx="2"
                            className="cursor-nesw-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize (Bottom-Left)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'sw');
                            }}
                          />

                          {/* Top (North) Edge Handle */}
                          <rect
                            x={annex.x + annex.width / 2 - 16}
                            y={annex.y - 4}
                            width="32"
                            height="8"
                            rx="4"
                            className="cursor-ns-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize Height (Top)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'top');
                            }}
                          />

                          {/* Bottom (South) Edge Handle */}
                          <rect
                            x={annex.x + annex.width / 2 - 16}
                            y={annex.y + annex.height - 4}
                            width="32"
                            height="8"
                            rx="4"
                            className="cursor-ns-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize Height (Bottom)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'bottom');
                            }}
                          />

                          {/* Left (West) Edge Handle */}
                          <rect
                            x={annex.x - 4}
                            y={annex.y + annex.height / 2 - 16}
                            width="8"
                            height="32"
                            rx="4"
                            className="cursor-ew-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize Width (Left)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'left');
                            }}
                          />

                          {/* Right (East) Edge Handle */}
                          <rect
                            x={annex.x + annex.width - 4}
                            y={annex.y + annex.height / 2 - 16}
                            width="8"
                            height="32"
                            rx="4"
                            className="cursor-ew-resize fill-white stroke-slate-950 stroke-2 hover:fill-lime-400 shadow-md"
                            title="Resize Width (Right)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (onAnnexClick) onAnnexClick(annex);
                              if (onAnnexResizeStart) onAnnexResizeStart(e, annex, 'right');
                            }}
                          />
                        </g>
                      )}
                    </>
                  )}
                </g>
              );
            })}
            {isRoomEdit && !isThumbnail && (() => {
               const roomX = dimensions.x || 0;
               const roomY = dimensions.y || 0;
               return (
               <>
                 <rect x={roomX} y={roomY} width={dimensions.width} height={dimensions.height} fill="url(#dotGrid)" className="pointer-events-none opacity-100"/>
                 {/* Every wall is its own handle now, not just the two that
                     used to be draggable — left/top move the room's origin,
                     right/bottom only change width/height. */}
                 <rect x={roomX - 4} y={roomY + dimensions.height / 2 - 20} width="8" height="40" rx="4" className={handleStyle} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'left'); }} />
                 <rect x={roomX + dimensions.width - 4} y={roomY + dimensions.height / 2 - 20} width="8" height="40" rx="4" className={handleStyle} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'right'); }} />
                 <rect x={roomX + dimensions.width / 2 - 20} y={roomY - 4} width="40" height="8" rx="4" className={`cursor-ns-resize hover:fill-lime-400 fill-white stroke-slate-900`} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'top'); }} />
                 <rect x={roomX + dimensions.width / 2 - 20} y={roomY + dimensions.height - 4} width="40" height="8" rx="4" className={`cursor-ns-resize hover:fill-lime-400 fill-white stroke-slate-900`} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'bottom'); }} />
                 <rect x={roomX + dimensions.width - 8} y={roomY + dimensions.height - 8} width="16" height="16" rx="2" className={cornerStyle} onMouseDown={(e) => { e.stopPropagation(); onMainRoomResizeStart && onMainRoomResizeStart(e, 'corner'); }} />
               </>
               );
             })()}
            {/* Hallway Walkway Paths */}
            {(dimensions.hallways || []).map((hallway) => {
              if (!hallway.points || hallway.points.length < 2) return null;
              const pathD = `M ${hallway.points[0].x} ${hallway.points[0].y} ` + hallway.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
              return (
                <g key={hallway.id} className="pointer-events-none">
                  {/* Outer Corridor Boundary */}
                  <path d={pathD} stroke={hallway.color || "#334155"} strokeWidth={(hallway.width || 36) + 4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
                  {/* Corridor Walkway Base */}
                  <path d={pathD} stroke="#1e293b" strokeWidth={hallway.width || 36} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  {/* Walkway Directional Centerline Track */}
                  <path d={pathD} stroke="#38bdf8" strokeWidth="3" strokeDasharray="10 10" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
                  {/* Corridor Label */}
                  {hallway.name && (
                    <text
                      x={(hallway.points[0].x + hallway.points[hallway.points.length - 1].x) / 2}
                      y={(hallway.points[0].y + hallway.points[hallway.points.length - 1].y) / 2 - 8}
                      textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" letterSpacing="1"
                    >
                      🚶 {hallway.name.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}

            <path d={`M ${door.x1} ${door.y1} L ${door.x2} ${door.y2}`} stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
            {!isThumbnail && (
              <text x={door.labelX} y={door.labelY} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${door.labelRotation}, ${door.labelX}, ${door.labelY})`} fill="#64748b" fontSize="12" fontFamily="sans-serif" fontWeight="bold" className="select-none pointer-events-none">ENTRANCE</text>
            )}

            <g style={{ opacity: isRoomEdit ? 0.3 : 1, pointerEvents: isRoomEdit ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
              {zones.map((zone, idx) => {
                const isSelected = selectedZoneId === zone.id;
                const isFocused = focusedZoneId === zone.id;
                const isAmenity = isAmenityZone(zone);
                const isMatch = matchingZoneIds.has(zone.id);
                const hasActiveSearch = matchingZoneIds.size > 0 || mapSearchQuery.trim().length > 0 || selectedMuscleFilter !== 'All';
                const zoneOpacity = focusedZoneId
                  ? (isFocused ? 1 : 0.6)
                  : hasActiveSearch
                  ? (isMatch ? 1 : 0.15)
                  : (selectedZoneId && !isSelected ? 0.4 : 1);
                // On the Locate map, dim the non-focused zones' fill so the
                // focused zone stands out, but keep every zone's name
                // readable at a glance regardless of focus. These zone
                // theme colors are already fairly dark/muted by design, so
                // a low opacity here reads as near-invisible against the
                // near-black floor rather than "dim" — 0.6 keeps a real gap
                // vs. the fully-lit focused zone while staying visible.
                const labelOpacity = focusedZoneId ? (isFocused ? 1 : 0.92) : zoneOpacity;

                // Zone style matching screenshot
                const zoneStyle = getZoneThemeStyle(zone);
                const zoneLabel = getGymTranslation(zone.name, lang);
                const hasZoneLabel = !!zoneLabel.trim();
                const showZoneIcon = !isThumbnail && zone.height >= 70 && (!zone.machines || zone.machines.length === 0 || isAmenity);

                return (
                  <g
                    key={`zone-${zone.id}-${idx}`}
                    onClick={(e) => {
                      if (wasDraggedRef.current) {
                        wasDraggedRef.current = false;
                        e.stopPropagation();
                        return;
                      }
                      if (!isThumbnail) {
                        e.stopPropagation();
                        if (!isMachineEdit) {
                          setPanX(0);
                          setPanY(0);
                          setZoomScale(1);
                          onZoneClick(zone);
                          if (!isEditable) {
                            setActivePopoverZone(zone);
                            setPopoverExpanded(false);
                          }
                        }
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!isThumbnail && isLayoutEdit && onZoneDragStart) onZoneDragStart(e, zone);
                    }}
                    className={`transition-all duration-300 ease-in-out ${isThumbnail ? '' : isLayoutEdit ? 'cursor-move' : isMachineEdit && isFocused ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {/* Active / Match Highlight Glow */}
                    {isMatch && !isThumbnail && (
                      <rect
                        x={zone.x - 4} y={zone.y - 4} width={zone.width + 8} height={zone.height + 8}
                        fill="none" stroke="#22c55e" strokeWidth="2.5" rx="10"
                        className="animate-pulse pointer-events-none drop-shadow-md"
                      />
                    )}

                    {/* Main Zone Card. Training zones (open floor — nothing
                        physically separates them) get a translucent
                        "glass" fill so the floor grid shows through, plus
                        a soft glow on the border. Amenity zones (real
                        walled rooms — lockers, reception) stay fully
                        opaque/matte, since nothing behind them should be
                        visible. */}
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      fill={zoneStyle.fill}
                      fillOpacity={isAmenity ? 1 : 0.42}
                      stroke={isSelected ? '#38bdf8' : zoneStyle.stroke}
                      strokeWidth={isThumbnail ? 2 : (isSelected || isFocused ? 2.5 : 1.5)}
                      rx="8"
                      className="transition-all duration-300 ease-in-out shadow-sm"
                      style={{
                        opacity: zoneOpacity,
                        filter: !isAmenity && !isThumbnail ? `drop-shadow(0 0 7px ${zoneStyle.stroke}66)` : undefined,
                      }}
                    />
                    {!isAmenity && (
                      <rect
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        fill="url(#zoneGlassSheen)"
                        rx="8"
                        className="pointer-events-none transition-opacity duration-300 ease-in-out"
                        style={{ opacity: zoneOpacity }}
                      />
                    )}

                    {/* Inner Dashed Accent Border for Workout Zones, Solid for Amenities */}
                    <rect
                      x={zone.x + 6}
                      y={zone.y + 6}
                      width={Math.max(0, zone.width - 12)}
                      height={Math.max(0, zone.height - 12)}
                      fill="none"
                      stroke={isSelected ? '#38bdf8' : zoneStyle.dashStroke}
                      strokeWidth={isAmenity ? 1.4 : 1.2}
                      strokeDasharray={isAmenity ? undefined : "4 3"}
                      strokeOpacity={isAmenity ? 0.95 : 0.85}
                      rx="4"
                      className="pointer-events-none transition-opacity duration-300 ease-in-out"
                      style={{ opacity: zoneOpacity }}
                    />

                    {/* Soft blurred machine footprints — real position & size within
                        the zone, previewed before zooming in. Hidden once this zone
                        is the one being focused/zoomed, since the real machines take
                        over rendering at that point. Also hidden for amenity zones
                        (Reception, Lockers, Water Station, Classes, etc.) — those
                        typically carry one placeholder "machine" spanning nearly the
                        whole zone (e.g. a Water Fountain fixture), which reads as an
                        odd blurry blob rather than a useful preview; the zone icon
                        below represents them better. */}
                    {!isFocused && !isThumbnail && !isAmenity && zone.machines && zone.machines.length > 0 && (
                      <g style={{ pointerEvents: 'none', opacity: zoneOpacity }} className="transition-opacity duration-300 ease-in-out">
                        {zone.machines.map((machine, mIdx) => (
                          <rect
                            key={`preview-${zone.id}-${machine.id}-${mIdx}`}
                            x={zone.x + machine.x}
                            y={zone.y + machine.y}
                            width={machine.width}
                            height={machine.height}
                            rx="4"
                            fill="rgba(255,255,255,0.16)"
                            style={{ filter: 'blur(3px)' }}
                          />
                        ))}
                      </g>
                    )}

                    {/* Zone icon — shown when a zone has no individual machines
                        placed in it (e.g. Front Desk), or is an amenity zone even
                        with a placeholder machine (e.g. Water Station, Classes),
                        so the tile isn't just a colored box with a name label and
                        nothing else. Zones with real machines (strength/cardio/etc.)
                        already get visual richness from the machine footprints
                        themselves. */}
                    {(() => {
                      if (!showZoneIcon) return null;
                      const ZoneIcon = getEquipmentIcon(zone.icon, zone.name, zone.type);
                      if (!ZoneIcon) return null;
                      const iconSize = zone.width < 110 || zone.height < 90 ? 20 : 26;
                      // With no label to sit above, center the icon in the
                      // zone instead of leaving it offset with empty space
                      // below where the name would otherwise be.
                      const iconY = hasZoneLabel ? zone.y + zone.height / 2 - iconSize * 0.9 : zone.y + zone.height / 2;
                      return (
                        <g
                          transform={`translate(${zone.x + zone.width / 2}, ${iconY})`}
                          className="pointer-events-none transition-opacity duration-300 ease-in-out"
                          style={{ opacity: labelOpacity }}
                        >
                          <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
                            <ZoneIcon size={iconSize} color={zoneStyle.textColor || '#ffffff'} />
                          </g>
                        </g>
                      );
                    })()}

                    {/* Centered White Zone Name matching screenshot — opacity is
                        tracked separately from the fill/border above so the
                        label stays legible even when a zone's fill is dimmed. */}
                    <text
                      x={zone.x + zone.width / 2}
                      y={zone.y + zone.height / 2 + (showZoneIcon && hasZoneLabel ? 14 : 0)}
                      fill={zoneStyle.textColor || '#ffffff'}
                      fontSize={zone.width < 110 || zone.height < 55 ? '12' : '14'}
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none drop-shadow-sm font-sans transition-opacity duration-300 ease-in-out"
                      style={{ opacity: labelOpacity }}
                    >
                      {zoneLabel}
                    </text>

                    {/* Layout Edit Mode selected indicator pill */}
                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <g transform={`translate(${zone.x + zone.width - 52}, ${zone.y + zone.height - 24})`}>
                        <rect width="46" height="18" rx="4" fill="#0f172a" fillOpacity="0.9" stroke="#334155" strokeWidth="1" />
                        <text x="23" y="12" fill="#94a3b8" fontSize="9" fontWeight="700" textAnchor="middle">Selected</text>
                      </g>
                    )}

                    {/* Thumbnail view fallback label */}
                    {isThumbnail && (
                      <text
                        x={zone.x + zone.width / 2}
                        y={zone.y + zone.height / 2}
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {getGymTranslation(zone.name, lang).substring(0, 10)}
                      </text>
                    )}

                    {/* Machines rendered inside zone (when focused or editing) */}
                    {((isFocused && !isAmenity && !isEditable) || (isMachineEdit && isFocused)) && zone.machines && (
                      <g className="animate-in fade-in zoom-in duration-300">
                        {(() => {
                          // Spotlight mode: once a specific machine in this zone is the
                          // resolved match (selectedMachineId), every other machine dims
                          // to gray so there's only one thing left to look at.
                          const zoneHasTarget = !isEditable && !!selectedMachineId && zone.machines!.some(m => m.id === selectedMachineId);
                          return zone.machines!.map((machine, mIdx) => {
                          const isMachineSelected = selectedMachineId === machine.id;
                          const isHovered = hoveredMachineId === machine.id;
                          const showAdminSelected = isEditable && isMachineSelected;
                          const isUserTarget = !isEditable && isMachineSelected;
                          const showUserGlow = !isEditable && (isMachineSelected || isHovered);
                          const isDimmed = zoneHasTarget && !isMachineSelected && !isHovered;
                          const MachineIcon = getEquipmentIcon(machine.icon, machine.name, zone.type);

                          return (
                            <g
                               key={`mach-${zone.id}-${machine.id}-${mIdx}`}
                               transform={`translate(${zone.x + machine.x}, ${zone.y + machine.y})`}
                               style={{ opacity: isDimmed ? 0.35 : 1, filter: isDimmed ? 'grayscale(1)' : 'none', transition: 'opacity 0.3s ease, filter 0.3s ease' }}
                               onMouseDown={(e) => {
                                 if (isMachineEdit && onMachineDragStart) {
                                   e.stopPropagation();
                                   onMachineDragStart(e, machine, zone.id);
                                 }
                               }}
                               onMouseEnter={() => { if (!isEditable) setHoveredMachineId(machine.id); }}
                               onMouseLeave={() => { if (!isEditable) setHoveredMachineId(null); }}
                               onClick={(e) => {
                                 if (wasDraggedRef.current) {
                                   wasDraggedRef.current = false;
                                   e.stopPropagation();
                                   return;
                                 }
                                 if (!isEditable && onMachineClick) {
                                     e.stopPropagation();
                                     setHoveredMachineId(machine.id);
                                     onMachineClick(machine);
                                 }
                               }}
                               className={`${isMachineEdit ? 'cursor-move' : !isEditable ? 'cursor-pointer hover:opacity-80' : ''}`}
                            >
                              {isUserTarget && (
                                <rect
                                  x={-6} y={-6} width={machine.width + 12} height={machine.height + 12}
                                  rx="8" strokeWidth="1.5"
                                  className="spotlight-ring"
                                />
                              )}
                              <rect
                                width={machine.width} height={machine.height}
                                fill={zoneStyle.stroke} fillOpacity={isUserTarget ? 1 : isDimmed ? 0.5 : 0.85}
                                stroke={showAdminSelected ? "#3b82f6" : isUserTarget ? "#a3e635" : "#ffffff"}
                                strokeWidth={(showAdminSelected || showUserGlow) ? 2 : 1}
                                rx="4"
                                className={showAdminSelected ? 'machine-pulse' : isUserTarget ? 'machine-glow-lime' : (showUserGlow ? 'machine-glow-white' : '')}
                              />

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

                              {showUserGlow && (
                                <g transform={`translate(${machine.width / 2}, -8)`} className="pointer-events-none animate-in fade-in duration-150">
                                  {(() => {
                                    const label = getGymTranslation(machine.name, lang);
                                    const tipWidth = Math.max(40, label.length * 6.5 + 16);
                                    return (
                                      <g transform={`translate(${-tipWidth / 2}, ${-20})`}>
                                        <rect width={tipWidth} height="20" rx="6" fill="#131f38" stroke="#1e293b" />
                                        <text x={tipWidth / 2} y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                                          {label}
                                        </text>
                                      </g>
                                    );
                                  })()}
                                </g>
                              )}

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
                        });
                        })()}
                      </g>
                    )}

                    {isSelected && isLayoutEdit && !isThumbnail && (
                      <>
                        <rect
                          x={zone.x - 6} y={zone.y - 6} width="12" height="12"
                          fill="white" stroke="#0f172a" strokeWidth="1"
                          className="cursor-nwse-resize hover:fill-lime-400"
                          onMouseDown={(e) => { e.stopPropagation(); if (onZoneResizeStart) onZoneResizeStart(e, zone, 'nw'); }}
                        />
                        <rect
                          x={zone.x + zone.width - 6} y={zone.y - 6} width="12" height="12"
                          fill="white" stroke="#0f172a" strokeWidth="1"
                          className="cursor-nesw-resize hover:fill-lime-400"
                          onMouseDown={(e) => { e.stopPropagation(); if (onZoneResizeStart) onZoneResizeStart(e, zone, 'ne'); }}
                        />
                        <rect
                          x={zone.x + zone.width - 6} y={zone.y + zone.height - 6} width="12" height="12"
                          fill="white" stroke="#0f172a" strokeWidth="1"
                          className="cursor-nwse-resize hover:fill-lime-400"
                          onMouseDown={(e) => { e.stopPropagation(); if (onZoneResizeStart) onZoneResizeStart(e, zone, 'se'); }}
                        />
                        <rect
                          x={zone.x - 6} y={zone.y + zone.height - 6} width="12" height="12"
                          fill="white" stroke="#0f172a" strokeWidth="1"
                          className="cursor-nesw-resize hover:fill-lime-400"
                          onMouseDown={(e) => { e.stopPropagation(); if (onZoneResizeStart) onZoneResizeStart(e, zone, 'sw'); }}
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* Map Header Status Overlay */}
      {!isThumbnail && !isEditable && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-start pointer-events-none">
          {/* Back-to-map pill, shown whenever a zone is focused/zoomed in */}
          {focusedZoneId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMapClick();
                setMapSearchQuery('');
                setSelectedMuscleFilter('All');
              }}
              className="pointer-events-auto flex items-center gap-2 bg-slate-950/92 hover:border-lime-500/60 border border-slate-700 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 text-xs font-bold text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-lime-400" />
              <span>Back to map</span>
            </button>
          )}
        </div>
      )}

      {/* Zone Popover: starts as a compact strip, expands to the full card
          only when the user explicitly asks for it via "Explore this area" */}
      {activePopoverZone && !isEditable && !isThumbnail && !hideSearch && !popoverExpanded && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-sm bg-slate-950/95 border border-slate-700 p-3 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-white truncate">
              {getGymTranslation(activePopoverZone.name, lang)}
            </h4>
            <p className="text-[11px] text-slate-400">
              {(activePopoverZone.machines || []).length} equipment item{(activePopoverZone.machines || []).length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => setPopoverExpanded(true)}
            className="flex-shrink-0 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold py-2.5 px-3.5 rounded-xl text-xs whitespace-nowrap transition-colors active:scale-95"
          >
            Explore this area
          </button>
        </div>
      )}

      {activePopoverZone && !isEditable && !isThumbnail && !hideSearch && popoverExpanded && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-sm bg-slate-950/95 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-slate-950 shadow-sm"
                  style={{ backgroundColor: getTaxonomyColor(activePopoverZone.type, activePopoverZone.color) }}
                >
                  {activePopoverZone.type.replace('_', ' ')}
                </span>
                {isBeginnerFriendly(activePopoverZone) && (
                  <span className="text-[10px] font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    🌱 Beginner Friendly
                  </span>
                )}
              </div>
              <h4 className="text-base font-black text-white flex items-center gap-2">
                {getGymTranslation(activePopoverZone.name, lang)}
              </h4>
            </div>
            <button
              onClick={handleExitZone}
              title="Close and return to the full gym map"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {activePopoverZone.description && (
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">{getGymTranslation(activePopoverZone.description, lang)}</p>
          )}
          {activePopoverZone.machines && activePopoverZone.machines.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Equipment available:</span>
              <div className="flex flex-wrap gap-1">
                {activePopoverZone.machines.map((m, mIdx) => (
                  <button
                    key={`pop-${m.id}-${mIdx}`}
                    onClick={() => onHighlightMachine?.(m)}
                    className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span>{getGymTranslation(m.name, lang)}</span>
                    {m.videoUrl && <Play className="w-2.5 h-2.5 text-lime-400 fill-current" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              onZoneClick(activePopoverZone);
              setActivePopoverZone(null);
              setPopoverExpanded(false);
            }}
            className="w-full bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Explore Exercises for this Area</span>
          </button>
          <button
            onClick={() => setPopoverExpanded(false)}
            className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold py-2 rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Editable Mode Bottom Helper */}
      {isEditable && !isThumbnail && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none select-none">
          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-400 font-medium shadow-md">
            <span>✦ Drag to move</span>
            <span className="text-slate-600">•</span>
            <span>⤢ Drag corner to resize</span>
          </div>
        </div>
      )}

      {!isThumbnail && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          {scaleParams && (
            <div className="flex flex-col items-center justify-center border-r border-slate-800/65 pr-2.5 mr-1 select-none pointer-events-none">
              <span className="text-[9px] font-mono font-bold text-slate-400 leading-none mb-1">{scaleParams.meters} m</span>
              <div className="h-1 border-x border-b border-slate-400" style={{ width: `${scaleParams.widthPx}px` }} />
            </div>
          )}

          <button
            onClick={() => handleZoom(1.2)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-90"
            title="Zoom In (+)"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-mono font-black text-slate-400 px-1.5 min-w-[38px] text-center border-x border-slate-800/65">
            {Math.round(zoomScale * 100)}%
          </span>
          
          <button
            onClick={() => handleZoom(1 / 1.2)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-90"
            title="Zoom Out (−)"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => {
              setZoomScale(1);
              setPanX(0);
              setPanY(0);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all active:scale-90 flex items-center justify-center"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default GymMap;