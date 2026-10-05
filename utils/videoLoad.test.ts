import { describe, it, expect } from 'vitest';
import { nextVideoLoadPhase, canPreload, upcomingTutorialUrls, SLOW_AFTER_MS, type VideoLoadPhase, type VideoLoadEvent } from './videoLoad';

const run = (events: VideoLoadEvent[], from: VideoLoadPhase = 'loading') =>
  events.reduce(nextVideoLoadPhase, from);

describe('what a video is doing while it loads', () => {
  it('is ready once it can play', () => {
    expect(run(['start', 'canplay'])).toBe('ready');
  });

  it('says it is taking longer than usual if it is still loading when the timer fires', () => {
    expect(run(['start', 'slowTimer'])).toBe('slow');
  });

  it('is ready if it arrives late, after the slow warning', () => {
    expect(run(['start', 'slowTimer', 'canplay'])).toBe('ready');
  });

  it('does not call a video slow once it is playing', () => {
    expect(run(['start', 'canplay', 'slowTimer'])).toBe('ready');
  });

  it('goes back to loading when playback runs out of buffer', () => {
    expect(run(['start', 'canplay', 'waiting'])).toBe('loading');
  });

  it('keeps a failed or slow video as it is when playback reports waiting', () => {
    expect(run(['error', 'waiting'])).toBe('error');
    expect(run(['start', 'slowTimer', 'waiting'])).toBe('slow');
  });

  it('fails on an error, from any state', () => {
    for (const from of ['loading', 'ready', 'slow'] as VideoLoadPhase[]) expect(nextVideoLoadPhase(from, 'error')).toBe('error');
  });

  it('starts loading again on a retry, whatever it was', () => {
    for (const from of ['error', 'slow', 'ready', 'loading'] as VideoLoadPhase[]) expect(nextVideoLoadPhase(from, 'retry')).toBe('loading');
  });

  it('starts over when a new video starts loading', () => {
    expect(run(['start', 'canplay', 'start'])).toBe('loading');
  });

  it('gives a video a few seconds before calling it slow', () => {
    expect(SLOW_AFTER_MS).toBeGreaterThanOrEqual(4000);
    expect(SLOW_AFTER_MS).toBeLessThanOrEqual(10000);
  });
});

describe('whether to load videos ahead', () => {
  it('does on an ordinary connection, and when nothing is known', () => {
    expect(canPreload(undefined)).toBe(true);
    expect(canPreload(null)).toBe(true);
    expect(canPreload({ effectiveType: '4g' })).toBe(true);
    expect(canPreload({ effectiveType: '3g' })).toBe(true);
  });

  it('does not on data saver or a 2G connection', () => {
    expect(canPreload({ saveData: true })).toBe(false);
    expect(canPreload({ effectiveType: '2g' })).toBe(false);
    expect(canPreload({ effectiveType: 'slow-2g' })).toBe(false);
  });
});

describe('which videos to load ahead', () => {
  const exercises = [
    { libraryExerciseId: 'a' }, { libraryExerciseId: 'b' }, {}, { libraryExerciseId: 'c' }, { libraryExerciseId: 'd' },
  ];
  const library = [
    { id: 'a', tutorialVideoUrl: '/v/a' }, { id: 'b' }, { id: 'c', tutorialVideoUrl: '/v/c' }, { id: 'd', tutorialVideoUrl: '/v/d' },
  ];

  it('takes the next videos in order, from where the client is', () => {
    expect(upcomingTutorialUrls(exercises, library, 0, 2)).toEqual(['/v/a', '/v/c']);
    expect(upcomingTutorialUrls(exercises, library, 1, 2)).toEqual(['/v/c', '/v/d']);
  });

  it('skips exercises with no uploaded video, or no library entry', () => {
    expect(upcomingTutorialUrls(exercises, library, 1, 1)).toEqual(['/v/c']);
  });

  it('gives only as many as are asked for, and none when none are left', () => {
    expect(upcomingTutorialUrls(exercises, library, 0, 1)).toEqual(['/v/a']);
    expect(upcomingTutorialUrls(exercises, library, 4, 5)).toEqual(['/v/d']);
    expect(upcomingTutorialUrls(exercises, library, 5, 2)).toEqual([]);
    expect(upcomingTutorialUrls(exercises, library, 0, 0)).toEqual([]);
  });

  it('does not list the same video twice', () => {
    const twice = [{ libraryExerciseId: 'a' }, { libraryExerciseId: 'a' }, { libraryExerciseId: 'c' }];
    expect(upcomingTutorialUrls(twice, library, 0, 3)).toEqual(['/v/a', '/v/c']);
  });

  it('copes with a negative start and an empty plan', () => {
    expect(upcomingTutorialUrls(exercises, library, -3, 1)).toEqual(['/v/a']);
    expect(upcomingTutorialUrls([], library, 0, 2)).toEqual([]);
  });
});
