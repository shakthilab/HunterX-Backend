// scripts/create-admin.js
// Creates (or promotes) an ADMIN user with a known email + password.
// Usage: node scripts/create-admin.js [email] [password] [name]

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import { generateHunterId, generateReferralCode } from '../src/utils/helpers.js';

const email    = process.argv[2] || 'admin@yopmail.com';
const password = process.argv[3] || 'admin123';
const name     = process.argv[4] || 'Admin';

async function main() {
  const salt         = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const existing = await prisma.users.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.users.update({
      where: { id: existing.id },
      data: {
        password_hash: passwordHash,
        role:          'ADMIN',
      },
    });
    console.log(`Updated existing user to ADMIN — id: ${updated.id}, hunter_id: ${updated.hunter_id}, email: ${updated.email}`);
    return;
  }

  const user = await prisma.users.create({
    data: {
      hunter_id:       await generateHunterId(),
      name,
      email,
      password_hash:   passwordHash,
      referral_code:   generateReferralCode(),
      role:            'ADMIN',
      onboarding_done: true,
    },
  });

  await prisma.auth_providers.create({
    data: {
      user_id:     user.id,
      provider:    'EMAIL',
      provider_id: email,
    },
  });

  await prisma.user_progression.create({
    data: { user_id: user.id },
  });

  console.log(`Created ADMIN user — id: ${user.id}, hunter_id: ${user.hunter_id}, email: ${user.email}`);
}

main()
  .catch((err) => {
    console.error('Failed to create admin user:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
