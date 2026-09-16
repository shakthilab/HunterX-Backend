// src/services/discordService.js — Team-facing Discord webhook notifications
//
// Purely internal: nothing here is ever surfaced to the mobile app or its
// users — see feedbackService.js, whose caller ignores whatever happens here.

import { logError } from '../utils/logger.js';

const MAX_DESCRIPTION_LENGTH = 500;

const CATEGORY_META = {
  bug_report: { emoji: '🐞', label: 'Bug Report', color: 0xE74C3C }, // red
  suggestion: { emoji: '💡', label: 'Suggestion',  color: 0x3498DB }, // blue
  other:      { emoji: '📝', label: 'Other',       color: 0x95A5A6 }, // gray
};

function truncate(text, maxLength) {
  if (typeof text !== 'string' || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildEmbed(feedback, user) {
  const meta = CATEGORY_META[feedback.category] || CATEGORY_META.other;

  const userName  = typeof user === 'object' ? user?.name : null;
  const userEmail = typeof user === 'object' ? user?.email : null;
  const hunterId  = typeof user === 'object' ? user?.hunter_id : user;

  const embed = {
    title:       `${meta.emoji} New Feedback: ${meta.label}`,
    description: truncate(feedback.message, MAX_DESCRIPTION_LENGTH),
    color:       meta.color,
    fields: [
      { name: 'Name',        value: userName || 'Unknown',                    inline: true },
      { name: 'Email',       value: userEmail || 'Unknown',                   inline: true },
      { name: 'Hunter ID',   value: hunterId || 'Unknown',                    inline: true },
      { name: 'App Version', value: feedback.app_version || 'Unknown',        inline: true },
      { name: 'Device',      value: feedback.device_os || 'Unknown',          inline: true },
      { name: 'Level',       value: feedback.user_level != null ? String(feedback.user_level) : 'Unknown', inline: true },
    ],
  };

  if (feedback.attachment_url) {
    embed.image = { url: feedback.attachment_url };
  }

  return embed;
}

// Fires the Discord webhook for a saved feedback row. Never throws — a
// Discord outage or missing/bad webhook URL must never fail the request
// that already saved the user's feedback.
export async function notifyFeedback(feedback, user) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [buildEmbed(feedback, user)] }),
    });

    if (!res.ok) {
      logError(`Discord webhook responded with ${res.status} for feedback_id=${feedback.id}`);
    }
  } catch (err) {
    logError(`Discord webhook call failed for feedback_id=${feedback.id}: ${err.message || err}`);
  }
}
