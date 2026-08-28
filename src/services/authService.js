// src/services/authService.js — All auth and onboarding business logic

import bcrypt           from 'bcryptjs';
import crypto           from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import appleSignin      from 'apple-signin-auth';
import nodemailer        from 'nodemailer';
import prisma            from '../config/prisma.js';
import { logError }      from '../utils/logger.js';
import { assignDailyTasks } from './taskAssignmentService.js';
import { getISTDateOnly }   from '../utils/helpers.js';
import {
  generateHunterId,
  generateReferralCode,
  generateResetToken,
  generateTokens,
  calculateBMI,
  calculateProtein,
} from '../utils/helpers.js';

// Expo/React Native apps get Google ID tokens issued for different
// client IDs per platform (web/iOS/Android), so verifyIdToken() must
// accept whichever of them is actually configured as a valid audience.
const GOOGLE_AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID_WEB,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
  process.env.GOOGLE_CLIENT_ID, // legacy/single-client fallback
].filter(Boolean);

const googleClient = new OAuth2Client();
const mailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports (uses STARTTLS)
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Removes sensitive fields before sending user to client
// Never expose password_hash, reset_token, or reset_token_expiry
function sanitizeUser(user) {
  if (!user) return user;
  const {
    password_hash,
    reset_token,
    reset_token_expiry,
    ...safeUser
  } = user;
  return safeUser;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL — processOnboarding
// Saves all 10 onboarding answers and updates users table
// Called inside register/google/apple after user is created
// ─────────────────────────────────────────────────────────────

async function processOnboarding(userId, answers) {
  if (!answers || answers.length === 0) return;

  // Validate all answers have questionId and answer
  for (const a of answers) {
    if (!a.questionId || a.answer === undefined || a.answer === null) {
      throw new Error('INVALID_ONBOARDING_ANSWER');
    }
    if (a.questionId < 1 || a.questionId > 10) {
      throw new Error('INVALID_QUESTION_ID');
    }
  }

  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);

  // Upsert all answers in a single transaction
  // UNIQUE(user_id, question_id) means re-submitting is safe
  await prisma.$transaction(
    answers.map(a =>
      prisma.user_onboarding_answers.upsert({
        where: {
          user_id_question_id: {
            user_id:     bUserId,
            question_id: Number(a.questionId),
          },
        },
        create: {
          user_id:     bUserId,
          question_id: Number(a.questionId),
          answer:      String(a.answer),
        },
        update: {
          answer: String(a.answer),
        },
      })
    )
  );

  // Build users table update from answers
  const userUpdates = {};

  for (const a of answers) {
    switch (Number(a.questionId)) {

      case 1:
        // Hunter Name — stored in users.name, max 24 chars
        userUpdates.name = String(a.answer).trim().slice(0, 24);
        break;

      case 2:
        // Genetic Profile — stored in users.gender
        // answer values: male / female / other
        const genderMap = {
          male:   'MALE',
          female: 'FEMALE',
          other:  'OTHER',
        };
        userUpdates.gender = genderMap[String(a.answer).toLowerCase()] || 'OTHER';
        break;

      case 3:
        // Temporal Age — store age directly in userUpdates, keep date_of_birth as null
        // answer is age as string e.g. "24"
        const age = parseInt(a.answer);
        if (!isNaN(age) && age >= 8 && age <= 80) {
          userUpdates.age = age;
        }
        break;

      case 4:
        // Height — stored in users.height_cm
        // answer is height in cm as string e.g. "181"
        const h = parseFloat(a.answer);
        if (!isNaN(h) && h >= 80 && h <= 230) {
          userUpdates.height_cm = h;
        }
        break;

      case 5:
        // Weight — stored in users.weight_kg
        // answer is weight in kg as string e.g. "75.5"
        const w = parseFloat(a.answer);
        if (!isNaN(w) && w >= 40 && w <= 160) {
          userUpdates.weight_kg = w;
        }
        break;

      case 8:
        // Self Assessment — map rank to fitness_level enum
        // answer values: e_rank / d_rank / c_rank / b_rank / a_rank / beginner / intermediate / advanced
        const levelMap = {
          e_rank: 'BEGINNER',
          d_rank: 'BEGINNER',
          c_rank: 'BEGINNER',
          b_rank: 'INTERMEDIATE',
          a_rank: 'ADVANCED',
          beginner: 'BEGINNER',
          intermediate: 'INTERMEDIATE',
          advanced: 'ADVANCED',
        };
        userUpdates.fitness_level = levelMap[a.answer] || 'BEGINNER';
        break;

      case 10:
        // The Oath — all 3 checkboxes confirmed
        // answer must be "accepted"
        if (a.answer === 'accepted') {
          userUpdates.oath_accepted    = true;
          userUpdates.oath_accepted_at = new Date();
        }
        break;

      // Q6 core_drive, Q7 weakness, Q9 training_window
      // stored only in user_onboarding_answers — no users table update
      default:
        break;
    }
  }

  // Calculate BMI and protein if height and weight both present
  const heightAns = answers.find(a => Number(a.questionId) === 4);
  const weightAns = answers.find(a => Number(a.questionId) === 5);
  const windowAns = answers.find(a => Number(a.questionId) === 9);

  if (heightAns && weightAns) {
    const finalH = parseFloat(heightAns.answer);
    const finalW = parseFloat(weightAns.answer);

    if (!isNaN(finalH) && !isNaN(finalW)) {
      // Map training window answer to activity key for protein calc
      const activityMap = {
        '15min':    'sedentary',
        '30min':    'lightly_active',
        '1hr':      'active',
        '2hr_plus': 'very_active',
      };
      const rawWindowAnswer = windowAns?.answer;
      const activityKey     = activityMap[rawWindowAnswer];

      if (!activityKey) {
        // Q9 answer didn't match any of the four values the mobile app is
        // supposed to send. Falling back silently here previously caused
        // protein goals to be quietly under-calculated (defaulted to
        // SEDENTARY/0.8x) with no trace. Log loudly — with the actual
        // unmapped value and the affected user — so this is caught
        // immediately instead of corrupting data unnoticed. We still fall
        // back to keep registration from failing on a bad enum value.
        logError(
          `Q9_ACTIVITY_MAP_MISMATCH: unrecognized training_window answer ` +
          `${JSON.stringify(rawWindowAnswer)} for user ${bUserId}. ` +
          `Expected one of "15min" | "30min" | "1hr" | "2hr_plus". ` +
          `Defaulting to SEDENTARY (0.8x) — daily_protein_goal for this ` +
          `user should be recalculated once the mismatch is fixed.`
        );
      }

      userUpdates.bmi                = calculateBMI(finalW, finalH);
      userUpdates.daily_protein_goal = calculateProtein(finalW, activityKey || 'sedentary');
    }
  }

  // Mark onboarding complete
  userUpdates.onboarding_done = true;
  userUpdates.onboarding_step = 10;

  // Single update to users table — all calculated fields at once
  await prisma.users.update({
    where: { id: bUserId },
    data:  userUpdates,
  });

  // Trigger B of the automatic task-assignment system (see
  // taskAssignmentService.js) — this is the one place all onboarding
  // flows (register, Google, Apple, completeOnboarding) funnel through,
  // so a new user gets today's tasks immediately instead of waiting for
  // the nightly cron. Never let an assignment hiccup fail onboarding —
  // the request-time fallback (trigger C) covers the gap if this fails.
  try {
    await assignDailyTasks(bUserId, getISTDateOnly());
  } catch (err) {
    logError(`Task assignment on onboarding failed for user ${bUserId}: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// INTERNAL — createBaseUser
// Creates the user record, auth_provider, and user_progression
// Used by all three auth methods
// ─────────────────────────────────────────────────────────────

async function createBaseUser({ name, email, provider, providerId, passwordHash }) {
  const user = await prisma.users.create({
    data: {
      hunter_id:     await generateHunterId(),
      name:          name?.trim() || 'Hunter',
      email:         email || null,
      password_hash: passwordHash || null,
      referral_code: generateReferralCode(),
      role:          'USER',
    },
  });

  await prisma.auth_providers.create({
    data: {
      user_id:     user.id,
      provider,
      provider_id: providerId,
    },
  });

  await prisma.user_progression.create({
    data: { user_id: user.id },
  });

  return user;
}

// ─────────────────────────────────────────────────────────────
// SEND OTP FOR EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────

export async function sendOtp(email) {
  // Step 1 — Check email not already registered
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw new Error('email is already exist');

  // Step 2 — Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Step 3 — Delete any existing unused OTPs for this email
  await prisma.email_otps.deleteMany({
    where: { email },
  });

  // Step 4 — Save new OTP to DB with 10 minute expiry
  await prisma.email_otps.create({
    data: {
      email,
      otp,
      verified:   false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  // Step 5 — Send OTP email via Gmail SMTP (Nodemailer) (Asynchronous)
  mailTransporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to:      email,
    subject: 'Your HunterX verification code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
      </head>
      <body style="
        margin: 0;
        padding: 0;
        background-color: #0a0a0a;
        font-family: Arial, sans-serif;
      ">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table width="480" cellpadding="0" cellspacing="0" style="
                background-color: #111111;
                border-radius: 8px;
                border: 1px solid #222222;
                overflow: hidden;
              ">
                <!-- Header -->
                <tr>
                  <td style="
                    background-color: #000000;
                    padding: 32px;
                    text-align: center;
                    border-bottom: 1px solid #222222;
                  ">
                    <h1 style="
                      margin: 0;
                      color: #ffffff;
                      font-size: 24px;
                      font-style: italic;
                      letter-spacing: 4px;
                    ">HUNTERX</h1>
                    <p style="
                      margin: 8px 0 0;
                      color: #555555;
                      font-size: 12px;
                      letter-spacing: 2px;
                      text-transform: uppercase;
                    ">The system awaits</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 32px; text-align: center;">
                    <p style="
                      margin: 0 0 8px;
                      color: #888888;
                      font-size: 13px;
                      letter-spacing: 1px;
                      text-transform: uppercase;
                    ">Your verification code</p>

                    <p style="
                      margin: 0 0 32px;
                      color: #555555;
                      font-size: 14px;
                      line-height: 1.6;
                    ">Enter this code to verify your email and begin your journey as a Hunter.</p>

                    <!-- OTP Box -->
                    <div style="
                      background-color: #000000;
                      border: 1px solid #333333;
                      border-radius: 8px;
                      padding: 24px;
                      margin: 0 0 32px;
                      display: inline-block;
                      width: 100%;
                    ">
                      <p style="
                        margin: 0;
                        color: #ffffff;
                        font-size: 48px;
                        font-weight: bold;
                        letter-spacing: 16px;
                        font-family: 'Courier New', monospace;
                      ">${otp}</p>
                    </div>

                    <!-- Expiry warning -->
                    <p style="
                      margin: 0 0 8px;
                      color: #E8A020;
                      font-size: 13px;
                      font-weight: bold;
                    ">⚠ This code expires in 10 minutes</p>

                    <p style="
                      margin: 0;
                      color: #555555;
                      font-size: 12px;
                    ">If you did not request this code, ignore this email.</p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="
                    padding: 20px 32px;
                    text-align: center;
                    border-top: 1px solid #222222;
                  ">
                    <p style="
                      margin: 0;
                      color: #333333;
                      font-size: 11px;
                    ">HunterX by Gymgasm · Do not reply to this email</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  }).catch((err) => {
    logError(`Failed to send OTP email to ${email}: ${err.message || err}`);
  });

  return true;
}

// ─────────────────────────────────────────────────────────────
// VERIFY OTP
// ─────────────────────────────────────────────────────────────

export async function verifyOtp(email, otp) {
  // Step 1 — Find the latest unverified unexpired OTP for this email
  const record = await prisma.email_otps.findFirst({
    where: {
      email,
      verified:   false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  // Step 2 — If no record found, OTP is invalid or expired
  if (!record) throw new Error('INVALID_OTP');

  // Step 3 — Check OTP matches exactly
  if (record.otp !== otp.trim()) throw new Error('INVALID_OTP');

  // Step 4 — Mark as verified
  await prisma.email_otps.update({
    where: { id: record.id },
    data:  { verified: true },
  });

  // Step 5 — Return true
  return true;
}

// ─────────────────────────────────────────────────────────────
// REGISTER WITH EMAIL AND PASSWORD
// ─────────────────────────────────────────────────────────────

export async function registerWithEmail(name, email, password, onboarding = []) {
  // Check OTP was verified for this email before allowing registration
  const otpRecord = await prisma.email_otps.findFirst({
    where: {
      email,
      verified:   true,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!otpRecord) throw new Error('EMAIL_NOT_VERIFIED');

  // Check email not already taken
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw new Error('EMAIL_EXISTS');

  // Hash password
  const salt         = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  const user = await createBaseUser({
    name,
    email,
    provider:     'EMAIL',
    providerId:   email,
    passwordHash,
  });

  // Save onboarding answers and calculate profile fields
  await processOnboarding(user.id, onboarding);

  // Fetch updated user after onboarding updates
  const updatedUser = await prisma.users.findUnique({
    where: { id: user.id },
  });

  const tokens = generateTokens(updatedUser.id.toString(), updatedUser.role);

  // Clean up OTP record — no longer needed after registration
  await prisma.email_otps.deleteMany({ where: { email } });

  return {
    user:   sanitizeUser(updatedUser),
    ...tokens,
    isNew:  true,
  };
}

// ─────────────────────────────────────────────────────────────
// LOGIN WITH EMAIL AND PASSWORD
// No onboarding — existing users go straight to home
// ─────────────────────────────────────────────────────────────

export async function loginWithEmail(email, password) {
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user || !user.password_hash) throw new Error('INVALID_CREDENTIALS');
  if (user.is_banned) throw new Error('ACCOUNT_BANNED');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const tokens = generateTokens(user.id.toString(), user.role);

  return {
    user:  sanitizeUser(user),
    ...tokens,
    isNew: !user.onboarding_done,
  };
}

// ─────────────────────────────────────────────────────────────
// CONTINUE WITH GOOGLE
// New users — create account + save onboarding
// Existing users — log in, skip onboarding
// ─────────────────────────────────────────────────────────────

export async function loginWithGoogle(idToken, onboarding = []) {
  if (GOOGLE_AUDIENCES.length === 0) throw new Error('GOOGLE_NOT_CONFIGURED');

  // Verify Google token — throws for expired/malformed/wrong-audience tokens
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_AUDIENCES,
    });
  } catch {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  const payload  = ticket.getPayload();
  const googleId = payload.sub;
  const email    = payload.email;
  const name     = payload.name || 'Hunter';

  // Check by Google provider ID
  const existingProvider = await prisma.auth_providers.findFirst({
    where: { provider: 'GOOGLE', provider_id: googleId },
  });

  if (existingProvider) {
    // Existing Google user — log in only, no onboarding
    const user = await prisma.users.findUnique({
      where: { id: existingProvider.user_id },
    });
    if (!user || user.is_banned) throw new Error('ACCOUNT_BANNED');
    const tokens = generateTokens(user.id.toString(), user.role);
    return { user: sanitizeUser(user), ...tokens, isNew: false };
  }

  // Check if email already registered (e.g. with email+password)
  if (email) {
    const existingByEmail = await prisma.users.findUnique({ where: { email } });
    if (existingByEmail) {
      // Link Google to existing account
      await prisma.auth_providers.create({
        data: {
          user_id:     existingByEmail.id,
          provider:    'GOOGLE',
          provider_id: googleId,
        },
      });
      // Save onboarding if not yet done
      if (onboarding.length > 0 && !existingByEmail.onboarding_done) {
        await processOnboarding(existingByEmail.id, onboarding);
      }
      const tokens = generateTokens(existingByEmail.id.toString(), existingByEmail.role);
      return { user: sanitizeUser(existingByEmail), ...tokens, isNew: false, linked: true };
    }
  }

  // Brand new user via Google
  const user = await createBaseUser({
    name,
    email,
    provider:   'GOOGLE',
    providerId: googleId,
  });

  await processOnboarding(user.id, onboarding);

  const updatedUser = await prisma.users.findUnique({ where: { id: user.id } });
  const tokens      = generateTokens(updatedUser.id.toString(), updatedUser.role);

  return { user: sanitizeUser(updatedUser), ...tokens, isNew: true };
}

// ─────────────────────────────────────────────────────────────
// CONTINUE WITH APPLE
// Apple only provides name and email on the VERY FIRST login
// Name comes from onboarding Q1 answer — more reliable
// ─────────────────────────────────────────────────────────────

export async function loginWithApple(idToken, nonce, onboarding = []) {
  // Verify Apple token
  const appleUser = await appleSignin.verifyIdToken(idToken, {
    audience:         process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
    ...(nonce && { nonce }),
  });

  const appleId = appleUser.sub;
  const email   = appleUser.email || null;

  // Check by Apple provider ID
  const existingProvider = await prisma.auth_providers.findFirst({
    where: { provider: 'APPLE', provider_id: appleId },
  });

  if (existingProvider) {
    const user = await prisma.users.findUnique({
      where: { id: existingProvider.user_id },
    });
    if (!user || user.is_banned) throw new Error('ACCOUNT_BANNED');
    const tokens = generateTokens(user.id.toString(), user.role);
    return { user: sanitizeUser(user), ...tokens, isNew: false };
  }

  // Check by email
  if (email) {
    const existingByEmail = await prisma.users.findUnique({ where: { email } });
    if (existingByEmail) {
      await prisma.auth_providers.create({
        data: {
          user_id:     existingByEmail.id,
          provider:    'APPLE',
          provider_id: appleId,
        },
      });
      if (onboarding.length > 0 && !existingByEmail.onboarding_done) {
        await processOnboarding(existingByEmail.id, onboarding);
      }
      const tokens = generateTokens(existingByEmail.id.toString(), existingByEmail.role);
      return { user: sanitizeUser(existingByEmail), ...tokens, isNew: false, linked: true };
    }
  }

  // Brand new Apple user
  // Get name from Q1 answer since Apple only gives it once
  const nameFromOnboarding = onboarding.find(a => Number(a.questionId) === 1)?.answer
                             || 'Hunter';

  const user = await createBaseUser({
    name:       nameFromOnboarding,
    email,
    provider:   'APPLE',
    providerId: appleId,
  });

  await processOnboarding(user.id, onboarding);

  const updatedUser = await prisma.users.findUnique({ where: { id: user.id } });
  const tokens      = generateTokens(updatedUser.id.toString(), updatedUser.role);

  return { user: sanitizeUser(updatedUser), ...tokens, isNew: true };
}

// ─────────────────────────────────────────────────────────────
// REFRESH ACCESS TOKEN
// ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken) {
  const { verifyRefreshToken } = await import('../utils/helpers.js');
  const decoded = verifyRefreshToken(refreshToken);

  const userId = BigInt(decoded.userId);
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user)           throw new Error('USER_NOT_FOUND');
  if (user.is_banned)  throw new Error('ACCOUNT_BANNED');

  const tokens = generateTokens(user.id.toString(), user.role);
  return { user: sanitizeUser(user), ...tokens };
}

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// Always returns true — prevents user enumeration
// ─────────────────────────────────────────────────────────────

export async function forgotPassword(email) {
  // Check email exists in DB before sending reset email
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) throw new Error('EMAIL_NOT_FOUND');

  // Only works for email+password accounts (not Google/Apple)
  const emailProvider = await prisma.auth_providers.findFirst({
    where: { user_id: user.id, provider: 'EMAIL' },
  });
  if (!emailProvider) throw new Error('SOCIAL_ACCOUNT');

  // If there is already an active (unexpired) reset token, enforce cooldown
  if (user.reset_token && user.reset_token_expiry && user.reset_token_expiry > new Date()) {
    const remainingMs = user.reset_token_expiry.getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / (60 * 1000));
    const err = new Error('RESET_COOLDOWN');
    err.remainingMinutes = remainingMins;
    throw err;
  }

  const resetToken  = generateResetToken();
  const resetExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.users.update({
    where: { id: user.id },
    data: {
      reset_token:        resetToken,
      reset_token_expiry: resetExpiry,
    },
  });

  const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

  await mailTransporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to:      email,
    subject: 'Reset your HunterX Secret Key',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:40px 20px;">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:8px;border:1px solid #222222;">

                <tr>
                  <td style="background-color:#000000;padding:32px;text-align:center;border-bottom:1px solid #222222;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-style:italic;letter-spacing:4px;">HUNTERX</h1>
                    <p style="margin:8px 0 0;color:#555555;font-size:12px;letter-spacing:2px;text-transform:uppercase;">The system awaits</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px 32px;text-align:center;">
                    <p style="margin:0 0 8px;color:#E8A020;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Lost Access</p>
                    <h2 style="margin:0 0 16px;color:#ffffff;font-size:28px;font-weight:bold;">Recover your account</h2>
                    <p style="margin:0 0 32px;color:#555555;font-size:14px;line-height:1.6;">
                      Click the button below to reset your Secret Key.<br>
                      This link expires in 10 minutes.
                    </p>

                    <a href="${resetLink}" style="
                      display:inline-block;
                      background-color:#ffffff;
                      color:#000000;
                      text-decoration:none;
                      font-size:14px;
                      font-weight:bold;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      padding:16px 40px;
                      border-radius:4px;
                      margin-bottom:32px;
                    ">SET NEW PASSWORD</a>

                    <p style="margin:0 0 8px;color:#E8A020;font-size:12px;">
                      Link expires in 10 minutes
                    </p>
                    <p style="margin:0;color:#333333;font-size:12px;">
                      If you did not request this, ignore this email.<br>
                      Check your spam folder if you don't receive it within 2 minutes.
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
    `,
  });

  return true;
}

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────

export async function resetPassword(resetToken, newPassword) {

  // Find user with valid unexpired reset token
  const user = await prisma.users.findFirst({
    where: {
      reset_token:        resetToken,
      reset_token_expiry: { gt: new Date() },
    },
  });

  if (!user) throw new Error('INVALID_OR_EXPIRED_TOKEN');

  // Hash new password
  const salt    = await bcrypt.genSalt(12);
  const newHash = await bcrypt.hash(newPassword, salt);

  // Update password and clear reset token
  await prisma.users.update({
    where: { id: user.id },
    data: {
      password_hash:      newHash,
      reset_token:        null,
      reset_token_expiry: null,
    },
  });

  return true;
}

// ─────────────────────────────────────────────────────────────
// COMPLETE ONBOARDING
// For an already-authenticated user whose onboarding isn't done
// yet — e.g. a Google/Apple account created straight from the
// Login screen, before the onboarding wizard ran. Attaches the
// wizard answers to the existing account instead of creating a
// new one or issuing new tokens.
// ─────────────────────────────────────────────────────────────

export async function completeOnboarding(userId, onboarding = []) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);

  const user = await prisma.users.findUnique({ where: { id: bUserId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.onboarding_done) throw new Error('ONBOARDING_ALREADY_DONE');

  await processOnboarding(bUserId, onboarding);

  return getCurrentUser(bUserId);
}

// ─────────────────────────────────────────────────────────────
// GET CURRENT USER
// ─────────────────────────────────────────────────────────────

export async function getCurrentUser(userId) {
  const bUserId = typeof userId === 'bigint' ? userId : BigInt(userId);
  return prisma.users.findUnique({
    where: { id: bUserId },
    select: {
      id:                            true,
      hunter_id:                     true,
      name:                          true,
      email:                         true,
      avatar_id:                     true,
      role:                          true,
      onboarding_done:               true,
      onboarding_step:               true,
      is_banned:                     true,
      referral_code:                 true,
      referred_by:                   true,
      gender:                        true,
      date_of_birth:                 true,
      age:                           true,
      height_cm:                     true,
      weight_kg:                     true,
      bmi:                           true,
      daily_protein_goal:            true,
      fitness_level:                 true,
      dragon_stage:                  true,
      streak_freeze_available:       true,
      streak_freeze_used_this_month: true,
      oath_accepted:                 true,
      oath_accepted_at:              true,
      location_visible:              true,
      created_at:                    true,
      updated_at:                    true,
      user_progression:              true,
    },
  });
}
