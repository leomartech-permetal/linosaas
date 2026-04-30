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

    // 1. Encontrar o Lead pelo telefone
    const { data: lead } = await supabase.from('leads').select('id').eq('phone', phone).single();
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });

    // 2. Apagar interações
    await supabase.from('interactions').delete().eq('lead_id', lead.id);

    // 3. Resetar status e dono do lead para o SDR pegar de novo
    await supabase.from('leads').update({
      status: 'SDR_QUALIFICATION',
      current_owner_id: null
    }).eq('id', lead.id);

    return NextResponse.json({ success: true, message: 'Histórico apagado com sucesso!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
