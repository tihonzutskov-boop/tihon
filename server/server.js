
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

// --- Routes ---

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
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description]
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
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description]
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
