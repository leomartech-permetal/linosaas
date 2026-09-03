import OpenAI from 'openai';
import { supabaseServer as supabase } from './supabase-server';

export type PostSaleCategory =
  | 'ORDER_VERIFICATION'
  | 'DELIVERY_STATUS'
  | 'INVOICE'
  | 'BOLETO'
  | 'WRONG_PRODUCT'
  | 'DAMAGE'
  | 'DEFECT'
  | 'MISSING_QUANTITY'
  | 'TECHNICAL_COMPLAINT'
  | 'OTHER';

export interface PostSalePlan {
  categoria: PostSaleCategory;
  numero_pedido_extraido: string | null;
  nota_fiscal_extraida: string | null;
  cnpj_extraido: string | null;
  urgencia_critica: boolean;
  resposta_whatsapp: string;
}

/**
 * Motor de Pós-Venda do Lino v4.
 * - Exige pedido verificado ou ticket temporário ORDER_VERIFICATION
 * - Extrai número do pedido / NF / CNPJ
 * - Nunca admite culpa, inventa causa ou promete prazo sem verificação interna
 * - Risco grave ou parada técnica gera prioridade URGENT no ticket
 */
export async function processPostSaleMessage(
  history: { sender_type: string; message_content: string }[],
  leadId: string
): Promise<{ resposta_whatsapp: string; category?: PostSaleCategory; orderNumber?: string | null }> {
  const { data: config } = await supabase
    .from('tenant_config')
    .select('openai_key')
    .limit(1)
    .single();

  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  // Fallback caso não haja chave da OpenAI
  if (!apiKey || apiKey === 'fake-key') {
    return {
      resposta_whatsapp:
        'Olá! Sou o assistente de Pós-Venda da Permetal. Para localizar seu pedido, você poderia me confirmar o número do pedido, nota fiscal ou CNPJ de faturamento?',
      category: 'ORDER_VERIFICATION',
      orderNumber: null,
    };
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `Você é o Lino Pós-Venda do Grupo Permetal / Metalgrade.
Sua função é registrar e encaminhar solicitações de clientes que já compraram:
- Rastreio / Previsão de entrega (DELIVERY_STATUS)
- 2ª via de Nota Fiscal ou XML (INVOICE)
- Boleto para pagamento (BOLETO)
- Produto divergente (WRONG_PRODUCT)
- Avaria no transporte (DAMAGE)
- Defeito de fabricação (DEFECT)
- Falta de quantidade / itens (MISSING_QUANTITY)
- Reclamação ou suporte técnico (TECHNICAL_COMPLAINT)
- Outro assunto pós-venda (OTHER)

REGRAS RÍGIDAS DE COMUNICAÇÃO:
1. Se o número do pedido ou nota fiscal NÃO foi informado ainda, classifique como ORDER_VERIFICATION e solicite educadamente o número do pedido ou NF.
2. NUNCA admita culpa, nunca invente motivos para atrasos, nunca prometa trocas ou prazos sem validação da fábrica/logística.
3. Se houver parada de obra, risco de segurança ou urgência grave, marque urgencia_critica=true.
4. Resposta curta (máximo 2 a 3 frases), profissional e humana, adequada para WhatsApp.

Responda OBRIGATORIAMENTE em JSON no formato:
{
  "categoria": "ORDER_VERIFICATION" | "DELIVERY_STATUS" | "INVOICE" | "BOLETO" | "WRONG_PRODUCT" | "DAMAGE" | "DEFECT" | "MISSING_QUANTITY" | "TECHNICAL_COMPLAINT" | "OTHER",
  "numero_pedido_extraido": string | null,
  "nota_fiscal_extraida": string | null,
  "cnpj_extraido": string | null,
  "urgencia_critica": boolean,
  "resposta_whatsapp": string
}`;

  const messagesPayload: any[] = [{ role: 'system', content: systemPrompt }];

  history.forEach(m => {
    messagesPayload.push({
      role:
        m.sender_type === 'CUSTOMER' ||
        m.sender_type === 'lead' ||
        m.sender_type === 'user'
          ? 'user'
          : 'assistant',
      content: m.message_content,
    });
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesPayload,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const parsed: PostSalePlan = JSON.parse(
      completion.choices[0]?.message?.content || '{}'
    );

    const category: PostSaleCategory = parsed.categoria || 'ORDER_VERIFICATION';
    const orderRef =
      parsed.numero_pedido_extraido || parsed.nota_fiscal_extraida || null;

    // Atualizar ticket ou criar se não existir
    try {
      const { data: ticket } = await supabase
        .from('service_tickets')
        .select('id')
        .eq('lead_id', leadId)
        .eq('flow', 'POST_SALE')
        .not('status', 'in', '("RESOLVED","CLOSED")')
        .limit(1)
        .maybeSingle();

      if (ticket) {
        await supabase
          .from('service_tickets')
          .update({
            category,
            order_reference: orderRef,
            priority: parsed.urgencia_critica ? 'URGENT' : 'NORMAL',
            status: orderRef ? 'OPEN' : 'PENDING_CUSTOMER',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ticket.id);
      } else {
        await supabase.from('service_tickets').insert([
          {
            lead_id: leadId,
            flow: 'POST_SALE',
            category,
            order_reference: orderRef,
            status: orderRef ? 'OPEN' : 'PENDING_CUSTOMER',
            priority: parsed.urgencia_critica ? 'URGENT' : 'NORMAL',
          },
        ]);
      }
    } catch {}

    return {
      resposta_whatsapp:
        parsed.resposta_whatsapp ||
        'Recebi sua solicitação de pós-venda. Nossa equipe foi notificada para verificar seu pedido.',
      category,
      orderNumber: orderRef,
    };
  } catch (err: any) {
    console.error('[PostSale] Erro ao processar:', err?.message || err);
    return {
      resposta_whatsapp:
        'Olá! Para que eu possa localizar sua entrega ou nota fiscal, você poderia me confirmar o número do pedido ou o CNPJ faturado?',
      category: 'ORDER_VERIFICATION',
      orderNumber: null,
    };
  }
}
