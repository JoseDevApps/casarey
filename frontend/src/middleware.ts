import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/register', '/properties']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  // Always allow API routes and static assets
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  // Allow public paths (exact match or properties detail)
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/properties/')

  if (isPublic) {
    // Redirect logged-in users away from login/register
    if (token && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard/reservations', request.url))
    }
    return NextResponse.next()
  }

  // All /dashboard/* routes require authentication
  if (pathname.startsWith('/dashboard/')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
