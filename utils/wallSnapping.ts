import { GymWall, SketchPoint } from '../types';

export interface SnapOptions {
  /** Magnetic snap activation threshold radius in pixels (default: 18px) */
  snapThreshold?: number;
  /** Wall ID to exclude from snapping calculations (e.g., the wall currently being dragged) */
  excludeWallId?: string;
  /** Whether to fallback to grid snapping if no wall endpoint is within threshold (default: true) */
  includeGrid?: boolean;
  /** Grid snapping step size in pixels (default: 10px) */
  gridSize?: number;
  /** Whether to also snap to wall segment midpoints (default: true) */
  snapToMidpoints?: boolean;
  /** Optional origin point (p1) to enforce orthogonal (90-degree / horizontal / vertical) snapping */
  referenceStartPoint?: SketchPoint;
}

export interface SnapPointTarget {
  x: number;
  y: number;
  wallId: string;
  type: 'endpoint-p1' | 'endpoint-p2' | 'midpoint';
}

export interface SnapResult {
  /** Final calculated x coordinate */
  x: number;
  /** Final calculated y coordinate */
  y: number;
  /** True if magnetically attached to an existing wall point */
  snapped: boolean;
  /** Classification of how the point was aligned */
  snapType: 'wall-endpoint' | 'wall-midpoint' | 'orthogonal' | 'grid' | 'none';
  /** ID of the target wall snapped onto, if any */
  snappedWallId?: string;
  /** Target coordinates snapped to */
  targetPoint?: { x: number; y: number };
  /** Distance in pixels to the snap target */
  distance: number;
}

/**
  * Helper to extract all candidate snap points (endpoints p1, p2, and midpoints) from existing walls.
  */
export function getWallSnapTargets(
  walls: GymWall[] = [],
  excludeWallId?: string,
  includeMidpoints = true
): SnapPointTarget[] {
  const targets: SnapPointTarget[] = [];

  for (const wall of walls) {
    if (excludeWallId && wall.id === excludeWallId) continue;

    // Endpoint P1
    targets.push({
      x: wall.x1,
      y: wall.y1,
      wallId: wall.id,
      type: 'endpoint-p1',
    });

    // Endpoint P2
    targets.push({
      x: wall.x2,
      y: wall.y2,
      wallId: wall.id,
      type: 'endpoint-p2',
    });

    // Wall Midpoint
    if (includeMidpoints) {
      const midX = wall.controlX ?? (wall.x1 + wall.x2) / 2;
      const midY = wall.controlY ?? (wall.y1 + wall.y2) / 2;
      targets.push({
        x: midX,
        y: midY,
        wallId: wall.id,
        type: 'midpoint',
      });
    }
  }

  return targets;
}

/**
  * Primary Helper Function: Magnetically snaps a 2D candidate point (x, y) to nearby
  * existing wall start/end endpoints, midpoints, or grid steps to ensure gap-free junction alignment.
  */
export function snapWallEndpoint(
  candidate: { x: number; y: number },
  walls: GymWall[] = [],
  options: SnapOptions = {}
): SnapResult {
  const {
    snapThreshold = 18,
    excludeWallId,
    includeGrid = true,
    gridSize = 10,
    snapToMidpoints = true,
    referenceStartPoint,
  } = options;

  let closestTarget: SnapPointTarget | null = null;
  let minDistance = Infinity;

  // 1. Find the nearest wall endpoint or midpoint
  const targets = getWallSnapTargets(walls, excludeWallId, snapToMidpoints);

  for (const target of targets) {
    const dist = Math.hypot(candidate.x - target.x, candidate.y - target.y);
    if (dist < minDistance) {
      minDistance = dist;
      closestTarget = target;
    }
  }

  // 2. Check if closest wall point is within magnetic snap radius
  if (closestTarget && minDistance <= snapThreshold) {
    return {
      x: closestTarget.x,
      y: closestTarget.y,
      snapped: true,
      snapType: closestTarget.type === 'midpoint' ? 'wall-midpoint' : 'wall-endpoint',
      snappedWallId: closestTarget.wallId,
      targetPoint: { x: closestTarget.x, y: closestTarget.y },
      distance: minDistance,
    };
  }

  // 3. Optional orthogonal alignment check (horizontal / vertical snap relative to reference point)
  let candidateX = candidate.x;
  let candidateY = candidate.y;
  let isOrthogonal = false;

  if (referenceStartPoint) {
    const dx = Math.abs(candidate.x - referenceStartPoint.x);
    const dy = Math.abs(candidate.y - referenceStartPoint.y);

    // Snap to horizontal line
    if (dy < snapThreshold) {
      candidateY = referenceStartPoint.y;
      isOrthogonal = true;
    }
    // Snap to vertical line
    else if (dx < snapThreshold) {
      candidateX = referenceStartPoint.x;
      isOrthogonal = true;
    }
  }

  // 4. Fallback grid snapping
  if (includeGrid && gridSize > 0) {
    const gridX = Math.round(candidateX / gridSize) * gridSize;
    const gridY = Math.round(candidateY / gridSize) * gridSize;

    return {
      x: gridX,
      y: gridY,
      snapped: isOrthogonal,
      snapType: isOrthogonal ? 'orthogonal' : 'grid',
      distance: isOrthogonal ? Math.hypot(candidate.x - candidateX, candidate.y - candidateY) : 0,
    };
  }

  return {
    x: candidateX,
    y: candidateY,
    snapped: isOrthogonal,
    snapType: isOrthogonal ? 'orthogonal' : 'none',
    distance: 0,
  };
}

/**
  * Helper to magnetically snap a newly created wall segment (p1 -> p2) against existing walls.
  */
export function snapNewWallSegment(
  p1: SketchPoint,
  p2: SketchPoint,
  walls: GymWall[] = [],
  options: SnapOptions = {}
): { p1: SketchPoint; p2: SketchPoint; snapP1: SnapResult; snapP2: SnapResult } {
  const snapP1 = snapWallEndpoint(p1, walls, options);
  const updatedP1 = { x: snapP1.x, y: snapP1.y };

  const snapP2 = snapWallEndpoint(p2, walls, {
    ...options,
    referenceStartPoint: updatedP1,
  });
  const updatedP2 = { x: snapP2.x, y: snapP2.y };

  return {
    p1: updatedP1,
    p2: updatedP2,
    snapP1,
    snapP2,
  };
}
