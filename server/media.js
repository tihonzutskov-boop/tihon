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

export const sendDataUri = (res, dataUri) => {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.*)$/s.exec(dataUri || '');
  if (!match) return res.status(404).json({ error: 'Media not found' });
  const buffer = Buffer.from(match[2], 'base64');
  res.set('Content-Type', match[1]);
  res.set('Content-Length', String(buffer.length));
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
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
    return sendDataUri(res, result.rows[0].media);
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
      return sendDataUri(res, legacy.rows[0]?.media);
    }

    const contentType = meta.rows[0].mime || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

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
