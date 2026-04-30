import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { verified, user } = body;

    // Se o login já foi verificado no client-side
    if (verified && user) {
      const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
      
      response.cookies.set('lino_admin_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });

      response.cookies.set('lino_user', JSON.stringify({ id: user.id, name: user.name, role: user.role, email: user.email }), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });

      return response;
    }

    return NextResponse.json({ success: false, error: 'Requisição inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('[Auth] Exception:', err.message);
    return NextResponse.json({ success: false, error: 'Erro interno: ' + err.message }, { status: 500 });
  }
}
