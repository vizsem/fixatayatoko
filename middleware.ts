import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Bypass public admin login page if any
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // NextAuth JWT session token check
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET, // Must be set via env — no insecure fallback
  });

  // Fallback check for legacy admin-token cookie during transition
  const legacyAdminToken = request.cookies.get("admin-token")?.value;

  // Protect all /admin routes
  if (pathname.startsWith("/admin")) {
    if (!token && !legacyAdminToken) {
      const redirectUrl = new URL("/profil/login", request.url);
      redirectUrl.searchParams.set("callbackUrl", encodeURI(pathname));
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/cashier", "/cashier/:path*"],
};