import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

/**
 * Object storage for tutorial videos.
 *
 * Videos used to live in Postgres, chunked across exercise_video_chunks. That
 * removed the request-body ceiling the base64-in-JSON approach had, but it
 * moved the ceiling rather than removing it: the database disk filled, and a
 * full Postgres stops accepting writes entirely — which took the whole app
 * down, not just video uploads.
 *
 * R2 is S3-compatible, so this is the standard AWS SDK pointed at a different
 * endpoint. R2 specifically, rather than S3, because it does not charge for
 * egress — and every client watching a tutorial is egress.
 *
 * Everything here degrades to "not configured" rather than throwing at import
 * time, so the server runs normally before the bucket exists and the Postgres
 * path stays in service for videos that have not been migrated yet.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
// The public base a browser fetches from: an r2.dev domain or a custom one.
// Without it the bytes would be stored somewhere nothing can play them from.
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

export const isConfigured = () =>
  !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_BASE);

/** Which piece is missing, so a misconfiguration says so instead of failing silently. */
export const missingConfig = () =>
  [
    !ACCOUNT_ID && 'R2_ACCOUNT_ID',
    !ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
    !SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
    !BUCKET && 'R2_BUCKET',
    !PUBLIC_BASE && 'R2_PUBLIC_BASE_URL',
  ].filter(Boolean);

let client = null;
const getClient = () => {
  if (!isConfigured()) return null;
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    });
  }
  return client;
};

const EXTENSION_BY_TYPE = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/ogg': 'ogv',
};

/**
 * The object key for one exercise's video.
 *
 * The version is part of the key rather than a query parameter, so replacing a
 * video writes a new object instead of overwriting one that caches — CDN and
 * browser caches key on the URL, and an immutable URL is what lets the video be
 * cached for a year without a stale one ever being served.
 */
export const videoKey = (exerciseId, version, contentType) =>
  `tutorial-videos/${exerciseId}/${version}.${EXTENSION_BY_TYPE[contentType] || 'mp4'}`;

export const publicUrl = (key) => (key ? `${PUBLIC_BASE}/${key}` : '');

/**
 * Streams a request body straight into the bucket.
 *
 * Upload() handles multipart on its own, so a large file never has to be held
 * in memory — the same property the chunked database writer existed to get,
 * without owning the code that provides it.
 */
export const putVideo = async (key, body, contentType) => {
  const s3 = getClient();
  if (!s3) throw new Error(`Object storage is not configured (missing ${missingConfig().join(', ')})`);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Keyed by version, so an object at a given URL never changes.
      CacheControl: 'public, max-age=31536000, immutable',
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
  });

  await upload.done();
  return key;
};

/** Best-effort: a leftover object costs storage, a thrown error costs the request. */
export const deleteVideo = async (key) => {
  const s3 = getClient();
  if (!s3 || !key) return false;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    console.error('Could not delete video object', key, err.message);
    return false;
  }
};

/** Confirms the credentials and bucket actually work, for the health check. */
export const checkAccess = async () => {
  const s3 = getClient();
  if (!s3) return { ok: false, error: `Not configured (missing ${missingConfig().join(', ')})` };
  try {
    // A HEAD on a key that does not exist still proves reachability and auth:
    // a missing object answers 404, bad credentials answer 401/403.
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: '__access_check__' }));
    return { ok: true };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NotFound') return { ok: true };
    return { ok: false, error: `${err.name || 'Error'}: ${err.message}` };
  }
};
