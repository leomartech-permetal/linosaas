import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { whatsapp_number } = await request.json();

    if (!whatsapp_number) {
      return NextResponse.json({ error: 'Número de WhatsApp é obrigatório' }, { status: 400 });
    }

    // Formata o número se necessário (garante que tenha @s.whatsapp.net)
    const remoteJid = whatsapp_number.includes('@') ? whatsapp_number : `${whatsapp_number}@s.whatsapp.net`;

    // 1. Buscar o lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('whatsapp_number', remoteJid)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    // 2. Deletar interações
    const { error: deleteInteractionsError } = await supabase
      .from('interactions')
      .delete()
      .eq('lead_id', lead.id);

    if (deleteInteractionsError) {
      throw deleteInteractionsError;
    }

    // 3. Resetar status do lead
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({ 
        status: 'SDR_QUALIFICATION',
        // Opcionalmente limpar outras variáveis se existirem colunas específicas
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
