// src/services/xpService.js — Level-up detection off user_progression.total_xp
//
// XP itself is awarded flat (task.xp_reward / task.xp_partial, no streak
// or fitness-level multiplier) by taskService.js#setTaskCompletion. This
// service owns everything that happens AFTER total_xp changes: working
// out which level that new total now qualifies for, walking every level
// crossed in one award (so a big XP jump can't skip a rank-up or dragon
// evolution that happened partway through), and firing a LEVEL_UP
// notification for each level/rank/evolution crossed.
//
// Fully independent of streakService.js — nothing here reads or writes
// any streak field, and streakService.js never imports this file.

import { createNotification } from './notificationService.js';

// Called from inside the same transaction that just incremented
// user_progression.total_xp — `tx` is a Prisma transaction client,
// `userId` is already a BigInt.
export async function checkLevelUp(tx, userId) {
  const progression = await tx.user_progression.findUnique({ where: { user_id: userId } });
  if (!progression) return { leveledUp: false };

  const levels = await tx.levels.findMany({ orderBy: { level_number: 'asc' } });
  const eligible = levels.filter(l => l.xp_required <= progression.total_xp);
  if (eligible.length === 0) return { leveledUp: false };

  const newLevel = eligible[eligible.length - 1].level_number;
  const oldLevel = progression.current_level;
  if (newLevel <= oldLevel) return { leveledUp: false };

  await tx.user_progression.update({
    where: { user_id: userId },
    data:  { current_level: newLevel },
  });

  const levelByNumber = new Map(levels.map(l => [l.level_number, l]));

  // Walk every level crossed, not just the final one — a multi-level
  // jump in one award must still trigger every rank-up / dragon
  // evolution boundary in between, not just the one at the top.
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    const levelRow = levelByNumber.get(lvl);
    if (!levelRow) continue; // gap in seeded levels — nothing to announce

    await createNotification(
      tx, userId, 'LEVEL_UP',
      `Level ${lvl} reached!`,
      `You've hit Level ${lvl}${levelRow.title ? ` — ${levelRow.title}` : ''}.`,
      { event: 'LEVEL_UP', level: lvl }
    );

    await checkRankUp(tx, userId, levelRow, levelByNumber.get(lvl - 1) ?? null);
    await checkDragonEvolution(tx, userId, lvl);
  }

  return { leveledUp: true, oldLevel, newLevel };
}

// Rank boundary = wherever levels.rank_name changes between two
// consecutive levels (every 10 levels per prisma/seed.js's RANK_NAMES
// bucketing) — read off the row instead of hard-coded "every 10" so this
// stays correct if that bucketing ever changes.
async function checkRankUp(tx, userId, levelRow, previousLevelRow) {
  if (!levelRow.rank_name) return;
  if (previousLevelRow && previousLevelRow.rank_name === levelRow.rank_name) return;

  await createNotification(
    tx, userId, 'LEVEL_UP',
    `Rank up: ${levelRow.rank_name}!`,
    `You've ranked up to ${levelRow.rank_name}.`,
    { event: 'RANK_UP', level: levelRow.level_number, rank_name: levelRow.rank_name }
  );
}

// Dragon stage boundary = the dragon_stages row whose level_range covers
// this level differs from the stage the user is currently on.
async function checkDragonEvolution(tx, userId, level) {
  const stage = await tx.dragon_stages.findFirst({
    where: { level_range_start: { lte: level }, level_range_end: { gte: level } },
  });
  if (!stage) return; // no seeded stage covers this level yet (placeholder content)

  const user = await tx.users.findUnique({ where: { id: userId }, select: { dragon_stage: true } });
  if (!user || user.dragon_stage === stage.stage_number) return;

  await tx.users.update({ where: { id: userId }, data: { dragon_stage: stage.stage_number } });

  await tx.user_dragon_evolutions.upsert({
    where:  { user_id_stage_number: { user_id: userId, stage_number: stage.stage_number } },
    create: { user_id: userId, stage_number: stage.stage_number, level_at_evolution: level },
    update: {},
  });

  await createNotification(
    tx, userId, 'LEVEL_UP',
    `Dragon evolution: ${stage.name}!`,
    `Your dragon has evolved into ${stage.name}.`,
    { event: 'DRAGON_EVOLUTION', level, stage_number: stage.stage_number, stage_name: stage.name }
  );
}
