import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usa service role key para ter permissão total (bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { whatsapp_number } = await request.json();

    if (!whatsapp_number) {
      return NextResponse.json({ error: 'Número de WhatsApp é obrigatório' }, { status: 400 });
    }

    // Tenta múltiplos formatos para achar o lead
    const rawNumber = whatsapp_number.replace(/\D/g, ''); // só dígitos
    const withoutCountry = rawNumber.replace(/^55/, '');
    const without9 = rawNumber.replace(/(\d{2})9(\d{8})/, '$1$2');
    const withoutCountryAnd9 = withoutCountry.replace(/(\d{2})9(\d{8})/, '$1$2');

    const formats = [
      `${rawNumber}@s.whatsapp.net`,
      `55${rawNumber}@s.whatsapp.net`,
      rawNumber,
      `55${rawNumber}`,
      `${withoutCountry}@s.whatsapp.net`,
      withoutCountry,
      `${without9}@s.whatsapp.net`,
      without9,
      `${withoutCountryAnd9}@s.whatsapp.net`,
      withoutCountryAnd9,
      `55${withoutCountryAnd9}@s.whatsapp.net`,
      `55${withoutCountryAnd9}`
    ];

    let lead: any = null;
    for (const fmt of formats) {
      const { data } = await supabase.from('leads').select('id, whatsapp_number').eq('whatsapp_number', fmt).single();
      if (data) { lead = data; break; }
    }

    if (!lead) {
      // Como último recurso, tenta usar ilike
      const { data } = await supabase.from('leads').select('id, whatsapp_number').ilike('whatsapp_number', `%${withoutCountryAnd9}%`).limit(1).single();
      if (data) {
        lead = data;
      } else {
        return NextResponse.json({ error: `Lead não encontrado para número: ${whatsapp_number}` }, { status: 404 });
      }
    }

    // 2. Deletar histórico em todas as tabelas relacionadas
    await supabase.from('interactions').delete().eq('lead_id', lead.id);
    await supabase.from('lead_status_history').delete().eq('lead_id', lead.id);
    await supabase.from('lead_follow_ups').delete().eq('lead_id', lead.id);
    await supabase.from('attendance_bottlenecks').delete().eq('lead_id', lead.id);
    await supabase.from('supervisor_escalations').delete().eq('lead_id', lead.id);

    // 3. Resetar status do lead e reativar bot
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({ 
        status: 'SDR_QUALIFICATION',
        bot_active: true,
        detected_product: null,
        detected_ddd: null,
        name: null,
        company: null,
        current_owner_id: null,
        sent_to_seller_at: null,
        seller_confirmed_at: null,
        attendance_started_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);

    if (updateLeadError) {
      throw updateLeadError;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Histórico limpo para o número ${whatsapp_number}` 
    });

  } catch (error: any) {
    console.error('[Clear History Error]', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
