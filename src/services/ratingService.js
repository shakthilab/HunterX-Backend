// src/services/ratingService.js — "Rate HunterX" single-current-rating flow
//
// Each user has exactly one rating row (upserted on every submission, not a
// history log) — see app_ratings' unique_user_rating constraint.

import prisma from '../config/prisma.js';

export const RATING_CATEGORIES = ['quests_xp', 'ui_design', 'performance', 'notifications', 'other'];

// stars >= this value tells the client its native store-review prompt
// qualifies for this submission. Tunable here without an app update.
const STORE_REVIEW_STARS_THRESHOLD = 4;

const MAX_META_LENGTH = 30; // matches app_ratings.app_version / device_os VARCHAR(30)
const truncateMeta = (value) => (typeof value === 'string' ? value.slice(0, MAX_META_LENGTH) : null);

export async function submitRating(userId, { stars, category, comment, app_version, device_os }) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);

  const data = {
    stars,
    category:    category ?? null,
    comment:     comment ?? null,
    app_version: truncateMeta(app_version),
    device_os:   truncateMeta(device_os),
  };

  await prisma.app_ratings.upsert({
    where:  { user_id: bUserId },
    create: { user_id: bUserId, ...data },
    // A resubmission always fully overwrites the previous rating — a user
    // changing their mind isn't merged with what they said last time.
    update: { ...data, updated_at: new Date() },
  });

  return { promptStoreReview: stars >= STORE_REVIEW_STARS_THRESHOLD };
}
