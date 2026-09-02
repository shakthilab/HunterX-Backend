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
  // These three back the BADGE-type streak_milestones below — names must
  // match STREAK_MILESTONES[].description exactly, since that's how
  // rewardService.grantStreakMilestoneReward looks them up (no FK from
  // streak_milestones to badges in the schema).
  {
    name:        'PLACEHOLDER_Exclusive badge',
    description: 'PLACEHOLDER 30-day streak badge.',
    image_url:   null,
    badge_type:  'STREAK',
  },
  {
    name:        'PLACEHOLDER_Legendary reward',
    description: 'PLACEHOLDER 60-day streak badge.',
    image_url:   null,
    badge_type:  'STREAK',
  },
  {
    name:        'PLACEHOLDER_Shadow rank badge',
    description: 'PLACEHOLDER 90-day streak badge.',
    image_url:   null,
    badge_type:  'STREAK',
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
// Per-level XP curve — flat 30 XP/day (3 routine tasks x 10 XP each, no
// streak or fitness-level multiplier — see taskService.js). Anchors:
//   Level 1:   0 XP
//   Level 10:  10,950 XP  (~1 year of consistent daily tasks)
//   Level 40:  21,900 XP  (~2 years)
//   Level 100: 32,850 XP  (~3 years)
// Three segments interpolate between anchors with an easing exponent —
// steeper early (fast first levels), flatter late (the long endgame
// grind) — rather than a single curve across all 100 levels.
// ─────────────────────────────────────────────────────────────

function levelXpRequired(level) {
  const anchors = { 1: 0, 10: 10950, 40: 21900, 100: 32850 };
  const segments = [
    { lo: 1, hi: 10, loXp: 0, hiXp: anchors[10], exp: 2.6 },
    { lo: 10, hi: 40, loXp: anchors[10], hiXp: anchors[40], exp: 1.6 },
    { lo: 40, hi: 100, loXp: anchors[40], hiXp: anchors[100], exp: 1.5 },
  ];
  if (level === 1) return 0;
  const seg = segments.find(s => level > s.lo && level <= s.hi);
  const x = (level - seg.lo) / (seg.hi - seg.lo);
  return Math.round(seg.loXp + (seg.hiXp - seg.loXp) * Math.pow(x, seg.exp));
}

// ⚠ PLACEHOLDER — title/unlock_message copy, and the specific 10 rank
// names (xp_required itself is the real formula above, not a
// placeholder). rank_name buckets every 10 levels into one rank, the
// same boundary width dragon_stages uses for its stages — PLACEHOLDER_
// prefixed the same way DRAGON_STAGES/BADGES are until real game-design
// copy replaces it.
const RANK_NAMES = [
  'PLACEHOLDER_E-Rank', 'PLACEHOLDER_D-Rank', 'PLACEHOLDER_C-Rank',
  'PLACEHOLDER_B-Rank', 'PLACEHOLDER_A-Rank', 'PLACEHOLDER_S-Rank',
  'PLACEHOLDER_SS-Rank', 'PLACEHOLDER_SSS-Rank', 'PLACEHOLDER_National-Level',
  'PLACEHOLDER_Shadow-Rank',
];

function buildLevels() {
  const levels = [];
  for (let level = 1; level <= 100; level++) {
    const rankIndex = Math.min(Math.floor((level - 1) / 10), RANK_NAMES.length - 1);
    levels.push({
      level_number:   level,
      xp_required:    levelXpRequired(level),
      title:          `PLACEHOLDER_Level_${level}`,
      rank_name:      RANK_NAMES[rankIndex],
      unlock_message: `PLACEHOLDER unlock message for level ${level}.`,
    });
  }
  return levels;
}

const LEVELS = buildLevels();

async function seedLevels() {
  for (const level of LEVELS) {
    await prisma.levels.upsert({
      where:  { level_number: level.level_number },
      create: level,
      update: level,
    });
  }
  console.log(`UPSERTED levels level_number=1-${LEVELS.length}`);
}

// ─────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDER — reward copy (description). xp_bonus is deliberately 0
// on every row and left unread by rewardService — streak milestones are
// a physical/cosmetic reward track only, fully decoupled from XP (XP
// only ever comes from task completion; see LEVELS above). reward_type
// maps each milestone onto the two grant mechanisms rewardService.js
// knows how to fulfill: COUPON claims a reward_pool code via
// user_rewards, BADGE awards a user_badges row (matched by name against
// BADGES above — see grantBadge in rewardService.js).
// ─────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
  { streak_days: 7,  reward_type: 'COUPON', xp_bonus: 0, description: 'PLACEHOLDER_Scratch card' },
  { streak_days: 14, reward_type: 'COUPON', xp_bonus: 0, description: 'PLACEHOLDER_Coupon' },
  { streak_days: 21, reward_type: 'COUPON', xp_bonus: 0, description: 'PLACEHOLDER_Partner coupon' },
  { streak_days: 30, reward_type: 'BADGE',  xp_bonus: 0, description: 'PLACEHOLDER_Exclusive badge' },
  { streak_days: 60, reward_type: 'BADGE',  xp_bonus: 0, description: 'PLACEHOLDER_Legendary reward' },
  { streak_days: 90, reward_type: 'BADGE',  xp_bonus: 0, description: 'PLACEHOLDER_Shadow rank badge' },
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
