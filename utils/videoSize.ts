// How big a tutorial video is too big for a phone.
//
// A client watches these on a phone, on gym Wi-Fi or mobile data, and the whole
// file has to arrive before the step-by-step player can seek around in it. The
// server accepts up to 200 MB, so nothing stopped a 4K clip straight off a phone
// from becoming the exercise's tutorial. This is where "too big" is decided, for
// the upload screen and the storage panel alike.

const MB = 1024 * 1024;

/** Above this a tutorial is slow to arrive on a phone (about 12 seconds on a 10 Mbps connection). */
export const HEAVY_VIDEO_BYTES = 15 * MB;

export const isHeavyVideo = (bytes: number | null | undefined): boolean =>
  typeof bytes === 'number' && bytes > HEAVY_VIDEO_BYTES;

export const formatVideoSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < MB) return '<1 MB';
  const mb = bytes / MB;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
};

/** What to tell someone about to upload this video, or null when its size is fine. */
export const heavyVideoWarning = (bytes: number | null | undefined): string | null =>
  isHeavyVideo(bytes)
    ? `This video is ${formatVideoSize(bytes as number)}, so it will load slowly on phones. `
      + 'Exporting it at 720p is usually under 10 MB for a 30-second clip, and plenty sharp for a tutorial.'
    : null;

/** The heaviest videos first, only those over the limit, so the biggest wins are at the top. */
export const heaviestVideos = <T extends { bytes: number }>(videos: T[], limit = 10): T[] =>
  videos.filter(v => isHeavyVideo(v.bytes)).sort((a, b) => b.bytes - a.bytes).slice(0, limit);
