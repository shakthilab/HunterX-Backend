// scripts/check-q9-mismatches.js
//
// Backfill/audit check for the Q9 (training window) activity-multiplier
// bug: any user_onboarding_answers row for question_id = 9 whose answer
// isn't one of the four values the mobile app is supposed to send would
// have silently fallen back to SEDENTARY (0.8x), under-calculating
// daily_protein_goal.
//
// This script only reads and reports — it does not modify any data.
// Run it, review the flagged user_ids, then recalculate/update
// daily_protein_goal for those users once their correct activity level
// is known.
//
// Usage: node scripts/check-q9-mismatches.js

import 'dotenv/config'; // standalone script — src/index.js normally does this
import prisma from '../src/config/prisma.js';

const VALID_Q9_ANSWERS = new Set(['15min', '30min', '1hr', '2hr_plus']);

async function main() {
  const q9Answers = await prisma.user_onboarding_answers.findMany({
    where: { question_id: 9 },
    select: {
      user_id:    true,
      answer:     true,
      created_at: true,
      users: {
        select: {
          email:               true,
          weight_kg:           true,
          daily_protein_goal:  true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const mismatches = q9Answers.filter(row => !VALID_Q9_ANSWERS.has(row.answer));

  console.log(`Scanned ${q9Answers.length} Q9 (training_window) answers.`);
  console.log(`Found ${mismatches.length} mismatched value(s).\n`);

  if (mismatches.length === 0) {
    console.log('No affected users — all Q9 answers map cleanly.');
    return;
  }

  console.log('Affected users (protein goal likely wrong, defaulted to SEDENTARY 0.8x):');
  console.log('user_id | email | raw_answer | weight_kg | daily_protein_goal | answered_at');
  for (const row of mismatches) {
    console.log(
      `${row.user_id} | ${row.users?.email ?? 'N/A'} | ${JSON.stringify(row.answer)} | ` +
      `${row.users?.weight_kg ?? 'N/A'} | ${row.users?.daily_protein_goal ?? 'N/A'} | ` +
      `${row.created_at?.toISOString() ?? 'N/A'}`
    );
  }

  console.log(
    `\n${mismatches.length} user(s) need their daily_protein_goal recalculated ` +
    `once the correct activity mapping for their raw answer is determined.`
  );
}

main()
  .catch(err => {
    console.error('check-q9-mismatches failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
