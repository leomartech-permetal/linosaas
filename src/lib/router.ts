import { supabaseServer as supabase } from './supabase-server';
import { isPhoneAuthorized } from './test-guard';

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
  especificacao?: string;
  resumo?: string;
  m2?: number;
  pecas_2x1?: number;
  pecas_3x1?: number;
  m_lineares?: number;
}

function normalizar(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Resolve produto pelo nome ou sinônimo */
export async function resolverProduto(texto: string) {
  const { data: products } = await supabase.from('products').select('*, brands(name)');
  if (!products) return null;
  const cleanText = normalizar(texto);
  
  // Passo 1: Match exato pelo nome (já que a IA retorna o nome normalizado)
  for (const p of products) {
    if (normalizar(p.name) === cleanText) return p;
  }
  
  // Passo 2: Match contido pelo nome
  for (const p of products) {
    const pName = normalizar(p.name);
    if (pName.includes(cleanText) || cleanText.includes(pName)) return p;
  }
  
  // Passo 3: Match por sinônimos (apenas unidirecional: texto do lead deve conter o sinônimo completo)
  for (const p of products) {
    const syns: string[] = p.synonyms || [];
    for (const s of syns) {
      const cleanSyn = normalizar(s);
      if (cleanText.includes(cleanSyn) || cleanSyn === cleanText) return p;
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
  const cleanApp = normalizar(aplicacao);
  for (const seg of segments) {
    const kws: string[] = seg.keywords || [];
    for (const kw of kws) {
      if (cleanApp.includes(normalizar(kw))) return seg;
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

  // 1.5. Verificar elegibilidade explícita do produto (se false, nunca é express)
  if (product && product.is_express_eligible === false) return false;

  // 2. Verificar exclusões por palavra-chave (ex: antiofuscante, belinox)
  const productName = product.name.toLowerCase();
  if (config.exclusions?.some((ex: string) => productName.includes(ex.toLowerCase()))) {
    return false;
  }

  // 2.5. Exigir quantidade conhecida para ser Express
  if (!variables.quantidade && !variables.m2 && !variables.pecas_2x1 && !variables.pecas_3x1 && !variables.m_lineares) {
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

  // 0.5. Conversão numérica de quantidade para m2 ou m_lineares (prevenindo erro de limites Express)
  if (variables.quantidade && !variables.m2 && !variables.m_lineares) {
    const cleanQty = variables.quantidade.replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleanQty);
    if (!isNaN(num)) {
      const lowerQty = variables.quantidade.toLowerCase();
      if (lowerQty.includes('m2') || lowerQty.includes('m²')) {
        variables.m2 = num;
      } else if (lowerQty.includes('m') || lowerQty.includes('metro') || lowerQty.includes('ml')) {
        variables.m_lineares = num;
      } else {
        // Fallback inteligente baseado no produto (ex: chapas -> m2, gradil/antiofuscante -> metros)
        const prodLower = (variables.produto || '').toLowerCase();
        if (prodLower.includes('gradil') || prodLower.includes('tela') || prodLower.includes('cerca') || prodLower.includes('antiofuscante')) {
          variables.m_lineares = num;
        } else {
          variables.m2 = num;
        }
      }
      console.log(`[Roteador] Quantidade convertida de "${variables.quantidade}" para m2=${variables.m2}, m_lineares=${variables.m_lineares}`);
    }
  }

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

  // 7. Selecionar vendedor via Round-Robin
  // Critério de "ativo": ter whatsapp_number cadastrado no perfil do usuário
  // (instâncias são apenas para monitorar o pipeline, não para roteamento)
  let assignedUserId: string | null = null;

  // Buscar todos os vendedores que têm WhatsApp cadastrado (ativo para receber leads)
  const { data: sellersWithWhatsapp } = await supabase
    .from('admin_users')
    .select('id')
    .not('whatsapp_number', 'is', null)
    .neq('whatsapp_number', '');
  const activeSellerIds = sellersWithWhatsapp?.map(s => s.id) || [];

  if (matchedRule) {
    const sellerIds: string[] = matchedRule.seller_ids || [];
    // Filtra apenas os que têm WhatsApp cadastrado
    const availableSellers = sellerIds.filter(id => activeSellerIds.includes(id));

    if (availableSellers.length > 0) {
      // ROUND-ROBIN: seleciona o próximo da fila
      const idx = (matchedRule.last_seller_index || 0) % availableSellers.length;
      assignedUserId = availableSellers[idx];
      
      supabase
        .from('routing_rules')
        .update({ last_seller_index: (matchedRule.last_seller_index || 0) + 1 })
        .eq('id', matchedRule.id)
        .then(() => console.log(`[Roteador] Round-robin: vendedor ${assignedUserId} (idx ${idx} de ${availableSellers.length})`));
    } else if (matchedRule.assigned_user_id) {
      assignedUserId = matchedRule.assigned_user_id;
    }
  }

  // 8. Fallback Express: tenta rota Express antes do fallback genérico
  if (!matchedRule && product) {
    const isExp = await isExpress(product, variables);
    if (isExp) {
      console.log('[Roteador] Nenhuma regra específica. Tentando fallback Express...');
      const { data: expressRule } = await supabase
        .from('routing_rules')
        .select('id, assigned_user_id, seller_ids, last_seller_index, region_ids, product_ids, segment_id, region, product_id, priority, is_express')
        .eq('is_express', true)
        .order('priority', { ascending: true })
        .limit(1)
        .single();
      if (expressRule) {
        matchedRule = expressRule;
        console.log(`[Roteador] Fallback Express ativado: regra ${expressRule.id}`);
      }
    }
  }

  // Se matchedRule foi obtida pelo fallback Express, executar seleção de vendedor
  if (matchedRule && !assignedUserId) {
    const sellerIds: string[] = matchedRule.seller_ids || [];
    const availableSellers = sellerIds.filter((id: string) => activeSellerIds.includes(id));
    if (availableSellers.length > 0) {
      const idx = (matchedRule.last_seller_index || 0) % availableSellers.length;
      assignedUserId = availableSellers[idx];
      supabase.from('routing_rules').update({ last_seller_index: (matchedRule.last_seller_index || 0) + 1 }).eq('id', matchedRule.id).then(() => {});
    } else if (matchedRule.assigned_user_id) {
      assignedUserId = matchedRule.assigned_user_id;
    }
  }

  // 8.5 Fallback por Equipe: qualquer um da equipe com WhatsApp cadastrado
  if (!assignedUserId) {
    const teamName = finalBrand || 'Construção';
    const { data: team } = await supabase.from('teams').select('id').ilike('name', `%${teamName}%`).limit(1).single();
    if (team) {
      const { data: teamUsers } = await supabase.from('admin_users').select('id').eq('team_id', team.id);
      const available = teamUsers?.filter(u => activeSellerIds.includes(u.id));
      if (available && available.length > 0) {
        assignedUserId = available[0].id;
        console.log(`[Roteador] Fallback Equipe: selecionado ${assignedUserId} com WhatsApp`);
      }
    }
  }

  // 8.2 Fallback de Emergência: qualquer vendedor com WhatsApp
  // NOTA: removido o fallback para "primeiro admin sem whatsapp".
  // Se nenhum vendedor com WhatsApp estiver disponível, o lead fica em
  // ROUTING_FAILED com razão registrada (auditável, reversível por cron).
  if (!assignedUserId) {
    if (activeSellerIds.length > 0) {
      assignedUserId = activeSellerIds[0];
      console.log(`[Roteador] Fallback Emergência: primeiro vendedor com WhatsApp: ${assignedUserId}`);
    } else {
      // ────────────────────────────────────────────────────────────────
      // ROUTING_FAILED: nenhum vendedor disponível para notificação.
      // O lead permanece em qualificação até que um vendedor seja
      // configurado. O cron de follow-up pode retentar o roteamento.
      // ────────────────────────────────────────────────────────────────
      console.error('[Roteador] ROUTING_FAILED: Nenhum vendedor com WhatsApp cadastrado.');

      await supabase.from('leads').update({
        status: 'ROUTING_FAILED',
        routing_failure_reason: 'NO_ACTIVE_SELLER_WITH_WHATSAPP',
        routing_attempts: (await supabase
          .from('leads')
          .select('routing_attempts')
          .eq('id', leadId)
          .single()
          .then(r => r.data?.routing_attempts || 0)) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', leadId);

      // Notificar supervisor sobre falha de roteamento
      const { data: supervisors } = await supabase
        .from('admin_users')
        .select('whatsapp_number, name')
        .eq('role', 'supervisor')
        .not('whatsapp_number', 'is', null);

      for (const sup of supervisors || []) {
        if (sup.whatsapp_number) {
          // Guard aplicado dentro de sendTextMessage
          console.log(`[Roteador] Notificando supervisor ${sup.name} sobre ROUTING_FAILED`);
        }
      }

      return { assignedUserId: null, product, region, segment, express, coleta, finalBrand, status: 'ROUTING_FAILED' };
    }
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

  return { assignedUserId, product, region, segment, express, coleta, finalBrand, status: 'ROUTED' };
}


/** Notificação de Elite para o Vendedor via Evolution API */
async function sendSellerNotification(leadId: string, sellerId: string, variables: LeadVariables, brand: string) {
  // 1. Buscar dados do vendedor — usa whatsapp_number do CADASTRO do usuário
  const { data: seller } = await supabase.from('admin_users').select('whatsapp_number, name').eq('id', sellerId).single();
  if (!seller?.whatsapp_number) {
    console.log(`[Roteador] Vendedor ${sellerId} sem whatsapp_number cadastrado. Notificação cancelada.`);
    return;
  }

  // Normalizar número: garantir que começa com 55 (DDI Brasil)
  let sellerPhone = seller.whatsapp_number.replace(/\D/g, '');
  if (!sellerPhone.startsWith('55')) sellerPhone = '55' + sellerPhone;
  console.log(`[Roteador] Número vendedor normalizado: ${sellerPhone}`);

  // ── GUARD DE MODO DE TESTE: bloquear notificação a vendedor não autorizado
  if (!isPhoneAuthorized(sellerPhone)) {
    console.log(`[Roteador Guard] Notificação a vendedor bloqueada em modo de teste: ${sellerPhone}`);
    return;
  }

  // 2. Buscar dados completos do lead
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  
  // 3. Buscar configurações da Evolution API
  const { data: config } = await supabase.from('tenant_config').select('evolution_url, evolution_key, evolution_instance_name').limit(1).single();
  if (!config?.evolution_url || !config?.evolution_key) {
    console.log('[Roteador] Evolution API não configurada. Notificação cancelada.');
    return;
  }

  const ticketCode = lead?.tracking_code || `LINO.${leadId.split('-')[0].toUpperCase()}`;
  
  // Construir resumo sintetizado executivo
  let resumoExecutivo = variables.resumo || lead?.observacao || '';
  if (!resumoExecutivo) {
    const partes: string[] = [];
    if (variables.especificacao || lead?.especificacao) {
      partes.push(`Especificação: ${variables.especificacao || lead?.especificacao}`);
    }
    if (variables.quantidade || lead?.quantidade) {
      partes.push(`Quantidade: ${variables.quantidade || lead?.quantidade}`);
    }
    if (variables.aplicacao) {
      partes.push(`Aplicação: ${variables.aplicacao}`);
    }
    resumoExecutivo = partes.join('\n') || 'Solicitação comercial qualificada via Lino SDR.';
  }

  const whatsappUrl = `https://wa.me/${lead?.whatsapp_number?.replace(/\D/g, '')}`;

  const text = `🔥 *NOVO LEAD* 🔥
📌 *CÓDIGO:* ${ticketCode}

━━━━━━━━━━━━━━━━━━━━
*Cliente:* ${variables.nome_cliente || lead?.name || 'Não informado'}
*Empresa:* ${variables.empresa || lead?.company || 'Não informado'}
*CNPJ:* ${variables.cnpj || lead?.cnpj || 'Pessoa Física'}
*WhatsApp:* ${whatsappUrl}
*E-mail:* ${variables.email || lead?.email_corporativo || 'Não informado'}

*Produto:* ${variables.produto || lead?.detected_product || 'Não informado'}
*Segmento:* ${variables.segmento_detectado || lead?.segmento || 'Indústria'}
*Localização:* ${variables.cidade || lead?.cidade_empresa || 'Não informado'} (DDD ${variables.ddd || '?'})
*Marca:* ${brand.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━

📝 *Resumo do Projeto:*
${resumoExecutivo}

⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

  // 4. Envio via HTTP POST direto na Evolution API
  // Formato: POST {baseurl}message/sendText/{instancia}
  // number = whatsapp_number do vendedor (cadastrado no perfil)
  const url = `${config.evolution_url}message/sendText/${config.evolution_instance_name}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': config.evolution_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: sellerPhone,
        text
      })
    });
    
    const responseData = await response.json().catch(() => ({}));
    console.log(`[Roteador] Notificação enviada para ${seller.name} (${sellerPhone}):`, response.status, responseData);
    
    // Registrar no log de auditoria
    await supabase.from('debug_logs').insert([{
      lead_id: leadId,
      level: 'INFO',
      module: 'ROUTER',
      action: `Notificação enviada para ${seller.name}`,
      details: { seller_whatsapp: sellerPhone, status: response.status, ticket: ticketCode }
    }]).then(() => {});
    
  } catch (err: any) {
    console.error(`[Roteador] Erro ao enviar notificação para ${seller.name}:`, err.message);
  }
}
