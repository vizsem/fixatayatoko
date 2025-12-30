// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin'; // ✅ Satu baris saja

export async function POST(req: Request) {
  try {
    // ... kode Anda
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 });
  }
}