// scripts/migrate-assets-to-cloudinary.mjs
//
// One-time migration: uploads HunterX-Mobile/assets/images/* to Cloudinary
// (skipping files Expo needs locally for native builds — app icons/splash)
// and writes a { filename: secure_url } map to
// scripts/asset-migration-map.json for the mobile repo to consume.
//
// Usage: node scripts/migrate-assets-to-cloudinary.mjs

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudinary from '../src/config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_IMAGES_DIR = path.resolve(__dirname, '../../HunterX-Mobile/assets/images');
const OUTPUT_FILE = path.resolve(__dirname, 'asset-migration-map.json');

// Expo reads these directly off disk at build time to generate native app
// icons / splash screens — they must stay local, a remote URL won't work.
const SKIP_FILES = new Set([
  'icon.png',
  'splash-icon.png',
  'android-icon-foreground.png',
  'android-icon-background.png',
  'android-icon-monochrome.png',
  'favicon.png',
]);

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env');
    process.exit(1);
  }

  const files = fs
    .readdirSync(MOBILE_IMAGES_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !SKIP_FILES.has(f));

  console.log(`Uploading ${files.length} files (skipping ${SKIP_FILES.size} build-required assets)...`);

  const map = {};
  let ok = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(MOBILE_IMAGES_DIR, file);
    const publicId = path.parse(file).name; // filename without extension
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'hunterx/app-assets',
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      });
      map[file] = result.secure_url;
      ok++;
      console.log(`  ✓ ${file} -> ${result.secure_url}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2));
  console.log(`\nDone: ${ok} uploaded, ${failed} failed.`);
  console.log(`Map written to ${OUTPUT_FILE}`);
}

main();
