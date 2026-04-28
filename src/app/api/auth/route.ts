import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { password } = body;

  // Senha padrão de segurança
  const correctPassword = process.env.ADMIN_PASSWORD || "permetal2026";

  if (password === correctPassword) {
    const response = NextResponse.json({ success: true });
    // Define um cookie seguro válido por 7 dias
    response.cookies.set('lino_admin_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 dias
    });
    return response;
  }

  return NextResponse.json({ success: false, error: 'Senha incorreta' }, { status: 401 });
}
