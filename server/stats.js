// Streaks are counted in the client's own time zone. In UTC a session at 00:30
// in Tallinn belongs to the previous day, and a run of daily late-evening or
// early-morning sessions reads as broken when it is not.

export const isValidTimeZone = (tz) => {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const timeZoneFromRequest = (req) => {
  const tz = req.cookies?.gyde_tz;
  return isValidTimeZone(tz) ? tz : 'UTC';
};

/** Today's date as YYYY-MM-DD in the given zone. */
export const todayIn = (tz, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const dayNumber = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/**
 * Consecutive days trained, counting back from today — or from yesterday, since
 * someone who has not trained yet today has not broken their streak.
 * `days` are YYYY-MM-DD strings, newest first.
 */
export const computeStreak = (days, today) => {
  let streak = 0;
  let cursor = dayNumber(today);
  for (const d of days || []) {
    const gap = cursor - dayNumber(d);
    if (gap === 0 || gap === 1) {
      streak += 1;
      cursor = dayNumber(d);
    } else if (gap < 0) {
      // A session dated after "today" (a clock a moment ahead): skip it rather
      // than let it end the count.
      continue;
    } else {
      break;
    }
  }
  return streak;
};
