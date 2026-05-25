import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/**
 * buildContext — Cria o contexto de prompt do sistema a partir do prompt mestre e RAG
 */
async function buildContext(ragContent?: string | null): Promise<string> {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  let context = config?.master_prompt || 'Você é Lino, um assistente SDR comercial focado em qualificar leads e prepará-los para o atendimento com um vendedor humano.';

  if (ragContent) {
    context += `\n\n${ragContent}`;
  }

  // Catálogo de produtos (sempre presente para identificação inicial)
  const { data: products } = await supabase.from('products').select('name, synonyms, is_express_eligible, express_max_qty, brands(name)');
  if (products && products.length > 0) {
    context += '\n\n=== CATÁLOGO DE PRODUTOS ===\n';
    context += 'Identifique o produto do cliente baseando-se nas opções abaixo:\n';
    for (const p of products) {
      context += `- ${p.name} | Marca: ${(p as any).brands?.name || 'N/A'} | Sinônimos: ${(p.synonyms || []).join(', ')}`;
      if (p.is_express_eligible) context += ` | EXPRESS (limite: ${p.express_max_qty})`;
      context += '\n';
    }
  }

  return context;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function processLeadWithSkills(history: { sender_type: string, message_content: string }[], leadId?: string) {
  // 1. Buscar configuração e chave
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return { erro_openai: 'Chave da OpenAI não configurada no banco de dados ou env.' };
  }

  // 2. Recuperar dados do lead no banco para guiar a coleta estruturada
  let detectedProduct: string | null = null;
  let leadInfoText = '';
  let qualificationInstructions = '';
  let ragContent = '';

  if (leadId) {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (leadData) {
      detectedProduct = leadData.detected_product || leadData.produto || null;
      
      // Buscar o schema de qualificação do produto
      let schema: any = null;
      if (detectedProduct) {
        const { data: productData } = await supabase
          .from('products')
          .select('qualification_schema')
          .ilike('name', `%${detectedProduct}%`)
          .limit(1)
          .maybeSingle();
        if (productData?.qualification_schema) {
          schema = productData.qualification_schema;
        }
      }

      // Se não houver schema de produto específico, usamos um padrão genérico
      if (!schema) {
        schema = {
          obrigatorias: ["nome_cliente", "empresa", "email", "quantidade"],
          opcionais: []
        };
      }

      // Recuperar estado estruturado (qualification_state)
      const qState = leadData.qualification_state || {};
      const valoresSalvos = qState.valores || {};
      const tentativasSalvas = qState.tentativas || {};

      // Dados preenchidos mapeados
      const preenchidos: Record<string, any> = {
        nome_cliente: leadData.name || null,
        empresa: leadData.company || leadData.empresa || null,
        cnpj: leadData.cnpj || null,
        email: leadData.email_corporativo || null,
        produto: detectedProduct || null,
        quantidade: leadData.quantidade || null
      };

      // Mesclar valores salvos no estado de qualificação com os campos raiz do lead
      const todasVariaveis = { ...preenchidos, ...valoresSalvos };

      const pendentesObrigatorias = schema.obrigatorias.filter((f: string) => !todasVariaveis[f]);
      const pendentesOpcionais = (schema.opcionais || []).filter((opt: any) => {
        const campo = opt.campo;
        const valor = todasVariaveis[campo];
        const tentativas = tentativasSalvas[campo] || 0;
        return !valor && tentativas < (opt.max_tentativas || 1);
      });

      leadInfoText = `
=== DADOS DO CLIENTE JÁ CADASTRADOS NO BANCO ===
${Object.entries(todasVariaveis)
  .map(([k, v]) => `- ${k.toUpperCase()}: ${v || 'Não informado'}`)
  .join('\n')}
================================================
`;

      qualificationInstructions = `
=== INSTRUÇÕES DE QUALIFICAÇÃO DO DIÁLOGO ===
Você atua como um agente de IA ultra moderno, empático e de alta fluidez conversacional.
Seu objetivo de qualificação é coletar os dados necessários para o atendimento comercial sem parecer um robô ou um formulário engessado.

1. VARIÁVEIS OBRIGATÓRIAS PENDENTES: [${pendentesObrigatorias.join(', ')}]
2. VARIÁVEIS OPCIONAIS PENDENTES (Dentro do limite de tentativas): [${pendentesOpcionais.map((o: any) => o.campo).join(', ')}]

REGRAS DE CONVERSAÇÃO ULTRA FLUIDA:
- NUNCA pergunte dados que já estejam cadastrados acima como preenchidos.
- Se o cliente fizer uma pergunta, desviar de assunto ou pedir informações sobre o produto, use as informações técnicas do catálogo abaixo para responder primeiro com atenção e clareza, e depois tente reintroduzir a coleta de forma natural.
- Não insista na mesma pergunta seguidamente se o cliente a ignorar. Introduza as perguntas em momentos oportunos.
- Apresente opções curtas de resposta no estilo catálogo/e-commerce quando aplicável (ex: espessuras disponíveis, tipos de furo).
- IMPORTANTE: No JSON de retorno, indique obrigatoriamente qual variável você tentou coletar na chave "campo_solicitado_nesta_rodada". Se você não tentou coletar nenhuma variável específica nesta resposta, retorne null.
`;

      // Carregar RAG associado se especificado no schema do produto
      if (schema.valores_validos_rag || schema.rag_document_name) {
        const docName = schema.valores_validos_rag || schema.rag_document_name;
        const { data: ragDoc } = await supabase
          .from('rag_documents')
          .select('name, content')
          .ilike('name', `%${docName}%`)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (ragDoc) {
          ragContent = `
=== BASE DE CONHECIMENTO TÉCNICA (RAG: ${ragDoc.name}) ===
${ragDoc.content || ''}
=========================================================
`;
        }
      } else if (detectedProduct) {
        // Fallback RAG pelo nome do produto
        const { data: ragDocs } = await supabase
          .from('rag_documents')
          .select('name, content')
          .eq('active', true)
          .limit(1);
        if (ragDocs && ragDocs.length > 0) {
          ragContent = `
=== BASE DE CONHECIMENTO TÉCNICA (RAG: ${ragDocs[0].name}) ===
${ragDocs[0].content || ''}
=========================================================
`;
        }
      }
    }
  }

  const dynamicOpenai = new OpenAI({ apiKey });
  const systemContext = await buildContext(ragContent);
  console.log(`[OpenAI Debug] Produto detectado: ${detectedProduct || 'nenhum (fase inicial)'}`);

  const extractionPrompt = `${systemContext}

${leadInfoText}

${qualificationInstructions}

---
INSTRUÇÃO FINAL — LEIA COM ATENÇÃO:

Você deve devolver EXCLUSIVAMENTE um JSON válido. Siga RIGOROSAMENTE as regras abaixo:

1. TOM HUMANO E CORDIAL:
   - Chame o cliente pelo nome assim que souber (ex: "Perfeito, João! ..." em vez de "Perfeito!")
   - Use linguagem natural, como um atendente humano experiente.
   - Nunca seja robótico ou repetitivo. Nunca repita a mesma pergunta duas vezes.
   - Máximo 2 frases curtas por mensagem. Sem listas, sem "\u2022", sem excessos.

2. GUIA EM CASCATA (MENU): Se o cliente escolheu um material, consulte o RAG e apresente as opções reais. Nunca invente especificações.

4. ESTADO DE COLETA DE DADOS: Enquanto você precisar fazer QUALQUER pergunta ao cliente (ex: perguntar quantidade, aplicação, nome da empresa ou e-mail), sua "acao_executada" deve ser OBRIGATORIAMENTE "coleta_dados".

5. ROTEAMENTO É O PONTO FINAL: SÓ marque "acao_executada": "roteamento_comercial" quando você NÃO TIVER MAIS NENHUMA PERGUNTA a fazer. Se usar essa ação, sua "resposta_whatsapp" deve ser SOMENTE um aviso de transferência (ex: "Tudo certo! Estou te transferindo para o especialista agora."). Nunca misture uma pergunta com a ação de roteamento.

6. DADOS DO CLIENTE NO JSON: DDD, telefone e localização são extraídos automaticamente pelo sistema. NÃO tente extrair ddd_regiao do texto, sempre retorne null nesse campo.

{
  "pensamento_critico": "<OBRIGATÓRIO: 1. Qual variável pendente estou tentando coletar de forma sutil? 2. Apresentei opções do RAG? 3. Tom de diálogo humanizado e fluido?>",
  "resposta_whatsapp": "<sua mensagem — máximo 2 frases, tom humano, chame pelo nome se souber>",
  "campo_solicitado_nesta_rodada": "<nome_da_variavel_solicitada_como_empresa_ou_email_ou_espessura_etc | null>",
  "intent": "<PRODUTO | VAGAS | FORNECEDOR | LOGISTICA | FINANCEIRO | COMEX | MARKETING | OUTRO>",
  "confidence": "<0 a 100>",
  "cliente": {
    "nome": "<extraia o nome ou null>",
    "empresa": "<extraia a empresa ou null>",
    "cnpj": "<extraia o cnpj ou null>",
    "email": "<extraia o email ou null>",
    "telefone": null,
    "ddd_regiao": null,
    "canal_origem": "whatsapp"
  },
  "demanda": {
    "produto_normalizado": "<nome exato do produto conforme catálogo ou null>",
    "produto_familia": "<produto principal ou null>",
    "produto_modelo": "<modelo específico ou null>",
    "marca_linha": "<marca ou null>",
    "segmento_normalizado": "<industria, construcao ou revenda ou null>",
    "segmento_aplicacao": "<aplicação descrita pelo cliente ou null>",
    "quantidade_metragem": "<quantidade ou null>",
    "material": "<material ou null>",
    "acabamento": "<acabamento ou null>",
    "dimensoes": "<dimensões ou null>",
    "tem_projeto_anexo": false,
    "urgencia": "<alta, media, baixa ou null>"
  },
  "estado_lead": {
    "dados_minimos_completos": <true SOMENTE se: produto + quantidade + especificação técnica mínima + aplicação/segmento definidos. Caso contrário: false>,
    "motivo_faltante": "<o que ainda falta, ex: faltando_tipo_furo, faltando_quantidade>"
  },
  "rag": {
    "consultado": <true se usou RAG, false caso contrário>,
    "fontes": ["<nome do documento RAG usado>"],
    "confianca": "<alta, media ou baixa>",
    "observacao": "<nota sobre o que o RAG respondeu>"
  },
  "acao_executada": "<roteamento_comercial | confirmacao | coleta_dados | duvida_tecnica | outro_setor>",
  "observacoes": "<notas internas do raciocínio>"
}
`;

  const messages: ChatMessage[] = [
    { role: 'system', content: extractionPrompt }
  ];

  // Adiciona o histórico
  for (const msg of history) {
    if (msg.sender_type === 'lead') {
      messages.push({ role: 'user', content: msg.message_content });
    } else if (msg.sender_type === 'sdr_ai') {
      messages.push({ role: 'assistant', content: msg.message_content });
    }
  }

  console.log(`[OpenAI Debug] Mensagens: ${messages.length}`);

  try {
    console.log(`[OpenAI] Enviando requisição com ${messages.length} mensagens.`);
    const response = await dynamicOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    console.log('[OpenAI] Resposta bruta:', content);
    const result = JSON.parse(content);

    // --- CONFIRMATION GUARD INTERCEPTOR ---
    if (result.acao_executada === 'roteamento_comercial') {
      // 1. Verificar se no histórico já enviamos o resumo
      let enviouResumo = false;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender_type === 'sdr_ai') {
          const text = history[i].message_content.toLowerCase();
          if (
            text.includes('resumo') || 
            text.includes('tudo certinho?') || 
            text.includes('está correto?') ||
            text.includes('confirmar') ||
            (text.includes('empresa:') && text.includes('produto:'))
          ) {
            enviouResumo = true;
            break;
          }
        }
      }

      // 2. Verificar se a última mensagem do cliente foi uma confirmação
      const lastLeadMsg = [...history].reverse().find(h => h.sender_type === 'lead');
      
      const verificarConfirmacaoCliente = (texto: string): boolean => {
        const t = texto.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
        const termosConfirmacao = [
          'sim', 'ok', 'isso', 'correto', 'tudo certo', 'tudo certinho', 'confirmo', 
          'pode ser', 'tá certo', 'ta certo', 'esta certo', 'está correto', 'sim está', 
          'perfeito', 'fechado', 'exato', 'com certeza', 'pode enviar', 'pode mandar',
          'esta correto', 'esta certinho', 'sim pfv', 'sim por favor', 'pode', 's'
        ];
        return termosConfirmacao.some(termo => t === termo || t.startsWith(termo + ' ') || t.endsWith(' ' + termo) || t.includes(' ' + termo + ' '));
      };

      const clienteConfirmou = lastLeadMsg ? verificarConfirmacaoCliente(lastLeadMsg.message_content) : false;

      console.log(`[ConfirmationGuard] acao_executada era roteamento_comercial. enviouResumo: ${enviouResumo}, clienteConfirmou: ${clienteConfirmou}`);

      if (!enviouResumo || !clienteConfirmou) {
        console.log(`[ConfirmationGuard] Bloqueando roteamento prematuro. Forçando etapa de confirmação.`);
        result.acao_executada = 'confirmacao';
        
        // Montar resumo formatado dos dados extraídos
        const dadosResumo: string[] = [];
        if (result.cliente?.empresa) dadosResumo.push(`* Empresa: ${result.cliente.empresa}`);
        if (result.cliente?.cnpj) dadosResumo.push(`* CNPJ: ${result.cliente.cnpj}`);
        if (result.cliente?.email) dadosResumo.push(`* E-mail: ${result.cliente.email}`);
        
        const prod = result.demanda?.produto_normalizado || result.demanda?.produto_familia || result.demanda?.produto_modelo;
        if (prod) dadosResumo.push(`* Produto: ${prod}`);
        
        if (result.demanda?.quantidade_metragem) dadosResumo.push(`* Quantidade: ${result.demanda.quantidade_metragem}`);
        
        const especParts = [result.demanda?.dimensoes, result.demanda?.acabamento, result.demanda?.material].filter(Boolean);
        if (especParts.length > 0) {
          dadosResumo.push(`* Especificação: ${especParts.join(' | ')}`);
        }
        
        result.resposta_whatsapp = `Fechou! Aqui vai o resumo da sua cotação 📋\n${dadosResumo.join('\n')}\n\nTudo certinho? Me diga 'sim' para confirmar ou 'corrigir' se quiser ajustar.`;
      }
    }

    return result;
  } catch (error: any) {
    console.error('[OpenAI Error]', error.message || error);
    return { erro_openai: error.message || 'Erro desconhecido na OpenAI' };
  }
}

export async function generateSupportResponse(leadData: any, history: any[], actionType: string) {
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;
  if (!apiKey) return { message: "Estou verificando sua situação com nossa equipe." };

  const dynamicOpenai = new OpenAI({ apiKey });

  // Buscar nome real do vendedor no banco
  let vendedorNome = 'o especialista';
  if (leadData.current_owner_id) {
    const { data: seller } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', leadData.current_owner_id)
      .single();
    if (seller?.name) vendedorNome = seller.name;
  }

  // Prompt separado de Suporte
  const supportPromptBase = config?.support_prompt || `Você é o Lino Suporte, assistente da Permetal S.A.
Você atua como ponte entre o cliente e o vendedor responsável pelo atendimento.
Tom: humano, empático, direto. Máximo 2 frases por mensagem.`;

  const systemPrompt = `${supportPromptBase}

CONTEXTO DO ATENDIMENTO ATUAL:
- Cliente: ${leadData.name || 'Cliente'}
- Vendedor responsável: ${vendedorNome}
- Situação: ${actionType}

REGRAS OBRIGATÓRIAS:
1. Nunca diga que não sabe quem é o vendedor — o vendedor é ${vendedorNome}.
2. Nunca use frases prontas como "Entendo sua urgência" ou "Vou verificar".
3. Se o cliente estiver bravo, reconheça o problem sem inventar justificativas.
4. Nunca diga "alta demanda" sem ter certeza do contexto real.
5. Não prometa prazos específicos.
6. CLASSIFICAÇÃO: Analise se a última mensagem do cliente trouxe uma nova especificação técnica (nova medida, mudança de material, alteração de quantidade, envio de projeto, etc.) que o vendedor precisa saber. Se sim, defina "nova_informacao" como true.

Você deve retornar EXCLUSIVAMENTE um objeto JSON neste formato:
{
  "nova_informacao": <true|false>,
  "message": "<Apenas o texto da mensagem para o WhatsApp.>"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({
      role: m.sender_type === 'lead' ? 'user' : 'assistant',
      content: m.message_content
    }))
  ];

  try {
    const response = await dynamicOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      response_format: { type: 'json_object' }
    });
    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
  } catch (e) {
    return { message: "Um momento, estou verificando com o vendedor.", nova_informacao: false };
  }
}
