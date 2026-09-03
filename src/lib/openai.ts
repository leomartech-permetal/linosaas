import OpenAI from 'openai';
import { supabaseServer as supabase } from './supabase-server';
import {
  extractTechnicalAttributes,
  getFacetedCatalogOptions,
  formatFacetedContextForPrompt
} from './catalog-faceted';

export interface B2BFieldConfig {
  key: string;
  label: string;
  obrigatorio: boolean;
  max_tentativas: number;
}

/**
 * processLeadWithSkills — Motor central SDR com Schema B2B Inteligente e RAG E-commerce
 */
export async function processLeadWithSkills(
  history: { sender_type: string; message_content: string }[],
  leadId?: string
) {
  // 1. Configurações e chave OpenAI
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return { erro_openai: 'Chave da OpenAI não configurada.' };
  }

  const openai = new OpenAI({ apiKey });

  // 2. Recuperar dados do Lead
  let leadData: any = null;
  let detectedProduct: string | null = null;
  let b2bAttempts: Record<string, number> = { cnpj: 0, email: 0, nome: 0, empresa: 0 };

  // Schema B2B padrão (pode ser sobrescrito por produto ou tenant)
  let schemaB2BFields: B2BFieldConfig[] = [
    { key: 'produto', label: 'Produto / Família', obrigatorio: true, max_tentativas: 99 },
    { key: 'quantidade', label: 'Quantidade / Metragem', obrigatorio: true, max_tentativas: 99 },
    { key: 'especificacao', label: 'Especificação Técnica', obrigatorio: true, max_tentativas: 99 },
    { key: 'nome_cliente', label: 'Nome do Contato', obrigatorio: false, max_tentativas: 2 },
    { key: 'empresa', label: 'Nome da Empresa', obrigatorio: false, max_tentativas: 2 },
    { key: 'cnpj', label: 'CNPJ', obrigatorio: false, max_tentativas: 2 },
    { key: 'email', label: 'E-mail Corporativo', obrigatorio: false, max_tentativas: 2 }
  ];

  if (leadId) {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (lead) {
      leadData = lead;
      detectedProduct = lead.detected_product || lead.produto || null;
      if (lead.b2b_attempts && typeof lead.b2b_attempts === 'object') {
        b2bAttempts = { ...b2bAttempts, ...lead.b2b_attempts };
      }

      // Buscar schema específico se cadastrado para o produto
      if (detectedProduct) {
        const { data: prod } = await supabase
          .from('products')
          .select('qualification_schema')
          .ilike('name', `%${detectedProduct}%`)
          .limit(1)
          .maybeSingle();

        if (prod?.qualification_schema) {
          const qs = prod.qualification_schema;
          const obrigatorias: string[] = qs.obrigatorias || [];
          const opcionais: { campo: string; max_tentativas?: number }[] = qs.opcionais || [];

          // Montar lista de campos estritamente baseada no preset do schema
          const customFields: B2BFieldConfig[] = [];

          // 1. Campos Básicos Sempre Obrigatórios do Domínio
          customFields.push({ key: 'nome_cliente', label: 'Nome do Contato', obrigatorio: true, max_tentativas: 99 });
          customFields.push({ key: 'empresa', label: 'Nome da Empresa', obrigatorio: true, max_tentativas: 99 });
          customFields.push({ key: 'produto', label: 'Produto / Família', obrigatorio: true, max_tentativas: 99 });
          customFields.push({ key: 'quantidade', label: 'Quantidade / Metragem', obrigatorio: true, max_tentativas: 99 });
          customFields.push({ key: 'especificacao', label: 'Especificação Técnica', obrigatorio: true, max_tentativas: 99 });

          // 2. Mapeamento de Labels Amigáveis
          const labelMap: Record<string, string> = {
            nome_cliente: 'Nome do Contato',
            name: 'Nome do Contato',
            empresa: 'Nome da Empresa',
            company: 'Nome da Empresa',
            cnpj: 'CNPJ da Empresa',
            email: 'E-mail Corporativo',
            email_corporativo: 'E-mail Corporativo',
            cargo: 'Cargo do Contato',
            segmento: 'Segmento / Aplicação',
            endereco_sede: 'Endereço da Empresa',
            project_location: 'Local da Obra / Entrega'
          };

          // 3. Adicionar campos configurados como OBRIGATÓRIOS no preset
          obrigatorias.forEach(k => {
            if (!customFields.find(f => f.key === k)) {
              customFields.push({
                key: k,
                label: labelMap[k] || k,
                obrigatorio: true,
                max_tentativas: 99
              });
            }
          });

          // 4. Adicionar campos configurados como OPCIONAIS com a quantidade EXATA de tentativas do preset
          opcionais.forEach(opt => {
            const k = opt.campo;
            const maxTentativas = typeof opt.max_tentativas === 'number' ? opt.max_tentativas : 2;
            if (!customFields.find(f => f.key === k)) {
              customFields.push({
                key: k,
                label: labelMap[k] || k,
                obrigatorio: false,
                max_tentativas: maxTentativas
              });
            }
          });

          if (customFields.length > 0) {
            schemaB2BFields = customFields;
          }
        }
      }
    }
  }

  // 3. RAG E-COMMERCE FACETADO
  const ultimaMsg = history[history.length - 1]?.message_content || '';
  const todoHistoricoTexto = history.map(h => h.message_content).join(' ');
  const technicalDetected = extractTechnicalAttributes(todoHistoricoTexto);

  let targetFamilia = technicalDetected.familia;
  const textoCompletoLower = (todoHistoricoTexto + ' ' + (detectedProduct || '')).toLowerCase();
  if (!targetFamilia) {
    if (textoCompletoLower.includes('gradil')) targetFamilia = 'gradil';
    else if (textoCompletoLower.includes('expandid')) targetFamilia = 'chapa_expandida';
    else if (textoCompletoLower.includes('perfurad')) targetFamilia = 'chapa_perfurada';
  }

  const facetCriteria = {
    familia: targetFamilia,
    malha_a: technicalDetected.malha_a,
    malha_b: technicalDetected.malha_b,
    material: technicalDetected.material,
    espessura: technicalDetected.espessura
  };

  const catalogFacets = await getFacetedCatalogOptions(facetCriteria);
  const catalogoEcommerceContexto = formatFacetedContextForPrompt(catalogFacets, technicalDetected);

  // 4. Preparar Regras de Persistência do Schema B2B
  const qStateValores = leadData?.qualification_state?.valores || {};
  const dadosCadastrados: Record<string, any> = {
    nome_cliente: leadData?.name || qStateValores.nome_cliente || null,
    name: leadData?.name || qStateValores.nome_cliente || null,
    empresa: leadData?.company || qStateValores.empresa || null,
    company: leadData?.company || qStateValores.empresa || null,
    cnpj: leadData?.cnpj || qStateValores.cnpj || null,
    email: leadData?.email_corporativo || qStateValores.email || null,
    email_corporativo: leadData?.email_corporativo || qStateValores.email || null,
    produto: detectedProduct || qStateValores.produto || technicalDetected.familia || null,
    quantidade: leadData?.quantidade || qStateValores.quantidade || technicalDetected.quantidade || null,
    especificacao: leadData?.especificacao || technicalDetected.dimensoes || null,
    ...qStateValores
  };

  // Montar instruções de campos com lógica dinâmica baseada no preset do Schema
  let instrucoesB2B = '=== REGRAS DE COLETA SCHEMA B2B (PRESET DO PRODUTO) ===\n';
  const camposFaltantesObrigatorios: string[] = [];

  schemaB2BFields.forEach(field => {
    const valorAtual = dadosCadastrados[field.key];
    const preenchido = valorAtual !== null && valorAtual !== undefined && valorAtual !== '';
    const tentativas = b2bAttempts[field.key] || 0;

    if (preenchido) {
      instrucoesB2B += `- [PREENCHIDO] ${field.label}: "${valorAtual}" (NUNCA pergunte novamente).\n`;
    } else if (field.obrigatorio) {
      camposFaltantesObrigatorios.push(field.label);
      instrucoesB2B += `- [OBRIGATÓRIO PENDENTE] ${field.label}: É OBRIGATÓRIO. Colete antes de montar o resumo.\n`;
    } else {
      // Campo opcional regrado estritamente pelo preset
      if (tentativas >= field.max_tentativas) {
        instrucoesB2B += `- [OPCIONAL LIMITE ATINGIDO] ${field.label}: Atingiu o limite de ${field.max_tentativas} tentativa(s) do Schema. NÃO pergunte nem insista mais.\n`;
      } else {
        instrucoesB2B += `- [OPCIONAL - TENTATIVA ${tentativas + 1} de ${field.max_tentativas}] ${field.label}: Tente coletar amigavelmente nesta mensagem. Se o cliente recusar ou se atingir ${field.max_tentativas} tentativa(s), siga em frente sem travar o lead.\n`;
      }
    }
  });

  // Contexto de anúncio / página navegada (se disponível)
  let contextoAnuncio = '';
  if (leadData?.context_source || leadData?.context_interest) {
    contextoAnuncio = `\n=== CONTEXTO DE ORIGEM / NAVEGAÇÃO DO LEAD ===
Origem: ${leadData.context_source || 'Site'}
Interesse/Página: ${leadData.context_interest || 'Catálogo Geral'}
(Use esse contexto para demonstrar empatia e entender a busca do cliente sem repetir perguntas óbvias).\n`;
  }

  const masterPrompt = config?.master_prompt || 'Você é o Lino, atendente SDR comercial B2B da Permetal e Metalgrade.';

  const systemInstructions = `${masterPrompt}

${contextoAnuncio}

${catalogoEcommerceContexto}

${instrucoesB2B}

=== PROTOCOLO OBRIGATÓRIO DE RESUMO E CONFIRMAÇÃO COM SIM OU NÃO ===
Quando todos os dados estiverem coletados (Nome, Empresa, Produto, Especificação, Quantidade, CNPJ/PF, E-mail, Cidade se houver):

1. O Lino DEVE formatar o resumo rigorosamente no SCHEMA PADRÃO DE SAÍDA:
"Aqui está o resumo das informações do seu projeto:

- Nome: [Nome do Contato]
- Empresa: [Nome da Empresa]
- Produto: [Produto / Linha]
- Especificação: [Especificação técnica detalhada, modelo, malha, arames, pilares, fixadores]
- Quantidade: [Quantidade / Metragem linear ou m²]
- CNPJ: [CNPJ ou 'Pessoa Física']
- E-mail: [E-mail Corporativo ou 'Não informado']
- Cidade da Sede da Empresa: [Cidade/UF ou 'Não informado']
- Resumo da Aplicação: [Breve descrição da aplicação e projeto para o vendedor]

As informações acima estão corretas? Por favor, responda com 'Sim' para confirmar ou 'Não' se precisar atualizar algo."

2. REGRA DE OURO DE CONFIRMAÇÃO:
- O Lino NUNCA transfere ou encerra antes do cliente responder 'Sim'.
- Enquanto estiver apresentando o resumo para o cliente confirmar, "qualificacao_concluida" DEVE SER false e "acao_executada": "qualificar".
- SOMENTE quando a última mensagem do cliente for uma confirmação positiva ('Sim', 'sim', 'está correto', 'pode seguir', 'ok'):
  * Marque "qualificacao_concluida": true e "acao_executada": "roteamento_vendedor".
  * Envie a mensagem cordial de que a solicitação foi encaminhada para o especialista responsável.
- Se o cliente responder 'Não' ou pedir alteração: pergunte o que deseja mudar, ajuste o dado e reapresente o resumo para nova confirmação de 'Sim' ou 'Não'.

=== FORMATO OBRIGATÓRIO DE RESPOSTA ===
Responda EXCLUSIVAMENTE em formato JSON com a estrutura:
{
  "resposta_whatsapp": "Texto da sua mensagem para o cliente no WhatsApp",
  "intent": "produto_comercial | pedido_orcamento | duvida_tecnica | outro_setor",
  "acao_executada": "qualificar | roteamento_vendedor",
  "cliente": {
    "nome": "Nome identificado ou null",
    "empresa": "Nome da empresa ou null",
    "cnpj": "CNPJ identificado ou 'Pessoa Física' ou null",
    "email": "E-mail identificado ou null",
    "cidade": "Cidade/UF identificada ou null"
  },
  "demanda": {
    "produto_normalizado": "Nome do produto ou null",
    "quantidade_metragem": "Quantidade ou null",
    "especificacao_tecnica_completa": "Especificação técnica detalhada completa (incluindo malha, fio/arame, espessura, dimensões, pilares, etc., exatamente idêntica à linha '- Especificação:' do seu resumo)",
    "material": "Material identificado ou null",
    "acabamento": "Acabamento ou null",
    "dimensoes": "Dimensões ou null",
    "segmento_detectado": "Indústria | Construção | Revenda | Serralheria | null",
    "resumo_executivo": "Resumo sintético em 1 a 2 linhas do projeto e especificações para o vendedor"
  },
  "campos_opcionais_perguntados": ["cnpj" ou "email" caso tenha feito a tentativa nesta mensagem],
  "qualificacao_concluida": false
}`;

  // 5. Histórico da conversa
  const messagesPayload: any[] = [
    { role: 'system', content: systemInstructions }
  ];

  history.forEach((m) => {
    const isCustomer =
      m.sender_type === 'lead' ||
      m.sender_type === 'user' ||
      m.sender_type === 'CUSTOMER' ||
      m.sender_type === 'customer';

    messagesPayload.push({
      role: isCustomer ? 'user' : 'assistant',
      content: m.message_content
    });
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: messagesPayload,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawResponse);

    // Atualizar tentativas se foram perguntadas
    const novosTentativas = { ...b2bAttempts };
    if (Array.isArray(parsed.campos_opcionais_perguntados)) {
      parsed.campos_opcionais_perguntados.forEach((k: string) => {
        if (novosTentativas[k] !== undefined) {
          novosTentativas[k] = (novosTentativas[k] || 0) + 1;
        }
      });
    }

    const hasNome = !!(parsed.cliente?.nome || dadosCadastrados.nome_cliente || dadosCadastrados.name);
    const hasEmpresa = !!(parsed.cliente?.empresa || dadosCadastrados.empresa || dadosCadastrados.company);
    const isConfirmed = !!parsed.qualificacao_concluida || parsed.acao_executada === 'roteamento_vendedor';
    const qualificacaoConcluida = isConfirmed && hasNome && hasEmpresa;

    return {
      resposta_whatsapp: parsed.resposta_whatsapp || 'Olá! Como posso te ajudar com nossos produtos?',
      intent: parsed.intent || 'produto_comercial',
      acao_executada: qualificacaoConcluida ? 'roteamento_vendedor' : (parsed.acao_executada || 'qualificar'),
      cliente: parsed.cliente || {},
      demanda: parsed.demanda || {},
      b2b_attempts: novosTentativas,
      qualificacao_concluida: qualificacaoConcluida,
      observacoes: 'Processado com motor facetado e regras dinâmicas de Schema B2B.'
    };
  } catch (error: any) {
    console.error('[OpenAI SDR Error]', error);
    return {
      erro_openai: error.message,
      resposta_whatsapp: 'Olá! Recebi sua mensagem e nossa equipe comercial já vai te atender.'
    };
  }
}

/**
 * generateSupportResponse — Gera resposta acolhedora enquanto o vendedor não atende e notifica SLA
 */
export async function generateSupportResponse(
  leadOrMessage: any,
  history: any[] = [],
  modeOrSeller?: string
) {
  const { data: config } = await supabase.from('tenant_config').select('openai_key, support_prompt').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  const defaultRet = {
    resposta: 'Olá! O consultor responsável já foi notificado da sua mensagem e logo entrará em contato.',
    message: 'Olá! O consultor responsável já foi notificado da sua mensagem e logo entrará em contato.',
    numero_pedido: null,
    escalar_urgente: true,
    intencao_pos_venda: 'atendimento',
    nova_informacao: null
  };

  if (!apiKey || apiKey === 'fake-key') {
    return defaultRet;
  }

  const openai = new OpenAI({ apiKey });
  const isContextObj = typeof modeOrSeller === 'object' && modeOrSeller !== null;
  const ctx: any = isContextObj ? modeOrSeller : {};
  const sellerName = typeof leadOrMessage === 'object' ? leadOrMessage?.current_owner?.name : (typeof modeOrSeller === 'string' ? modeOrSeller : null);

  let situationalGuidance = '';
  if (ctx.escalation_executed) {
    situationalGuidance = `\n- SITUAÇÃO CRÍTICA: O cliente já cobrou atendimento ${ctx.return_count || 3} vezes sem retorno. A COORDENAÇÃO GERAL DA PERMETAL JÁ FOI NOTIFICADA DIRETAMENTE para intervir com urgência máxima. Tranquilize o cliente informando que a coordenação já está no caso.`;
  } else if (ctx.charge_throttled) {
    situationalGuidance = `\n- ATENÇÃO: O cliente entrou em contato há poucos minutos desde a última notificação ao consultor (menos de 10 minutos de intervalo). O consultor já está com a solicitação na fila prioritária, mas pode estar em alinhamento técnico ou conferência de medidas. Não prometa cobrança repetida imediata; explique com simpatia que o caso já está com ele e logo ele responderá.`;
  } else if (ctx.seller_notified) {
    situationalGuidance = `\n- O consultor ${sellerName || 'responsável'} acabou de ser notificado com prioridade para fazer o contato imediato.`;
  }

  const supportPrompt = config?.support_prompt || `Você é o Lino Suporte da Permetal. O cliente já foi qualificado e está aguardando o consultor ${sellerName || 'responsável'}.
Seja cordial, profissional e acolhedor. Mantenha a resposta curta (1 a 2 frases no máximo).${situationalGuidance}`;

  try {
    const formattedHistory = (history || []).map((m: any) => ({
      role: m.sender_type === 'lead' || m.sender_type === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.message_content || ''
    }));

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: supportPrompt },
        ...formattedHistory
      ],
      temperature: 0.3
    });
    const text = res.choices[0]?.message?.content || defaultRet.resposta;
    return {
      resposta: text,
      message: text,
      numero_pedido: null,
      escalar_urgente: Boolean(ctx.escalation_executed),
      intencao_pos_venda: 'atendimento',
      nova_informacao: null
    };
  } catch (e: any) {
    return defaultRet;
  }
}
