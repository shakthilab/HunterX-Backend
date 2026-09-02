// src/services/notificationService.js — In-app notification creation
//
// Just an insert into `notifications` for now — no FCM push wiring yet
// (see user_fcm_tokens / firebase.js for when that's built). Callers
// that need the notification to land atomically with the state change
// it's announcing (a level-up, a streak milestone) pass their own `tx`;
// pass the plain `prisma` client when there's no surrounding transaction.

export async function createNotification(client, userId, type, title, body, data = null) {
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
