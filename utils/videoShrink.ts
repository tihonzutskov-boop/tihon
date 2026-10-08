// Deciding how to shrink a tutorial video that is too heavy for a phone, and
// whether the shrunk copy is fit to replace the original.
//
// Replacing a video deletes the original, so the checks here are what stand
// between a bad conversion and the only copy being lost: the copy has to be a
// real saving, and the same length to within a moment (a step in the tutorial is
// pinned to a timestamp, so a shorter or longer copy would point every step at
// the wrong place).

const MB = 1024 * 1024;

/** The shorter side, in pixels. 720 is "720p": 1280×720 for a landscape clip, 720×1280 for one held upright. */
export const SHRINK_SHORT_SIDE = 720;

// About what a phone loads in a few seconds on gym Wi-Fi, and what a tutorial of
// a person doing a movement looks good at: the scene barely changes.
const TARGET_BYTES = 10 * MB;
const AUDIO_BITS_PER_SECOND = 96_000;
const MIN_VIDEO_BITRATE = 800_000;
const MAX_VIDEO_BITRATE = 2_500_000;
/** Of the original's rate, at most: a video already close to its target gains nothing from a second round of compression. */
const MAX_SHARE_OF_ORIGINAL_BITRATE = 0.6;

/** The shrunk copy must be at most this much of the original to be worth replacing it with. */
export const WORTH_REPLACING = 0.8;

const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);

/** The size to scale to: the short side at 720, same shape, never enlarged, both sides even (video needs it). */
export const fitShortSide = (width: number, height: number, shortSide = SHRINK_SHORT_SIDE): { width: number; height: number } => {
  const short = Math.min(width, height);
  if (!(short > 0)) return { width, height };
  if (short <= shortSide) return { width: even(width), height: even(height) };
  const scale = shortSide / short;
  return { width: even(width * scale), height: even(height * scale) };
};

export interface ShrinkInput {
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
}

export type ShrinkPlan =
  | { ok: true; width: number; height: number; videoBitrate: number; expectedBytes: number }
  | { ok: false; reason: string };

export const planShrink = (v: ShrinkInput): ShrinkPlan => {
  const readable = [v.width, v.height, v.durationSeconds, v.bytes].every(n => Number.isFinite(n) && n > 0);
  if (!readable) return { ok: false, reason: 'Could not read this video.' };

  const size = fitShortSide(v.width, v.height);
  const originalBitrate = (v.bytes * 8) / v.durationSeconds;
  const fits = Math.floor((TARGET_BYTES * 8) / v.durationSeconds) - AUDIO_BITS_PER_SECOND;
  const videoBitrate = Math.floor(Math.min(
    Math.max(fits, MIN_VIDEO_BITRATE),
    MAX_VIDEO_BITRATE,
    originalBitrate * MAX_SHARE_OF_ORIGINAL_BITRATE,
  ));

  // Below this it would look smeared. A long video that is already this small for
  // its length is better shortened than squeezed further.
  if (videoBitrate < MIN_VIDEO_BITRATE) {
    return { ok: false, reason: 'This video is long for its size, so shrinking it more would make it blurry. Trimming it shorter would help instead.' };
  }
  // Always a real saving: the video gets at most 60% of the original's rate, and
  // being at least 800 kbps means the original ran at 1.3 Mbps or more, against
  // which the sound adds well under a tenth. So this never comes to more than
  // about two thirds of the original.
  const expectedBytes = Math.round(((videoBitrate + AUDIO_BITS_PER_SECOND) * v.durationSeconds) / 8);
  return { ok: true, ...size, videoBitrate, expectedBytes };
};

export interface ShrunkCheck {
  originalBytes: number;
  shrunkBytes: number;
  originalSeconds: number;
  shrunkSeconds: number;
  /** Whether the original had sound, and whether the copy kept it. A copy that lost it is not a copy. */
  hadAudio?: boolean;
  hasAudio?: boolean;
}

/** The longest the copy may differ in length from the original: a moment, or a fiftieth of it for a long one. */
export const durationTolerance = (originalSeconds: number): number => Math.max(0.5, originalSeconds * 0.02);

/** Whether the shrunk copy may replace the original, and if not, what to tell the admin. */
export const checkShrunk = (c: ShrunkCheck): { ok: true } | { ok: false; reason: string } => {
  const values = [c.originalBytes, c.shrunkBytes, c.originalSeconds, c.shrunkSeconds];
  if (!values.every(n => Number.isFinite(n) && n > 0)) {
    return { ok: false, reason: 'The shrunk copy could not be read, so the original was kept.' };
  }
  if (Math.abs(c.shrunkSeconds - c.originalSeconds) > durationTolerance(c.originalSeconds)) {
    return { ok: false, reason: 'The shrunk copy came out a different length, so the original was kept.' };
  }
  if (c.hadAudio && !c.hasAudio) {
    return { ok: false, reason: 'The shrunk copy lost the sound, so the original was kept.' };
  }
  if (c.shrunkBytes > c.originalBytes * WORTH_REPLACING) {
    return { ok: false, reason: 'The shrunk copy is not much smaller, so the original was kept.' };
  }
  return { ok: true };
};
