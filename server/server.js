
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3001;

// Database Connection
// Ensure you have a .env file or set these variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gym_cartographer'
});

// Self-initializing exercises table checking
const initDb = async () => {
  try {
    const client = pool ? await pool.connect() : null;
    if (!client) return;
    
    // Create the updated structure of 'exercises' table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        target_muscle VARCHAR(255) NOT NULL,
        equipment_required VARCHAR(255),
        category VARCHAR(150),
        instructions TEXT,
        equipment_id VARCHAR(100),
        video_url VARCHAR(255),
        image_url VARCHAR(255)
      )
    `);

    // Check mapping details of existing database cols for backward compatibility and migration
    const res = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'exercises'
    `);
    const cols = res.rows.map(r => r.column_name.toLowerCase());

    // Progressively alter existing tables when they lack the required columns
    if (!cols.includes('equipment_required')) {
      await client.query(`ALTER TABLE exercises ADD COLUMN equipment_required VARCHAR(255)`);
    }
    if (!cols.includes('category')) {
      await client.query(`ALTER TABLE exercises ADD COLUMN category VARCHAR(150)`);
    }
    if (!cols.includes('instructions')) {
      await client.query(`ALTER TABLE exercises ADD COLUMN instructions TEXT`);
      // Migrate old notes/sets/reps descriptions to instructions if instructions is currently null
      if (cols.includes('notes')) {
        await client.query(`UPDATE exercises SET instructions = notes WHERE instructions IS NULL`);
      }
    }
    if (!cols.includes('image_url')) {
      await client.query(`ALTER TABLE exercises ADD COLUMN image_url VARCHAR(255)`);
    }

    client.release();
    console.log("Database schema active: 'exercises' checked/initialized with updated columns.");
  } catch (err) {
    console.warn("Database initialization postponed (Postgres connection unavailable yet):", err.message);
  }
};
initDb();

app.use(cors());
app.use(express.json());

// --- Auth Routes ---

// Login (Passwordless)
app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  const client = await pool.connect();
  
  try {
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
    client.release();
  }
});

// Signup (Passwordless)
app.post('/api/signup', async (req, res) => {
  const { name, email } = req.body;
  const client = await pool.connect();

  try {
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
    client.release();
  }
});

// --- Gym Routes ---

// GET All Gyms (with nested zones/annexes)
app.get('/api/gyms', async (req, res) => {
  const client = await pool.connect();
  try {
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
    client.release();
  }
});

// POST Create Gym
app.post('/api/gyms', async (req, res) => {
  const { id, name, dimensions, entrance, floorColor, zones, annexes } = req.body;
  const client = await pool.connect();
  
  try {
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
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT Update Gym (Full Save)
app.put('/api/gyms/:id', async (req, res) => {
  const { id } = req.params;
  const { name, dimensions, entrance, floorColor, zones, annexes } = req.body;
  const client = await pool.connect();

  try {
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
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

// --- Exercise Library Routes ---

// GET All Exercises
app.get('/api/exercises', async (req, res) => {
  const client = await pool.connect();
  try {
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
    client.release();
  }
});

// POST Create Exercise
app.post('/api/exercises', async (req, res) => {
  const { id, name, targetMuscle, equipmentRequired, category, instructions, equipmentId, videoUrl, imageUrl } = req.body;
  const client = await pool.connect();
  try {
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
    client.release();
  }
});

// PUT Update Exercise
app.put('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;
  const { name, targetMuscle, equipmentRequired, category, instructions, equipmentId, videoUrl, imageUrl } = req.body;
  const client = await pool.connect();
  try {
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
    client.release();
  }
});

// DELETE Exercise
app.delete('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM exercises WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting exercise' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
