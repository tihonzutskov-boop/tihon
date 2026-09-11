#!/usr/bin/env node
/**
 * Moves tutorial videos out of Postgres and into object storage.
 *
 * Run with no flags for a dry run. Nothing is written until you pass --apply,
 * and nothing is deleted until you pass --purge as a separate, later step —
 * after you have actually watched a few videos play from their new home.
 *
 *   node server/migrate-videos-to-r2.js            # what would move, and how big
 *   node server/migrate-videos-to-r2.js --apply    # copy to R2, point rows at it
 *   node server/migrate-videos-to-r2.js --purge    # only then, free the database
 *
 * Copy and delete are deliberately two commands. A migration that frees space
 * in the same pass as it moves data has a window where a failure loses the
 * only copy, and these videos are not all recoverable from anywhere else.
 */
import pg from 'pg';
import { Readable } from 'node:stream';
import * as r2 from './r2.js';

const { Pool } = pg;
const APPLY = process.argv.includes('--apply');
const PURGE = process.argv.includes('--purge');

const mb = (bytes) => (Number(bytes || 0) / (1024 * 1024)).toFixed(1);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
  // Reading a whole video out in pieces can take a while on a struggling
  // instance; the default 15s used by the server is too tight for this.
  statement_timeout: 120_000,
});

/** Streams one exercise's chunks out of Postgres in order, without holding it whole. */
async function* videoChunks(client, exerciseId) {
  const { rows } = await client.query(
    'SELECT seq FROM exercise_video_chunks WHERE exercise_id = $1 ORDER BY seq ASC',
    [exerciseId]
  );
  for (const { seq } of rows) {
    const piece = await client.query(
      'SELECT bytes FROM exercise_video_chunks WHERE exercise_id = $1 AND seq = $2',
      [exerciseId, seq]
    );
    if (piece.rows[0]?.bytes) yield piece.rows[0].bytes;
  }
}

const migrate = async () => {
  if (!r2.isConfigured()) {
    console.error(`Object storage is not configured. Missing: ${r2.missingConfig().join(', ')}`);
    process.exit(1);
  }
  const access = await r2.checkAccess();
  if (!access.ok) {
    console.error(`Object storage is configured but unreachable: ${access.error}`);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT e.id, e.name, e.tutorial_video_type, e.tutorial_video_version,
             e.tutorial_video_size, e.tutorial_video_key,
             (e.tutorial_video IS NOT NULL) AS has_legacy_blob,
             COALESCE(c.pieces, 0)::int AS pieces,
             COALESCE(c.bytes, 0)::bigint AS chunk_bytes
        FROM exercises e
        LEFT JOIN (
          SELECT exercise_id, COUNT(*) AS pieces, SUM(byte_len) AS bytes
            FROM exercise_video_chunks GROUP BY exercise_id
        ) c ON c.exercise_id = e.id
       WHERE e.tutorial_video_key IS NULL
         AND (c.pieces IS NOT NULL OR e.tutorial_video IS NOT NULL)
       ORDER BY e.name ASC
    `);

    if (rows.length === 0) {
      console.log('Nothing to migrate — every stored video already has an object key.');
      return;
    }

    const total = rows.reduce((a, r) => a + Number(r.chunk_bytes || 0), 0);
    console.log(`${rows.length} video(s) still in the database, ${mb(total)}MB total\n`);

    if (!APPLY) {
      for (const r of rows) {
        const where = r.pieces > 0 ? `${r.pieces} chunks` : 'legacy single blob';
        console.log(`  ${mb(r.chunk_bytes).padStart(7)}MB  ${r.name}  (${where})`);
      }
      console.log('\nDry run. Re-run with --apply to copy these to object storage.');
      console.log('Nothing is deleted by --apply; use --purge afterwards, once you have watched them play.');
      return;
    }

    let moved = 0;
    let failed = 0;
    for (const row of rows) {
      const contentType = row.tutorial_video_type || 'video/mp4';
      const version = row.tutorial_video_version || Date.now().toString(36);
      const key = r2.videoKey(row.id, version, contentType);
      process.stdout.write(`  ${row.name} … `);

      if (row.pieces === 0) {
        // A legacy single blob predates chunking; read it as one value.
        const blob = await client.query('SELECT tutorial_video FROM exercises WHERE id = $1', [row.id]);
        const bytes = blob.rows[0]?.tutorial_video;
        if (!bytes) { console.log('skipped (no bytes)'); continue; }
        await r2.putVideo(key, Readable.from([bytes]), contentType);
      } else {
        await r2.putVideo(key, Readable.from(videoChunks(client, row.id)), contentType);
      }

      try {
        // The row points at the object; the database copy is left exactly
        // where it is, so this is reversible until --purge runs.
        await client.query(
          'UPDATE exercises SET tutorial_video_key = $2, tutorial_video_version = $3 WHERE id = $1',
          [row.id, key, version]
        );
        moved += 1;
        console.log(`moved (${mb(row.chunk_bytes)}MB)`);
      } catch (err) {
        // The object exists but nothing references it — remove it rather than
        // leave a copy that is paid for and unreachable.
        await r2.deleteVideo(key);
        failed += 1;
        console.log(`FAILED: ${err.message}`);
      }
    }

    console.log(`\n${moved} moved, ${failed} failed.`);
    if (moved > 0) {
      console.log('The database still holds every original. Watch a few videos play,');
      console.log('then run with --purge to actually free the disk.');
    }
  } finally {
    client.release();
  }
};

const purge = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT e.id, e.name, COALESCE(SUM(c.byte_len), 0)::bigint AS bytes
        FROM exercises e JOIN exercise_video_chunks c ON c.exercise_id = e.id
       WHERE e.tutorial_video_key IS NOT NULL
       GROUP BY e.id, e.name ORDER BY e.name ASC
    `);
    if (rows.length === 0) {
      console.log('Nothing to purge — no migrated video still has a database copy.');
      return;
    }
    const total = rows.reduce((a, r) => a + Number(r.bytes), 0);
    console.log(`${rows.length} migrated video(s) still taking ${mb(total)}MB in the database.\n`);

    for (const row of rows) {
      // Only for rows that already point at an object: a row with no key has
      // no second copy, and dropping its chunks would destroy the only one.
      const key = await client.query('SELECT tutorial_video_key FROM exercises WHERE id = $1', [row.id]);
      if (!key.rows[0]?.tutorial_video_key) { console.log(`  ${row.name}: no object key, left alone`); continue; }
      await client.query('DELETE FROM exercise_video_chunks WHERE exercise_id = $1', [row.id]);
      await client.query(
        'UPDATE exercises SET tutorial_video = NULL, tutorial_video_url = \'\' WHERE id = $1',
        [row.id]
      );
      console.log(`  ${row.name}: freed ${mb(row.bytes)}MB`);
    }

    // DELETE marks rows dead without returning their space to the disk, which
    // is the entire point of running this. VACUUM FULL rewrites the table —
    // but it needs room to write the copy, so on a disk that is already full
    // it will fail and the space stays claimed until more is available.
    console.log('\nReclaiming disk (VACUUM FULL on the chunk table)…');
    try {
      await client.query('VACUUM FULL exercise_video_chunks');
      console.log('Done. The space is back.');
    } catch (err) {
      console.log(`VACUUM FULL failed: ${err.message}`);
      console.log('The rows are deleted but the disk is not reclaimed yet. This usually means');
      console.log('there is not enough free space to rewrite the table — add space, then re-run.');
    }
  } finally {
    client.release();
  }
};

(PURGE ? purge() : migrate())
  .catch(err => { console.error('\nFailed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
