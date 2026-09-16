// scripts/upload-steps-task-images.js
//
// One-off: uploads the male/female art for the "Daily Steps" task to
// Cloudinary (same folder + naming convention as the other gendered task
// images — see migrate-assets-to-cloudinary.mjs and prisma/seed.js), then
// prints the f_auto,q_auto delivery URLs to paste into seed.js.
//
// Source files (local only, not committed):
//   /Users/shakthi/Desktop/Freelance/HunterX_asserts/walk.jpeg  (male)
//   /Users/shakthi/Downloads/walk_female.jpeg                   (female)
//
// Usage: node scripts/upload-steps-task-images.js

import 'dotenv/config';
import cloudinary from '../src/config/cloudinary.js';

const UPLOADS = [
  { file: '/Users/shakthi/Desktop/Freelance/HunterX_asserts/walk.jpeg', publicId: 'steps' },
  { file: '/Users/shakthi/Downloads/walk_female.jpeg', publicId: 'steps_female' },
];

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env');
    process.exit(1);
  }

  for (const { file, publicId } of UPLOADS) {
    const result = await cloudinary.uploader.upload(file, {
      folder: 'hunterx/app-assets',
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
    });

    // Same f_auto,q_auto delivery transformation every other task image
    // uses — auto best format (WebP/AVIF where supported) + auto quality,
    // computed on Cloudinary's side per-request rather than baked into a
    // fixed file, so it's the "compressed for UI" version at serve time.
    const deliveryUrl = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    console.log(`${publicId}: ${deliveryUrl}`);
  }
}

main().catch(err => {
  console.error('upload-steps-task-images failed:', err);
  process.exitCode = 1;
});
