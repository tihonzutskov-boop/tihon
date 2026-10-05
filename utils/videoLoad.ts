// What a tutorial video is doing while it loads, and which ones to load ahead.
//
// A video can take a long time to arrive — it comes from object storage or, for
// those not moved yet, from the database through the app server — and a browser
// shows a black box all that time, which reads as broken. The player says what is
// happening instead: loading, taking longer than usual (with a way to try again),
// or failed (the same).

export type VideoLoadPhase = 'loading' | 'ready' | 'slow' | 'error';
export type VideoLoadEvent = 'start' | 'canplay' | 'waiting' | 'slowTimer' | 'error' | 'retry';

/** How long a video may load before the player says it is taking longer than usual. */
export const SLOW_AFTER_MS = 6000;

export const nextVideoLoadPhase = (phase: VideoLoadPhase, event: VideoLoadEvent): VideoLoadPhase => {
  switch (event) {
    case 'start':
    case 'retry':
      return 'loading';
    case 'canplay':
      return 'ready';
    // Playback ran out of buffer. Only a video that was playing goes back to
    // loading; one already failed or slow stays as it is.
    case 'waiting':
      return phase === 'ready' ? 'loading' : phase;
    // The timer only matters while still loading.
    case 'slowTimer':
      return phase === 'loading' ? 'slow' : phase;
    case 'error':
      return 'error';
    default:
      return phase;
  }
};

/** Whether the connection is one to spend loading videos nobody has asked for yet. */
export const canPreload = (connection?: { saveData?: boolean; effectiveType?: string } | null): boolean =>
  !(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''));

/**
 * The uploaded tutorial videos of the next few exercises from `fromIndex` on, in
 * order, so they can be loaded while the current one is being read. A YouTube
 * follow-along is not one of these: it cannot be loaded ahead.
 */
export const upcomingTutorialUrls = (
  exercises: { libraryExerciseId?: string }[],
  library: { id: string; tutorialVideoUrl?: string }[],
  fromIndex: number,
  count: number,
): string[] => {
  const urls: string[] = [];
  for (let i = Math.max(0, fromIndex); i < exercises.length && urls.length < count; i++) {
    const id = exercises[i].libraryExerciseId;
    const url = id ? library.find(l => l.id === id)?.tutorialVideoUrl : undefined;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
};
