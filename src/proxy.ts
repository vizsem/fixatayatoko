import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';
import { authorize } from '@/lib/actions/guard';

/**
 * Gerbang halaman admin.
 *
 * Menggantikan `middleware.ts` yang selama ini tidak berjalan: Next.js memilih
 * `src/middleware.ts` (yang isinya hanya pass-through) sehingga pemeriksaan auth
 * di `middleware.ts` akar tidak pernah dieksekusi. Sejak Next.js 16 nama
 * konvensi ini adalah `proxy.ts`, dan Next.js MENOLAK build bila berkas
 * `middleware.ts` dan `proxy.ts` sama-sama ada.
 *
 * Yang diperiksa adalah cookie `ataya-access-token` berisi token akses Supabase.
 * Keasliannya diverifikasi ke Supabase, jadi tidak bisa dipalsukan — berbeda
 * dengan cookie `admin-token` lama yang hanya berisi string "true".
 *
 * PENTING: ini BUKAN satu-satunya pengaman. Dokumentasi Next.js menegaskan
 * Server Action selalu dapat dipanggil lewat POST langsung, sehingga
 * pemeriksaan di sini tidak berlaku untuknya. Setiap action memverifikasi
 * pemanggilnya sendiri lewat `requireAdmin()` / `requireStaff()`
 * (lihat `src/lib/actions/session.ts`). Proxy ini menutup tampilan halaman,
 * bukan menggantikan otorisasi di action.
 *
 * Permintaan yang tidak punya akses dialihkan ke `/admin/login`, bukan
 * ditolak mentah, agar pengguna bisa langsung masuk.
 */

/** Halaman masuk admin. Wajib dilewati, kalau tidak akan terjadi loop. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let token: string | null = null;
  if (raw && raw.trim() !== '') {
    try {
      token = decodeURIComponent(raw);
    } catch {
      token = raw;
    }
  }

  // Peran `staff` mencakup admin, owner, kasir, dan staf gudang.
  const identity = await authorize(token, 'staff');
  if (identity.ok) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/admin/login', request.url);
  if (pathname !== '/admin' && pathname !== '/admin/') {
    loginUrl.searchParams.set('callbackUrl', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/cashier', '/cashier/:path*'],
};
