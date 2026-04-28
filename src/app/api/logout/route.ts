import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set('lino_admin_auth', '', { maxAge: 0 });
  return response;
}
