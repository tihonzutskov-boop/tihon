import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import {
  generateFullProgramFromPreferences,
  generateExercisesForEquipment,
  generateProgramAnalysis,
  parseFloorPlan,
} from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gym_cartographer'
});

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

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// --- Auth Routes ---

// Login (Passwordless)
app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  let client;

  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Note: Password check removed for demo/guest access

    const { password_hash, ...userProfile } = user;

    // Add mock stats
    userProfile.stats = {
       workoutsCompleted: 12,
       totalMinutes: 480,
       streakDays: 3
    };

    res.json({ user: userProfile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client?.release();
  }
});

// Signup (Passwordless)
app.post('/api/signup', async (req, res) => {
  const { name, email } = req.body;
  let client;

  try {
    client = await pool.connect();
    // Check if user exists
    const check = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Insert new user
    // Store dummy password string since column likely expects it
    const dummyPassword = 'nopassword';

    const result = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, dummyPassword, 'user']
    );

    const newUser = result.rows[0];
    const { password_hash, ...userProfile } = newUser;

    userProfile.stats = { workoutsCompleted: 0, totalMinutes: 0, streakDays: 0 };

    res.json({ user: userProfile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client?.release();
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
app.post('/api/gyms', async (req, res) => {
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
    await client?.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client?.release();
  }
});

// PUT Update Gym (Full Save)
app.put('/api/gyms/:id', async (req, res) => {
  const { id } = req.params;
  const { name, dimensions, entrance, floorColor, zones, annexes } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Update Gym Details
    await client.query(
      'UPDATE gyms SET name=$2, dimensions=$3, entrance=$4, floor_color=$5 WHERE id=$1',
      [id, name, JSON.stringify(dimensions), JSON.stringify(entrance), floorColor]
    );

    // 2. Replace Zones (Delete all and re-insert)
    await client.query('DELETE FROM zones WHERE gym_id = $1', [id]);
    if (zones && zones.length > 0) {
      for (const z of zones) {
        await client.query(
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description, machines) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description, JSON.stringify(z.machines || [])]
        );
      }
    }

    // 3. Replace Annexes
    await client.query('DELETE FROM annexes WHERE gym_id = $1', [id]);
    if (annexes && annexes.length > 0) {
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
    await client?.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client?.release();
  }
});

// DELETE Gym
app.delete('/api/gyms/:id', async (req, res) => {
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
      isFloorSpace: row.is_floor_space || false
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
app.post('/api/equipment', async (req, res) => {
  const { id, name, category, description, icon, imageUrl, defaultFootprint, isFloorSpace } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO equipment (id, name, category, description, icon, image_url, default_footprint, is_floor_space) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, category || '', description || '', icon || '', imageUrl || '', JSON.stringify(defaultFootprint || null), !!isFloorSpace]
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
app.put('/api/equipment/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, description, icon, imageUrl, defaultFootprint, isFloorSpace } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'UPDATE equipment SET name=$1, category=$2, description=$3, icon=$4, image_url=$5, default_footprint=$6, is_floor_space=$7 WHERE id=$8',
      [name, category || '', description || '', icon || '', imageUrl || '', JSON.stringify(defaultFootprint || null), !!isFloorSpace, id]
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
app.delete('/api/equipment/:id', async (req, res) => {
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
app.post('/api/exercises', async (req, res) => {
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
app.put('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;
  const { name, targetMuscle, equipmentRequired, category, instructions, equipmentId, videoUrl, imageUrl } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'UPDATE exercises SET name=$1, target_muscle=$2, equipment_required=$3, category=$4, instructions=$5, equipment_id=$6, video_url=$7, image_url=$8 WHERE id=$9',
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
app.delete('/api/exercises/:id', async (req, res) => {
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

// --- Gemini AI Routes ---
// The Gemini API key lives only on the server; the frontend never sees it.

app.post('/api/gemini/full-program', async (req, res) => {
  const { preferences, zones, lang } = req.body;
  try {
    const days = await generateFullProgramFromPreferences(preferences, zones, lang);
    res.json({ days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gemini request failed', days: [] });
  }
});

app.post('/api/gemini/exercises-for-equipment', async (req, res) => {
  const { equipmentName, goal, lang } = req.body;
  try {
    const exercises = await generateExercisesForEquipment(equipmentName, goal, lang);
    res.json({ exercises });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gemini request failed', exercises: [] });
  }
});

app.post('/api/gemini/program-analysis', async (req, res) => {
  const { exercises, lang } = req.body;
  try {
    const analysis = await generateProgramAnalysis(exercises, lang);
    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gemini request failed', analysis: 'Error analyzing program.' });
  }
});

app.post('/api/gemini/parse-floor-plan', async (req, res) => {
  const { base64Data, fileType } = req.body;
  try {
    const plan = await parseFloorPlan(base64Data, fileType);
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gemini request failed' });
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
