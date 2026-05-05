import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface LeadVariables {
  produto?: string;
  ddd?: string;
  quantidade?: string;
  quantidade_nivel?: 'baixa' | 'media' | 'alta';
  aplicacao?: string;
  precisa_desenho?: boolean;
  precisa_prototipo?: boolean;
  nome_cliente?: string;
  email?: string;
  empresa?: string;
  cnpj?: string;
  cidade?: string;
  segmento_detectado?: string;
}

/** Resolve produto pelo nome ou sinônimo */
export async function resolverProduto(texto: string) {
  const { data: products } = await supabase.from('products').select('*, brands(name)');
  if (!products) return null;
  const lower = texto.toLowerCase();
  for (const p of products) {
    if (p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())) return p;
    const syns: string[] = p.synonyms || [];
    for (const s of syns) {
      if (lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower)) return p;
    }
  }
  return null;
}

/** Resolve região pelo DDD */
export async function resolverRegiao(ddd: string) {
  const { data: regions } = await supabase.from('regions').select('*');
  if (!regions) return null;
  for (const r of regions) {
    const codes: string[] = r.ddd_codes || [];
    if (codes.includes(ddd)) return r;
  }
  return null;
}

/** Resolve segmento pela aplicação/keywords */
export async function resolverSegmento(aplicacao: string) {
  const { data: segments } = await supabase.from('segments').select('*');
  if (!segments) return null;
  const lower = aplicacao.toLowerCase();
  for (const seg of segments) {
    const kws: string[] = seg.keywords || [];
    for (const kw of kws) {
      if (lower.includes(kw.toLowerCase())) return seg;
    }
  }
  return null;
}

/** Verifica se é EXPRESS */
export function isExpress(product: any, variables: LeadVariables): boolean {
  if (!product?.is_express_eligible) return false;
  if (variables.precisa_desenho || variables.precisa_prototipo) return false;
  if (variables.quantidade_nivel === 'alta') return false;
  return true;
}

/** Determina tipo de coleta */
export function tipoColeta(product: any, segment: any, variables: LeadVariables): 'short' | 'normal' {
  if (isExpress(product, variables)) return 'short';
  if (segment?.collection_type === 'short') return 'short';
  return 'normal';
}

/** Motor principal de roteamento */
export async function routeLead(leadId: string, tenantId: string, variables: LeadVariables) {
  console.log('[Roteador] Iniciando roteamento para lead:', leadId);

  // 1. Resolver produto
  const product = variables.produto ? await resolverProduto(variables.produto) : null;
  const brandName = product?.brands?.name || null;
  console.log(`[Roteador] Produto: ${product?.name || 'N/A'} | Marca: ${brandName || 'N/A'}`);

  // 2. Resolver região
  const region = variables.ddd ? await resolverRegiao(variables.ddd) : null;
  console.log(`[Roteador] DDD: ${variables.ddd || 'N/A'} → Região: ${region?.name || 'N/A'}`);

  // 3. Resolver segmento
  const segment = variables.aplicacao ? await resolverSegmento(variables.aplicacao) : null;
  console.log(`[Roteador] Segmento: ${segment?.name || 'N/A'}`);

  // 4. Verificar EXPRESS
  const express = isExpress(product, variables);
  const finalBrand = express ? 'PERMETAL EXPRESS' : brandName;
  const coleta = tipoColeta(product, segment, variables);
  console.log(`[Roteador] Express: ${express} | Marca final: ${finalBrand} | Coleta: ${coleta}`);

  // 5. Buscar equipe pela marca
  const { data: brand } = await supabase.from('brands').select('id').ilike('name', finalBrand || 'PERMETAL').single();

  // 6. Buscar regra de roteamento (cruzando região + produto + segmento)
  let query = supabase.from('routing_rules').select('assigned_user_id').order('priority', { ascending: true }).limit(1);

  if (region) query = query.or(`region.ilike.%${region.name}%,region.eq.*,region.is.null`);
  if (product) query = query.or(`product_id.eq.${product.id},product_id.is.null`);
  if (segment) query = query.or(`segment_id.eq.${segment.id},segment_id.is.null`);

  const { data: rule } = await query.single();
  let assignedUserId = rule?.assigned_user_id || null;

  // 7. Fallback: buscar qualquer vendedor da equipe via team
  if (!assignedUserId) {
    const teamName = finalBrand || 'Construção';
    const { data: team } = await supabase.from('teams').select('id').ilike('name', `%${teamName}%`).limit(1).single();
    if (team) {
      const { data: user } = await supabase.from('admin_users').select('id').eq('team_id', team.id).limit(1).single();
      assignedUserId = user?.id || null;
    }
  }

  // 8. Atualizar lead
  await supabase.from('leads').update({
    current_owner_id: assignedUserId,
    status: 'WAITING_SELLER',
    updated_at: new Date().toISOString(),
  }).eq('id', leadId);

  // 9. Notificar Vendedor (Notificação de Elite)
  if (assignedUserId) {
    try {
      await sendSellerNotification(leadId, assignedUserId, variables, finalBrand || 'PERMETAL');
    } catch (e) {
      console.error('[Roteador] Erro ao notificar vendedor:', e);
    }
  }

  return { assignedUserId, product, region, segment, express, coleta, finalBrand };
}

/** Notificação de Elite para o Vendedor */
async function sendSellerNotification(leadId: string, sellerId: string, variables: LeadVariables, brand: string) {
  // 1. Buscar dados do vendedor
  const { data: seller } = await supabase.from('admin_users').select('whatsapp_number, name').eq('id', sellerId).single();
  if (!seller?.whatsapp_number) return;

  // 2. Buscar dados brutos do lead
  const { data: lead } = await supabase.from('leads').select('whatsapp_number, name').eq('id', leadId).single();
  
  // 3. Gerar código de atendimento curto
  const ticketCode = `LINO.${leadId.split('-')[0].toUpperCase()}`;
  
  // 4. Buscar histórico resumido
  const { data: interactions } = await supabase.from('interactions')
    .select('message_content')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(3);
  
  const resumo = interactions?.reverse().map(i => i.message_content).join('\n') || 'Sem observações adicionais.';
  const whatsappUrl = `https://wa.me/${lead?.whatsapp_number?.replace(/\D/g, '')}`;

  const message = `🔥 *NOVO LEAD* 🔥
📌 *CÓDIGO DO ATENDIMENTO:* ${ticketCode}
✅ Anote este código no cadastro do cliente.

━━━━━━━━━━━━━━━━━━━━
*Cliente:* ${variables.nome_cliente || lead?.name || 'Não informado'}
*Empresa:* ${variables.empresa || 'Não informado'}
*CNPJ:* ${variables.cnpj || 'Não informado'}
*WhatsApp:* ${whatsappUrl}
*E-mail:* ${variables.email || 'Não informado'}

*Produto:* ${variables.produto || 'Não informado'}
*Segmento:* ${variables.segmento_detectado || 'Indústria'}
*Localização:* ${variables.cidade || 'Não informado'} - ${variables.ddd || ''}

*Marca (roteada):* ${brand.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━

📝 *Resumo da conversa:*
${resumo}

⏰ *Enviado em:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
`;

  // 5. Enviar via Evolution API
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  if (config?.evolution_url && config?.evolution_key) {
    const { sendTextMessage } = require('./evolution-api');
    await sendTextMessage(config.evolution_instance_name, config.evolution_url, config.evolution_key, seller.whatsapp_number, message);
  }
}
