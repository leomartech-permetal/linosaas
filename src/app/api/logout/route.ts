import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect(new URL('/login', 'https://linosaas.vercel.app'));
  response.cookies.set('lino_admin_auth', '', { maxAge: 0 });
  return response;
}
