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
  m2?: number;
  pecas_2x1?: number;
  pecas_3x1?: number;
  m_lineares?: number;
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

/** Verifica se é EXPRESS (Regras Flexíveis via Banco de Dados) */
export async function isExpress(product: any, variables: LeadVariables): Promise<boolean> {

  // 1. Buscar regras no banco
  const brand = product?.brands?.name?.toUpperCase();
  const ruleKey = brand?.includes('METALGRADE') ? 'express_metalgrade' : 'express_permetal';
  
  const { data: rule } = await supabase
    .from('business_rules')
    .select('config')
    .eq('rule_key', ruleKey)
    .single();

  if (!rule || !rule.config) return false;
  const config = rule.config as any;

  // 2. Verificar exclusões (ex: antiofuscante, belinox)
  const productName = product.name.toLowerCase();
  if (config.exclusions?.some((ex: string) => productName.includes(ex.toLowerCase()))) {
    return false;
  }

  // 3. Verificar limites quantitativos (Prioridade: Produto > Regra Global)
  const productLimit = product.express_max_qty ? parseInt(product.express_max_qty.replace(/\D/g, '')) : null;

  if (ruleKey === 'express_permetal') {
    const m2Limit = productLimit || config.max_m2;
    const p2x1Limit = productLimit || config.max_pcs_2x1;
    const p3x1Limit = productLimit || config.max_pcs_3x1;

    if (variables.m2 && variables.m2 > m2Limit) return false;
    if (variables.pecas_2x1 && variables.pecas_2x1 > p2x1Limit) return false;
    if (variables.pecas_3x1 && variables.pecas_3x1 > p3x1Limit) return false;
  } else if (ruleKey === 'express_metalgrade') {
    const mlLimit = productLimit || config.max_m_lineares;
    if (variables.m_lineares && variables.m_lineares > mlLimit) return false;
  }

  // 4. Outras restrições
  if (variables.precisa_desenho || variables.precisa_prototipo) return false;
  if (variables.quantidade_nivel === 'alta') return false;

  return true;
}

/** Determina tipo de coleta */
export async function tipoColeta(product: any, segment: any, variables: LeadVariables): Promise<'short' | 'normal'> {
  const express = await isExpress(product, variables);
  if (express) return 'short';
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
  const express = await isExpress(product, variables);
  const finalBrand = express ? 'PERMETAL EXPRESS' : brandName;
  const coleta = await tipoColeta(product, segment, variables);
  console.log(`[Roteador] Express: ${express} | Marca final: ${finalBrand} | Coleta: ${coleta}`);

  // 5. Buscar equipe pela marca
  const { data: brand } = await supabase.from('brands').select('id').ilike('name', finalBrand || 'PERMETAL').single();

  // 6. Buscar regra de roteamento — prioriza novos campos array, fallback legado
  const { data: allRules } = await supabase
    .from('routing_rules')
    .select('id, assigned_user_id, seller_ids, last_seller_index, region_ids, product_ids, segment_id, region, product_id, priority, is_express')
    .order('priority', { ascending: true });

  let matchedRule: any = null;
  if (allRules) {
    for (const r of allRules) {
      // --- Critério: Região ---
      const hasRegionFilter = (r.region_ids?.length > 0) || r.region;
      if (hasRegionFilter && region) {
        const inNewIds = r.region_ids?.length > 0 && r.region_ids.includes(region.id);
        const inLegacy = r.region && (region.name.toLowerCase().includes(r.region.toLowerCase()) || r.region === '*');
        if (!inNewIds && !inLegacy) continue;
      } else if (hasRegionFilter && !region) continue; // regra exige região mas lead não tem

      // --- Critério: Produto ---
      const hasProductFilter = (r.product_ids?.length > 0) || r.product_id;
      if (hasProductFilter && product) {
        const inNewIds = r.product_ids?.length > 0 && r.product_ids.includes(product.id);
        const inLegacy = r.product_id === product.id;
        if (!inNewIds && !inLegacy) continue;
      } else if (hasProductFilter && !product) continue;

      // --- Critério: Segmento ---
      if (r.segment_id && segment?.id !== r.segment_id) continue;

      // --- Critério: EXPRESS ---
      // Se a regra é Express, só bate se o lead for Express
      if (r.is_express && !express) continue;

      matchedRule = r;
      break;
    }
  }

  // 7. Selecionar vendedor: round-robin ou legado
  let assignedUserId: string | null = null;
  if (matchedRule) {
    const sellerIds: string[] = matchedRule.seller_ids || [];
    if (sellerIds.length > 0) {
      // ROUND-ROBIN: seleciona o próximo da fila
      const idx = (matchedRule.last_seller_index || 0) % sellerIds.length;
      assignedUserId = sellerIds[idx];
      // Incrementa índice no banco (não aguarda para não bloquear)
      supabase
        .from('routing_rules')
        .update({ last_seller_index: idx + 1 })
        .eq('id', matchedRule.id)
        .then(() => console.log(`[Roteador] Round-robin: vendedor idx ${idx} de ${sellerIds.length}`));
    } else {
      // Fallback legado
      assignedUserId = matchedRule.assigned_user_id || null;
    }
  }

  // 8. Fallback: buscar qualquer vendedor da equipe via team
  if (!assignedUserId) {
    const teamName = finalBrand || 'Construção';
    const { data: team } = await supabase.from('teams').select('id').ilike('name', `%${teamName}%`).limit(1).single();
    if (team) {
      const { data: user } = await supabase.from('admin_users').select('id').eq('team_id', team.id).limit(1).single();
      assignedUserId = user?.id || null;
    }
  }

  // 8.2 Fallback de Emergência: se ainda estiver null, pega o primeiro admin/vendedor ativo
  if (!assignedUserId) {
    const { data: firstUser } = await supabase.from('admin_users').select('id').limit(1).single();
    assignedUserId = firstUser?.id || null;
  }

  // 8.3 Atualizar lead com timestamp de envio
  await supabase.from('leads').update({
    current_owner_id: assignedUserId,
    status: 'WAITING_SELLER',
    sent_to_seller_at: new Date().toISOString(),
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
