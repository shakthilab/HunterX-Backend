// prisma/seed.js — Reference data seed for a fresh environment
// (staging, production, a new dev's local setup).
//
// Wired into `npx prisma db seed` via the "prisma.seed" entry in
// package.json, and run automatically on every Railway deploy
// (see railway.json's buildCommand). Every upsert here is keyed on a
// stable natural key, so re-running this on every deploy is a safe
// no-op after the first run — nothing is ever duplicated.
//
// Usage: npx prisma db seed   (or: node prisma/seed.js)
//
// ⚠ PLACEHOLDER CONTENT — dragon_stages / badges / levels /
// streak_milestones below are scaffolded with obviously-fake placeholder
// rows so the seed *mechanism* works end-to-end (and so a fresh DB has
// at least a dragon_stages row for stage_number=1, which users.dragon_stage
// defaults to and has an FK constraint against — registration fails
// without it). Replace PLACEHOLDER_* with the real game-design content
// before running this against staging/production.

import 'dotenv/config';
import prisma from '../src/config/prisma.js';

// ─────────────────────────────────────────────────────────────
// Routine daily tasks — same 3 tasks, every user, every day.
// Matches the content previously seeded by scripts/seed-daily-tasks.js
// (now deleted), with is_default_daily added so the automatic
// task-assignment engine (src/services/taskAssignmentService.js) picks
// these up.
// ─────────────────────────────────────────────────────────────

const DAILY_TASKS = [
  {
    title:            'Sleep 8 Hours',
    description:      'Get 8 hours of quality sleep',
    tag:               'REST',
    task_type:         'DAILY_FIXED',
    xp_reward:         10,
    xp_partial:        5,
    allows_partial:    false,
    target_value:      8,
    target_unit:       'hours',
    level_target:      'ALL',
    is_recurring:      true,
    is_default_daily:  true,
    is_active:         true,
    image_url:         null,
  },
  {
    title:            'Drink 3L Water',
    description:      'Stay hydrated — drink 3 liters of water',
    tag:               'HYDRATE',
    task_type:         'DAILY_FIXED',
    xp_reward:         10,
    xp_partial:        5,
    allows_partial:    true,
    target_value:      3,
    target_unit:       'L',
    level_target:      'ALL',
    is_recurring:      true,
    is_default_daily:  true,
    is_active:         true,
    image_url:         null,
  },
  {
    title:            'Protein Goal',
    description:      'Hit your daily protein target',
    tag:               'NUTRITION',
    task_type:         'DAILY_FIXED',
    xp_reward:         10,
    xp_partial:        5,
    allows_partial:    true,
    target_value:      null, // dynamic — read from users.daily_protein_goal per user
    target_unit:       'g',
    level_target:      'ALL',
    is_recurring:      true,
    is_default_daily:  true,
    is_active:         true,
    image_url:         null,
  },
];

// tasks.title has no DB-level unique constraint (it's also used by
// arbitrary future admin-created tasks), so this can't be a literal
// Prisma .upsert(). Same idempotent find-then-create/update pattern the
// old script used, upgraded to also update fields on re-run instead of
// just skipping.
async function seedDailyTasks() {
  for (const task of DAILY_TASKS) {
    const existing = await prisma.tasks.findFirst({ where: { title: task.title } });

    if (existing) {
      await prisma.tasks.update({ where: { id: existing.id }, data: task });
      console.log(`UPDATED "${task.title}" (id=${existing.id})`);
    } else {
      const created = await prisma.tasks.create({ data: task });
      console.log(`ADDED   "${created.title}" (id=${created.id})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDER — replace with real dragon-stage lore/colors/animations
// before seeding staging/production. stage_number=1 MUST exist before
// any user can be created (users.dragon_stage defaults to 1 and has an
// FK constraint against dragon_stages.stage_number).
// ─────────────────────────────────────────────────────────────

const DRAGON_STAGES = [
  {
    stage_number:       1,
    name:               'PLACEHOLDER_Hatchling',
    rank_name:          'PLACEHOLDER_E-Rank',
    lore:               'PLACEHOLDER lore text for stage 1.',
    unlock_message:     'PLACEHOLDER unlock message for stage 1.',
    level_range_start:  1,
    level_range_end:    9,
    primary_color:      '#8A8A8A',
    glow_color:         '#B0B0B0',
  },
];

async function seedDragonStages() {
  for (const stage of DRAGON_STAGES) {
    await prisma.dragon_stages.upsert({
      where:  { stage_number: stage.stage_number },
      create: stage,
      update: stage,
    });
    console.log(`UPSERTED dragon_stages stage_number=${stage.stage_number}`);
  }
}

// ─────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDER — replace with real badge names/images.
// ─────────────────────────────────────────────────────────────

const BADGES = [
  {
    name:        'PLACEHOLDER_Badge',
    description: 'PLACEHOLDER badge description.',
    image_url:   null,
    badge_type:  'ACHIEVEMENT',
  },
];

async function seedBadges() {
  for (const badge of BADGES) {
    await prisma.badges.upsert({
      where:  { name: badge.name },
      create: badge,
      update: badge,
    });
    console.log(`UPSERTED badges name="${badge.name}"`);
  }
}

// ─────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDER — replace with the real per-level XP curve.
// ─────────────────────────────────────────────────────────────

const LEVELS = [
  {
    level_number:   1,
    xp_required:    0,
    title:          'PLACEHOLDER_Rookie',
    rank_name:      'PLACEHOLDER_E-Rank',
    unlock_message: 'PLACEHOLDER unlock message for level 1.',
  },
];

async function seedLevels() {
  for (const level of LEVELS) {
    await prisma.levels.upsert({
      where:  { level_number: level.level_number },
      create: level,
      update: level,
    });
    console.log(`UPSERTED levels level_number=${level.level_number}`);
  }
}

// ─────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDER — replace with the real streak-milestone rewards.
// ─────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
  {
    streak_days: 7,
    reward_type: 'XP_BONUS',
    xp_bonus:    50,
    description: 'PLACEHOLDER 7-day streak reward.',
  },
];

async function seedStreakMilestones() {
  for (const milestone of STREAK_MILESTONES) {
    await prisma.streak_milestones.upsert({
      where:  { streak_days: milestone.streak_days },
      create: milestone,
      update: milestone,
    });
    console.log(`UPSERTED streak_milestones streak_days=${milestone.streak_days}`);
  }
}

async function main() {
  await seedDragonStages();  // before tasks/users — FK dependency
  await seedDailyTasks();
  await seedBadges();
  await seedLevels();
  await seedStreakMilestones();
}

main()
  .catch(err => {
    console.error('prisma/seed.js failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
