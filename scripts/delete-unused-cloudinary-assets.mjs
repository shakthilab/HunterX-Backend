// scripts/delete-unused-cloudinary-assets.mjs
//
// Permanently removes images from Cloudinary that were uploaded by the
// asset migration but ended up unreferenced in the mobile app's code.
//
// Usage: node scripts/delete-unused-cloudinary-assets.mjs

import 'dotenv/config';
import cloudinary from '../src/config/cloudinary.js';

const UNUSED_PUBLIC_IDS = [
  'hunterx/app-assets/Avatar',
  'hunterx/app-assets/Avatar1',
  'hunterx/app-assets/Avatar2',
  'hunterx/app-assets/naruto',
  'hunterx/app-assets/luffy',
  'hunterx/app-assets/gojo',
  'hunterx/app-assets/itachi',
  'hunterx/app-assets/goku',
  'hunterx/app-assets/jinwoo',
  'hunterx/app-assets/trophy_7_day',
  'hunterx/app-assets/trophy_14_day',
  'hunterx/app-assets/guest_pass_anime',
  'hunterx/app-assets/profileright',
  'hunterx/app-assets/popup avatar',
  'hunterx/app-assets/daily_clear_bg',
];

async function main() {
  const result = await cloudinary.api.delete_resources(UNUSED_PUBLIC_IDS);
  for (const [publicId, status] of Object.entries(result.deleted)) {
    console.log(`  ${status === 'deleted' ? '✓' : '✗'} ${publicId}: ${status}`);
  }
}

main();
