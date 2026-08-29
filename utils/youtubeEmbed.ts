/**
 * Extracts the raw 11-character YouTube video ID from any of the URL shapes
 * getYouTubeEmbedUrl understands. Used to build a thumbnail URL
 * (img.youtube.com/vi/<id>/hqdefault.jpg) without any API call — that CDN
 * path is public and keyless for any valid video ID.
 */
export function getYouTubeVideoId(url: string | undefined | null): string {
  if (!url) return '';
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  try {
    if (cleanUrl.includes('youtube.com/shorts/')) {
      const match = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
    }
    if (cleanUrl.includes('youtube.com/watch')) {
      const urlObj = new URL(cleanUrl);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;
    }
    if (cleanUrl.includes('youtu.be/')) {
      const match = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
    }
    if (cleanUrl.includes('youtube.com/embed/')) {
      const match = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
    }
    if (cleanUrl.includes('youtube.com/live/')) {
      const match = cleanUrl.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Utility to extract clean YouTube embed URLs at render time
 * without modifying or mutating the original user-entered stored URL string.
 */
export function getYouTubeEmbedUrl(url: string | undefined | null): string {
  if (!url) return '';
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  try {
    // 1. YouTube Shorts: https://www.youtube.com/shorts/<id>?...
    if (cleanUrl.includes('youtube.com/shorts/')) {
      const match = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    // 2. Standard Watch URL: https://www.youtube.com/watch?v=<id>&...
    if (cleanUrl.includes('youtube.com/watch')) {
      const urlObj = new URL(cleanUrl);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // 3. Short URL: https://youtu.be/<id>?...
    if (cleanUrl.includes('youtu.be/')) {
      const match = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    // 4. Live / Direct Embeds / Other YouTube paths: https://www.youtube.com/embed/<id> or /live/<id>
    if (cleanUrl.includes('youtube.com/embed/')) {
      return cleanUrl;
    }
    if (cleanUrl.includes('youtube.com/live/')) {
      const match = cleanUrl.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    // Fallback: return as-is
    return cleanUrl;
  } catch {
    return cleanUrl;
  }
}
