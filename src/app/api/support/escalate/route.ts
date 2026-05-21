import { NextResponse } from 'next/server';
import { escalateToSupervisor } from '@/lib/support-monitor';

export async function POST(request: Request) {
  try {
    const { leadId } = await request.json();
    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório' }, { status: 400 });
    }

    // Chama a função existente no support-monitor que cuida de atualizar status,
    // buscar supervisor da equipe e notificar no WhatsApp.
    await escalateToSupervisor(leadId, 'Escalação manual via painel Lino Suporte');

    return NextResponse.json({ success: true, message: 'Lead escalado para o supervisor com sucesso!' });
  } catch (error: any) {
    console.error('[API Escalate Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
