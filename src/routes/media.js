// src/routes/media.js — Signed direct-to-Cloudinary uploads
//
// The mobile app never sees the Cloudinary API secret. Instead it asks us
// for a signature, then uploads the file straight to Cloudinary's API
// using that signature (the file itself never passes through our server).
//
// Flow:
//   1. Client: POST /api/media/signature { folder: 'avatars' }
//   2. Us:     sign { timestamp, folder } with the API secret, return it
//              alongside cloudName + apiKey (both public, not secret)
//   3. Client: POST https://api.cloudinary.com/v1_1/<cloudName>/image/upload
//              with { file, api_key, timestamp, signature, folder }

import { Router }         from 'express';
import { verifyToken }    from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import cloudinary          from '../config/cloudinary.js';

const router = Router();

// Folders we allow uploads into — keeps the client from writing into an
// arbitrary/unbounded path on our Cloudinary account.
const ALLOWED_FOLDERS = ['avatars', 'guest-pass', 'task-proof', 'misc'];

// ── POST /api/media/signature ─────────────────────────────
// Body: { folder?: 'avatars' | 'guest-pass' | 'task-proof' | 'misc' }
// (defaults to 'misc' if omitted)
// Header: Authorization: Bearer <access_token>

router.post('/signature', verifyToken, async (req, res, next) => {
  try {
    const folderInput = req.body?.folder || 'misc';

    if (!ALLOWED_FOLDERS.includes(folderInput))
      return error(res, `folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`, 400);

    // Namespace by user so uploads land at e.g. hunterx/avatars/<userId>/...
    const folder = `hunterx/${folderInput}/${req.user.id}`;
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    return success(res, {
      timestamp,
      signature,
      folder,
      apiKey:    process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    }, 'Signature issued');

  } catch (err) {
    next(err);
  }
});

export default router;
