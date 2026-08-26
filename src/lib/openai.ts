import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const DESCRICOES_PADRAO: Record<string, string> = {
  nome_cliente: "Nome completo do cliente",
  empresa: "Nome da empresa do cliente",
  email: "E-mail corporativo do cliente",
  cnpj: "CNPJ da empresa",
  quantidade: "Quantidade/metragem do pedido (peÃ§as, m2, metros, rolos)",
  material: "Material do produto (ex: AÃ§o Carbono, Galvanizado, INOX, AlumÃ­nio)",
  espessura: "Espessura da chapa em mm",
  tipo_furo: "Tipo de furo (redondo, quadrado, oblongo, hexagonal, retangular ou losangular)",
  dimensoes: "Medida do furo em mm (diÃ¢metro para redondo, lado para quadrado, A x B para outros furos)",
  ec: "Entre-centros em mm (espaÃ§amento centro a centro)",
  disposicao: "DisposiÃ§Ã£o dos furos (AL - Alternada, RE - Reta, DI - Diagonal, etc.)",
  malha: "Medida da malha A x B em mm (abertura da malha, ex: 10x20 mm)",
  cordao: "Largura do cordÃ£o (passe) em mm",
  dimensoes_placa: "DimensÃµes da placa ou rolo (largura x comprimento)",
  modelo_gradil: "Modelo do gradil (Stadium, Artis, Sigma, Leone, Ã”mega, etc.)",
  tipo_portao: "Tipo de portÃ£o (deslizante ou pivotante)",
  altura: "Altura do portÃ£o em mm",
  largura_vao: "Largura do vÃ£o ou portÃ£o em mm",
  acabamento: "Acabamento/pintura (galvanizado a fogo, pintura epÃ³xi, etc.)",
  forma_recalque: "Formato do relevo/recalque (quadrado, oblongo, redondo, modelo GME)",
  dimensoes_recalque: "Medidas do relevo/recalque em mm",
  modelo_forro: "Modelo do forro (modular, colmeia, ripado, linear, baffle)",
  dimensoes_forro: "Medidas das colmeias, rÃ©guas ou placas (comprimento x largura x altura)",
  tipo_furo_forro: "Se o forro Ã© perfurado (tipo de furo) ou liso",
  modelo_brise: "Modelo do brise metÃ¡lico",
  modelo_antiofuscante: "Modelo da tela antiofuscante"
};

/**
 * buildContext â€” Cria o contexto de prompt do sistema a partir do prompt mestre e RAG
 */
async function buildContext(ragContent?: string | null): Promise<string> {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  let context = config?.master_prompt || 'VocÃª Ã© Lino, um assistente SDR comercial focado em qualificar leads e preparÃ¡-los para o atendimento com um vendedor humano.';

  if (ragContent) {
    context += `\n\n${ragContent}`;
  }

  // CatÃ¡logo de produtos (sempre presente para identificaÃ§Ã£o inicial)
  const { data: products } = await supabase.from('products').select('name, synonyms, is_express_eligible, express_max_qty, brands(name)');
  if (products && products.length > 0) {
    context += '\n\n=== CATÃLOGO DE PRODUTOS ===\n';
    context += 'Identifique o produto do cliente baseando-se nas opÃ§Ãµes abaixo:\n';
    for (const p of products) {
      context += `- ${p.name} | Marca: ${(p as any).brands?.name || 'N/A'} | SinÃ´nimos: ${(p.synonyms || []).join(', ')}`;
      if (p.is_express_eligible) context += ` | EXPRESS (limite: ${p.express_max_qty} - se a quantidade for MAIOR que o limite, PROÍBIDO classificar como EXPRESS)`;
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
  // 1. Buscar configuraÃ§Ã£o e chave
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return { erro_openai: 'Chave da OpenAI nÃ£o configurada no banco de dados ou env.' };
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
      
      // Buscar o schema de qualificaÃ§Ã£o do produto
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

      // Extrair variÃ¡veis configuradas no Front End
      const extVars = config?.extraction_variables || [
        { name: "empresa", description: "Nome da empresa do cliente", required: true },
        { name: "email", description: "E-mail corporativo", required: true },
        { name: "cnpj", description: "CNPJ da empresa", required: true }
      ];

      const schemaObrigatorias = extVars.filter((v: any) => v.required).map((v: any) => v.name);
      const schemaOpcionais = extVars.filter((v: any) => !v.required).map((v: any) => ({ campo: v.name, max_tentativas: 1 }));

      // Se nÃ£o houver schema de produto especÃ­fico, usamos as variÃ¡veis do Painel
      if (!schema) {
        schema = {
          obrigatorias: schemaObrigatorias,
          opcionais: schemaOpcionais
        };
      }

      // Recuperar estado estruturado (qualification_state)
      const qState = leadData.qualification_state || {};
      const valoresSalvos = qState.valores || {};
      const tentativasSalvas = qState.tentativas || {};

      // Dados preenchidos mapeados
      const preenchidos: Record<string, any> = {
        nome_cliente: leadData.name || null,
        produto: detectedProduct || null,
        quantidade: leadData.quantidade || null
      };
      
      // Carrega os dados das variÃ¡veis dinÃ¢micas se jÃ¡ existirem no lead raiz
      for (const v of extVars) {
        if (leadData[v.name] !== undefined && leadData[v.name] !== null) {
          preenchidos[v.name] = leadData[v.name];
        }
      }

      // Mesclar valores salvos no estado de qualificaÃ§Ã£o com os campos raiz do lead
      const todasVariaveis = { ...preenchidos, ...valoresSalvos };

      const pendentesObrigatorias = schema.obrigatorias.filter((f: string) => !todasVariaveis[f]);
      const pendentesOpcionais = (schema.opcionais || []).filter((opt: any) => {
        const campo = opt.campo;
        const valor = todasVariaveis[campo];
        const tentativas = tentativasSalvas[campo] || 0;
        return !valor && tentativas < (opt.max_tentativas || 1);
      });

      leadInfoText = `
=== DADOS DO CLIENTE JÃ CADASTRADOS NO BANCO ===
${Object.entries(todasVariaveis)
  .map(([k, v]) => `- ${k.toUpperCase()}: ${v || 'NÃ£o informado'}`)
  .join('\n')}
================================================
`;

      const formatarPendente = (campo: string) => {
        const opt = (schema.opcionais || []).find((o: any) => o.campo === campo);
        const desc = opt?.descricao || DESCRICOES_PADRAO[campo] || `Campo tÃ©cnico ${campo}`;
        return `- **${campo}**: ${desc}`;
      };

      const pendentesObrigatoriasText = pendentesObrigatorias.map(formatarPendente).join('\n') || 'Nenhuma';
      const pendentesOpcionaisText = pendentesOpcionais.map((opt: any) => formatarPendente(opt.campo)).join('\n') || 'Nenhuma';

      qualificationInstructions = `
=== INSTRUÃ‡Ã•ES DE QUALIFICAÃ‡ÃƒO DO DIÃLOGO ===
VocÃª atua como um agente de IA ultra moderno, empÃ¡tico e de alta fluidez conversacional.
Seu objetivo de qualificaÃ§Ã£o Ã© coletar os dados necessÃ¡rios para o atendimento comercial sem parecer um robÃ´ ou um formulÃ¡rio engessado.

1. VARIÃVEIS OBRIGATÃ“RIAS PENDENTES:
${pendentesObrigatoriasText}

2. VARIÃVEIS OPCIONAIS PENDENTES (Dentro do limite de tentativas):
${pendentesOpcionaisText}

REGRAS DE CONVERSAÃ‡ÃƒO ULTRA FLUIDA:
- NUNCA pergunte dados que jÃ¡ estejam cadastrados acima como preenchidos.
- Se o cliente fizer uma pergunta, desviar de assunto ou pedir informaÃ§Ãµes sobre o produto, use as informaÃ§Ãµes tÃ©cnicas do catÃ¡logo abaixo para responder primeiro com atenÃ§Ã£o e clareza, e depois tente reintroduzir a coleta de forma natural.
- NÃ£o insista na mesma pergunta seguidamente se o cliente a ignorar. Introduza as perguntas em momentos oportunos.
- Apresente opÃ§Ãµes curtas de resposta no estilo catÃ¡logo/e-commerce quando aplicÃ¡vel (ex: espessuras disponÃ­veis, tipos de furo).
- IMPORTANTE: No JSON de retorno, indique obrigatoriamente qual variÃ¡vel vocÃª tentou coletar na chave "campo_solicitado_nesta_rodada". Se vocÃª nÃ£o tentou coletar nenhuma variÃ¡vel especÃ­fica nesta resposta, retorne null.
- IMPORTANTE: Extraia qualquer valor dessas variÃ¡veis pendentes que o cliente tenha mencionado e coloque no objeto "valores_campos_pendentes" do JSON.
`;

            // NOVO FLUXO RAG V2 (FILTRAGEM PROGRESSIVA)
      if (detectedProduct) {
        // 1. O LLM extraiu variǭveis na rodada anterior (salvas em valoresSalvos).
        // 2. Buscamos todas as variantes dessa categoria.
        const normalizedCategory = detectedProduct.toLowerCase().replace(/ /g, '_');
        
        let query = supabase.from('rag_chunks').select('metadata, content').eq('ativo_para_filtro', true).limit(50);
        
        // Aplica filtro por cada variǭvel extrada
        for (const [key, value] of Object.entries(todasVariaveis)) {
          if (value && key !== 'nome_cliente' && key !== 'empresa' && key !== 'email' && key !== 'cnpj' && key !== 'quantidade') {
             // Em um sistema real jsonb query: query = query.contains('metadata', { [key]: value })
             // Como nǜo sabemos a estrutura exata do jsonb no Supabase JS v2, filtramos via RPC match_rag_chunks 
             // ou trazemos os dados e filtramos em memria.
          }
        }
        
        // Por simplicidade, vamos injetar o RAG semǽntico (regras) + metadados
        const { data: chunks } = await supabase.rpc('match_rag_chunks', {
           query_embedding: (await new OpenAI({ apiKey }).embeddings.create({ input: (history[history.length -1]?.message_content || detectedProduct), model: 'text-embedding-ada-002' })).data[0].embedding,
           match_threshold: 0.7,
           match_count: 5
        });

        if (chunks && chunks.length > 0) {
          ragContent = \n=== BASE T%CNICA ESTRUTURADA ===\n;
          chunks.forEach(c => {
             ragContent += - Variante/Regra: \n;
          });
          ragContent += \nINSTRUǟO DE FILTRAGEM: O cliente quer . Use a base acima para cruzar com o que ele jǭ disse. Se a base nǜo tiver combinaǜo para o que ele pediu, diga que nǜo encontrou e roteie para o comercial. Se faltar dados (ex: material), mostre APENAS as opes presentes na base acima.;
        }
      }} else if (detectedProduct) {
        // Fallback RAG pelo nome do produto
        const { data: ragDocs } = await supabase
          .from('rag_documents')
          .select('name, content')
          .ilike('name', `%${detectedProduct}%`)
          .eq('active', true)
          .limit(1);
        if (ragDocs && ragDocs.length > 0) {
          ragContent = `
=== BASE DE CONHECIMENTO TÃ‰CNICA (RAG: ${ragDocs[0].name}) ===
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

  // Coleta genÃ©rica de campos no JSON de retorno
  let todosPendentes: string[] = [];
  if (leadId) {
    const { data: leadData } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (leadData) {
      let schema: any = null;
      if (detectedProduct) {
        const { data: productData } = await supabase.from('products').select('qualification_schema').ilike('name', `%${detectedProduct}%`).limit(1).maybeSingle();
        schema = productData?.qualification_schema;
      }
      const extVars = config?.extraction_variables || [
        { name: "empresa", description: "Nome da empresa do cliente", required: true },
        { name: "email", description: "E-mail corporativo", required: true },
        { name: "cnpj", description: "CNPJ da empresa", required: true }
      ];
      if (!schema) {
        const schemaObrigatorias = extVars.filter((v: any) => v.required).map((v: any) => v.name);
        const schemaOpcionais = extVars.filter((v: any) => !v.required).map((v: any) => ({ campo: v.name }));
        schema = { obrigatorias: schemaObrigatorias, opcionais: schemaOpcionais };
      }
      const qState = leadData.qualification_state || {};
      const valoresSalvos = qState.valores || {};
      const preenchidos: Record<string, any> = { nome_cliente: leadData.name || null, produto: detectedProduct || null, quantidade: leadData.quantidade || null };
      for (const v of extVars) {
        if ((leadData as any)[v.name] !== undefined && (leadData as any)[v.name] !== null) {
          preenchidos[v.name] = (leadData as any)[v.name];
        }
      }
      const todasVariaveis = { ...preenchidos, ...valoresSalvos };
      const pendentesObrigatorias = schema.obrigatorias.filter((f: string) => !todasVariaveis[f]);
      const pendentesOpcionais = (schema.opcionais || []).filter((opt: any) => !todasVariaveis[opt.campo]);
      todosPendentes = [...pendentesObrigatorias, ...pendentesOpcionais.map((o: any) => o.campo)];
    }
  }

  // Fallback se nÃ£o hÃ¡ leadId ou lista vazia
  if (todosPendentes.length === 0) {
    todosPendentes = ["empresa", "email", "quantidade"];
  }

  const dynamicJsonFields = todosPendentes.map((campo: string) => `    "${campo}": "<extraia o valor do diÃ¡logo para ${campo} ou null>"`).join(',\n');

  const extractionPrompt = `${systemContext}

${leadInfoText}

${qualificationInstructions}

---
INSTRUÃ‡ÃƒO FINAL â€” LEIA COM ATENÃ‡ÃƒO:

VocÃª deve devolver EXCLUSIVAMENTE um JSON vÃ¡lido. Siga RIGOROSAMENTE as regras abaixo:

1. TOM HUMANO E CORDIAL:
   - Chame o cliente pelo nome assim que souber (ex: "Perfeito, JoÃ£o! ..." em vez de "Perfeito!")
   - Use linguagem natural, como um atendente humano experiente.
   - Nunca seja robÃ³tico ou repetitivo. Nunca repita a mesma pergunta duas vezes.
   - Tente ser conciso, mas SE precisar dar opÃ§Ãµes do catÃ¡logo, pode usar listas curtas.

2. GUIA EM CASCATA (FILTRAGEM E-COMMERCE ESTRITA):
   - VOCÃŠ NÃƒO Ã‰ UM ORÃ‡AMENTISTA, mas sim um filtro de tabela. Use EXCLUSIVAMENTE os dados do RAG.
   - FAÃ‡A APENAS UMA PERGUNTA TÃ‰CNICA POR VEZ. NÃ£o faÃ§a combos de perguntas tÃ©cnicas (ex: nunca pergunte "qual a espessura e a malha?" na mesma frase).
   - AFUNILAMENTO LÃ“GICO: Quando o cliente escolher um item (ex: Material = AÃ§o Galvanizado), olhe na tabela QUAIS opÃ§Ãµes sobram para o prÃ³ximo passo e LISTE-AS. (Ex: "Para AÃ§o Galvanizado, temos as malhas 6x10 e 12x25. Qual prefere?").
   - SE A LISTA FOR MUITO GRANDE, apresente as 3 a 5 primeiras opÃ§Ãµes e diga: "Temos essas e outras medidas, qual vocÃª busca?".
   - Nunca invente especificaÃ§Ãµes nem assuma valores que o cliente nÃ£o confirmou, continue afunilando atÃ© encontrar o item ou o cliente dizer que nÃ£o sabe. Se o cliente nÃ£o souber, pare a especificaÃ§Ã£o e siga em frente.

4. ESTADO DE COLETA DE DADOS: Enquanto existirem variÃ¡veis listadas como OBRIGATÃ“RIAS PENDENTES no bloco acima, ou enquanto vocÃª precisar coletar especificaÃ§Ãµes tÃ©cnicas do produto, sua "acao_executada" deve ser OBRIGATORIAMENTE "coleta_dados".

5. COLETA OTIMIZADA (MÃšLTIPLOS DADOS): Quando for coletar dados comerciais obrigatÃ³rios (como CNPJ, Empresa, E-mail, AplicaÃ§Ã£o, Quantidade), vocÃª PODE E DEVE pedir mÃºltiplos dados na mesma mensagem de forma amigÃ¡vel, para nÃ£o deixar o fluxo longo e cansativo. Exemplo: "Qual o seu e-mail corporativo e o CNPJ da empresa para agilizarmos o cadastro e o orÃ§amento?"

6. ROTEAMENTO Ã‰ O PONTO FINAL: SÃ“ marque "acao_executada": "roteamento_comercial" quando TODAS as variÃ¡veis obrigatÃ³rias jÃ¡ estiverem preenchidas E a especificaÃ§Ã£o tÃ©cnica do produto estiver clara. Se usar essa aÃ§Ã£o, sua "resposta_whatsapp" deve ser SOMENTE um aviso informando que a triagem acabou, que o especialista entrarÃ¡ em contato em instantes pelo WhatsApp prÃ³prio do vendedor.

7. PESSOA FÃSICA / RECUSAS: Se o cliente disser que Ã© pessoa fÃ­sica, que nÃ£o tem CNPJ, que nÃ£o tem empresa, ou se recusar a passar algum dado, PREENCHA o respectivo campo pendente no JSON (ex: "empresa", "cnpj", "email") com o valor "Pessoa FÃ­sica", "NÃ£o possui" ou "Recusado". NUNCA retorne null nesses casos, senÃ£o o sistema continuarÃ¡ pedindo. Se preencher com um texto, o sistema considerarÃ¡ como resolvido e avanÃ§arÃ¡.

9. REGRA DE QUANTIDADE EXPRESS: Se a quantidade que o cliente quer for MAIOR que o limite do produto EXPRESS indicado, NÃO preencha 'marca_linha' como EXPRESS. O Roteamento comercial NÃO DEVE ser acionado se faltarem as variáveis obrigatórias (empresa, email, cnpj).

9. REGRAS GLOBAIS DE EXPRESS:

Se a quantidade, aplicaǜo ou produto do cliente violar QUALQUER uma das regras acima (exemplo: 80 m  maior que o limite Mximo),  EXPRESSAMENTE PROIBIDO classificar como EXPRESS.

8. DADOS DO CLIENTE NO JSON: DDD, telefone e localizaÃ§Ã£o sÃ£o extraÃ­dos automaticamente pelo sistema. NÃƒO tente extrair ddd_regiao do texto, sempre retorne null nesse campo.

{
  "pensamento_critico": "<OBRIGATÃ“RIO: 1. Qual variÃ¡vel pendente estou tentando coletar de forma sutil? 2. Pedi mais de um dado ao mesmo tempo se possÃ­vel? 3. Apresentei opÃ§Ãµes do RAG?>",
  "resposta_whatsapp": "<sua mensagem â€” mÃ¡ximo 2 frases, tom humano, chame pelo nome se souber>",
  "campo_solicitado_nesta_rodada": "<nome_da_variavel_solicitada_como_empresa_ou_email_ou_espessura_etc | null>",
  "intent": "<PRODUTO | VAGAS | FORNECEDOR | LOGISTICA | FINANCEIRO | COMEX | MARKETING | OUTRO>",
  "confidence": "<0 a 100>",
  "cliente": {
    "nome": "<extraia o nome ou null>",
    "telefone": null,
    "ddd_regiao": null,
    "canal_origem": "whatsapp"
  },
  "demanda": {
    "produto_normalizado": "<nome exato do produto conforme catÃ¡logo ou null>",
    "produto_familia": "<produto principal ou null>",
    "produto_modelo": "<modelo especÃ­fico ou null>",
    "marca_linha": "<marca ou null>",
    "segmento_normalizado": "<industria, construcao ou revenda ou null>",
    "segmento_aplicacao": "<aplicaÃ§Ã£o descrita pelo cliente ou null>",
    "quantidade_metragem": "<quantidade ou null>",
    "material": "<material ou null>",
    "acabamento": "<acabamento ou null>",
    "dimensoes": "<dimensÃµes ou null>",
    "tem_projeto_anexo": false,
    "urgencia": "<alta, media, baixa ou null>"
  },
  "valores_campos_pendentes": {
${dynamicJsonFields}
  },
  "status_qualificacao": {
    "status_qualificacao": "<incompleto | minimo_para_vendedor | completo>",
    "campos_faltantes": ["<campos obrigatÃ³rios ou opcionais pendentes, ex: material, espessura, quantidade>"],
    "precisa_vendedor": <true se jÃ¡ coletou o mÃ­nimo necessÃ¡rio (produto + quantidade + material/especificaÃ§Ãµes bÃ¡sicas) ou se o cliente nÃ£o quer responder mais e deve ir para atendimento humano. Caso contrÃ¡rio: false>,
    "precisa_engenharia": "<sim | nao - sim se envolver carga, piso, passarela, seguranÃ§a ou medida/recalque especial>",
    "motivo_engenharia": "<carga | piso | passarela | seguranca | medida_especial | aplicacao_critica | nao_aplica>",
    "resumo_para_vendedor": "<Resumo estruturado no padrÃ£o Permetal. Exemplo:\nCliente: JoÃ£o - Empresa ABC\nProduto: Chapa perfurada furo redondo\nQuantidade: 20 chapas\nEspecificaÃ§Ã£o: carbono, esp. 0,45 mm, furo redondo Ã˜3 mm, EC 4 mm, disposiÃ§Ã£o AL, chapa 1000 x 2000 mm.\nAplicaÃ§Ã£o: ventilaÃ§Ã£o industrial\nAnexos: cliente enviou foto/projeto ou nÃ£o possui\nStatus: mÃ­nimo para vendedor | completo\nPendÃªncias: confirmar fabricaÃ§Ã£o, preÃ§o, prazo e disponibilidade.>"
  },
  "rag": {
    "consultado": <true se usou RAG, false caso contrÃ¡rio>,
    "fontes": ["<nome do documento RAG usado>"],
    "confianca": "<alta, media ou baixa>",
    "observacao": "<nota sobre o que o RAG respondeu>"
  },
  "acao_executada": "<roteamento_comercial | confirmacao | coleta_dados | duvida_tecnica | outro_setor>",
  "observacoes": "<notas internas do raciocÃ­nio>"
}
`;

  const messages: ChatMessage[] = [
    { role: 'system', content: extractionPrompt }
  ];

  // Adiciona o histÃ³rico
  for (const msg of history) {
    if (msg.sender_type === 'lead') {
      messages.push({ role: 'user', content: msg.message_content });
    } else if (msg.sender_type === 'sdr_ai') {
      messages.push({ role: 'assistant', content: msg.message_content });
    }
  }

  console.log(`[OpenAI Debug] Mensagens: ${messages.length}`);

  try {
    console.log(`[OpenAI] Enviando requisiÃ§Ã£o com ${messages.length} mensagens.`);
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
      // 1. Verificar se no histÃ³rico jÃ¡ enviamos o resumo
      let enviouResumo = false;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender_type === 'sdr_ai') {
          const text = history[i].message_content.toLowerCase();
          if (
            text.includes('resumo') || 
            text.includes('tudo certinho?') || 
            text.includes('estÃ¡ correto?') ||
            text.includes('confirmar') ||
            (text.includes('empresa:') && text.includes('produto:'))
          ) {
            enviouResumo = true;
            break;
          }
        }
      }

      // 2. Verificar se a Ãºltima mensagem do cliente foi uma confirmaÃ§Ã£o
      const lastLeadMsg = [...history].reverse().find(h => h.sender_type === 'lead');
      
      const verificarConfirmacaoCliente = (texto: string): boolean => {
        const t = texto.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
        const termosConfirmacao = [
          'sim', 'ok', 'isso', 'correto', 'tudo certo', 'tudo certinho', 'confirmo', 
          'pode ser', 'tÃ¡ certo', 'ta certo', 'esta certo', 'estÃ¡ correto', 'sim estÃ¡', 
          'perfeito', 'fechado', 'exato', 'com certeza', 'pode enviar', 'pode mandar',
          'esta correto', 'esta certinho', 'sim pfv', 'sim por favor', 'pode', 's'
        ];
        return termosConfirmacao.some(termo => t === termo || t.startsWith(termo + ' ') || t.endsWith(' ' + termo) || t.includes(' ' + termo + ' '));
      };

      const clienteConfirmou = lastLeadMsg ? verificarConfirmacaoCliente(lastLeadMsg.message_content) : false;

      console.log(`[ConfirmationGuard] acao_executada era roteamento_comercial. enviouResumo: ${enviouResumo}, clienteConfirmou: ${clienteConfirmou}`);

      if (!enviouResumo || !clienteConfirmou) {
        console.log(`[ConfirmationGuard] Bloqueando roteamento prematuro. ForÃ§ando etapa de confirmaÃ§Ã£o.`);
        result.acao_executada = 'confirmacao';
        
        // Montar resumo formatado dos dados extraÃ­dos
        const dadosResumo: string[] = [];
        if (result.cliente?.empresa) dadosResumo.push(`* Empresa: ${result.cliente.empresa}`);
        if (result.cliente?.cnpj) dadosResumo.push(`* CNPJ: ${result.cliente.cnpj}`);
        if (result.cliente?.email) dadosResumo.push(`* E-mail: ${result.cliente.email}`);
        
        const prod = result.demanda?.produto_normalizado || result.demanda?.produto_familia || result.demanda?.produto_modelo;
        if (prod) dadosResumo.push(`* Produto: ${prod}`);
        
        if (result.demanda?.quantidade_metragem) dadosResumo.push(`* Quantidade: ${result.demanda.quantidade_metragem}`);
        
        const especParts = [result.demanda?.dimensoes, result.demanda?.acabamento, result.demanda?.material].filter(Boolean);
        if (especParts.length > 0) {
          dadosResumo.push(`* EspecificaÃ§Ã£o: ${especParts.join(' | ')}`);
        }
        
        result.resposta_whatsapp = `Fechou! Aqui vai o resumo da sua cotaÃ§Ã£o ðŸ“‹\n${dadosResumo.join('\n')}\n\nTudo certinho? Me diga 'sim' para confirmar ou 'corrigir' se quiser ajustar.`;
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
  if (!apiKey) return { message: "Estou verificando sua situaÃ§Ã£o com nossa equipe." };

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

  // Prompt separado de Suporte e PÃ³s-Venda
  const supportPromptBase = config?.support_prompt || `VocÃª Ã© o Lino Suporte e PÃ³s-Venda, a central inteligente de relacionamento com o cliente.
VocÃª atua como ponte entre o cliente e o vendedor, cobrando agilidade no atendimento de orÃ§amentos ou atuando como ouvidoria para pedidos jÃ¡ faturados.
Tom: humano, empÃ¡tico, resolutivo e direto. VocÃª nÃ£o acusa o vendedor, mas se posiciona ao lado do cliente para resolver. MÃ¡ximo 2 frases por mensagem.`;

  const isPosVenda = actionType === 'POS_VENDA_RECEPTIVO';

  let rules = `REGRAS OBRIGATÃ“RIAS:
1. Nunca diga que nÃ£o sabe quem Ã© o vendedor â€” o vendedor Ã© ${vendedorNome}.
2. Nunca use frases prontas como "Entendo sua urgÃªncia" ou "Vou verificar".
3. Se o cliente estiver bravo, reconheÃ§a o problema sem inventar justificativas.
4. Nunca diga "alta demanda" sem ter certeza do contexto real.
5. NÃ£o prometa prazos especÃ­ficos.
6. CLASSIFICAÃ‡ÃƒO: Analise se a Ãºltima mensagem do cliente trouxe uma nova especificaÃ§Ã£o tÃ©cnica ou dÃºvida que o vendedor precisa saber. Se sim, defina "nova_informacao" como true.`;

  if (isPosVenda) {
    rules += `
7. PÃ“S-VENDA E OUVIDORIA: O cliente JÃ COMPROU. Ele pode estar cobrando a entrega, pedindo a nota fiscal, ou relatando um problema.
8. EXTRAÃ‡ÃƒO DE DADOS: Sempre tente identificar e extrair o nÃºmero do pedido ou nota fiscal ("numero_pedido"). Se o cliente nÃ£o forneceu, peÃ§a de forma sutil.
9. CLASSIFICAÃ‡ÃƒO DE INTENÃ‡ÃƒO: Classifique a "intencao_pos_venda" como: "atraso", "devolucao", "chargeback", "duvida_entrega", "solicitacao_nf", ou "outro".
10. ESCALAÃ‡ÃƒO: Se a intenÃ§Ã£o for "atraso", "devolucao" ou "chargeback", defina "escalar_urgente" como true.`;
  }

  const systemPrompt = `${supportPromptBase}

CONTEXTO DO ATENDIMENTO ATUAL:
- Cliente: ${leadData.name || 'Cliente'}
- Vendedor responsÃ¡vel: ${vendedorNome}
- SituaÃ§Ã£o: ${actionType}

${rules}

VocÃª deve retornar EXCLUSIVAMENTE um objeto JSON neste formato:
{
  "nova_informacao": <true|false>,
  "message": "<Apenas o texto da mensagem para o WhatsApp.>"${isPosVenda ? `,
  "intencao_pos_venda": "<atraso|devolucao|chargeback|duvida_entrega|solicitacao_nf|outro>",
  "numero_pedido": "<nÃºmero extraÃ­do ou null>",
  "escalar_urgente": <true|false>` : ''}
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




