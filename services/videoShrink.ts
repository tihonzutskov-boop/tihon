// Shrinking a tutorial video in the admin's own browser.
//
// Done here rather than on the server: the server is a small instance that also
// serves every client, and re-encoding a minute of 4K there would starve it. The
// browser re-encodes with the machine's own video hardware, and nothing leaves it
// until the admin has seen the result and chosen to use it. The deciding is in
// utils/videoShrink.ts; this only does the work.

import { planShrink, checkShrunk } from '../utils/videoShrink';
// The library's own prebuilt file, copied into the build as it is and loaded
// only when someone shrinks a video. Bundling it from its source made the build
// need more memory than Render allows it, and the deploy failed. Imported by
// path because the package does not export this file.
import mediabunnyUrl from '../node_modules/mediabunny/dist/bundles/mediabunny.min.mjs?url';

type Mediabunny = typeof import('mediabunny');
const loadMediabunny = (): Promise<Mediabunny> => import(/* @vite-ignore */ mediabunnyUrl);

export type ShrinkOutcome =
  | { ok: true; file: File; width: number; height: number; seconds: number; originalBytes: number }
  | { ok: false; reason: string };

/** Whether this browser can encode video at all; Safari 16.4+, Chrome and Edge can. */
export const canShrinkVideo = (): boolean =>
  typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

const toMp4Name = (name: string): string => `${name.replace(/\.[^./\\]+$/, '') || 'tutorial'}.mp4`;

/**
 * A smaller copy of `video` as an MP4 at 720p, or the reason there is not one.
 * Never throws: anything that goes wrong comes back as a reason, since the
 * original is untouched either way. `onProgress` gets 0 to 1.
 */
export const shrinkVideo = async (
  video: Blob,
  name: string,
  onProgress?: (fraction: number) => void,
): Promise<ShrinkOutcome> => {
  if (!canShrinkVideo()) {
    return { ok: false, reason: 'This browser cannot shrink videos. Safari, Chrome or Edge can.' };
  }
  try {
    const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await loadMediabunny();

    const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { ok: false, reason: 'There is no video in this file to shrink.' };
    const seconds = await input.computeDuration();
    const hadAudio = !!(await input.getPrimaryAudioTrack());

    const plan = planShrink({
      width: track.displayWidth, height: track.displayHeight, durationSeconds: seconds, bytes: video.size,
    });
    if (plan.ok === false) return { ok: false, reason: plan.reason };

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { codec: 'avc', width: plan.width, height: plan.height, fit: 'contain', bitrate: plan.videoBitrate },
      audio: { codec: 'aac' },
    });
    if (!conversion.isValid) {
      return { ok: false, reason: 'This browser could not convert this kind of video.' };
    }
    conversion.onProgress = p => onProgress?.(Math.min(1, Math.max(0, p)));
    await conversion.execute();

    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) return { ok: false, reason: 'The conversion produced no file, so the original was kept.' };
    const file = new File([buffer], toMp4Name(name), { type: 'video/mp4' });

    // Read back what was actually written, rather than trusting that it was.
    const shrunkInput = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const shrunkTrack = await shrunkInput.getPrimaryVideoTrack();
    const shrunkSeconds = shrunkTrack ? await shrunkInput.computeDuration() : 0;
    const hasAudio = !!(await shrunkInput.getPrimaryAudioTrack());
    const verdict = checkShrunk({
      originalBytes: video.size, shrunkBytes: file.size, originalSeconds: seconds, shrunkSeconds, hadAudio, hasAudio,
    });
    if (verdict.ok === false) return verdict;

    return { ok: true, file, width: plan.width, height: plan.height, seconds: shrunkSeconds, originalBytes: video.size };
  } catch (err: any) {
    return { ok: false, reason: `Could not shrink this video (${err?.message || 'unknown error'}). The original was kept.` };
  }
};
