import { NextResponse, type NextRequest } from 'next/server';
import { authorizeOperatorRequest } from './lib/security/operator-access';

export async function middleware(request: NextRequest) {
  const denied = await authorizeOperatorRequest(request);
  if (denied) return denied;
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
