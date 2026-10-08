import { describe, it, expect } from 'vitest';
import { fitShortSide, planShrink, checkShrunk, durationTolerance, WORTH_REPLACING } from './videoShrink';
import { isHeavyVideo } from './videoSize';

const MB = 1024 * 1024;

describe('scaling to 720p', () => {
  it('scales a landscape clip to 1280×720 and an upright one to 720×1280', () => {
    expect(fitShortSide(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(fitShortSide(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(fitShortSide(3840, 2160)).toEqual({ width: 1280, height: 720 });
  });

  it('never enlarges a video that is already small', () => {
    expect(fitShortSide(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitShortSide(854, 480)).toEqual({ width: 854, height: 480 });
  });

  it('keeps the shape and makes both sides even, which video needs', () => {
    for (const [w, h] of [[1920, 1080], [1440, 1080], [2704, 1520], [1000, 999], [3000, 2001]]) {
      const r = fitShortSide(w, h);
      expect(r.width % 2).toBe(0);
      expect(r.height % 2).toBe(0);
      expect(Math.abs(r.width / r.height - w / h)).toBeLessThan(0.01);
      expect(Math.min(r.width, r.height)).toBeLessThanOrEqual(720);
    }
  });

  it('leaves a size it cannot read alone', () => {
    expect(fitShortSide(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('planning a shrink', () => {
  const clip = (over = {}) => ({ width: 1920, height: 1080, durationSeconds: 45, bytes: 84 * MB, ...over });

  it('shrinks a heavy clip to well under the limit that makes it heavy', () => {
    const plan = planShrink(clip());
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan).toMatchObject({ width: 1280, height: 720 });
      expect(isHeavyVideo(plan.expectedBytes)).toBe(false);
      expect(plan.expectedBytes).toBeLessThan(84 * MB * WORTH_REPLACING);
    }
  });

  it('gives a longer clip a lower rate so it still comes in small, but not so low it blurs', () => {
    const short = planShrink(clip({ durationSeconds: 30, bytes: 60 * MB }));
    const long = planShrink(clip({ durationSeconds: 120, bytes: 90 * MB }));
    expect(short.ok && long.ok).toBe(true);
    if (short.ok && long.ok) {
      expect(long.videoBitrate).toBeLessThan(short.videoBitrate);
      expect(long.videoBitrate).toBeGreaterThanOrEqual(800_000);
      expect(short.videoBitrate).toBeLessThanOrEqual(2_500_000);
    }
  });

  it('plans an upright phone video the same way', () => {
    const plan = planShrink(clip({ width: 1080, height: 1920 }));
    expect(plan).toMatchObject({ ok: true, width: 720, height: 1280 });
  });

  it('does not recompress hard a video already near its target', () => {
    const plan = planShrink(clip({ width: 1280, height: 720, durationSeconds: 60, bytes: 16 * MB }));
    if (plan.ok) expect(plan.videoBitrate).toBeLessThanOrEqual(((16 * MB * 8) / 60) * 0.6);
    else if (plan.ok === false) expect(plan.reason).toBeTruthy();
  });

  it('declines a video that is long for its size rather than make it blurry', () => {
    const plan = planShrink(clip({ width: 1280, height: 720, durationSeconds: 600, bytes: 16 * MB }));
    expect(plan.ok).toBe(false);
    if (plan.ok === false) expect(plan.reason).toMatch(/long for its size|Trimming/);
  });

  it('declines a video already compressed about as far as it should go', () => {
    const plan = planShrink(clip({ width: 1280, height: 720, durationSeconds: 60, bytes: 8 * MB }));
    expect(plan.ok).toBe(false);
  });

  it('refuses a video it could not read', () => {
    for (const bad of [{ width: 0 }, { durationSeconds: 0 }, { bytes: 0 }, { durationSeconds: NaN }, { height: -1 }]) {
      const plan = planShrink(clip(bad));
      expect(plan).toEqual({ ok: false, reason: 'Could not read this video.' });
    }
  });

  it('never plans a copy that is not a real saving, at any size and length', () => {
    let planned = 0;
    for (let mb = 1; mb <= 200; mb += 3) {
      for (let secs = 5; secs <= 900; secs += 17) {
        const plan = planShrink(clip({ bytes: mb * MB, durationSeconds: secs }));
        if (plan.ok) {
          planned++;
          expect(plan.expectedBytes, `${mb} MB, ${secs} s`).toBeLessThanOrEqual(mb * MB * 0.7);
        }
      }
    }
    expect(planned).toBeGreaterThan(100);
  });
});

describe('checking the shrunk copy before it replaces the original', () => {
  const copy = (over = {}) => ({ originalBytes: 84 * MB, shrunkBytes: 9 * MB, originalSeconds: 45, shrunkSeconds: 45, ...over });

  it('accepts a much smaller copy of the same length', () => {
    expect(checkShrunk(copy())).toEqual({ ok: true });
  });

  it('accepts a length that differs by a rounding error', () => {
    expect(checkShrunk(copy({ shrunkSeconds: 45.2 }))).toEqual({ ok: true });
    expect(checkShrunk(copy({ shrunkSeconds: 44.6 }))).toEqual({ ok: true });
  });

  it('refuses a copy of a different length, which would put every step in the wrong place', () => {
    for (const shrunkSeconds of [43, 47, 20, 90]) {
      const r = checkShrunk(copy({ shrunkSeconds }));
      expect(r.ok, String(shrunkSeconds)).toBe(false);
    }
  });

  it('allows a longer video proportionally more drift, but not a lot', () => {
    expect(durationTolerance(10)).toBe(0.5);
    expect(durationTolerance(300)).toBe(6);
    expect(checkShrunk(copy({ originalSeconds: 300, shrunkSeconds: 303 })).ok).toBe(true);
    expect(checkShrunk(copy({ originalSeconds: 300, shrunkSeconds: 310 })).ok).toBe(false);
  });

  it('refuses a copy that is not much smaller', () => {
    expect(checkShrunk(copy({ shrunkBytes: 80 * MB })).ok).toBe(false);
    expect(checkShrunk(copy({ shrunkBytes: 84 * MB * WORTH_REPLACING + 1 })).ok).toBe(false);
    expect(checkShrunk(copy({ shrunkBytes: 84 * MB * WORTH_REPLACING })).ok).toBe(true);
  });

  it('refuses a copy that lost the sound, and accepts one that kept it or never had any', () => {
    const lost = checkShrunk(copy({ hadAudio: true, hasAudio: false }));
    expect(lost.ok).toBe(false);
    if (lost.ok === false) expect(lost.reason).toMatch(/lost the sound/);
    expect(checkShrunk(copy({ hadAudio: true, hasAudio: true })).ok).toBe(true);
    expect(checkShrunk(copy({ hadAudio: false, hasAudio: false })).ok).toBe(true);
    expect(checkShrunk(copy({ hadAudio: false, hasAudio: true })).ok).toBe(true);
  });

  it('refuses a copy it could not read, or an empty one', () => {
    for (const bad of [{ shrunkBytes: 0 }, { shrunkSeconds: 0 }, { shrunkSeconds: NaN }, { originalSeconds: 0 }]) {
      const r = checkShrunk(copy(bad));
      expect(r.ok).toBe(false);
      if (r.ok === false) expect(r.reason).toMatch(/original was kept/);
    }
  });
});
