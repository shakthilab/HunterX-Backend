// src/services/notificationService.js — In-app notification creation with user settings gating

import { shouldSendNotification } from './userSettingsService.js';

export async function createNotification(client, userId, type, title, body, data = null) {
  const allowed = await shouldSendNotification(userId, type);
  if (!allowed) {
    return null;
  }
  return client.notifications.create({
    data: {
      user_id: userId,
      type,
      title,
      body,
      data,
    },
  });
}
