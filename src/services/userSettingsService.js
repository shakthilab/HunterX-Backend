// src/services/userSettingsService.js — User Settings management & notification gating

import prisma from "../config/prisma.js";

function formatSettings(settings) {
  if (!settings) return null;
  return {
    id: String(settings.id),
    user_id: String(settings.user_id),
    units: settings.units || "metric",
    notify_all: settings.notify_all ?? true,
    notify_daily_motivation: settings.notify_daily_motivation ?? true,
    notify_task_reminders: settings.notify_task_reminders ?? true,
    notify_streak_preservation: settings.notify_streak_preservation ?? true,
    notify_streak_milestones: settings.notify_streak_milestones ?? true,
    notify_streak_freeze: settings.notify_streak_freeze ?? true,
    notify_level_up: settings.notify_level_up ?? true,
    notify_reward_ready: settings.notify_reward_ready ?? true,
    notify_announcements: settings.notify_announcements ?? true,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  };
}

export async function getUserSettings(userId) {
  const bUserId = typeof userId === "bigint" ? userId : BigInt(userId);

  let settings = await prisma.user_settings.findUnique({
    where: { user_id: bUserId },
  });

  if (!settings) {
    settings = await prisma.user_settings.create({
      data: {
        user_id: bUserId,
        units: "metric",
        notify_all: true,
        notify_daily_motivation: true,
        notify_task_reminders: true,
        notify_streak_preservation: true,
        notify_streak_milestones: true,
        notify_streak_freeze: true,
        notify_level_up: true,
        notify_reward_ready: true,
        notify_announcements: true,
      },
    });
  }

  return formatSettings(settings);
}

export async function updateUserSettings(userId, payload) {
  const bUserId = typeof userId === "bigint" ? userId : BigInt(userId);

  const updateData = { updated_at: new Date() };

  if (payload.units !== undefined) {
    if (!["metric", "imperial"].includes(payload.units)) {
      throw new Error("INVALID_UNITS");
    }
    updateData.units = payload.units;
  }

  const boolFields = [
    "notify_all",
    "notify_daily_motivation",
    "notify_task_reminders",
    "notify_streak_preservation",
    "notify_streak_milestones",
    "notify_streak_freeze",
    "notify_level_up",
    "notify_reward_ready",
    "notify_announcements",
  ];

  for (const field of boolFields) {
    if (payload[field] !== undefined) {
      updateData[field] = Boolean(payload[field]);
    }
  }

  const settings = await prisma.user_settings.upsert({
    where: { user_id: bUserId },
    create: {
      user_id: bUserId,
      units: payload.units || "metric",
      notify_all: payload.notify_all !== undefined ? Boolean(payload.notify_all) : true,
      notify_daily_motivation: payload.notify_daily_motivation !== undefined ? Boolean(payload.notify_daily_motivation) : true,
      notify_task_reminders: payload.notify_task_reminders !== undefined ? Boolean(payload.notify_task_reminders) : true,
      notify_streak_preservation: payload.notify_streak_preservation !== undefined ? Boolean(payload.notify_streak_preservation) : true,
      notify_streak_milestones: payload.notify_streak_milestones !== undefined ? Boolean(payload.notify_streak_milestones) : true,
      notify_streak_freeze: payload.notify_streak_freeze !== undefined ? Boolean(payload.notify_streak_freeze) : true,
      notify_level_up: payload.notify_level_up !== undefined ? Boolean(payload.notify_level_up) : true,
      notify_reward_ready: payload.notify_reward_ready !== undefined ? Boolean(payload.notify_reward_ready) : true,
      notify_announcements: payload.notify_announcements !== undefined ? Boolean(payload.notify_announcements) : true,
      ...updateData,
    },
    update: updateData,
  });

  return formatSettings(settings);
}

export async function shouldSendNotification(userId, notificationType) {
  try {
    const settings = await getUserSettings(userId);
    if (!settings.notify_all) return false;

    switch (notificationType) {
      case "DAILY_MOTIVATION":
        return settings.notify_daily_motivation;
      case "TASK_REMINDER":
        return settings.notify_task_reminders;
      case "STREAK_AT_RISK":
        return settings.notify_streak_preservation;
      case "STREAK_MILESTONE":
        return settings.notify_streak_milestones;
      case "STREAK_FREEZE_USED":
      case "STREAK_BROKEN":
      case "MONTHLY_FREEZE":
        return settings.notify_streak_freeze;
      case "LEVEL_UP":
        return settings.notify_level_up;
      case "REWARD_READY":
        return settings.notify_reward_ready;
      case "BROADCAST":
        return settings.notify_announcements;
      default:
        return true;
    }
  } catch (err) {
    return true;
  }
}
