import OpenAI from 'openai';
import { supabase } from './supabase';

export async function processPostSaleMessage(
  history: { sender_type: string; message_content: string }[],
  leadId: string
) {
  const { data: config } = await supabase.from('tenant_config').select('openai_key').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return {
      resposta_whatsapp: 'Olá! Sou o assistente de Pós-Venda da Permetal. Para localizar seu pedido, você poderia me informar o número do pedido, nota fiscal ou CNPJ de faturamento?'
    };
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `Você é o Lino Pós-Venda do Grupo Permetal / Metalgrade.
Sua missão é atender clientes que já realizaram compras e buscam:
1. Rastreio ou previsão de entrega de mercadorias
2. Segunda via de nota fiscal (DANFE / XML) ou boleto
3. Registro de dúvidas técnicas após instalação, garantia ou assistência técnica
4. Recompra ou repetição de pedido anterior

Diretrizes:
- Seja extremamente acolhedor, rápido e prestativo.
- Se o cliente ainda não informou, peça gentilmente o NÚMERO DO PEDIDO, NOTA FISCAL ou CNPJ da empresa faturada.
- Nunca invente status de entrega ou prazos fictícios.
- Informe que nossa equipe de Logística e Faturamento foi notificada para priorizar a verificação.
- Mantenha respostas curtas (máximo 2 a 3 frases) adequadas para WhatsApp.`;

  const messagesPayload: any[] = [
    { role: 'system', content: systemPrompt }
  ];

  history.forEach(m => {
    messagesPayload.push({
      role: m.sender_type === 'lead' || m.sender_type === 'user' ? 'user' : 'assistant',
      content: m.message_content
    });
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesPayload,
      temperature: 0.3
    });

    return {
      resposta_whatsapp: completion.choices[0]?.message?.content || 'Recebi sua solicitação de pós-venda. Nossa equipe já está verificando seu pedido.'
    };
  } catch (err: any) {
    return {
      resposta_whatsapp: 'Olá! Para que eu possa localizar sua entrega ou nota fiscal, você poderia me confirmar o número do pedido ou o CNPJ faturado?'
    };
  }
}
