// src/middleware/auth.js — Verify JWT on protected routes

import { verifyAccessToken } from '../utils/helpers.js';
import { error } from '../utils/response.js';
import prisma from '../config/prisma.js';

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Unauthorized — no token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch user from DB to check banned status
    const user = await prisma.users.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: {
        id:       true,
        role:     true,
        is_banned: true,
        onboarding_done: true,
        hunter_id: true,
        name:     true,
        email:    true,
      },
    });

    if (!user) {
      return error(res, 'Unauthorized — user not found', 401);
    }

    if (user.is_banned) {
      return error(res, 'Your account has been suspended', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired — please refresh', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid token', 401);
    }
    next(err);
  }
}
