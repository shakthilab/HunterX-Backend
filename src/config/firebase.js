// src/config/firebase.js - Firebase Admin SDK configuration and messaging instance export

import admin from 'firebase-admin';
import { info, error } from '../utils/logger.js';

let messaging = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }
  messaging = admin.messaging();
  info('Firebase Admin initialized successfully');
} catch (err) {
  error(`Firebase Admin initialization failed: ${err.message}`);
}

export { messaging };
export default messaging;
