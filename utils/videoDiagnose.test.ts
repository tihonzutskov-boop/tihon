import { describe, it, expect } from 'vitest';
import { sniffContainer, describeSource, diagnoseVideo, summariseDiagnosis } from './videoDiagnose';

const bytes = (...codes: (number | string)[]) =>
  new Uint8Array(codes.flatMap(c => typeof c === 'string' ? c.split('').map(ch => ch.charCodeAt(0)) : [c]));

describe('what kind of file it is', () => {
  it('recognises an mp4 or mov by its ftyp box', () => {
    expect(sniffContainer(bytes(0, 0, 0, 0x20, 'ftypisom'))).toBe('mp4/mov');
    expect(sniffContainer(bytes(0, 0, 0, 0x14, 'ftypqt  '))).toBe('mp4/mov');
  });

  it('recognises webm/mkv and ogg', () => {
    expect(sniffContainer(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f))).toBe('webm/mkv');
    expect(sniffContainer(bytes('OggS', 0))).toBe('ogg');
  });

  it('recognises an error page: JSON or HTML where a video should be', () => {
    expect(sniffContainer(bytes('{"error":"Not found"}'))).toBe('text');
    expect(sniffContainer(bytes('<html><body>'))).toBe('text');
  });

  it('does not guess at anything else, or at nothing', () => {
    expect(sniffContainer(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBe('unknown');
    expect(sniffContainer(new Uint8Array(0))).toBe('unknown');
  });
});

describe('where a video comes from', () => {
  const origin = 'https://gyde-1tly.onrender.com';
  it('says this app for the app\'s own path, and the host for storage elsewhere', () => {
    expect(describeSource('/api/exercises/ex-1/tutorial-video?v=abc', origin)).toBe('this app/api/exercises/ex-1/tutorial-video');
    expect(describeSource('https://pub-1234.r2.dev/tutorial-videos/ex-1/v1.mp4', origin)).toBe('pub-1234.r2.dev/tutorial-videos/ex-1/v1.mp4');
  });

  it('drops the query string', () => {
    expect(describeSource('/api/x?v=secret', origin)).not.toContain('secret');
  });
});

describe('asking the server', () => {
  const origin = 'https://app.test';
  const fakeFetch = (status: number, headers: Record<string, string>, body: Uint8Array) =>
    (async () => ({
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    })) as unknown as typeof fetch;

  it('asks for the first bytes only, with the cookie, and reports what came back', async () => {
    let seen: any;
    const f = (async (u: any, init: any) => { seen = { u, init }; return { status: 206, headers: { get: (k: string) => ({ 'content-type': 'video/mp4', 'content-range': 'bytes 0-15/900' } as any)[k] ?? null }, arrayBuffer: async () => bytes(0, 0, 0, 0x20, 'ftypisom').buffer }; }) as unknown as typeof fetch;
    const d = await diagnoseVideo('/api/v', origin, f);
    expect(seen.init.headers.Range).toBe('bytes=0-15');
    expect(seen.init.credentials).toBe('same-origin');
    expect(d).toMatchObject({ status: 206, contentType: 'video/mp4', contentRange: 'bytes 0-15/900', container: 'mp4/mov' });
  });

  it('says it was blocked when the request cannot be made', async () => {
    const f = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await diagnoseVideo('https://pub.r2.dev/x.mp4', origin, f)).toMatchObject({ blocked: true, source: 'pub.r2.dev/x.mp4' });
  });

  it('reads a 404 and a refused request', async () => {
    expect((await diagnoseVideo('/api/v', origin, fakeFetch(404, {}, bytes('{}')))).status).toBe(404);
    expect((await diagnoseVideo('/api/v', origin, fakeFetch(401, {}, bytes('{}')))).status).toBe(401);
  });
});

describe('what it means', () => {
  const lines = (d: any) => summariseDiagnosis({ source: 'this app/api/v', ...d }).join(' | ');

  it('names a missing file', () => expect(lines({ status: 404, container: 'text' })).toMatch(/file is not there/));
  it('names a refused request', () => {
    expect(lines({ status: 401, container: 'text' })).toMatch(/refused/);
    expect(lines({ status: 403, container: 'text' })).toMatch(/refused/);
  });
  it('names a server error', () => expect(lines({ status: 500, container: 'text' })).toMatch(/server had an error/));
  it('names text sent in place of a video', () => expect(lines({ status: 200, contentRange: 'x', container: 'text' })).toMatch(/text, not a video/));
  it('names a server that ignored the byte range', () => {
    expect(lines({ status: 200, contentType: 'video/mp4', contentRange: null, container: 'mp4/mov' })).toMatch(/ignored the byte range/);
  });
  it('names a file that arrived but cannot be played', () => {
    const text = lines({ status: 206, contentType: 'video/webm', contentRange: 'bytes 0-15/9', container: 'webm/mkv' });
    expect(text).toMatch(/File type: webm\/mkv/);
    expect(text).toMatch(/cannot play what is inside/);
  });
  it('says so when it could not check, and says what to do instead', () => {
    const text = lines({ blocked: true });
    expect(text).toMatch(/does not let this page read it/);
    expect(text).toMatch(/open the file directly/);
  });
  it('always says where it came from', () => expect(lines({ status: 404 })).toContain('From: this app/api/v'));
});
