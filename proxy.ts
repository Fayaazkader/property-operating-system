import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  console.log("PROXY:", request.nextUrl.pathname);

  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('sb-'));

  const protectedPaths = ["/", "/leases", "/properties", "/tenants", "/financials", "/settings", "/admin"];
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/")
  );

  if (isProtected && !hasAuthCookie) {
    console.log("REDIRECT to landing");
    return NextResponse.redirect(new URL("/landing", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
