import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-helpers';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const { data, error } = await supabase
      .from('admin_users')
      // Não retornar whatsapp_number por padrão (apenas id e name para o Kanban)
      .select('id, name, role, team_id')
      .order('name');

    if (error) return NextResponse.json({ error: 'Erro ao buscar usuários.' }, { status: 500 });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
