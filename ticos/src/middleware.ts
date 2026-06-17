import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (pathname.startsWith("/api/admin") && token.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-id", token.tenantId as string);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/webhooks") ||
          pathname === "/"
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
