import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function GET() {
  const isInitialized = admin.apps.length > 0;
  const dbReady = adminDb && typeof adminDb.collection === 'function';
  
  return NextResponse.json({
    status: isInitialized && dbReady ? 'ok' : 'error',
    message: isInitialized && dbReady
      ? 'Firebase Admin is initialized and ready.' 
      : 'Firebase Admin failed to initialize. Please check Environment Variables.',
    details: {
      appsLength: admin.apps.length,
      dbReady,
      envCheck: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        projectIdValue: process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID.substring(0, 3)}***` : null
      }
    }
  }, { status: isInitialized && dbReady ? 200 : 500 });
}
