import { describe, it, expect, vi } from 'vitest';
import { PassThrough, Readable } from 'stream';
import { mediaUrl, sendDataUri, serveMediaColumn, serveBinaryColumn, streamObject, parseRange, blobWrite } from './media.js';

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

  describe('byte ranges, which Safari needs before it will play a video', () => {
    // 'abcdefghij' as a video data URI: ten bytes make the arithmetic readable.
    const TEN = 'data:video/mp4;base64,' + Buffer.from('abcdefghij').toString('base64');
    const send = (range) => { const res = fakeRes(); sendDataUri(res, TEN, range); return res; };

    it('answers a range with 206, the slice, and a Content-Range', () => {
      const res = send('bytes=2-5');
      expect(res.statusCode).toBe(206);
      expect(res.body.toString()).toBe('cdef');
      expect(res.headers['Content-Range']).toBe('bytes 2-5/10');
      expect(res.headers['Content-Length']).toBe('4');
    });

    it("answers Safari's first probe, bytes=0-1, with two bytes and a 206", () => {
      const res = send('bytes=0-1');
      expect(res.statusCode).toBe(206);
      expect(res.body.toString()).toBe('ab');
      expect(res.headers['Content-Range']).toBe('bytes 0-1/10');
    });

    it('answers an open-ended range from the start point to the end', () => {
      const res = send('bytes=7-');
      expect(res.statusCode).toBe(206);
      expect(res.body.toString()).toBe('hij');
      expect(res.headers['Content-Range']).toBe('bytes 7-9/10');
    });

    it('answers a suffix range with the last bytes', () => {
      const res = send('bytes=-3');
      expect(res.body.toString()).toBe('hij');
      expect(res.headers['Content-Range']).toBe('bytes 7-9/10');
    });

    it('stops a range that runs past the end at the end', () => {
      const res = send('bytes=8-500');
      expect(res.body.toString()).toBe('ij');
      expect(res.headers['Content-Range']).toBe('bytes 8-9/10');
    });

    it('refuses a range that starts past the end with 416 and the size', () => {
      const res = send('bytes=50-60');
      expect(res.statusCode).toBe(416);
      expect(res.headers['Content-Range']).toBe('bytes */10');
      expect(res.body).toBeUndefined();
    });

    it('sends the whole thing with a 200 when no range is asked for, and says ranges are accepted', () => {
      const res = send(undefined);
      expect(res.statusCode).toBe(200);
      expect(res.body.toString()).toBe('abcdefghij');
      expect(res.headers['Accept-Ranges']).toBe('bytes');
      expect(res.headers['Content-Range']).toBeUndefined();
    });

    it('sends the whole thing when the range is one it does not understand', () => {
      for (const bad of ['bytes=0-1,4-5', 'items=0-1', 'bytes=', 'garbage']) {
        const res = send(bad);
        expect(res.statusCode, bad).toBe(200);
        expect(res.body.toString(), bad).toBe('abcdefghij');
      }
    });
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

describe('streamObject (a video in object storage, sent through the app)', () => {
  // A real writable, so piping is exercised; the rest is what Express adds.
  const streamingRes = () => {
    const res = new PassThrough();
    res.headers = {}; res.statusCode = 200; res.jsonBody = undefined; res.headersSent = false;
    res.set = (k, v) => { res.headers[k] = v; return res; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.jsonBody = b; res.end(); return res; };
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.bodyText = async () => { await new Promise(r => res.once('end', r)); return Buffer.concat(chunks).toString(); };
    return res;
  };
  const object = (text, extra = {}) => ({
    body: Readable.from([Buffer.from(text)]), contentLength: text.length, contentType: 'video/mp4', ...extra,
  });

  it('streams the whole file with its type, a length, and a note that ranges are accepted', async () => {
    const res = streamingRes();
    await streamObject(res, undefined, async () => object('abcdefghij'));
    expect(await res.bodyText()).toBe('abcdefghij');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('video/mp4');
    expect(res.headers['Content-Length']).toBe('10');
    expect(res.headers['Accept-Ranges']).toBe('bytes');
    expect(res.headers['Cache-Control']).toContain('immutable');
  });

  it("answers Safari's first probe with a 206 and the Content-Range the storage gave", async () => {
    const res = streamingRes();
    let asked;
    await streamObject(res, 'bytes=0-1', async (range) => { asked = range; return object('ab', { contentRange: 'bytes 0-1/10' }); });
    expect(asked).toBe('bytes=0-1');
    expect(await res.bodyText()).toBe('ab');
    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 0-1/10');
    expect(res.headers['Content-Length']).toBe('2');
  });

  it('passes open-ended and suffix ranges on', async () => {
    for (const range of ['bytes=5-', 'bytes=-4', 'bytes=2-6']) {
      let asked;
      await streamObject(streamingRes(), range, async (r) => { asked = r; return object('x', { contentRange: 'bytes 0-0/1' }); });
      expect(asked).toBe(range);
    }
  });

  it('drops a range it does not understand and sends the whole file', async () => {
    for (const bad of ['bytes=0-1,4-5', 'items=0-1', 'garbage', '', undefined, 42]) {
      let asked = 'unset';
      const res = streamingRes();
      await streamObject(res, bad, async (r) => { asked = r; return object('whole'); });
      expect(asked, String(bad)).toBeUndefined();
      expect(await res.bodyText(), String(bad)).toBe('whole');
      expect(res.statusCode, String(bad)).toBe(200);
    }
  });

  it('is a 404 when there is no such object', async () => {
    const none = streamingRes();
    await streamObject(none, undefined, async () => null);
    expect(none.statusCode).toBe(404);

    const missing = streamingRes();
    await streamObject(missing, undefined, async () => { const e = new Error('nope'); e.name = 'NoSuchKey'; throw e; });
    expect(missing.statusCode).toBe(404);
  });

  it('is a 416 for a range the storage refuses', async () => {
    const res = streamingRes();
    await streamObject(res, 'bytes=999-', async () => { const e = new Error('bad range'); e.name = 'InvalidRange'; e.$metadata = { httpStatusCode: 416 }; throw e; });
    expect(res.statusCode).toBe(416);
  });

  it('is a 502 when storage itself fails, not a bare crash', async () => {
    const res = streamingRes();
    await streamObject(res, undefined, async () => { throw new Error('connect ETIMEDOUT'); });
    expect(res.statusCode).toBe(502);
    expect(res.jsonBody).toEqual({ error: 'Could not read the video from storage' });
  });

  it('stops reading from storage when the viewer goes away', async () => {
    const res = streamingRes();
    const body = new PassThrough();
    await streamObject(res, undefined, async () => ({ body, contentLength: 5, contentType: 'video/mp4' }));
    res.emit('close');
    expect(body.destroyed).toBe(true);
  });
});
