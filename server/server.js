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
import { mediaUrl, sendDataUri, serveMediaColumn, serveBinaryColumn, blobWrite } from './media.js';
// Compiled from utils/planGeneration.ts by `npm run build:engine` — the same
// engine the frontend and the test suite use, so there is exactly one
// implementation of the eligibility and safety rules.
import { generatePlan, validatePlan, buildDefaultBlueprint } from './generated/utils/planGeneration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gym_cartographer'
});
const requireAdmin = createRequireAdmin(pool);

// node-postgres emits 'error' on the pool when an *idle* connection dies —
// a database restart, an idle timeout, a network blip. On an EventEmitter an
// unhandled 'error' event is rethrown, which takes the whole process down
// with exit code 1 even though every in-flight request was fine. The pool
// discards the dead client and reconnects on its own, so logging is the
// correct response here, not crashing.
pool.on('error', (err) => {
  console.error('Idle Postgres client error (pool will reconnect):', err.message);
});

// The handler above only covers clients sitting *idle* in the pool. A client
// checked out with pool.connect() belongs to the caller, and the pool drops
// its own listener for as long as it is out — so if that connection dies
// mid-checkout the 'error' event has nobody listening, Node rethrows it as an
// uncaught exception, and the whole process exits with code 1. It arrives as
// an event rather than a rejected promise, so the try/catch around the
// queries cannot see it. This fires once per newly connected client and the
// listener outlives every checkout, so the dropped connection surfaces as a
// failed query on that one request — the pool discards the client and
// reconnects — instead of taking the gym offline.
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Postgres client error (connection dropped):', err.message);
  });
});

// The free tier drops idle Postgres connections, so the first query after a
// quiet spell can find the socket already gone. The pool reconnects on its
// own, but whichever request was in flight has still failed — which is what
// makes the gym intermittently fail to load. Retry that query once on a fresh
// connection, but only when it is a read: after a dropped connection there is
// no way to tell whether an INSERT/UPDATE committed before the socket died,
// and a statement belonging to a BEGIN/COMMIT block cannot be replayed on its
// own anyway. Writes still surface the error to the caller. This only covers
// pool.query(); the routes that check a client out to run a transaction are
// deliberately left alone.
const CONNECTION_LOST = /Connection terminated|terminating connection|server closed the connection|ECONNRESET|EPIPE/i;
const isReadOnlySql = (sql) => typeof sql === 'string' && /^\s*select\b/i.test(sql);

const runPoolQuery = pool.query.bind(pool);
pool.query = (...args) => {
  const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
  // pg also accepts a callback form; only the promise form is retried.
  const usesCallback = args.some((arg) => typeof arg === 'function');
  if (usesCallback || !isReadOnlySql(sql)) return runPoolQuery(...args);
  return runPoolQuery(...args).catch((err) => {
    if (!CONNECTION_LOST.test(err?.message || '')) throw err;
    console.warn('Read lost its connection, retrying once:', err.message);
    return runPoolQuery(...args);
  });
};

// One rejected promise in a single route should not take the gym offline.
// Node exits with code 1 on an unhandled rejection by default; log it loudly
// instead so the request fails alone and the service stays up.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
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

app.use(cookieParser());
// Sized against the 512MB instance, not against how long a video an admin
// might want. Express buffers the raw body, then the UTF-16 string, then the
// parsed object, so a body of N MB costs roughly 5N MB of heap at peak: 60mb
// alone could exhaust the instance and get it OOM-killed (exit 137). 12mb of
// base64 is about a 9MB source file — enough for a short demo clip.
// Raising this only becomes safe on a larger instance; the real fix for long
// videos is uploading to object storage instead of embedding base64 in JSON.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '12mb' }));

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

// --- Training Questionnaire Routes ---

app.get('/api/questionnaire/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT answers FROM training_questionnaires WHERE user_id = $1', [req.user.id]);
    res.json({ answers: result.rows[0]?.answers || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching questionnaire' });
  }
});

// Keyed by day COUNT, not the user's requested daysPerWeek — the matched
// template can have a different day count than what the user asked for
// (the fallback match below accepts any template for the goal when no
// exact days-per-week variant exists), and spreading by the user's answer
// instead of the template's actual day count silently drops days past
// spread.length or leaves extra requested days empty.
const WEEKDAY_SPREADS = {
  1: ['wed'],
  2: ['tue', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'thu', 'fri'],
  6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  7: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
};
const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Spreads a template's days across the week, preferring the days the user
// actually picked (kept in calendar order regardless of click order) when
// they cover the day count, otherwise falling back to the generic spread
// for that count. When existingDays is passed — resyncing an already-
// assigned plan after the coach edited the template — each day's own id
// and weekday are carried over wherever the template still has a day at
// that index, so a trainee's calendar placement (and anything keyed off
// that day id) isn't disturbed just because the exercises changed; only
// genuinely new days (the template grew) get freshly generated ones.
const assignWeekdaysToTemplateDays = (templateDays, preferredDays, existingDays) => {
  const dayCount = Math.min(Math.max(templateDays.length, 1), 7);
  const userDays = Array.isArray(preferredDays)
    ? WEEKDAY_ORDER.filter(d => preferredDays.includes(d))
    : [];
  const spread = userDays.length >= dayCount ? userDays.slice(0, dayCount) : (WEEKDAY_SPREADS[dayCount] || []);
  return templateDays.map((d, i) => {
    const existing = existingDays?.[i];
    return { ...d, id: existing?.id || `day-${Date.now()}-${i}`, weekday: existing?.weekday || spread[i] };
  });
};

// The questionnaire stores display strings ('60 min', 'Beginner'); the engine
// wants structured values. Normalizing in one place keeps raw questionnaire
// text out of the generation rules entirely.
const GENERATION_INJURY_AREAS = ['Back', 'Knees', 'Shoulders', 'Neck', 'Wrists', 'Hips', 'Ankles'];
const buildGenerationProfile = (answers, goal) => ({
  goal,
  experience: ['Beginner', 'Intermediate', 'Advanced'].includes(answers.level) ? answers.level : 'Beginner',
  daysPerWeek: parseInt(answers.daysPerWeek, 10) || 1,
  sessionMinutes: parseInt(String(answers.minutesPerSession || '').replace(/[^0-9]/g, ''), 10) || 45,
  // Only recognized areas reach the engine — an unrecognized value would
  // otherwise silently match nothing and behave as "no injury".
  injuryAreas: (answers.injuryAreas || []).filter(a => GENERATION_INJURY_AREAS.includes(a)),
});

// Loads the gym the plan is being generated against, with its zones — the
// zones' equipmentIds are what the eligibility filter reads.
const loadGymForGeneration = async (gymId) => {
  const gymRes = await pool.query('SELECT * FROM gyms WHERE id = $1', [gymId]);
  if (gymRes.rows.length === 0) return null;
  const zonesRes = await pool.query('SELECT * FROM zones WHERE gym_id = $1', [gymId]);
  return {
    id: gymRes.rows[0].id,
    name: gymRes.rows[0].name,
    zones: zonesRes.rows.map(z => ({
      id: z.id, name: z.name, type: z.type, x: z.x, y: z.y, width: z.width, height: z.height,
      color: z.color, icon: z.icon, equipmentIds: z.equipment_ids || [],
    })),
  };
};

const loadLibraryForGeneration = async () => {
  // Explicit column list: the generator needs none of the media columns, and
  // SELECT * pulled every base64 blob into memory just to drop it here.
  const result = await pool.query(
    `SELECT id, name, target_muscle, equipment_required, required_equipment_ids,
            category, instructions, equipment_id, movement_pattern,
            exercise_category, min_experience, joint_stress,
            primary_muscles, secondary_muscles, generation_enabled
     FROM exercises`
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    targetMuscle: row.target_muscle || '',
    equipmentRequired: row.equipment_required || '',
    requiredEquipmentIds: row.required_equipment_ids || [],
    category: row.category || '',
    instructions: row.instructions || '',
    equipmentId: row.equipment_id || '',
    movementPattern: row.movement_pattern || undefined,
    exerciseCategory: row.exercise_category || undefined,
    minExperience: row.min_experience || undefined,
    jointStress: row.joint_stress || [],
    primaryMuscles: row.primary_muscles || [],
    secondaryMuscles: row.secondary_muscles || [],
    generationEnabled: row.generation_enabled === true,
  }));
};

const recordGenerationFailure = async (userId, templateId, gymId, reason, detail) => {
  await pool.query(
    'INSERT INTO generation_failures (user_id, template_id, gym_id, reason, detail) VALUES ($1, $2, $3, $4, $5)',
    [userId, templateId || null, gymId || null, reason, detail || null]
  );
};

app.put('/api/questionnaire/me', requireAuth, async (req, res) => {
  const { answers } = req.body;
  try {
    await pool.query(
      `INSERT INTO training_questionnaires (user_id, answers, submitted_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET answers=$2, submitted_at=now()`,
      [req.user.id, JSON.stringify(answers)]
    );

    // Auto-assign a matching plan template, if one exists, so the user
    // sees a real weekly schedule immediately rather than waiting on an
    // admin to hand-build one.
    let assignedPlan = false;
    const goals = answers.goals || [];
    if (goals.length > 0) {
      // Without an ORDER BY, Postgres doesn't guarantee row order — if more
      // than one template shares a goal, .find() below would pick whichever
      // one the scan happened to return first, not necessarily the one the
      // admin actually intends (e.g. the one they just edited). Newest
      // first is at least deterministic and favors the actively-maintained
      // template over an old leftover.
      const candidates = await pool.query(
        'SELECT * FROM plan_templates WHERE goal = ANY($1::text[]) ORDER BY created_at DESC',
        [goals]
      );
      let match = null;
      for (const goal of goals) {
        const forGoal = candidates.rows.filter(t => t.goal === goal);
        if (forGoal.length === 0) continue;
        // No template covers the exact days/week the client asked for —
        // pick whichever comes closest instead of an arbitrary one, so a
        // client wanting 4 days/week doesn't get silently matched to some
        // unrelated 1-day template just because it happened to be newest.
        // Ties keep candidates' current (newest-first) order.
        const requested = parseInt(answers.daysPerWeek, 10);
        match = forGoal.find(t => t.days_per_week === answers.daysPerWeek)
          || forGoal.reduce((best, t) => {
            const diff = Math.abs(parseInt(t.days_per_week, 10) - requested);
            const bestDiff = Math.abs(parseInt(best.days_per_week, 10) - requested);
            return diff < bestDiff ? t : best;
          }, forGoal[0]);
        if (match) break;
      }
      const gymId = answers.gymId || null;
      const goalForPlan = match ? match.goal : (goals[0] || 'General fitness');
      const profile = buildGenerationProfile(answers, goalForPlan);

      let planDays = null;
      let generationMeta = null;
      let planName = match ? match.name : `${goalForPlan} — ${profile.daysPerWeek} Day Plan`;

      // A fixed template an admin actually filled in is a deliberate choice —
      // use it as-is rather than generating over the top of it. Generation is
      // the path for everyone else, which is most clients.
      const hasAuthoredFixedDays = match && Array.isArray(match.days)
        && match.days.some(d => (d.exercises || []).length > 0);

      const gym = hasAuthoredFixedDays ? null : (gymId ? await loadGymForGeneration(gymId) : null);

      if (hasAuthoredFixedDays) {
        planDays = assignWeekdaysToTemplateDays(match.days, answers.preferredDays, null);
      } else if (!gym) {
        await recordGenerationFailure(req.user.id, match?.id || null, gymId, 'no_gym',
          'No gym selected, so available equipment could not be determined');
      } else {
        // The matcher picks the *closest* days-per-week, not an exact one, so
        // an admin blueprint can carry a different day count than the client
        // committed to. Generating from it then fails validation on the day
        // count and the client gets nothing, so fall back to the default
        // blueprint, which is always built for the requested number of days.
        const authored = Array.isArray(match?.blueprint_days) && match.blueprint_days.length > 0
          ? match.blueprint_days
          : null;
        const adminBlueprint = authored && authored.length === profile.daysPerWeek ? authored : null;
        const blueprintDays = adminBlueprint || buildDefaultBlueprint(goalForPlan, profile.daysPerWeek);

        const library = await loadLibraryForGeneration();
        const result = generatePlan(
          {
            id: match?.id || 'default',
            name: planName,
            goal: goalForPlan,
            daysPerWeek: String(profile.daysPerWeek),
            durationMin: match?.duration_min || profile.sessionMinutes,
            days: [],
            blueprintDays,
          },
          library, gym, profile
        );

        if (!result.ok) {
          await recordGenerationFailure(req.user.id, match?.id || null, gymId, result.reason, result.detail);
        } else {
          // Validate independently of the selection step — a plan that fails
          // here is never delivered, it goes to admin review.
          const check = validatePlan(result.days, library, gym, profile);
          if (!check.valid) {
            await recordGenerationFailure(req.user.id, match?.id || null, gymId, 'validation_failed',
              check.errors.join('; '));
          } else {
            planDays = assignWeekdaysToTemplateDays(result.days, answers.preferredDays, null);
            generationMeta = {
              generatedAt: new Date().toISOString(),
              source: adminBlueprint ? 'blueprint' : 'default_blueprint',
              templateId: match?.id || null,
              gymId,
              decisions: result.decisions,
            };
          }
        }
      }

      if (planDays) {
        await pool.query(
          `INSERT INTO user_plans (user_id, name, days, source_template_id, generated_for_gym_id, generation_meta, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (user_id) DO UPDATE SET name=$2, days=$3, source_template_id=$4, generated_for_gym_id=$5, generation_meta=$6, updated_at=now()`,
          [req.user.id, planName, JSON.stringify(planDays), match?.id || null, gymId,
           generationMeta ? JSON.stringify(generationMeta) : null]
        );
        assignedPlan = true;
      }
    }

    res.json({ success: true, assignedPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error saving questionnaire' });
  }
});

// Generation failures awaiting admin review. The engine deliberately fails
// closed rather than delivering a questionable plan, so this is where those
// cases surface instead of being silently swallowed.
app.get('/api/coaching/generation-failures', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT gf.*, u.name AS user_name, u.email AS user_email
      FROM generation_failures gf
      JOIN users u ON u.id = gf.user_id
      WHERE gf.resolved = false
      ORDER BY gf.created_at DESC
      LIMIT 100
    `);
    res.json({
      failures: result.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        templateId: r.template_id,
        gymId: r.gym_id,
        reason: r.reason,
        detail: r.detail,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching generation failures' });
  }
});

app.put('/api/coaching/generation-failures/:id/resolve', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE generation_failures SET resolved = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error resolving generation failure' });
  }
});

// Read-only roster so an admin can see which real users matched a catalog
// template (and which didn't) — LEFT JOIN keeps users who submitted the
// questionnaire but have no plan yet.
app.get('/api/coaching/clients', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id AS user_id, u.name, u.email, u.avatar_url,
             tq.answers, tq.submitted_at,
             up.name AS plan_name, up.days AS plan_days
      FROM training_questionnaires tq
      JOIN users u ON u.id = tq.user_id
      LEFT JOIN user_plans up ON up.user_id = tq.user_id
      ORDER BY tq.submitted_at DESC
    `);
    res.json({
      clients: result.rows.map(r => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        answers: r.answers,
        submittedAt: r.submitted_at,
        plan: r.plan_days ? { name: r.plan_name, days: r.plan_days } : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching clients' });
  }
});

// Clears a client's questionnaire and any assigned plan, so they see a
// fresh "Let's build your training plan" prompt and get freshly re-matched
// on resubmission — e.g. to pick up a template the admin fixed after the
// client was already (mis)assigned an earlier, broken version of it.
app.delete('/api/coaching/clients/:userId/questionnaire', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM training_questionnaires WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_plans WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client?.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database error resetting questionnaire' });
  } finally {
    client?.release();
  }
});

// --- Plan Template Catalog Routes ---

app.get('/api/plan-templates', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plan_templates ORDER BY created_at DESC');
    res.json({
      templates: result.rows.map(r => ({
        id: r.id, name: r.name, goal: r.goal, daysPerWeek: r.days_per_week, durationMin: r.duration_min, days: r.days,
        blueprintDays: r.blueprint_days || undefined,
        minExperience: r.min_experience || undefined,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching plan templates' });
  }
});

app.post('/api/plan-templates', requireAdmin, async (req, res) => {
  const { id, name, goal, daysPerWeek, durationMin, days, blueprintDays, minExperience } = req.body;
  try {
    await pool.query(
      'INSERT INTO plan_templates (id, name, goal, days_per_week, duration_min, days, blueprint_days, min_experience) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, goal, daysPerWeek, durationMin || 45, JSON.stringify(days || []),
       blueprintDays ? JSON.stringify(blueprintDays) : null, minExperience || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error creating plan template' });
  }
});

app.put('/api/plan-templates/:id', requireAdmin, async (req, res) => {
  const { name, goal, daysPerWeek, durationMin, days, blueprintDays, minExperience } = req.body;
  const templateDays = days || [];
  try {
    await pool.query(
      `INSERT INTO plan_templates (id, name, goal, days_per_week, duration_min, days, blueprint_days, min_experience)
       VALUES ($6, $1, $2, $3, $4, $5, $7, $8)
       ON CONFLICT (id) DO UPDATE SET name=$1, goal=$2, days_per_week=$3, duration_min=$4, days=$5, blueprint_days=$7, min_experience=$8`,
      [name, goal, daysPerWeek, durationMin || 45, JSON.stringify(templateDays), req.params.id,
       blueprintDays ? JSON.stringify(blueprintDays) : null, minExperience || null]
    );

    // Push this edit to every client whose plan was assigned from this
    // template, so adding/changing an exercise here doesn't leave already-
    // matched clients stuck looking at a stale snapshot from whenever they
    // first submitted their questionnaire.
    const dependents = await pool.query(
      `SELECT up.user_id, up.days, tq.answers->'preferredDays' AS preferred_days
       FROM user_plans up
       LEFT JOIN training_questionnaires tq ON tq.user_id = up.user_id
       WHERE up.source_template_id = $1`,
      [req.params.id]
    );
    for (const row of dependents.rows) {
      const resyncedDays = assignWeekdaysToTemplateDays(templateDays, row.preferred_days, row.days);
      await pool.query(
        `UPDATE user_plans SET name = $1, days = $2, updated_at = now() WHERE user_id = $3`,
        [name, JSON.stringify(resyncedDays), row.user_id]
      );
    }

    res.json({ success: true, syncedClients: dependents.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error saving plan template' });
  }
});

app.delete('/api/plan-templates/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM plan_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting plan template' });
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
      // equipment_ids is snake_case in the DB but the client (and the
      // generation engine) read equipmentIds.
      gym.zones = zonesRes.rows.map(z => ({ ...z, equipmentIds: z.equipment_ids || [] }));

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
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description, machines, equipment_ids) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description, JSON.stringify(z.machines || []), JSON.stringify(z.equipmentIds || [])]
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
          'INSERT INTO zones (id, gym_id, name, type, x, y, width, height, color, icon, description, machines, equipment_ids) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
          [z.id, id, z.name, z.type, z.x, z.y, z.width, z.height, z.color, z.icon, z.description, JSON.stringify(z.machines || []), JSON.stringify(z.equipmentIds || [])]
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
    const result = await client.query(
      `SELECT id, name, category, description, icon, default_footprint, muscle_groups,
              CASE WHEN image_url <> '' THEN substr(md5(image_url), 1, 8) END AS image_v
       FROM equipment ORDER BY name ASC`
    );
    const equipment = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category || '',
      description: row.description || '',
      icon: row.icon || '',
      imageUrl: row.image_v ? mediaUrl('equipment', `${row.id}/image`, row.image_v) : '',
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
      [id, name, category || '', description || '', icon || '', blobWrite(imageUrl) || '', JSON.stringify(defaultFootprint || null), JSON.stringify(muscleGroups || [])]
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
       VALUES ($8, $1, $2, $3, $4, COALESCE($5::text, ''), $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name=$1, category=$2, description=$3, icon=$4,
         image_url=COALESCE($5::text, equipment.image_url),
         default_footprint=$6, muscle_groups=$7`,
      [name, category || '', description || '', icon || '', blobWrite(imageUrl), JSON.stringify(defaultFootprint || null), JSON.stringify(muscleGroups || []), id]
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

app.get('/api/equipment/:id/image', serveMediaColumn(pool, 'equipment', 'image_url'));

// --- Exercise Library Routes ---

// GET All Exercises
app.get('/api/exercises', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, name, target_muscle, equipment_required, required_equipment_ids,
              category, instructions, equipment_id, video_url, make_harder, make_easier,
              tutorial_video_file_name, steps, exercise_type, video_duration_label,
              harder_exercise_id, easier_exercise_id, harder_tutorial, easier_tutorial,
              movement_pattern, exercise_category, min_experience, joint_stress,
              primary_muscles, secondary_muscles, generation_enabled,
              CASE WHEN image_url <> '' THEN substr(md5(image_url), 1, 8) END AS image_v,
              CASE
                WHEN tutorial_video IS NOT NULL
                  THEN substr(md5(encode(tutorial_video, 'hex')), 1, 8)
                WHEN tutorial_video_url <> ''
                  THEN substr(md5(tutorial_video_url), 1, 8)
              END AS tutorial_v
       FROM exercises ORDER BY name ASC`
    );
    // Map database snake_case back to camelCase for the API response
    const exercises = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      targetMuscle: row.target_muscle,
      equipmentRequired: row.equipment_required || '',
      requiredEquipmentIds: row.required_equipment_ids || [],
      category: row.category || '',
      instructions: row.instructions || '',
      equipmentId: row.equipment_id || '',
      videoUrl: row.video_url || '',
      imageUrl: row.image_v ? mediaUrl('exercises', `${row.id}/image`, row.image_v) : '',
      makeHarder: row.make_harder || '',
      makeEasier: row.make_easier || '',
      tutorialVideoUrl: row.tutorial_v
        ? mediaUrl('exercises', `${row.id}/tutorial-video`, row.tutorial_v)
        : '',
      tutorialVideoFileName: row.tutorial_video_file_name || '',
      steps: row.steps || [],
      exerciseType: row.exercise_type || 'standard',
      videoDurationLabel: row.video_duration_label || '',
      harderExerciseId: row.harder_exercise_id || '',
      easierExerciseId: row.easier_exercise_id || '',
      harderTutorial: row.harder_tutorial || {},
      easierTutorial: row.easier_tutorial || {},
      movementPattern: row.movement_pattern || undefined,
      exerciseCategory: row.exercise_category || undefined,
      minExperience: row.min_experience || undefined,
      jointStress: row.joint_stress || [],
      primaryMuscles: row.primary_muscles || [],
      secondaryMuscles: row.secondary_muscles || [],
      generationEnabled: row.generation_enabled === true
    }));
    res.json(exercises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching exercises' });
  } finally {
    client?.release();
  }
});

app.get('/api/exercises/:id/image', serveMediaColumn(pool, 'exercises', 'image_url'));
app.get(
  '/api/exercises/:id/tutorial-video',
  serveBinaryColumn(pool, 'exercises', 'tutorial_video', 'tutorial_video_type', 'tutorial_video_url')
);

// Raw-body upload: the video never passes through JSON, so it is not subject
// to the JSON body limit and is stored exactly as uploaded — no base64, no
// re-encoding, no quality ceiling imposed by the transport.
app.put(
  '/api/exercises/:id/tutorial-video',
  requireAdmin,
  express.raw({ type: () => true, limit: process.env.VIDEO_UPLOAD_LIMIT || '200mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Empty upload' });
    }
    const contentType = (req.get('Content-Type') || 'video/mp4').split(';')[0].trim();
    if (!contentType.startsWith('video/')) {
      return res.status(415).json({ error: 'Expected a video file' });
    }
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `UPDATE exercises
            SET tutorial_video = $2, tutorial_video_type = $3, tutorial_video_url = ''
          WHERE id = $1
        RETURNING substr(md5(encode(tutorial_video, 'hex')), 1, 8) AS v`,
        [req.params.id, req.body, contentType]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
      return res.json({
        success: true,
        tutorialVideoUrl: mediaUrl('exercises', `${req.params.id}/tutorial-video`, result.rows[0].v),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error saving video' });
    } finally {
      client?.release();
    }
  }
);

app.delete('/api/exercises/:id/tutorial-video', requireAdmin, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `UPDATE exercises SET tutorial_video = NULL, tutorial_video_type = NULL, tutorial_video_url = '' WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error removing video' });
  } finally {
    client?.release();
  }
});

// POST Create Exercise
app.post('/api/exercises', requireAdmin, async (req, res) => {
  const { id, name, targetMuscle, equipmentRequired, requiredEquipmentIds, category, instructions, equipmentId, videoUrl, imageUrl, makeHarder, makeEasier, tutorialVideoUrl, tutorialVideoFileName, steps, exerciseType, videoDurationLabel, harderExerciseId, easierExerciseId, harderTutorial, easierTutorial, movementPattern, exerciseCategory, minExperience, jointStress, primaryMuscles, secondaryMuscles, generationEnabled } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO exercises (id, name, target_muscle, equipment_required, required_equipment_ids, category, instructions, equipment_id, video_url, image_url, make_harder, make_easier, tutorial_video_url, tutorial_video_file_name, steps, exercise_type, video_duration_label, harder_exercise_id, easier_exercise_id, harder_tutorial, easier_tutorial, movement_pattern, exercise_category, min_experience, joint_stress, generation_enabled, primary_muscles, secondary_muscles) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)',
      [
        id,
        name,
        targetMuscle || '',
        equipmentRequired || '',
        JSON.stringify(requiredEquipmentIds || []),
        category || '',
        instructions || '',
        equipmentId || '',
        videoUrl || '',
        blobWrite(imageUrl),
        makeHarder || '',
        makeEasier || '',
        blobWrite(tutorialVideoUrl),
        tutorialVideoFileName || '',
        JSON.stringify(steps || []),
        exerciseType || 'standard',
        videoDurationLabel || '',
        harderExerciseId || '',
        easierExerciseId || '',
        JSON.stringify(harderTutorial || {}),
        JSON.stringify(easierTutorial || {}),
        movementPattern || null,
        exerciseCategory || null,
        minExperience || null,
        JSON.stringify(jointStress || []),
        generationEnabled === true,
        JSON.stringify(primaryMuscles || []),
        JSON.stringify(secondaryMuscles || [])
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
  const { name, targetMuscle, equipmentRequired, requiredEquipmentIds, category, instructions, equipmentId, videoUrl, imageUrl, makeHarder, makeEasier, tutorialVideoUrl, tutorialVideoFileName, steps, exerciseType, videoDurationLabel, harderExerciseId, easierExerciseId, harderTutorial, easierTutorial, movementPattern, exerciseCategory, minExperience, jointStress, primaryMuscles, secondaryMuscles, generationEnabled } = req.body;
  let client;
  try {
    client = await pool.connect();
    // Upsert: the item being "updated" may be one of the client-side default
    // exercises that was never actually inserted into the database yet.
    await client.query(
      `INSERT INTO exercises (id, name, target_muscle, equipment_required, required_equipment_ids, category, instructions, equipment_id, video_url, image_url, make_harder, make_easier, tutorial_video_url, tutorial_video_file_name, steps, exercise_type, video_duration_label, harder_exercise_id, easier_exercise_id, harder_tutorial, easier_tutorial, movement_pattern, exercise_category, min_experience, joint_stress, generation_enabled, primary_muscles, secondary_muscles)
       VALUES ($28, $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::text, ''), $10, $11, COALESCE($12::text, ''), $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
       ON CONFLICT (id) DO UPDATE SET
         name=$1, target_muscle=$2, equipment_required=$3, required_equipment_ids=$4, category=$5, instructions=$6, equipment_id=$7, video_url=$8,
         image_url=COALESCE($9::text, exercises.image_url),
         make_harder=$10, make_easier=$11,
         tutorial_video_url=COALESCE($12::text, exercises.tutorial_video_url),
         tutorial_video_file_name=$13, steps=$14, exercise_type=$15, video_duration_label=$16, harder_exercise_id=$17, easier_exercise_id=$18, harder_tutorial=$19, easier_tutorial=$20, movement_pattern=$21, exercise_category=$22, min_experience=$23, joint_stress=$24, generation_enabled=$25, primary_muscles=$26, secondary_muscles=$27`,
      [
        name,
        targetMuscle || '',
        equipmentRequired || '',
        JSON.stringify(requiredEquipmentIds || []),
        category || '',
        instructions || '',
        equipmentId || '',
        videoUrl || '',
        blobWrite(imageUrl),
        makeHarder || '',
        makeEasier || '',
        blobWrite(tutorialVideoUrl),
        tutorialVideoFileName || '',
        JSON.stringify(steps || []),
        exerciseType || 'standard',
        videoDurationLabel || '',
        harderExerciseId || '',
        easierExerciseId || '',
        JSON.stringify(harderTutorial || {}),
        JSON.stringify(easierTutorial || {}),
        movementPattern || null,
        exerciseCategory || null,
        minExperience || null,
        JSON.stringify(jointStress || []),
        generationEnabled === true,
        JSON.stringify(primaryMuscles || []),
        JSON.stringify(secondaryMuscles || []),
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
