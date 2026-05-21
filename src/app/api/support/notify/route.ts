import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { notifySellerAboutLead } from '@/lib/evolution-api';

export async function POST(request: Request) {
  try {
    const { leadId } = await request.json();
    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório' }, { status: 400 });
    }

    // 1. Buscar o lead e vendedor
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, seller:current_owner_id(id, name, whatsapp_number)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const seller = lead.seller as any;
    if (!seller) {
      return NextResponse.json({ error: 'Nenhum vendedor atribuído a este lead' }, { status: 400 });
    }

    // 2. Buscar o telefone ativo do vendedor (das instâncias ou fallback)
    const { data: sellerInstance } = await supabase
      .from('instances')
      .select('phone_number')
      .eq('assigned_user_id', seller.id)
      .eq('active', true)
      .limit(1)
      .single();

    const sellerPhone = sellerInstance?.phone_number || seller.whatsapp_number;
    if (!sellerPhone) {
      return NextResponse.json({ error: 'Vendedor sem número de WhatsApp configurado' }, { status: 400 });
    }

    // 3. Notificar via Evolution API (com attempt 3, que é a de urgência)
    const sent = await notifySellerAboutLead(
      sellerPhone,
      lead.name || 'Lead',
      lead.whatsapp_number || '',
      3
    );

    if (!sent) {
      return NextResponse.json({ error: 'Erro ao enviar notificação via Evolution API' }, { status: 500 });
    }

    // 4. Registrar em lead_follow_ups
    await supabase.from('lead_follow_ups').insert([{
      lead_id: leadId,
      assigned_user_id: seller.id,
      team_id: lead.team_id || seller.team_id,
      attempt_number: 3,
      status: 'NOTIFIED',
    }]);

    return NextResponse.json({ success: true, message: 'Vendedor notificado com sucesso!' });
  } catch (error: any) {
    console.error('[API Notify Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
