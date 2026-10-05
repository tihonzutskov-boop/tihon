// What is actually behind a video that will not play.
//
// A browser reports "could not be opened" for a missing file, a refused request,
// an unplayable format and a server that sent something that is not a video, and
// they look the same from the player. This asks the server for the first bytes of
// the file and says what came back, so the cause is a line of text and not a guess.

export type ContainerKind = 'mp4/mov' | 'webm/mkv' | 'ogg' | 'text' | 'unknown';

/** What kind of file the first bytes belong to. */
export const sniffContainer = (bytes: Uint8Array): ContainerKind => {
  const at = (i: number, text: string) => text.split('').every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (bytes.length >= 8 && at(4, 'ftyp')) return 'mp4/mov';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm/mkv';
  if (bytes.length >= 4 && at(0, 'OggS')) return 'ogg';
  // JSON or HTML where a video should be: an error page, usually.
  if (bytes.length >= 1 && (bytes[0] === 0x7b || bytes[0] === 0x3c)) return 'text';
  return 'unknown';
};

/** Where a video is loaded from, without the query string. */
export const describeSource = (url: string, pageOrigin: string): string => {
  try {
    const u = new URL(url, pageOrigin);
    const where = u.origin === pageOrigin ? 'this app' : u.host;
    return `${where}${u.pathname}`;
  } catch {
    return url;
  }
};

export interface VideoDiagnosis {
  source: string;
  /** Absent when the request could not be made or was blocked. */
  status?: number;
  contentType?: string | null;
  contentRange?: string | null;
  container?: ContainerKind;
  blocked?: boolean;
}

export const diagnoseVideo = async (
  url: string,
  pageOrigin: string,
  fetchFn: typeof fetch = fetch,
): Promise<VideoDiagnosis> => {
  const source = describeSource(url, pageOrigin);
  try {
    const res = await fetchFn(url, { headers: { Range: 'bytes=0-15' }, credentials: 'same-origin' });
    const head = new Uint8Array(await res.arrayBuffer()).slice(0, 16);
    return {
      source,
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentRange: res.headers.get('content-range'),
      container: sniffContainer(head),
    };
  } catch {
    // A video from another site is only checkable if that site allows it.
    return { source, blocked: true };
  }
};

/** The diagnosis as short lines of plain text, ending in what it most likely means. */
export const summariseDiagnosis = (d: VideoDiagnosis): string[] => {
  const lines = [`From: ${d.source}`];
  if (d.blocked || d.status === undefined) {
    lines.push('Could not check the file: the browser blocked the request.');
    return lines;
  }
  lines.push(`Server answered ${d.status}${d.contentType ? `, ${d.contentType}` : ''}`);
  if (d.contentRange) lines.push(`Range: ${d.contentRange}`);
  if (d.status === 401 || d.status === 403) lines.push('So: the server refused the request. Sign in again, or the storage link is not public.');
  else if (d.status === 404) lines.push('So: the file is not there.');
  else if (d.status >= 500) lines.push('So: the server had an error sending it.');
  else if (d.container === 'text') lines.push('So: the server sent text, not a video.');
  else if (d.status === 200 && !d.contentRange) lines.push('So: the server sent the whole file and ignored the byte range, which Safari will not accept.');
  else if (d.container === 'mp4/mov' || d.container === 'webm/mkv' || d.container === 'ogg') {
    lines.push(`File type: ${d.container}`);
    lines.push('So: the file arrived, but this browser cannot play what is inside it.');
  } else lines.push('So: the file arrived but is not a video this browser recognises.');
  return lines;
};
