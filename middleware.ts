// middleware.ts (Letakkan di folder root atau src/)
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ambil cookie untuk proteksi admin
  const adminToken = request.cookies.get("admin-token")?.value;

  // Jika mencoba masuk ke admin tapi tidak ada token
  if (pathname.startsWith("/admin") && !adminToken) {
    // Redirect ke login profil, bukan ke /login (karena /login tidak ada/404)
    return NextResponse.redirect(new URL("/profil/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};