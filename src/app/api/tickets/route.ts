import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers';

/**
 * API: /api/tickets
 * Gerenciamento de tickets de suporte de atendimento e pós-venda.
 * Autenticação obrigatória e isolamento de dados.
 */

// GET: Lista tickets com filtros por fluxo, status e paginação
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const flow = searchParams.get('flow'); // ATTENDANCE_SUPPORT ou POST_SALE
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('service_tickets')
      .select('*, lead:lead_id(name, company, whatsapp_number, tracking_code), assigned:assigned_to(name)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (flow) query = query.eq('flow', flow);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      console.error('[API Tickets GET Error]', error);
      return NextResponse.json({ error: 'Erro ao buscar tickets.' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count ?? 0, page, limit });
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// PATCH: Atualiza status, prioridade, responsável ou nota de resolução de um ticket
export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id, status, priority, assigned_to, resolution_note } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do ticket é obrigatório.' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
      if (status === 'RESOLVED') {
        updates.resolved_at = new Date().toISOString();
        updates.resolution_by = user.id;
      } else if (status === 'CLOSED') {
        updates.closed_at = new Date().toISOString();
      }
    }

    if (priority) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (resolution_note !== undefined) updates.resolution_note = resolution_note;

    const { data, error } = await supabase
      .from('service_tickets')
      .update(updates)
      .eq('id', id)
      .select('*, lead:lead_id(name, tracking_code)')
      .single();

    if (error) {
      console.error('[API Tickets PATCH Error]', error);
      return NextResponse.json({ error: 'Erro ao atualizar ticket.' }, { status: 500 });
    }

    // Registrar evento de resolução/atualização se resolvido
    if (status === 'RESOLVED' && data) {
      try {
        await supabase.from('conversation_events').insert([{
          lead_id: data.lead_id,
          ticket_id: data.id,
          event_type: 'ticket.resolved',
          actor_type: 'SELLER',
          actor_id: user.id,
          payload: { resolution_note, resolved_by_name: user.name },
        }]);
      } catch {}
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
