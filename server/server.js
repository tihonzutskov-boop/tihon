import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import {
  verifyGoogleToken,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  createRequireAdmin,
  isAdminEmail,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gym_cartographer'
});
const requireAdmin = createRequireAdmin(pool);

// Apply the schema (all statements are idempotent, safe to re-run on every boot)
const initDb = async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema applied.');
  } catch (err) {
    console.warn('Database initialization postponed (Postgres connection unavailable yet):', err.message);
  }
};
initDb();

app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));

// --- Auth Routes ---

const computeStats = async (client, userId) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(duration_minutes), 0)::int AS total_minutes,
            ARRAY_AGG(DISTINCT completed_at::date ORDER BY completed_at::date DESC) AS days
     FROM workout_logs WHERE user_id = $1`,
    [userId]
  );
  const { count, total_minutes, days } = result.rows[0];

  let streakDays = 0;
  if (days && days.length > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let cursor = today;
    for (const d of days) {
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      const diff = Math.round((cursor - day) / 86400000);
      if (diff === 0 || diff === 1) {
        streakDays++;
        cursor = day;
      } else {
        break;
      }
    }
  }

  return { workoutsCompleted: count, totalMinutes: total_minutes, streakDays };
};

// Sign in with Google — verifies the ID token, finds or creates the user,
// and issues our own httpOnly session cookie. Admin role is granted only to
// emails listed in ADMIN_EMAILS — never client-controlled.
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
  let client;

  try {
    const payload = await verifyGoogleToken(idToken);
    const { email, name, sub: googleId, picture } = payload;

    client = await pool.connect();
    const existing = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    // ADMIN_EMAILS is the sole source of truth for admin access, re-derived
    // on every login — this makes removing an email from it actually revoke
    // access on that person's next sign-in, not just stop granting new ones.
    const role = isAdminEmail(email) ? 'admin' : 'user';
    let user;

    if (existing.rows.length > 0) {
      const updated = await client.query(
        'UPDATE users SET name=$1, google_id=$2, avatar_url=$3, role=$4 WHERE email=$5 RETURNING *',
        [name, googleId, picture, role, email]
      );
      user = updated.rows[0];
    } else {
      const created = await client.query(
        'INSERT INTO users (name, email, role, google_id, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, email, role, googleId, picture]
      );
      user = created.rows[0];
    }

    const { password_hash, ...userProfile } = user;
    userProfile.stats = await computeStats(client, user.id);

    setSessionCookie(res, signSession(user));
    res.json({ user: userProfile });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Google sign-in failed' });
  } finally {
    client?.release();
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const { password_hash, ...userProfile } = result.rows[0];
    userProfile.stats = await computeStats(client, req.user.id);
    res.json({ user: userProfile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client?.release();
  }
});

// --- Workout Tracking Routes ---

app.post('/api/workouts', requireAuth, async (req, res) => {
  const { dayName, exerciseCount, planDayId } = req.body;
  try {
    await pool.query(
      'INSERT INTO workout_logs (user_id, day_name, exercise_count, plan_day_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, dayName || 'Workout', exerciseCount || 0, planDayId || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error logging workout' });
  }
});

app.get('/api/workouts/me', requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const logsRes = await client.query(
      'SELECT * FROM workout_logs WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 20',
      [req.user.id]
    );
    const stats = await computeStats(client, req.user.id);
    res.json({
      logs: logsRes.rows.map(row => ({
        id: row.id,
        dayName: row.day_name,
        exerciseCount: row.exercise_count,
        durationMinutes: row.duration_minutes,
        completedAt: row.completed_at,
        planDayId: row.plan_day_id
      })),
      stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching workouts' });
  } finally {
    client?.release();
  }
});

// --- Personal Training Plan Routes ---

app.get('/api/plans/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_plans WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.json({ plan: null });
    }
    const row = result.rows[0];
    res.json({ plan: { id: row.id, name: row.name, days: row.days } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching plan' });
  }
});

app.put('/api/plans/me', requireAuth, async (req, res) => {
  const { name, days } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_plans (user_id, name, days, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET
         name=$2, days=$3, updated_at=now()`,
      [req.user.id, name || 'My Training Plan', JSON.stringify(days || [])]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error saving plan' });
  }
});

// --- Gym Routes ---

// GET All Gyms (with nested zones/annexes)
app.get('/api/gyms', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const gymsRes = await client.query('SELECT * FROM gyms ORDER BY created_at ASC');
    const gyms = gymsRes.rows;

    // Populate children
    // Note: For production, consider using JOINs or JSON_AGG for efficiency
    for (let gym of gyms) {
      const zonesRes = await client.query('SELECT * FROM zones WHERE gym_id = $1', [gym.id]);
      gym.zones = zonesRes.rows;

      const annexRes = await client.query('SELECT * FROM annexes WHERE gym_id = $1', [gym.id]);
      gym.annexes = annexRes.rows;
    }

    res.json(gyms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client?.release();
  }
});

// POST Create Gym
app.post('/api/gyms', requireAdmin, async (req, res) => {
  const { id, name, dimensions, entrance, floorColor, zones, annexes } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(
      'INSERT INTO gyms (id, name, dimensions, entrance, floor_color) VALUES ($1, $2, $3, $4, $5)',
      [id, name, JSON.stringify(dimensions), JSON.stringify(entrance), floorColor]
    );

    // Insert Zones if any provided initially
    if (zones && zones.length > 0) {
      for (const z of zones) {
        await client.query(
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description, machines) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description, JSON.stringify(z.machines || [])]
        );
      }
    }

    // Insert Annexes
    if (annexes && annexes.length > 0) {
      for (const a of annexes) {
         await client.query(
          'INSERT INTO annexes (id, gym_id, x, y, width, height) VALUES ($1, $2, $3, $4, $5, $6)',
          [a.id, id, a.x, a.y, a.width, a.height]
         );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, id });
  } catch (err) {
    try {
      await client?.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error(err);
    res.status(500).json({ error: 'Database error creating gym' });
  } finally {
    client?.release();
  }
});

// PUT Update Gym (Full Save)
app.put('/api/gyms/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, dimensions, entrance, floorColor, zones, annexes } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Update Gym Details (upsert — the gym being "updated" may be the
    // client-side DEFAULT_GYM that was never actually inserted yet)
    await client.query(
      `INSERT INTO gyms (id, name, dimensions, entrance, floor_color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name=$2, dimensions=$3, entrance=$4, floor_color=$5`,
      [id, name, JSON.stringify(dimensions), JSON.stringify(entrance), floorColor]
    );

    // 2. Replace Zones (Delete all and re-insert) — only touch zones if the
    // payload actually included the field, so a request that omits it (a
    // partial update) can't wipe existing data. Send zones: [] to
    // intentionally clear them.
    if (Array.isArray(zones)) {
      await client.query('DELETE FROM zones WHERE gym_id = $1', [id]);
      for (const z of zones) {
        await client.query(
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description, machines) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description, JSON.stringify(z.machines || [])]
        );
      }
    }

    // 3. Replace Annexes (same omit-vs-empty-array distinction as zones)
    if (Array.isArray(annexes)) {
      await client.query('DELETE FROM annexes WHERE gym_id = $1', [id]);
      for (const a of annexes) {
         await client.query(
          'INSERT INTO annexes (id, gym_id, x, y, width, height) VALUES ($1, $2, $3, $4, $5, $6)',
          [a.id, id, a.x, a.y, a.width, a.height]
         );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    try {
      await client?.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error(err);
    res.status(500).json({ error: 'Database error updating gym' });
  } finally {
    client?.release();
  }
});

// DELETE Gym
app.delete('/api/gyms/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM gyms WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Equipment Library Routes ---

// GET All Equipment
app.get('/api/equipment', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM equipment ORDER BY name ASC');
    const equipment = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category || '',
      description: row.description || '',
      icon: row.icon || '',
      imageUrl: row.image_url || '',
      defaultFootprint: row.default_footprint || undefined,
      muscleGroups: row.muscle_groups || []
    }));
    res.json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching equipment' });
  } finally {
    client?.release();
  }
});

// POST Create Equipment
app.post('/api/equipment', requireAdmin, async (req, res) => {
  const { id, name, category, description, icon, imageUrl, defaultFootprint, muscleGroups } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO equipment (id, name, category, description, icon, image_url, default_footprint, muscle_groups) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, category || '', description || '', icon || '', imageUrl || '', JSON.stringify(defaultFootprint || null), JSON.stringify(muscleGroups || [])]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error creating equipment' });
  } finally {
    client?.release();
  }
});

// PUT Update Equipment
app.put('/api/equipment/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, category, description, icon, imageUrl, defaultFootprint, muscleGroups } = req.body;
  let client;
  try {
    client = await pool.connect();
    // Upsert: the item being "updated" may be one of the client-side default
    // items that was never actually inserted into the database yet.
    await client.query(
      `INSERT INTO equipment (id, name, category, description, icon, image_url, default_footprint, muscle_groups)
       VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name=$1, category=$2, description=$3, icon=$4, image_url=$5, default_footprint=$6, muscle_groups=$7`,
      [name, category || '', description || '', icon || '', imageUrl || '', JSON.stringify(defaultFootprint || null), JSON.stringify(muscleGroups || []), id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating equipment' });
  } finally {
    client?.release();
  }
});

// DELETE Equipment
app.delete('/api/equipment/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('DELETE FROM equipment WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting equipment' });
  } finally {
    client?.release();
  }
});

// --- Exercise Library Routes ---

// GET All Exercises
app.get('/api/exercises', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM exercises ORDER BY name ASC');
    // Map database snake_case back to camelCase for the API response
    const exercises = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      targetMuscle: row.target_muscle,
      equipmentRequired: row.equipment_required || '',
      category: row.category || '',
      instructions: row.instructions || '',
      equipmentId: row.equipment_id || '',
      videoUrl: row.video_url || '',
      imageUrl: row.image_url || ''
    }));
    res.json(exercises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching exercises' });
  } finally {
    client?.release();
  }
});

// POST Create Exercise
app.post('/api/exercises', requireAdmin, async (req, res) => {
  const { id, name, targetMuscle, equipmentRequired, category, instructions, equipmentId, videoUrl, imageUrl } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO exercises (id, name, target_muscle, equipment_required, category, instructions, equipment_id, video_url, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        id,
        name,
        targetMuscle || '',
        equipmentRequired || '',
        category || '',
        instructions || '',
        equipmentId || '',
        videoUrl || '',
        imageUrl || ''
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error creating exercise' });
  } finally {
    client?.release();
  }
});

// PUT Update Exercise
app.put('/api/exercises/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, targetMuscle, equipmentRequired, category, instructions, equipmentId, videoUrl, imageUrl } = req.body;
  let client;
  try {
    client = await pool.connect();
    // Upsert: the item being "updated" may be one of the client-side default
    // exercises that was never actually inserted into the database yet.
    await client.query(
      `INSERT INTO exercises (id, name, target_muscle, equipment_required, category, instructions, equipment_id, video_url, image_url)
       VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name=$1, target_muscle=$2, equipment_required=$3, category=$4, instructions=$5, equipment_id=$6, video_url=$7, image_url=$8`,
      [
        name,
        targetMuscle || '',
        equipmentRequired || '',
        category || '',
        instructions || '',
        equipmentId || '',
        videoUrl || '',
        imageUrl || '',
        id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating exercise' });
  } finally {
    client?.release();
  }
});

// DELETE Exercise
app.delete('/api/exercises/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('DELETE FROM exercises WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting exercise' });
  } finally {
    client?.release();
  }
});

// --- Serve built frontend in production ---
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
