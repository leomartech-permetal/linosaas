import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usa service role key para ter permissão total (bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const whatsapp_number = body.whatsapp_number || '16991415319';

    // Normaliza variações do número
    const rawNumber = whatsapp_number.replace(/\D/g, ''); // só dígitos
    const withoutCountry = rawNumber.replace(/^55/, '');
    const without9 = rawNumber.replace(/(\d{2})9(\d{8})/, '$1$2');
    const withoutCountryAnd9 = withoutCountry.replace(/(\d{2})9(\d{8})/, '$1$2');

    // 1. Buscar todos os leads associados a qualquer variante desse número
    const { data: leads } = await supabase
      .from('leads')
      .select('id, whatsapp_number')
      .or(`whatsapp_number.ilike.%${withoutCountryAnd9}%,whatsapp_number.ilike.%${withoutCountry}%,whatsapp_number.ilike.%${rawNumber}%`);

    const leadIds = (leads || []).map((l) => l.id);

    if (leadIds.length > 0) {
      // 2. Deletar histórico em todas as tabelas relacionadas
      for (const id of leadIds) {
        try { await supabase.from('interactions').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('service_tickets').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('conversation_events').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('supervisor_escalations').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('lead_status_history').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('lead_follow_ups').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('attendance_bottlenecks').delete().eq('lead_id', id); } catch {}
        try { await supabase.from('outbound_messages').delete().eq('correlation_lead_id', id); } catch {}
      }

      // 3. Resetar COMPLETAMENTE todas as variáveis de qualificação, produto, empresa e status
      for (const id of leadIds) {
        await supabase
          .from('leads')
          .update({
            status: 'SDR_QUALIFICATION',
            qualification_completed: false,
            bot_active: true,
            name: null,
            company: null,
            empresa: null,
            cargo: null,
            cnpj: null,
            email_corporativo: null,
            cidade_empresa: null,
            estado_empresa: null,
            produto: null,
            detected_product: null,
            detected_ddd: null,
            quantidade: null,
            especificacao: null,
            observacao: null,
            marca_id: null,
            region_id: null,
            qualified_at: null,
            routed_at: null,
            last_mode: 'SDR',
            intent_type: null,
            return_intent: 'SDR',
            support_attempts: 0,
            sent_to_seller_at: null,
            seller_confirmed_at: null,
            seller_acknowledged_at: null,
            seller_contacted_at: null,
            quote_sent_at: null,
            attendance_started_at: null,
            tentativas_coleta: 0,
            qualification_state: null,
            tracking_code: null,
            tracking_id: null,
            context_source: null,
            context_interest: null,
            b2b_attempts: { cnpj: 0, email: 0, nome: 0, empresa: 0 },
            sla_breached: false,
            last_interaction_at: null,
            current_owner_id: null,
            assigned_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
    }

    // 4. Limpar mensagens de outbound/inbound associadas ao número
    try {
      await supabase.from('outbound_messages').delete().or(`to_phone.ilike.%${withoutCountryAnd9}%,to_phone.ilike.%${rawNumber}%`);
    } catch {}
    try {
      await supabase.from('inbound_messages').delete().or(`from_number.ilike.%${withoutCountryAnd9}%,from_number.ilike.%${rawNumber}%`);
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Histórico, tickets, dados de qualificação e memória completamente apagados para o número ${whatsapp_number}`,
      leadsResetados: leadIds.length,
    });
  } catch (error: any) {
    console.error('[Clear History Error]', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
