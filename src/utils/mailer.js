// src/utils/mailer.js — Shared Nodemailer transport (Gmail SMTP)
//
// Single transporter reused by every service that sends transactional
// email (OTP, password reset, data export, ...) instead of each one
// opening its own SMTP connection pool.

import nodemailer from 'nodemailer';

export const mailTransporter = nodemailer.createTransport({
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

// Thin wrapper around sendMail that fills in the shared "from" address.
export async function sendMail({ to, subject, html, attachments }) {
  return mailTransporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to,
    subject,
    html,
    ...(attachments ? { attachments } : {}),
  });
}
