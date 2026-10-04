import { describe, it, expect } from 'vitest';
import {
  tierFor, shapeFor, bookendsFor, trainingMinutesAvailable, bookendBandFor, BOOKEND_MINUTES, regionsOfPatterns,
} from './sessionShape';

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
    expect(long.warmupSetsPerCompound).toBeGreaterThan(medium.warmupSetsPerCompound);
  });

  it('lengthens warm-up and cooldown as the session grows', () => {
    expect(short.warmupMinutes).toBeLessThan(medium.warmupMinutes);
    expect(medium.warmupMinutes).toBeLessThan(long.warmupMinutes);
    expect(short.cooldownMinutes).toBeLessThan(long.cooldownMinutes);
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
    const lines = (m: number) => { const w = bookendsFor(shapeFor(m), ['legs', 'push', 'pull']).warmup; return w.steps.length + (w.extra?.length ?? 0); };
    expect(lines(90)).toBeGreaterThan(lines(60));
    expect(lines(60)).toBeGreaterThan(lines(45));
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

describe('warm-up and cooldown by session length', () => {
  it('sizes them by length more finely than the tier: 45 and 60 minutes differ', () => {
    expect(bookendBandFor(30)).toBe('short');
    expect(bookendBandFor(45)).toBe('base');
    expect(bookendBandFor(60)).toBe('mid');
    expect(bookendBandFor(75)).toBe('long');
    expect(bookendBandFor(90)).toBe('long');
  });

  it('gives each offered length its warm-up and cooldown minutes', () => {
    const minutes = (m: number) => { const sh = shapeFor(m); return [sh.warmupMinutes, sh.cooldownMinutes]; };
    expect(minutes(45)).toEqual([10, 5]);
    expect(minutes(60)).toEqual([14, 10]);
    expect(minutes(90)).toEqual([20, 15]);
    // Answers saved when 30 minutes was offered are unchanged.
    expect(minutes(30)).toEqual([6, 4]);
  });

  it('always builds the warm-up around 10 minutes of cardio', () => {
    for (const band of ['base', 'mid', 'long'] as const) expect(BOOKEND_MINUTES[band].cardio).toBe(10);
    expect(BOOKEND_MINUTES.base.warmup).toBe(10);
  });

  it('keeps the warm-up at least as long as its cardio, and the stretching to what is left', () => {
    for (const band of ['base', 'mid', 'long'] as const) {
      const m = BOOKEND_MINUTES[band];
      expect(m.warmup).toBeGreaterThanOrEqual(m.cardio);
      expect(m.cooldown).toBeGreaterThan(m.walk);
    }
  });

  it('never lets the two together take more than 45% of the session', () => {
    for (const minutes of [10, 20, 30, 45, 60, 75, 90]) {
      const sh = shapeFor(minutes);
      expect(sh.warmupMinutes + sh.cooldownMinutes, String(minutes)).toBeLessThanOrEqual(Math.max(2, Math.ceil(minutes * 0.45) + 1));
    }
  });
});

describe('what a day trains', () => {
  it('reads the regions from the movements, in a fixed order', () => {
    expect(regionsOfPatterns(['horizontal_pull', 'squat', 'horizontal_push'])).toEqual(['legs', 'push', 'pull']);
    expect(regionsOfPatterns(['core'])).toEqual(['core']);
    expect(regionsOfPatterns(['calf_raise', 'elbow_flexion', 'shoulder_abduction'])).toEqual(['legs', 'push', 'pull']);
  });

  it('reads nothing from movements that are not strength work', () => {
    expect(regionsOfPatterns(['mobility', 'conditioning', 'hip_mobility'])).toEqual([]);
    expect(regionsOfPatterns([])).toEqual([]);
  });
});

describe('the written warm-up and cooldown', () => {
  const all = ['legs', 'push', 'pull'] as const;
  const text = (lines?: string[]) => (lines || []).join('\n');

  it('is cardio only, then a light set, at 45 minutes', () => {
    const { warmup } = bookendsFor(shapeFor(45), [...all]);
    expect(warmup.steps).toHaveLength(1);
    expect(warmup.steps[0]).toMatch(/^10 minutes easy cardio/);
    expect(warmup.extra).toEqual(['One light set of your first exercise, well short of the working weight']);
  });

  it('adds four minutes of dynamic stretching at 60 and ten at 90', () => {
    const mid = bookendsFor(shapeFor(60), [...all]).warmup.extra!;
    const long = bookendsFor(shapeFor(90), [...all]).warmup.extra!;
    expect(mid.find(l => l.endsWith(':'))).toMatch(/about 4 minutes/);
    expect(long.find(l => l.includes('about 10 minutes'))).toBeTruthy();
    const moves = (extra: string[]) => extra.filter(l => !l.endsWith(':') && /\d/.test(l) && !/light set|ramp-up/i.test(l));
    expect(moves(mid)).toHaveLength(4);
    expect(moves(long)).toHaveLength(8);
    expect(text(long)).toMatch(/joint circles/i);
    expect(long[long.length - 1]).toMatch(/ramp-up sets/);
  });

  it('is stretching for what the day trains, and nothing for what it does not', () => {
    const legsOnly = text(bookendsFor(shapeFor(60), ['legs']).warmup.extra);
    expect(legsOnly).toMatch(/squats|leg swings|lunges/i);
    expect(legsOnly).not.toMatch(/arm circles|push-ups|cat-cow/i);
    const pushOnly = text(bookendsFor(shapeFor(60), ['push']).warmup.extra);
    expect(pushOnly).toMatch(/arm circles|push-ups/i);
    expect(pushOnly).not.toMatch(/squats|leg swings/i);
  });

  it('takes a move from each trained region before a second from any one', () => {
    const extra = bookendsFor(shapeFor(60), ['legs', 'push', 'pull']).warmup.extra!;
    const moves = extra.filter(l => !l.endsWith(':') && !/light set/i.test(l));
    expect(moves).toHaveLength(4);
    expect(text(moves)).toMatch(/leg swings/i);
    expect(text(moves)).toMatch(/arm circles/i);
    expect(text(moves)).toMatch(/cat-cow/i);
  });

  it('warms the whole body when nothing identifiable is trained', () => {
    const extra = text(bookendsFor(shapeFor(60), []).warmup.extra);
    expect(extra).toMatch(/leg swings/i);
    expect(extra).toMatch(/arm circles/i);
  });

  it('is an easy walk, then stretches with a hold time, then breathing', () => {
    const base = bookendsFor(shapeFor(45), [...all]).cooldown;
    const mid = bookendsFor(shapeFor(60), [...all]).cooldown;
    const long = bookendsFor(shapeFor(90), [...all]).cooldown;
    expect(base.steps[0]).toMatch(/2 minutes easy walking/);
    expect(mid.steps[0]).toMatch(/3 minutes/);
    const stretches = (c: typeof base) => c.extra!.filter(l => !l.endsWith(':') && !/breathing/i.test(l));
    expect(stretches(base)).toHaveLength(3);
    expect(stretches(mid)).toHaveLength(6);
    expect(stretches(long)).toHaveLength(9);
    expect(base.extra![0]).toMatch(/20–30 seconds/);
    expect(mid.extra![0]).toMatch(/30 seconds/);
    expect(long.extra![0]).toMatch(/45 seconds/);
    expect(text(base.extra)).not.toMatch(/breathing/i);
    expect(mid.extra![mid.extra!.length - 1]).toMatch(/minute of slow breathing/);
    expect(long.extra![long.extra!.length - 1]).toMatch(/two minutes of slow breathing/);
  });

  it('stretches what the day trained', () => {
    const legs = text(bookendsFor(shapeFor(60), ['legs']).cooldown.extra);
    expect(legs).toMatch(/quad|hamstring|hip flexor|glute|calf/i);
    expect(legs).not.toMatch(/doorway chest|child's pose/i);
  });

  it('gives fewer when a trained region has fewer stretches than asked', () => {
    const core = bookendsFor(shapeFor(90), ['core']).cooldown.extra!.filter(l => !l.endsWith(':') && !/breathing/i.test(l));
    expect(core.length).toBe(2);
  });

  it('writes none of the stretching a video covers', () => {
    const w = bookendsFor(shapeFor(90), [...all], { warmup: true, cooldown: true });
    expect(text(w.warmup.extra)).not.toMatch(/Dynamic stretching|joint circles|leg swings/i);
    expect(w.warmup.extra!.length).toBe(1);   // only the ramp-up line
    expect(text(w.cooldown.extra)).not.toMatch(/Stretch what you trained/);
    expect(text(w.cooldown.extra)).toMatch(/breathing/);
  });

  it('keeps a short session as it was: no extra written', () => {
    const { warmup, cooldown } = bookendsFor(shapeFor(30), [...all]);
    expect(warmup.extra).toBeUndefined();
    expect(cooldown.extra).toBeUndefined();
    expect(warmup.steps.length).toBe(3);
  });
});
