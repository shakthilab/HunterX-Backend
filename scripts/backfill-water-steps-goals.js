// scripts/backfill-water-steps-goals.js
//
// One-off backfill for the new personalized daily_water_goal /
// daily_steps_goal columns (see prisma/migrations/20260913000000_add_water_and_steps_goals).
// Anyone who finished onboarding before this change has both columns
// null — authService.js only computes them going forward (at onboarding
// time, or when height/weight/birthday change via updateUserProfile).
// Without this, their "Drink Water" / "Daily Steps" tasks would resolve
// to a null target (see taskService.js#resolveTarget).
//
// Safe to re-run: recomputes from each user's current height_cm/weight_kg/
// bmi/age every time, so it just re-derives the same numbers if nothing
// about the user has changed since.
//
// Usage: node scripts/backfill-water-steps-goals.js

import 'dotenv/config'; // standalone script — src/index.js normally does this
import prisma from '../src/config/prisma.js';
import { calculateWaterGoal, calculateStepsGoal } from '../src/utils/helpers.js';

async function main() {
  const users = await prisma.users.findMany({
    where: {
      OR: [
        { weight_kg: { not: null } },
        { bmi: { not: null } },
      ],
    },
    select: { id: true, email: true, weight_kg: true, bmi: true, age: true },
  });

  console.log(`Found ${users.length} user(s) with height/weight on file.`);

  let updated = 0;
  for (const user of users) {
    const data = {};
    if (user.weight_kg != null) data.daily_water_goal = calculateWaterGoal(user.weight_kg);
    if (user.bmi != null)       data.daily_steps_goal = calculateStepsGoal(user.bmi, user.age);

    if (Object.keys(data).length === 0) continue;

    await prisma.users.update({ where: { id: user.id }, data });
    updated++;
    console.log(
      `user ${user.id} (${user.email ?? 'no email'}): ` +
      `water=${data.daily_water_goal ?? 'unchanged'}L steps=${data.daily_steps_goal ?? 'unchanged'}`
    );
  }

  console.log(`\nDone — updated ${updated}/${users.length} user(s).`);
}

main()
  .catch(err => {
    console.error('backfill-water-steps-goals failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
