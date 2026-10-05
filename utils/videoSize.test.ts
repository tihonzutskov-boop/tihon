import { describe, it, expect } from 'vitest';
import { HEAVY_VIDEO_BYTES, isHeavyVideo, formatVideoSize, heavyVideoWarning, heaviestVideos } from './videoSize';

const MB = 1024 * 1024;

describe('which videos are too heavy', () => {
  it('is anything over 15 MB, and not 15 MB itself', () => {
    expect(HEAVY_VIDEO_BYTES).toBe(15 * MB);
    expect(isHeavyVideo(15 * MB)).toBe(false);
    expect(isHeavyVideo(15 * MB + 1)).toBe(true);
    expect(isHeavyVideo(60 * MB)).toBe(true);
  });

  it('is not a video of ordinary size, or one with no size known', () => {
    expect(isHeavyVideo(4 * MB)).toBe(false);
    expect(isHeavyVideo(0)).toBe(false);
    expect(isHeavyVideo(null)).toBe(false);
    expect(isHeavyVideo(undefined)).toBe(false);
  });
});

describe('writing a size', () => {
  it('rounds to a whole number from 10 MB and keeps a decimal below it', () => {
    expect(formatVideoSize(62 * MB)).toBe('62 MB');
    expect(formatVideoSize(10 * MB)).toBe('10 MB');
    expect(formatVideoSize(4.26 * MB)).toBe('4.3 MB');
  });

  it('says under 1 MB for a small file, and 0 for nothing or nonsense', () => {
    expect(formatVideoSize(300 * 1024)).toBe('<1 MB');
    expect(formatVideoSize(0)).toBe('0 MB');
    expect(formatVideoSize(NaN)).toBe('0 MB');
  });
});

describe('the warning on the upload screen', () => {
  it('names the size, says why it matters and what to do', () => {
    const text = heavyVideoWarning(62 * MB)!;
    expect(text).toContain('62 MB');
    expect(text).toMatch(/slowly on phones/);
    expect(text).toMatch(/720p/);
  });

  it('says nothing about a video that is a fine size', () => {
    expect(heavyVideoWarning(5 * MB)).toBeNull();
    expect(heavyVideoWarning(15 * MB)).toBeNull();
    expect(heavyVideoWarning(null)).toBeNull();
  });
});

describe('the heaviest videos', () => {
  const videos = [
    { name: 'a', bytes: 3 * MB }, { name: 'b', bytes: 80 * MB }, { name: 'c', bytes: 20 * MB },
    { name: 'd', bytes: 15 * MB }, { name: 'e', bytes: 45 * MB },
  ];

  it('lists only those over the limit, biggest first', () => {
    expect(heaviestVideos(videos).map(v => v.name)).toEqual(['b', 'e', 'c']);
  });

  it('stops at the limit it is given', () => {
    expect(heaviestVideos(videos, 2).map(v => v.name)).toEqual(['b', 'e']);
  });

  it('is empty when nothing is heavy, and does not change the list it was given', () => {
    expect(heaviestVideos([{ name: 'x', bytes: MB }])).toEqual([]);
    expect(videos.map(v => v.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
