
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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
