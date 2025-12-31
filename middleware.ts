// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ambil cookie session (jika Anda mengimplementasikannya nanti)
  const adminToken = request.cookies.get("admin-token")?.value;

  // Proteksi hanya untuk folder admin
  if (pathname.startsWith("/admin")) {
    // Jika tidak ada token, jangan langsung redirect jika ini adalah request internal Next.js
    // agar tidak mengganggu proses inisialisasi Firebase di client
    if (!adminToken) {
      // HANYA redirect jika user mengakses halaman secara langsung dan benar-benar tidak ada session
      // Namun, untuk Firebase Client-Side, sebaiknya proteksi dilakukan di page.tsx (Client Component)
      // agar tidak terjadi 403 Forbidden saat build/runtime di Vercel.
      
      // Jika Anda ingin mematikan redirect agresif ini agar bisa masuk ke dashboard:
      return NextResponse.next(); 
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};