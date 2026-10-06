// --- Inline media handling ---
//
// Equipment photos, exercise GIFs and tutorial videos are stored as base64
// data URIs in TEXT columns. Returning them inline from the list endpoints
// meant one request to /api/equipment or /api/exercises materialised every
// blob twice — once as a UTF-16 JS string (2 bytes per base64 char), then
// again inside res.json's serialisation — which is what was OOM-killing the
// 512MB instance (exit 137). The list endpoints now return a URL pointing at
// the per-item routes built here, so at most one blob is ever in memory at a
// time. The field names are unchanged, so <img src> and <video src> in the
// frontend keep working untouched.

// The URL carries a content hash, so replacing a photo changes its URL and
// the long cache lifetime below can never serve a stale one.
export const mediaUrl = (kind, idPath, version) => `/api/${kind}/${idPath}?v=${version}`;

// Honours a Range request. Safari will not play a video from a server that
// answers its "bytes=0-1" probe with the whole file and a 200: it needs a 206 and
// a Content-Range, or it reports the video as unplayable. Chrome tolerates the
// whole file, which is how every video stored this way kept working for anyone
// not on Safari. An image is never sent a Range, so for one nothing changes.
export const sendDataUri = (res, dataUri, rangeHeader) => {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.*)$/s.exec(dataUri || '');
  if (!match) return res.status(404).json({ error: 'Media not found' });
  const buffer = Buffer.from(match[2], 'base64');
  res.set('Content-Type', match[1]);
  res.set('Accept-Ranges', 'bytes');
  res.set('Cache-Control', 'private, max-age=31536000, immutable');

  const range = parseRange(rangeHeader, buffer.length);
  if (range?.unsatisfiable) {
    res.set('Content-Range', `bytes */${buffer.length}`);
    return res.status(416).end();
  }
  if (range) {
    res.set('Content-Range', `bytes ${range.start}-${range.end}/${buffer.length}`);
    res.set('Content-Length', String(range.end - range.start + 1));
    res.status(206);
    return res.end(buffer.subarray(range.start, range.end + 1));
  }
  res.set('Content-Length', String(buffer.length));
  return res.end(buffer);
};

// Streams one media column without loading any sibling row's blob. The table
// and column are fixed strings supplied at wiring time, never request data;
// only the id is interpolated, and that goes through a bound parameter.
export const serveMediaColumn = (pool, table, column) => async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT ${column} AS media FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return sendDataUri(res, result.rows[0].media, req.headers?.range);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error fetching media' });
  } finally {
    client?.release();
  }
};

// A save round-trips whatever the list endpoint handed out, so an unchanged
// item sends its media URL back rather than the original data URI. Writing
// that URL into the column would destroy the media, so a URL means "keep
// what is stored" — returned as null, which the COALESCE in each write
// statement resolves to the existing column value. A data URI is a genuine
// upload and overwrites; an empty string is a deliberate removal and clears.
export const blobWrite = (value) =>
  (typeof value === 'string' && value.startsWith('/api/')) ? null : (value || '');

// --- Raw binary media (tutorial videos) ---
//
// Videos are stored as BYTEA and uploaded as a raw request body rather than
// a base64 data URI inside JSON. Base64 inflated every file by a third and
// forced it through the JSON body limit, which has to stay small on a 512MB
// instance — so the transport was silently capping video quality. Raw bytes
// remove that ceiling and are stored and returned unmodified: no re-encoding
// happens anywhere in this path, so what is served is byte-identical to what
// was uploaded.

// Sends a video that lives in object storage, passing the browser's byte range
// through to it and its answer back, so Safari gets the 206 it insists on and
// nothing larger than a chunk is held in memory. `getObject(range)` is supplied
// by the caller and returns { body (a readable stream), contentLength,
// contentRange, contentType }, or null. A range it cannot use is dropped and the
// whole file sent, as everywhere else here.
export const streamObject = async (res, rangeHeader, getObject) => {
  const range = typeof rangeHeader === 'string' && /^bytes=\d*-\d*$/.test(rangeHeader.trim()) ? rangeHeader.trim() : undefined;
  try {
    const object = await getObject(range);
    if (!object) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', object.contentType || 'application/octet-stream');
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    if (object.contentLength != null) res.set('Content-Length', String(object.contentLength));
    if (object.contentRange) {
      res.set('Content-Range', object.contentRange);
      res.status(206);
    }
    // A viewer who leaves mid-video must not leave the download running.
    res.on?.('close', () => object.body?.destroy?.());
    return object.body.pipe(res);
  } catch (err) {
    console.error('Error reading video from object storage:', err?.name, err?.message);
    if (res.headersSent) return res.end();
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NoSuchKey' || err?.name === 'NotFound') return res.status(404).json({ error: 'Not found' });
    if (status === 416 || err?.name === 'InvalidRange') return res.status(416).end();
    return res.status(502).json({ error: 'Could not read the video from storage' });
  }
};

// Parses a single-range "bytes=start-end" header. Returns null for absent,
// malformed, or multi-range requests, which callers answer with a full body.
export const parseRange = (header, size) => {
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    // "bytes=-500" means the final 500 bytes.
    const suffix = Number(rawEnd);
    if (suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return { unsatisfiable: true };
  return { start, end };
};

// Writes a byte range out of exercise_video_chunks, one piece at a time.
// Nothing larger than a single chunk is ever held in memory, so serving a
// 300MB video costs the same as serving a 4MB one. Chunk lengths come from
// the stored byte_len rather than measuring the blobs, so picking the pieces
// a range needs reads no video bytes at all.
const streamChunks = async (client, res, exerciseId, start, end) => {
  const spans = await client.query(
    `SELECT seq, start_byte, byte_len
       FROM exercise_video_chunks
      WHERE exercise_id = $1 AND start_byte <= $3 AND start_byte + byte_len > $2
      ORDER BY seq`,
    [exerciseId, start, end]
  );

  for (const span of spans.rows) {
    const spanStart = Number(span.start_byte);
    const from = Math.max(start, spanStart);
    const to = Math.min(end, spanStart + span.byte_len - 1);
    if (from > to) continue;
    // substring() is 1-indexed in Postgres.
    const piece = await client.query(
      `SELECT substring(bytes from $3 for $4) AS part
         FROM exercise_video_chunks WHERE exercise_id = $1 AND seq = $2`,
      [exerciseId, span.seq, from - spanStart + 1, to - from + 1]
    );
    // Respect backpressure: without this a fast database would queue the
    // whole video in the socket's buffer, reintroducing the memory spike
    // that chunking exists to avoid.
    if (!res.write(piece.rows[0].part)) {
      await new Promise((resolve) => res.once('drain', resolve));
    }
  }
  return res.end();
};

// Serves a tutorial video, from the chunk table when the upload was chunked
// and from the single-value column otherwise, so videos stored before
// chunking existed keep playing untouched.
export const serveVideo = (pool, table, dataColumn, typeColumn, sizeColumn, fallbackTextColumn) => {
  const serveSingleValue = serveBinaryColumn(pool, table, dataColumn, typeColumn, fallbackTextColumn);

  return async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const meta = await client.query(
      `SELECT ${sizeColumn} AS chunked_size, ${typeColumn} AS mime
         FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (meta.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const chunkedSize = meta.rows[0].chunked_size === null ? null : Number(meta.rows[0].chunked_size);
    if (!chunkedSize) {
      // Not chunked — fall through to the original single-column path. Hand
      // this client back first: that path checks out its own, and holding
      // both would let enough concurrent requests exhaust the pool with each
      // one waiting on a client the others are holding.
      client.release();
      client = null;
      return serveSingleValue(req, res);
    }

    res.set('Content-Type', meta.rows[0].mime || 'application/octet-stream');
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=31536000, immutable');

    const range = parseRange(req.headers?.range, chunkedSize);
    if (range?.unsatisfiable) {
      res.set('Content-Range', `bytes */${chunkedSize}`);
      return res.status(416).end();
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : chunkedSize - 1;
    res.set('Content-Length', String(end - start + 1));
    if (range) {
      res.set('Content-Range', `bytes ${start}-${end}/${chunkedSize}`);
      res.status(206);
    }
    return await streamChunks(client, res, req.params.id, start, end);
  } catch (err) {
    console.error('Error serving video:', err.message);
    if (!res.headersSent) return res.status(500).json({ error: 'Database error fetching media' });
    return res.end();
  } finally {
    client?.release();
  }
  };
};

// Serves a BYTEA column, honouring Range so the browser can seek — which the
// step-by-step tutorial depends on, and which a data URI could never support.
// The slice is taken in SQL (substring), so seeking a large video never pulls
// the whole file into the server's memory.
export const serveBinaryColumn = (pool, table, dataColumn, typeColumn, fallbackTextColumn) => async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const meta = await client.query(
      `SELECT octet_length(${dataColumn}) AS size, ${typeColumn} AS mime
       FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (meta.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const size = meta.rows[0].size;
    if (!size) {
      // Uploaded before videos moved to BYTEA — still stored as a data URI.
      if (!fallbackTextColumn) return res.status(404).json({ error: 'Media not found' });
      const legacy = await client.query(
        `SELECT ${fallbackTextColumn} AS media FROM ${table} WHERE id = $1`,
        [req.params.id]
      );
      return sendDataUri(res, legacy.rows[0]?.media, req.headers?.range);
    }

    const contentType = meta.rows[0].mime || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=31536000, immutable');

    const range = parseRange(req.headers?.range, size);
    if (range?.unsatisfiable) {
      res.set('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    // substring() is 1-indexed in Postgres.
    const chunk = await client.query(
      `SELECT substring(${dataColumn} from $2 for $3) AS part FROM ${table} WHERE id = $1`,
      [req.params.id, start + 1, end - start + 1]
    );

    res.set('Content-Length', String(end - start + 1));
    if (range) {
      res.set('Content-Range', `bytes ${start}-${end}/${size}`);
      res.status(206);
    }
    return res.end(chunk.rows[0].part);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error fetching media' });
  } finally {
    client?.release();
  }
};
