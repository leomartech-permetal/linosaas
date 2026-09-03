import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAuthUser, unauthorizedResponse, LEAD_PATCH_ALLOWLIST } from '@/lib/auth-helpers';

// GET: Lista todos os leads com dados de vendedor e ordenação
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'));
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select('*, seller:current_owner_id(id, name)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      console.error('[API Leads GET Error]', error);
      return NextResponse.json({ error: 'Erro ao buscar leads.' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count ?? 0, page, limit });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// POST: Cria um novo lead (campo de sistema: nunca confia no body para tenant)
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();

    // Campos mínimos obrigatórios
    if (!body.whatsapp_number) {
      return NextResponse.json({ error: 'whatsapp_number é obrigatório.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert([{
        whatsapp_number: body.whatsapp_number,
        name: body.name || null,
        company: body.company || null,
        status: 'SDR_QUALIFICATION',
        bot_active: true,
      }])
      .select()
      .single();

    if (error) {
      console.error('[API Leads POST Error]', error);
      return NextResponse.json({ error: 'Erro ao criar lead.' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// PATCH: Atualiza campos permitidos de um lead (allowlist estrita)
export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do lead é obrigatório.' }, { status: 400 });
    }

    // Filtrar apenas campos da allowlist
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (LEAD_PATCH_ALLOWLIST.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select('*, seller:current_owner_id(id, name)')
      .single();

    if (error) {
      console.error('[API Leads PATCH Error]', error);
      return NextResponse.json({ error: 'Erro ao atualizar lead.' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// DELETE: Soft delete (marca como deletado, não remove do banco)
export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  // Apenas admin pode excluir
  if (!['admin', 'gestor', 'coordenador'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão insuficiente para excluir leads.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do lead é obrigatório.' }, { status: 400 });
    }

    // Soft delete: marcar como deletado sem remover dados
    const { error } = await supabase
      .from('leads')
      .update({ status: 'DELETED', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[API Leads DELETE Error]', error);
      return NextResponse.json({ error: 'Erro ao deletar lead.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
