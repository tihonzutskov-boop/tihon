import { describe, it, expect } from 'vitest';
import { videoUseOf, withVideoUse, videoStatus, videoCoverage } from './bookendVideos';
import { selectBookendVideos, checkEligibility, gymEquipmentIds } from './planGeneration';
import type { LibraryExercise } from '../types';

const video = (over: Partial<LibraryExercise> = {}): LibraryExercise => ({
  id: 'v1', name: 'Hip openers', targetMuscle: 'Hips', equipmentRequired: '', category: 'Warm-up', instructions: '',
  exerciseType: 'video', videoDurationLabel: '5 min', requiredEquipmentIds: [], ...over,
});
const eligibility = { profile: { goal: 'Muscle gain', experience: 'Beginner' as const, daysPerWeek: 3, sessionMinutes: 75, injuryAreas: [] }, availableEquipmentIds: gymEquipmentIds(null) };

describe('what a video is used for', () => {
  it('reads it from its roles', () => {
    expect(videoUseOf(video())).toBe('none');
    expect(videoUseOf(video({ bookendRoles: ['warmup'] }))).toBe('warmup');
    expect(videoUseOf(video({ bookendRoles: ['cooldown'] }))).toBe('cooldown');
    expect(videoUseOf(video({ bookendRoles: ['warmup', 'cooldown'] }))).toBe('both');
  });

  it('reads a video tagged only by its category, the way the generator does', () => {
    expect(videoUseOf(video({ exerciseCategory: 'warmup' }))).toBe('warmup');
    expect(videoUseOf(video({ exerciseCategory: 'cooldown' }))).toBe('cooldown');
    expect(videoUseOf(video({ exerciseCategory: 'warmup', bookendRoles: ['cooldown'] }))).toBe('both');
  });
});

describe('setting what a video is used for', () => {
  it.each(['warmup', 'cooldown', 'both'] as const)('makes a video usable by the generator for %s', use => {
    const tagged = withVideoUse(video(), use);
    expect(tagged.generationEnabled).toBe(true);
    expect(tagged.exerciseCategory).toBeTruthy();
    expect(checkEligibility(tagged, eligibility).eligible).toBe(true);
    expect(videoUseOf(tagged)).toBe(use);
    expect(videoStatus(tagged).ready).toBe(true);
  });

  it('is picked by the selection for the end it is set for, and not the other', () => {
    const tagged = withVideoUse(video(), 'warmup');
    expect(selectBookendVideos('warmup', [tagged], 5).map(v => v.id)).toEqual(['v1']);
    expect(selectBookendVideos('cooldown', [tagged], 5)).toEqual([]);
  });

  it('takes a video off an end it was set for, even when only its category said so', () => {
    const legacy = video({ exerciseCategory: 'warmup', generationEnabled: true });
    const moved = withVideoUse(legacy, 'cooldown');
    expect(selectBookendVideos('warmup', [moved], 5)).toEqual([]);
    expect(selectBookendVideos('cooldown', [moved], 5).map(v => v.id)).toEqual(['v1']);
    const off = withVideoUse(legacy, 'none');
    expect(selectBookendVideos('warmup', [off], 5)).toEqual([]);
    expect(videoUseOf(off)).toBe('none');
  });

  it('keeps a category that is not an end, such as the abs video\'s', () => {
    const abs = video({ exerciseCategory: 'isolation', movementPattern: 'core', generationEnabled: true });
    expect(withVideoUse(abs, 'warmup').exerciseCategory).toBe('isolation');
    expect(withVideoUse(abs, 'none').exerciseCategory).toBe('isolation');
  });

  it('does not switch generation off when a video is set to not used', () => {
    const abs = video({ exerciseCategory: 'isolation', movementPattern: 'core', generationEnabled: true });
    expect(withVideoUse(abs, 'none')).toMatchObject({ generationEnabled: true, bookendRoles: [] });
  });

  it('does not invent a category for a video that is not used', () => {
    expect(withVideoUse(video(), 'none').exerciseCategory).toBeUndefined();
  });

  it('does not change anything else about the video', () => {
    const v = video({ videoUrl: 'https://youtu.be/x', instructions: 'Follow along' });
    expect(withVideoUse(v, 'both')).toMatchObject({ id: 'v1', name: 'Hip openers', videoUrl: 'https://youtu.be/x', instructions: 'Follow along', videoDurationLabel: '5 min' });
  });
});

describe('what stops a video being used', () => {
  it('says a tagged video is switched off', () => {
    const s = videoStatus(video({ bookendRoles: ['warmup'], exerciseCategory: 'mobility', generationEnabled: false }));
    expect(s.ready).toBe(false);
    expect(s.problems).toEqual(['Switched off for automatic plans']);
  });

  it('says a tagged video has no category', () => {
    const s = videoStatus(video({ bookendRoles: ['warmup'], generationEnabled: true }));
    expect(s.ready).toBe(false);
    expect(s.problems).toEqual(['No category set']);
  });

  it('has nothing to fix on a video that is not used', () => {
    const s = videoStatus(video());
    expect(s).toMatchObject({ use: 'none', ready: false, problems: [] });
  });

  it('notes a missing length without blocking the video', () => {
    const s = videoStatus(withVideoUse(video({ videoDurationLabel: 'Follow-along video' }), 'warmup'));
    expect(s.ready).toBe(true);
    expect(s.minutes).toBe(3);
    expect(s.notes[0]).toMatch(/No length set.*3 minutes/);
  });

  it('reads the length', () => {
    expect(videoStatus(video({ videoDurationLabel: '12:30' })).minutes).toBe(13);
  });
});

describe('what the library has to offer', () => {
  it('counts only the videos that are ready, at each end', () => {
    const lib = [
      withVideoUse(video({ id: 'a', videoDurationLabel: '5 min' }), 'warmup'),
      withVideoUse(video({ id: 'b', videoDurationLabel: '4 min' }), 'both'),
      withVideoUse(video({ id: 'c', videoDurationLabel: '6 min' }), 'cooldown'),
      { ...withVideoUse(video({ id: 'd' }), 'warmup'), generationEnabled: false },
      video({ id: 'e' }),
      { ...withVideoUse(video({ id: 'f' }), 'warmup'), exerciseType: 'standard' as const },
    ];
    expect(videoCoverage(lib)).toEqual({ warmup: { videos: 2, minutes: 9 }, cooldown: { videos: 2, minutes: 10 } });
  });

  it('is empty for an empty library', () => {
    expect(videoCoverage([])).toEqual({ warmup: { videos: 0, minutes: 0 }, cooldown: { videos: 0, minutes: 0 } });
  });
});
