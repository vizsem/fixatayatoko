// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Pass-through to avoid redirect loops when using client-side Supabase auth (localStorage).
  // Route authorization and role verification are enforced client-side via useAdminAuth / Supabase auth.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

