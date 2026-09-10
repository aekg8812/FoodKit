import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authRequestDiagnosticsEnabled } from "@/lib/diagnostics/authRequests";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export async function proxy(request: NextRequest) {
  const diagnosticsEnabled = authRequestDiagnosticsEnabled();
  const requestId = diagnosticsEnabled ? crypto.randomUUID() : undefined;

  if (diagnosticsEnabled) {
    console.info("[auth-request-debug]", {
      kind: "proxy-start",
      timestamp: new Date().toISOString(),
      requestId,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      method: request.method,
      purpose: request.headers.get("purpose"),
      secPurpose: request.headers.get("sec-purpose"),
      nextRouterPrefetch: request.headers.get("next-router-prefetch"),
      rsc: request.headers.get("rsc"),
      nextRouterStateTree: request.headers.has("next-router-state-tree"),
      accept: request.headers.get("accept"),
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      authGetUser: true,
    });
  }

  const { response, user } = await updateSession(request, requestId);
  const { pathname } = request.nextUrl;

  if (diagnosticsEnabled) {
    console.info("[auth-request-debug]", {
      kind: "proxy-auth-complete",
      timestamp: new Date().toISOString(),
      requestId,
      pathname,
      authenticated: Boolean(user),
      authGetUser: true,
    });
  }

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!user && !isPublicPath) {
    const redirectResponse = NextResponse.redirect(
      new URL("/login", request.url),
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (user && isPublicPath) {
    const redirectResponse = NextResponse.redirect(
      new URL("/home", request.url),
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
