import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: 'Número de telefone obrigatório' }, { status: 400 });

    const cleanPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    // 1. Encontrar o Lead pelo whatsapp_number
    const { data: lead } = await supabase.from('leads').select('id').eq('whatsapp_number', cleanPhone).single();
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });

    // 2. Apagar interações
    await supabase.from('interactions').delete().eq('lead_id', lead.id);
    
    // 3. Apagar follow-ups
    await supabase.from('lead_follow_ups').delete().eq('lead_id', lead.id);
    
    // 4. Apagar consentimentos
    await supabase.from('consentimentos').delete().eq('lead_id', lead.id);

    // 5. Resetar status e dono do lead para o SDR pegar de novo
    await supabase.from('leads').update({
      status: 'SDR_QUALIFICATION',
      current_owner_id: null,
      // Limpar campos de qualificação
      produto: null,
      ddd: null,
      cidade: null,
      aplicacao: null,
      updated_at: new Date().toISOString()
    }).eq('id', lead.id);

    // 6. Limpar variáveis em tenant_config se houver cache de contexto
    // (opcional - dependendo da implementação)

    return NextResponse.json({ 
      success: true, 
      message: 'Histórico completo apagado! Lead resetsdo para SDR_QUALIFICATION.',
      lead_id: lead.id 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
