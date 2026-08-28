/* Whether the training is going anywhere.
 *
 * WHOOP already answers how hard a session was and how well the body took it.
 * Neither of those says whether the bench press went up, and for anyone who
 * lifts that is the whole point of keeping a log.
 *
 * A workout carries sets: an exercise, a weight, a number of reps. From that,
 * three facts follow without any interpretation — the heaviest set done, the
 * work done (weight times reps, summed), and how both have moved. Nothing
 * here recommends a weight, a programme or a rest day; it reports what was
 * lifted and when.
 *
 * A comparison needs enough sessions to mean anything. Where there are not
 * enough, the trend is withheld rather than computed from two points — the
 * same rule the health observations follow. */
import { localDate } from "./dates.js?v=20260827-172331";

const MIN_SESSIONS_FOR_TREND = 3;
const DAY = 86_400_000;

const isLive = (record) => record.type === "workout" && !record.deletedAt;

/* One row of a log: normalised, because a set typed by hand can be missing
   half its numbers and must not poison a total. */
function normaliseSet(entry) {
  const exercise = String(entry?.exercise || "").trim();
  if (!exercise) return null;

  const weight = Number(entry.weight);
  const reps = Number(entry.reps);

  return {
    exercise,
    /* Bodyweight work has reps and no weight, and is still training. */
    weight: Number.isFinite(weight) && weight > 0 ? weight : null,
    reps: Number.isFinite(reps) && reps > 0 ? Math.round(reps) : null
  };
}

export const setsOf = (record) =>
  (Array.isArray(record?.sets) ? record.sets : []).map(normaliseSet).filter(Boolean);

/* Work done in one set. Bodyweight sets contribute reps but no tonnage,
   because inventing a bodyweight figure would make the total fiction. */
const volumeOf = (entry) =>
  (entry.weight !== null && entry.reps !== null ? entry.weight * entry.reps : 0);

/* Every exercise ever logged, with a session-by-session history. */
export function byExercise(records) {
  const groups = new Map();

  for (const record of records) {
    if (!isLive(record)) continue;
    const sets = setsOf(record);
    if (!sets.length) continue;

    const perExercise = new Map();
    for (const entry of sets) {
      const key = entry.exercise.toLowerCase();
      if (!perExercise.has(key)) {
        perExercise.set(key, { name: entry.exercise, sets: [], bestWeight: null, reps: 0, volume: 0 });
      }
      const bucket = perExercise.get(key);
      bucket.sets.push(entry);
      bucket.reps += entry.reps ?? 0;
      bucket.volume += volumeOf(entry);
      if (entry.weight !== null && (bucket.bestWeight === null || entry.weight > bucket.bestWeight)) {
        bucket.bestWeight = entry.weight;
      }
    }

    for (const [key, session] of perExercise) {
      if (!groups.has(key)) groups.set(key, { name: session.name, sessions: [] });
      groups.get(key).sessions.push({
        date: record.date,
        recordId: record.id,
        setCount: session.sets.length,
        reps: session.reps,
        volume: session.volume,
        bestWeight: session.bestWeight
      });
    }
  }

  const out = [];
  for (const group of groups.values()) {
    group.sessions.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const latest = group.sessions.at(-1);
    const first = group.sessions[0];
    const heaviest = group.sessions.reduce(
      (best, session) => (session.bestWeight !== null && (best === null || session.bestWeight > best.bestWeight) ? session : best),
      null
    );

    /* Two sessions is an anecdote. Three is the least that can show direction. */
    let trend = null;
    if (group.sessions.length >= MIN_SESSIONS_FOR_TREND
        && first.bestWeight !== null && latest.bestWeight !== null) {
      const change = latest.bestWeight - first.bestWeight;
      trend = {
        changeKg: change,
        direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
        from: first.date,
        sessions: group.sessions.length
      };
    }

    out.push({
      name: group.name,
      sessions: group.sessions,
      count: group.sessions.length,
      latest,
      heaviest,
      trend,
      lastDate: latest.date
    });
  }

  return out.sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)));
}

/* Total work per week, for the recent past. Sessions with no weights still
   count as sessions but add nothing to the tonnage. */
export function weeklyVolume(records, { weeks = 8, now = new Date() } = {}) {
  const out = [];
  const startOfWeek = (date) => {
    const copy = new Date(date);
    const weekday = (copy.getDay() + 6) % 7;          /* Monday-based */
    copy.setHours(12, 0, 0, 0);
    copy.setDate(copy.getDate() - weekday);
    return copy;
  };

  const thisWeek = startOfWeek(now);

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const from = new Date(thisWeek.getTime() - offset * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const fromISO = localDate(from);
    const toISO = localDate(to);

    let volume = 0;
    let sessions = 0;
    for (const record of records) {
      if (!isLive(record) || !record.date) continue;
      if (record.date < fromISO || record.date >= toISO) continue;
      sessions += 1;
      for (const entry of setsOf(record)) volume += volumeOf(entry);
    }
    out.push({ from: fromISO, volume, sessions });
  }
  return out;
}

/* A personal best that has just been set — a fact about the log, worth
   surfacing because it is the reason people keep one. */
export function freshRecords(records, { withinDays = 30, now = new Date() } = {}) {
  const cutoff = localDate(now.getTime() - withinDays * DAY);

  return byExercise(records)
    .filter((group) => group.heaviest && group.heaviest.date >= cutoff && group.count >= 2)
    .filter((group) => {
      /* Only a best that beats everything before it, not merely a repeat. */
      const earlier = group.sessions.filter((session) => session.date < group.heaviest.date);
      return earlier.length > 0
        && earlier.every((session) => session.bestWeight === null || session.bestWeight < group.heaviest.bestWeight);
    })
    .map((group) => ({ name: group.name, weight: group.heaviest.bestWeight, date: group.heaviest.date }));
}

export const TRAINING_NOTE = {
  ru: "Считается только то, что вы записали: самый тяжёлый подход и объём — вес, умноженный на повторы. Направление показывается с третьей тренировки, раньше двух точек мало для вывода.",
  en: "Only what was logged is counted: the heaviest set, and volume as weight times reps. Direction is shown from the third session onward — two points are not a trend."
};
