// src/services/dataExportService.js — "Download My Data" (GDPR export)
//
// Gathers everything HunterX stores about a user into a multi-sheet
// Excel workbook and emails it to their registered address. Satisfies
// GDPR data portability and Apple App Store Review Guideline 5.1.1.

import ExcelJS          from 'exceljs';
import prisma            from '../config/prisma.js';
import { sendMail }      from '../utils/mailer.js';
import { info, logError } from '../utils/logger.js';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 request per user per 24h

// ─────────────────────────────────────────────────────────────
// RATE LIMIT — one export per user per 24h, backed by
// data_export_requests (which also serves as the audit trail)
// ─────────────────────────────────────────────────────────────

async function assertNotRateLimited(bUserId) {
  const lastRequest = await prisma.data_export_requests.findFirst({
    where:   { user_id: bUserId },
    orderBy: { requested_at: 'desc' },
  });

  if (!lastRequest) return;

  const elapsedMs = Date.now() - lastRequest.requested_at.getTime();
  if (elapsedMs < RATE_LIMIT_WINDOW_MS) {
    const err = new Error('EXPORT_RATE_LIMITED');
    err.retryAfterMs = RATE_LIMIT_WINDOW_MS - elapsedMs;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// DATE FORMATTING — plain strings, kept simple on purpose
// ─────────────────────────────────────────────────────────────

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmtDateTime = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '');

const STATUS_LABELS = { COMPLETED: 'completed', PARTIAL: 'partial', SKIPPED: 'skipped' };

// ─────────────────────────────────────────────────────────────
// DATA GATHERING — one query per category, always returning
// arrays (never omitted) even when a user has no rows there
// ─────────────────────────────────────────────────────────────

async function gatherUserData(bUserId) {
  const profile = await prisma.users.findUnique({
    where:  { id: bUserId },
    // Deliberately hand-picked — never widen this with `include`/spread,
    // it must never surface password_hash, reset_token or reset_token_expiry.
    select: {
      name:               true,
      email:              true,
      hunter_id:          true,
      gender:             true,
      date_of_birth:      true,
      height_cm:          true,
      weight_kg:          true,
      bmi:                true,
      daily_protein_goal: true,
      fitness_level:      true,
      dragon_stage:       true,
      created_at:         true,
    },
  });

  if (!profile) throw new Error('USER_NOT_FOUND');

  const [
    onboardingAnswers,
    taskCompletions,
    xpTransactions,
    userBadges,
    progression,
    userRewards,
    referralsSent,
    dragonStage,
  ] = await Promise.all([
    prisma.user_onboarding_answers.findMany({
      where:   { user_id: bUserId },
      orderBy: { question_id: 'asc' },
    }),
    prisma.task_completions.findMany({
      where:   { user_id: bUserId },
      orderBy: { completed_at: 'asc' },
      include: { tasks: { select: { title: true } } },
    }),
    prisma.xp_transactions.findMany({
      where:   { user_id: bUserId },
      orderBy: { created_at: 'asc' },
    }),
    prisma.user_badges.findMany({
      where:   { user_id: bUserId },
      orderBy: { earned_at: 'asc' },
      include: { badges: { select: { name: true, description: true } } },
    }),
    prisma.user_progression.findUnique({ where: { user_id: bUserId } }),
    prisma.user_rewards.findMany({
      where:   { user_id: bUserId },
      orderBy: { assigned_at: 'asc' },
      include: {
        reward_pool: {
          select: {
            description:    true,
            reward_partners: { select: { name: true } },
          },
        },
      },
    }),
    prisma.referrals.findMany({
      where:   { referrer_id: bUserId },
      orderBy: { created_at: 'asc' },
      include: {
        users_referrals_referred_idTousers: { select: { name: true, hunter_id: true } },
      },
    }),
    prisma.dragon_stages.findUnique({
      where:  { stage_number: profile.dragon_stage },
      select: { name: true },
    }),
  ]);

  const currentLevel = progression
    ? await prisma.levels.findUnique({
        where:  { level_number: progression.current_level },
        select: { rank_name: true },
      })
    : null;

  const dragonStageLabel = dragonStage?.name || `Stage ${profile.dragon_stage}`;

  let runningTotal = 0;
  const xpHistory = xpTransactions.map((tx) => {
    runningTotal += tx.amount;
    return {
      date:          fmtDateTime(tx.created_at),
      amount:        tx.amount,
      reason:        tx.reason,
      running_total: runningTotal,
    };
  });

  return {
    profile: {
      name:                profile.name,
      hunter_id:           profile.hunter_id,
      email:               profile.email,
      gender:              profile.gender || 'Not specified',
      date_of_birth:       fmtDate(profile.date_of_birth) || 'Not specified',
      height_cm:           profile.height_cm ?? 'Not specified',
      weight_kg:           profile.weight_kg ?? 'Not specified',
      bmi:                 profile.bmi ?? 'Not specified',
      daily_protein_goal:  profile.daily_protein_goal ?? 'Not specified',
      fitness_level:       profile.fitness_level,
      dragon_stage:        dragonStageLabel,
      created_at:          fmtDateTime(profile.created_at),
    },

    onboarding: onboardingAnswers.map((a) => ({
      question_number: a.question_id,
      answer:          a.answer,
      answered_on:     fmtDateTime(a.created_at),
    })),

    tasks: taskCompletions.map((c) => ({
      date:      fmtDateTime(c.completed_at),
      task_name: c.tasks?.title || 'Unknown task',
      status:    STATUS_LABELS[c.status] || String(c.status).toLowerCase(),
      xp_earned: c.xp_earned,
    })),

    xp: xpHistory,

    badges: userBadges.map((b) => ({
      badge_name:  b.badges?.name || 'Unknown badge',
      description: b.badges?.description || '',
      earned_at:   fmtDateTime(b.earned_at),
    })),

    progression: {
      current_level:   progression?.current_level ?? 'N/A',
      current_rank:    currentLevel?.rank_name || 'N/A',
      total_xp:        progression?.total_xp ?? 0,
      current_streak:  progression?.daily_streak ?? 0,
      longest_streak:  progression?.longest_streak ?? 0,
      dragon_stage:    dragonStageLabel,
    },

    rewards: userRewards.map((r) => ({
      reward_name: r.reward_pool?.description || r.reward_pool?.reward_partners?.name || 'Reward',
      type:        r.trigger_type,
      received_at: fmtDateTime(r.assigned_at),
    })),

    referrals: referralsSent.map((r) => ({
      referred_user: r.users_referrals_referred_idTousers?.name
        || r.users_referrals_referred_idTousers?.hunter_id
        || 'Unknown user',
      referred_on: fmtDateTime(r.created_at),
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// WORKBOOK BUILDING — one sheet per category, in a fixed order
// ─────────────────────────────────────────────────────────────

// "Profile"/"Progression"-style sheet: a Field | Value pair per row.
function addKeyValueSheet(workbook, sheetName, pairs) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  sheet.addRows(pairs.map(([field, value]) => ({ field, value })));
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

// Table sheet: header row (bold) + one row per record, header-only if empty.
function addTableSheet(workbook, sheetName, columns, rows) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  if (rows.length) sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

async function buildWorkbookBuffer(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HunterX';
  workbook.created = new Date();

  // 1. Profile
  addKeyValueSheet(workbook, 'Profile', [
    ['Name', data.profile.name],
    ['Hunter ID', data.profile.hunter_id],
    ['Email', data.profile.email],
    ['Gender', data.profile.gender],
    ['Date of Birth', data.profile.date_of_birth],
    ['Height (cm)', data.profile.height_cm],
    ['Weight (kg)', data.profile.weight_kg],
    ['BMI', data.profile.bmi],
    ['Daily Protein Goal', data.profile.daily_protein_goal],
    ['Fitness Level', data.profile.fitness_level],
    ['Dragon Stage', data.profile.dragon_stage],
    ['Account Created', data.profile.created_at],
  ]);

  // 2. Onboarding Answers
  addTableSheet(workbook, 'Onboarding Answers', [
    { header: 'Question Number', key: 'question_number', width: 18 },
    { header: 'Answer',          key: 'answer',          width: 50 },
    { header: 'Answered On',     key: 'answered_on',     width: 20 },
  ], data.onboarding);

  // 3. Task History
  addTableSheet(workbook, 'Task History', [
    { header: 'Date',      key: 'date',      width: 20 },
    { header: 'Task Name', key: 'task_name', width: 40 },
    { header: 'Status',    key: 'status',    width: 14 },
    { header: 'XP Earned', key: 'xp_earned', width: 12 },
  ], data.tasks);

  // 4. XP History
  addTableSheet(workbook, 'XP History', [
    { header: 'Date',          key: 'date',          width: 20 },
    { header: 'XP Amount',     key: 'amount',         width: 12 },
    { header: 'Reason/Source', key: 'reason',         width: 40 },
    { header: 'Running Total', key: 'running_total',  width: 16 },
  ], data.xp);

  // 5. Badges Earned
  addTableSheet(workbook, 'Badges Earned', [
    { header: 'Badge Name',   key: 'badge_name',  width: 30 },
    { header: 'Description',  key: 'description', width: 50 },
    { header: 'Date Earned',  key: 'earned_at',    width: 20 },
  ], data.badges);

  // 6. Progression
  addKeyValueSheet(workbook, 'Progression', [
    ['Current Level', data.progression.current_level],
    ['Current Rank', data.progression.current_rank],
    ['Total XP', data.progression.total_xp],
    ['Current Streak', data.progression.current_streak],
    ['Longest Streak', data.progression.longest_streak],
    ['Dragon Stage', data.progression.dragon_stage],
  ]);

  // 7. Rewards
  addTableSheet(workbook, 'Rewards', [
    { header: 'Reward Name',    key: 'reward_name', width: 35 },
    { header: 'Type',           key: 'type',        width: 18 },
    { header: 'Date Received',  key: 'received_at', width: 20 },
  ], data.rewards);

  // 8. Referrals
  addTableSheet(workbook, 'Referrals', [
    { header: 'Referred User', key: 'referred_user', width: 30 },
    { header: 'Date Referred', key: 'referred_on',    width: 20 },
  ], data.referrals);

  return workbook.xlsx.writeBuffer();
}

// ─────────────────────────────────────────────────────────────
// EMAIL — attaches the workbook, reuses the OTP email's branding
// ─────────────────────────────────────────────────────────────

function buildEmailHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:8px;border:1px solid #222222;overflow:hidden;">

              <tr>
                <td style="background-color:#000000;padding:32px;text-align:center;border-bottom:1px solid #222222;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-style:italic;letter-spacing:4px;">HUNTERX</h1>
                  <p style="margin:8px 0 0;color:#555555;font-size:12px;letter-spacing:2px;text-transform:uppercase;">The system awaits</p>
                </td>
              </tr>

              <tr>
                <td style="padding:40px 32px;text-align:center;">
                  <p style="margin:0 0 8px;color:#E8A020;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Data Export</p>
                  <h2 style="margin:0 0 16px;color:#ffffff;font-size:28px;font-weight:bold;">Your data archive is ready</h2>
                  <p style="margin:0 0 24px;color:#555555;font-size:14px;line-height:1.6;">
                    As requested, we've attached an Excel spreadsheet with everything HunterX
                    has on your account — your profile, tasks, XP, badges, progression,
                    rewards and referrals, each on its own sheet.
                  </p>
                  <p style="margin:0;color:#333333;font-size:12px;">
                    If you did not request this export, please secure your account and contact support.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;text-align:center;border-top:1px solid #222222;">
                  <p style="margin:0;color:#333333;font-size:11px;">HunterX by Gymgasm · Do not reply to this email</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────

export async function requestDataExport(userId) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);

  await assertNotRateLimited(bUserId);

  info(`Data export requested — user_id=${bUserId} at=${new Date().toISOString()}`);

  const exportData = await gatherUserData(bUserId);
  const exportedAt = new Date();

  const fileBuffer = await buildWorkbookBuffer(exportData);
  const filename = `HunterX_Data_Export_${exportData.profile.hunter_id || bUserId}.xlsx`;

  try {
    await sendMail({
      to:      exportData.profile.email,
      subject: 'Your HunterX Data Export',
      html:    buildEmailHtml(),
      attachments: [
        {
          filename,
          content:     fileBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  } catch (err) {
    logError(`Failed to send data export email — user_id=${bUserId}: ${err.message || err}`);
    throw new Error('EXPORT_EMAIL_FAILED');
  }

  // Only record (and thus start the 24h cooldown) once the email is
  // actually sent — a transient SMTP failure shouldn't lock the user out.
  await prisma.data_export_requests.create({
    data: { user_id: bUserId, requested_at: exportedAt },
  });

  info(`Data export sent — user_id=${bUserId} email=${exportData.profile.email}`);

  return { email: exportData.profile.email };
}
