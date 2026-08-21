// scripts/seed-daily-tasks.js
//
// Seeds the 3 fixed daily recurring tasks (Sleep 8 Hours / Drink 3L Water /
// Protein Goal) into the `tasks` table as task_type = DAILY_FIXED.
//
// "Protein Goal" has no fixed target_value — it's read per-user from
// users.daily_protein_goal at runtime (see authService.js), since that
// value differs per user based on weight/activity level. target_unit is
// still set to "g" so the UI knows how to label it.
//
// Idempotent: matched by title, so re-running this script won't create
// duplicates — it skips tasks that already exist.
//
// Usage: node scripts/seed-daily-tasks.js

import 'dotenv/config'; // standalone script — src/index.js normally does this
import prisma from '../src/config/prisma.js';

const DAILY_TASKS = [
  {
    title:          'Sleep 8 Hours',
    description:    'Get 8 hours of quality sleep',
    tag:            'REST',
    task_type:      'DAILY_FIXED',
    xp_reward:      10, // daily task cap is 10xp
    xp_partial:     5,  // unused while allows_partial=false, kept <= xp_reward for consistency
    allows_partial: false,
    target_value:   8,
    target_unit:    'hours',
    level_target:   'ALL',
    is_recurring:   true,
    is_active:      true,
    image_url:      null,
  },
  {
    title:          'Drink 3L Water',
    description:    'Stay hydrated — drink 3 liters of water',
    tag:            'HYDRATE',
    task_type:      'DAILY_FIXED',
    xp_reward:      10, // daily task cap is 10xp
    xp_partial:     5,  // kept <= xp_reward for consistency
    allows_partial: true,
    target_value:   3,
    target_unit:    'L',
    level_target:   'ALL',
    is_recurring:   true,
    is_active:      true,
    image_url:      null,
  },
  {
    title:          'Protein Goal',
    description:    'Hit your daily protein target',
    tag:            'NUTRITION',
    task_type:      'DAILY_FIXED',
    xp_reward:      10, // daily task cap is 10xp
    xp_partial:     5,  // kept <= xp_reward for consistency
    allows_partial: true,
    target_value:   null, // dynamic — read from users.daily_protein_goal per user
    target_unit:    'g',
    level_target:   'ALL',
    is_recurring:   true,
    is_active:      true,
    image_url:      null,
  },
];

async function main() {
  for (const task of DAILY_TASKS) {
    const existing = await prisma.tasks.findFirst({ where: { title: task.title } });

    if (existing) {
      console.log(`SKIP  "${task.title}" already exists (id=${existing.id})`);
      continue;
    }

    const created = await prisma.tasks.create({ data: task });
    console.log(`ADDED "${created.title}" (id=${created.id})`);
  }
}

main()
  .catch(err => {
    console.error('seed-daily-tasks failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
