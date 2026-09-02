import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, verified, user: clientUser } = body;

    let user = clientUser;

    // 1. Se foi enviado email e senha para verificação no servidor
    if (email && password) {
      const { data: dbUser, error: dbError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim())
        .maybeSingle();

      if (dbError || !dbUser) {
        return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
      }

      if (dbUser.active === false) {
        return NextResponse.json({ success: false, error: 'Usuário desativado. Contate o administrador.' }, { status: 403 });
      }

      user = dbUser;
    }

    // 2. Se temos um usuário autenticado, gerar cookies de sessão
    if (user) {
      const response = NextResponse.json({
        success: true,
        user: { id: user.id, name: user.name, role: user.role, email: user.email }
      });
      
      response.cookies.set('lino_admin_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      response.cookies.set('lino_user', JSON.stringify({ id: user.id, name: user.name, role: user.role, email: user.email }), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      return response;
    }

    return NextResponse.json({ success: false, error: 'Credenciais não fornecidas.' }, { status: 400 });
  } catch (err: any) {
    console.error('[Auth] Exception:', err.message);
    return NextResponse.json({ success: false, error: 'Erro interno: ' + err.message }, { status: 500 });
  }
}
