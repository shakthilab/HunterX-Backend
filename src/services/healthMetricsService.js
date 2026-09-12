// src/services/healthMetricsService.js — Daily health-metric summaries
// synced from the client's Apple HealthKit / Google Health Connect reads,
// powering the Metrics screen's Today/Week/Month/Year tabs.
//
// Purely a passive data store: this is the only place health_metrics_daily
// is written. Nothing else in this backend (task completion, XP, streaks)
// reads from or writes to it, and it must stay that way — see
// health_metrics_daily in schema.prisma.
//
// Day boundaries use the same IST calendar-day convention as streak/task
// scheduling (see getISTDateOnly/parseDateOnly in utils/helpers.js) so
// "today" here always lines up with "today" everywhere else in the app.

import prisma from '../config/prisma.js';
import { getISTDateOnly, parseDateOnly } from '../utils/helpers.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const HEALTH_SOURCES = ['apple_health', 'health_connect'];

// camelCase request/response field -> snake_case column
const NUMERIC_FIELDS = {
  steps:         'steps',
  calories:      'calories',
  distanceKm:    'distance_km',
  activeMinutes: 'active_minutes',
  avgHeartRate:  'avg_heart_rate',
  sleepMinutes:  'sleep_minutes',
  workoutCount:  'workout_count',
};
// distanceKm is the one NUMERIC(6,2) field — everything else is an integer column
const INTEGER_FIELDS = new Set(Object.keys(NUMERIC_FIELDS).filter((f) => f !== 'distanceKm'));

const RANGE_DAYS = { today: 1, week: 7, month: 30, year: 365 };

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function toNumberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function formatDay(dateStr, row) {
  return {
    date:          dateStr,
    steps:         row?.steps ?? null,
    calories:      row?.calories ?? null,
    distanceKm:    toNumberOrNull(row?.distance_km),
    activeMinutes: row?.active_minutes ?? null,
    avgHeartRate:  row?.avg_heart_rate ?? null,
    sleepMinutes:  row?.sleep_minutes ?? null,
    workoutCount:  row?.workout_count ?? null,
  };
}

// ── Upsert (client sync) ────────────────────────────────────
// One row per (user, date) — a re-sync of the same day overwrites it
// (unique_user_date is the upsert target), e.g. corrected end-of-day
// totals after an initial partial sync.
export async function upsertDailyMetrics(userId, payload = {}) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);
  const { date, source } = payload;

  if (!date) throw new Error('DATE_REQUIRED');
  const parsedDate = parseDateOnly(date);
  if (!parsedDate) throw new Error('INVALID_DATE');
  if (parsedDate.getTime() > getISTDateOnly().getTime()) throw new Error('DATE_IN_FUTURE');

  if (source !== undefined && source !== null && !HEALTH_SOURCES.includes(source)) {
    throw new Error('INVALID_SOURCE');
  }

  const data = {};
  for (const [field, column] of Object.entries(NUMERIC_FIELDS)) {
    const value = payload[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('INVALID_NUMERIC_FIELD');
    }
    if (INTEGER_FIELDS.has(field) && !Number.isInteger(value)) {
      throw new Error('INVALID_NUMERIC_FIELD');
    }
    data[column] = value;
  }
  if (source !== undefined) data.source = source;

  await prisma.health_metrics_daily.upsert({
    where:  { user_id_date: { user_id: bUserId, date: parsedDate } },
    create: { user_id: bUserId, date: parsedDate, ...data },
    update: { ...data, updated_at: new Date() },
  });
}

// ── Range fetch (Metrics screen) ────────────────────────────
// Same response shape for all four ranges so the frontend never needs
// special-casing: "today" is just the week/month/year logic with a
// 1-day window, so its summary and single daily entry are naturally
// identical to that one day's values.
export async function getHealthMetrics(userId, range) {
  if (!RANGE_DAYS[range]) throw new Error('INVALID_RANGE');

  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);
  const days    = RANGE_DAYS[range];
  const today   = getISTDateOnly();
  const start   = new Date(today.getTime() - (days - 1) * MS_PER_DAY);

  const rows = await prisma.health_metrics_daily.findMany({
    where: { user_id: bUserId, date: { gte: start, lte: today } },
  });
  const byDate = new Map(rows.map((row) => [toDateStr(row.date), row]));

  // Missing days are included as null-valued entries (not omitted) so the
  // frontend chart always gets a consistent number of data points.
  const daily = [];
  for (let i = 0; i < days; i++) {
    const dateStr = toDateStr(new Date(start.getTime() + i * MS_PER_DAY));
    daily.push(formatDay(dateStr, byDate.get(dateStr)));
  }

  const summary = {
    steps: 0, calories: 0, distanceKm: 0, activeMinutes: 0,
    avgHeartRate: null, sleepMinutes: null, workoutCount: 0,
  };
  let heartRateSum = 0, heartRateDays = 0;
  let sleepSum = 0, sleepDays = 0;

  for (const day of daily) {
    summary.steps         += day.steps ?? 0;
    summary.calories      += day.calories ?? 0;
    summary.distanceKm    += day.distanceKm ?? 0;
    summary.activeMinutes += day.activeMinutes ?? 0;
    summary.workoutCount  += day.workoutCount ?? 0;
    if (day.avgHeartRate !== null) { heartRateSum += day.avgHeartRate; heartRateDays++; }
    if (day.sleepMinutes !== null) { sleepSum += day.sleepMinutes; sleepDays++; }
  }

  summary.distanceKm   = Math.round(summary.distanceKm * 100) / 100;
  summary.avgHeartRate = heartRateDays > 0 ? Math.round(heartRateSum / heartRateDays) : null;
  summary.sleepMinutes = sleepDays > 0 ? Math.round(sleepSum / sleepDays) : null;

  return { range, summary, daily };
}
