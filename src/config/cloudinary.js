// src/config/cloudinary.js — Cloudinary SDK configuration
//
// Only used server-side to sign uploads (see routes/media.js). The API
// secret never leaves the backend — the mobile app receives a signature,
// not the secret itself.

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export default cloudinary;
