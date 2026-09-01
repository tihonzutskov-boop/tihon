import { describe, it, expect, vi } from 'vitest';
import { mediaUrl, sendDataUri, serveMediaColumn, serveBinaryColumn, parseRange, blobWrite } from './media.js';

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t';

const fakeRes = () => {
  const res = {
    headers: {}, statusCode: 200, body: undefined, jsonBody: undefined,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.jsonBody = b; return this; },
    end(b) { this.body = b; return this; },
  };
  return res;
};

const fakePool = (rows, { failOn } = {}) => {
  const client = {
    query: vi.fn(async () => {
      if (failOn) throw new Error(failOn);
      return { rows };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: async () => client }, client };
};

describe('blobWrite — the save round-trip guard', () => {
  // The list endpoint hands out a URL, so an unchanged item sends that URL
  // back on save. Writing it would replace the video with the string
  // "/api/exercises/x/tutorial-video?v=ab12" and destroy the upload.
  it('returns null for a media URL so the stored blob is preserved', () => {
    expect(blobWrite('/api/exercises/ex-1/tutorial-video?v=ab12cd34')).toBeNull();
    expect(blobWrite('/api/equipment/eq-1/image?v=ffffffff')).toBeNull();
  });

  it('passes a freshly uploaded data URI through so it overwrites', () => {
    expect(blobWrite(MP4)).toBe(MP4);
    expect(blobWrite(GIF)).toBe(GIF);
  });

  it('treats an empty value as a deliberate removal, not a preserve', () => {
    // Distinct from the URL case: '' must clear the column, null must keep it.
    expect(blobWrite('')).toBe('');
    expect(blobWrite(undefined)).toBe('');
    expect(blobWrite(null)).toBe('');
  });

  it('does not mistake an external https URL for one of our media paths', () => {
    expect(blobWrite('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
});

describe('mediaUrl', () => {
  it('embeds the content version so a replaced file gets a new URL', () => {
    expect(mediaUrl('exercises', 'ex-1/tutorial-video', 'ab12cd34'))
      .toBe('/api/exercises/ex-1/tutorial-video?v=ab12cd34');
  });

  it('produces a URL that blobWrite recognises as "keep"', () => {
    // The two halves of the round-trip must agree, or saves lose media.
    expect(blobWrite(mediaUrl('equipment', 'eq-1/image', 'deadbeef'))).toBeNull();
  });
});

describe('sendDataUri', () => {
  it('decodes base64 to binary with the declared content type', () => {
    const res = fakeRes();
    sendDataUri(res, GIF);
    expect(res.headers['Content-Type']).toBe('image/gif');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.headers['Content-Length']).toBe(String(res.body.length));
  });

  it('reads a video mime type rather than assuming an image', () => {
    const res = fakeRes();
    sendDataUri(res, MP4);
    expect(res.headers['Content-Type']).toBe('video/mp4');
  });

  it('sets an immutable cache, which is only safe because URLs are versioned', () => {
    const res = fakeRes();
    sendDataUri(res, GIF);
    expect(res.headers['Cache-Control']).toContain('immutable');
  });

  it('404s on an empty or malformed column instead of serving garbage', () => {
    for (const bad of ['', null, undefined, 'not-a-data-uri', 'data:image/gif,notbase64']) {
      const res = fakeRes();
      sendDataUri(res, bad);
      expect(res.statusCode).toBe(404);
      expect(res.body).toBeUndefined();
    }
  });
});

describe('serveMediaColumn', () => {
  it('selects only the one requested column, never the whole row', async () => {
    // This is the entire point of the change: pulling sibling blobs is what
    // exhausted the instance.
    const { pool, client } = fakePool([{ media: GIF }]);
    const res = fakeRes();
    await serveMediaColumn(pool, 'exercises', 'tutorial_video_url')({ params: { id: 'ex-1' } }, res);

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('tutorial_video_url AS media');
    expect(sql).not.toContain('SELECT *');
    expect(params).toEqual(['ex-1']);
    expect(res.headers['Content-Type']).toBe('image/gif');
  });

  it('binds the id as a parameter rather than interpolating it', async () => {
    const { pool, client } = fakePool([{ media: GIF }]);
    await serveMediaColumn(pool, 'exercises', 'image_url')(
      { params: { id: "'; DROP TABLE exercises; --" } }, fakeRes()
    );
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).not.toContain('DROP TABLE');
    expect(params[0]).toBe("'; DROP TABLE exercises; --");
  });

  it('404s for a missing row', async () => {
    const { pool } = fakePool([]);
    const res = fakeRes();
    await serveMediaColumn(pool, 'equipment', 'image_url')({ params: { id: 'nope' } }, res);
    expect(res.statusCode).toBe(404);
  });

  it('releases the connection even when the query throws', async () => {
    // A leaked connection per failed request would exhaust the pool and take
    // the service down just as surely as the memory did.
    const { pool, client } = fakePool([], { failOn: 'connection reset' });
    const res = fakeRes();
    await serveMediaColumn(pool, 'equipment', 'image_url')({ params: { id: 'eq-1' } }, res);
    expect(res.statusCode).toBe(500);
    expect(client.release).toHaveBeenCalled();
  });
});

describe('parseRange', () => {
  it('returns null when the browser asks for the whole file', () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('', 1000)).toBeNull();
  });

  it('parses an explicit start and end', () => {
    expect(parseRange('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 });
  });

  it('treats an open-ended range as running to the last byte', () => {
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
  });

  it('reads a suffix range as the final N bytes', () => {
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });

  it('clamps an end past the file rather than over-reading', () => {
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('flags a start beyond the file as unsatisfiable', () => {
    expect(parseRange('bytes=2000-', 1000)).toEqual({ unsatisfiable: true });
  });

  it('ignores multi-range and malformed headers instead of guessing', () => {
    expect(parseRange('bytes=0-99,200-299', 1000)).toBeNull();
    expect(parseRange('kilobytes=0-99', 1000)).toBeNull();
    expect(parseRange('bytes=-', 1000)).toBeNull();
  });
});

describe('serveBinaryColumn', () => {
  const binPool = (rows) => {
    const calls = [];
    const client = {
      query: vi.fn(async (sql, params) => {
        calls.push({ sql, params });
        return { rows: rows[calls.length - 1] };
      }),
      release: vi.fn(),
    };
    return { pool: { connect: async () => client }, client, calls };
  };

  it('serves the whole video and advertises range support', async () => {
    const { pool, calls } = binPool([
      [{ size: 1000, mime: 'video/mp4' }],
      [{ part: Buffer.alloc(1000) }],
    ]);
    const res = fakeRes();
    await serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')(
      { params: { id: 'ex-1' }, headers: {} }, res
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('video/mp4');
    expect(res.headers['Accept-Ranges']).toBe('bytes');
    expect(res.headers['Content-Length']).toBe('1000');
    // Postgres substring is 1-indexed: byte 0 is "from 1".
    expect(calls[1].params).toEqual(['ex-1', 1, 1000]);
  });

  it('answers a seek with 206 and slices in SQL, not in memory', async () => {
    const { pool, calls } = binPool([
      [{ size: 1000, mime: 'video/mp4' }],
      [{ part: Buffer.alloc(500) }],
    ]);
    const res = fakeRes();
    await serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')(
      { params: { id: 'ex-1' }, headers: { range: 'bytes=500-999' } }, res
    );
    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 500-999/1000');
    expect(res.headers['Content-Length']).toBe('500');
    expect(calls[1].sql).toContain('substring(tutorial_video from $2 for $3)');
    expect(calls[1].params).toEqual(['ex-1', 501, 500]);
  });

  it('returns 416 for a seek past the end', async () => {
    const { pool } = binPool([[{ size: 1000, mime: 'video/mp4' }]]);
    const res = fakeRes();
    await serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')(
      { params: { id: 'ex-1' }, headers: { range: 'bytes=9999-' } }, res
    );
    expect(res.statusCode).toBe(416);
    expect(res.headers['Content-Range']).toBe('bytes */1000');
  });

  it('falls back to a pre-migration data URI when no bytes are stored', async () => {
    // Videos uploaded before the BYTEA migration must keep playing.
    const { pool } = binPool([
      [{ size: null, mime: null }],
      [{ media: MP4 }],
    ]);
    const res = fakeRes();
    await serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')(
      { params: { id: 'ex-1' }, headers: {} }, res
    );
    expect(res.headers['Content-Type']).toBe('video/mp4');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('404s for an unknown exercise', async () => {
    const { pool } = binPool([[]]);
    const res = fakeRes();
    await serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')(
      { params: { id: 'nope' }, headers: {} }, res
    );
    expect(res.statusCode).toBe(404);
  });
});
