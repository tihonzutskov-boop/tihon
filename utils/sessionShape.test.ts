import { describe, it, expect } from 'vitest';
import { tierFor, shapeFor, bookendsFor, trainingMinutesAvailable } from './sessionShape';

describe('tierFor', () => {
  it('maps the questionnaire\'s offered lengths to distinct tiers', () => {
    expect(tierFor(30)).toBe('short');
    expect(tierFor(45)).toBe('medium');
    expect(tierFor(60)).toBe('medium');
    expect(tierFor(75)).toBe('long');
    expect(tierFor(90)).toBe('long');
  });
});

describe('shapeFor — longer sessions buy quality, not volume', () => {
  const short = shapeFor(30);
  const medium = shapeFor(60);
  const long = shapeFor(90);

  // The whole point of the change: 60 and 90 must not produce the same session.
  it('gives 60 and 90 minutes materially different shapes', () => {
    expect(long).not.toEqual({ ...medium, tier: 'long' });
    expect(long.warmupMinutes).toBeGreaterThan(medium.warmupMinutes);
    expect(long.restMultiplier).toBeGreaterThan(medium.restMultiplier);
    expect(long.warmupSetsPerCompound).toBeGreaterThan(medium.warmupSetsPerCompound);
  });

  it('lengthens warm-up and cooldown as the session grows', () => {
    expect(short.warmupMinutes).toBeLessThan(medium.warmupMinutes);
    expect(medium.warmupMinutes).toBeLessThan(long.warmupMinutes);
    expect(short.cooldownMinutes).toBeLessThan(long.cooldownMinutes);
  });

  it('rests longer when there is time for it', () => {
    expect(short.restMultiplier).toBe(1);
    expect(long.restMultiplier).toBeGreaterThan(1.2);
  });

  // The load-bearing safety property: tripling the time must not triple the work.
  it('raises working sets far less than proportionally to time', () => {
    const timeRatio = 90 / 30;
    const setRatio = long.maxWorkingSets / short.maxWorkingSets;
    expect(setRatio).toBeLessThan(timeRatio);
    // And never past the spec's per-session ceiling.
    expect(long.maxWorkingSets).toBeLessThanOrEqual(20);
  });

  it('keeps a short session focused rather than padded', () => {
    expect(short.includeAccessories).toBe(false);
    expect(medium.includeAccessories).toBe(true);
  });
});

describe('bookendsFor — always present, never library-dependent', () => {
  it('produces a warm-up and cooldown for every tier', () => {
    for (const minutes of [30, 45, 60, 75, 90]) {
      const { warmup, cooldown } = bookendsFor(shapeFor(minutes));
      expect(warmup.steps.length).toBeGreaterThan(0);
      expect(cooldown.steps.length).toBeGreaterThan(0);
      expect(warmup.minutes).toBeGreaterThan(0);
      expect(cooldown.minutes).toBeGreaterThan(0);
    }
  });

  it('gives a longer session a more thorough warm-up, not just a longer one', () => {
    const shortWarmup = bookendsFor(shapeFor(30)).warmup;
    const longWarmup = bookendsFor(shapeFor(90)).warmup;
    expect(longWarmup.steps.length).toBeGreaterThan(shortWarmup.steps.length);
  });
});

describe('trainingMinutesAvailable', () => {
  // Reserved off the top, so a session can never be built with no room to warm up.
  it('reserves the bookends before any training time is allocated', () => {
    const shape = shapeFor(60);
    expect(trainingMinutesAvailable(60, shape)).toBe(60 - shape.warmupMinutes - shape.cooldownMinutes);
  });

  it('never returns negative time', () => {
    expect(trainingMinutesAvailable(5, shapeFor(90))).toBe(0);
  });
});
