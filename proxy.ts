
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api') ||
      request.nextUrl.pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  let response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const publicRoutes = ['/login', '/signup', '/landing'];
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  if (session && request.nextUrl.pathname === '/landing') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!session && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
