"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FlowVisualizer from "@/app/components/FlowVisualizer";

const SKILL_TYPES = [
  { value: "product", label: "Produto", color: "#3b82f6", desc: "Conhecimento técnico de um produto" },
  { value: "atendimento", label: "Atendimento", color: "#10b981", desc: "Tom de voz e saudação" },
  { value: "objecao", label: "Objeção", color: "#f59e0b", desc: "Resposta a objeções comerciais" },
  { value: "qualificacao", label: "Qualificação", color: "#ec4899", desc: "Perguntas de qualificação SDR" },
];

const FULL_OFFICIAL_MASTER_PROMPT = `Você é o Lino, o Agente Supervisor SDR e Suporte do Grupo Permetal.

Você atende todas as marcas do Grupo Permetal: Permetal, Metalgrade, Permetal Express e PSA Permetal.

==================================================
1. IDENTIFICAÇÃO DO TIPO DE CONTATO (ESTADO DO LEAD)
==================================================

A cada mensagem, analise o histórico para classificar o lead em um destes 3 estados:

1. LEAD NOVO (Início de Conversa):
   - Nunca conversou ou não tem registro ativo no CRM.
   - Siga o protocolo de primeira mensagem com saudação cordial e atenta.
   - Trate o CÓDIGO DE RASTREIO (ex: LINO.XXXXXX):
     * Se o cliente enviou código de rastreio ou link do site, o sistema busca os dados da URL (página de referência, UTMs, se veio do Google, Instagram, etc.).
     * Contextualize a conversa imediatamente com base na página que o cliente estava navegando (ex: "Olá! Vi que você estava consultando nossos Gradis e Pisos no site da Metalgrade...").
     * Se não houver código, atenda com base direta no que o cliente enviou na primeira mensagem.

2. LEAD RETORNANTE (Em fase SDR / Qualificação):
   - O lead já enviou mensagens anteriores, mas o vendedor AINDA NÃO FOI ATRIBUÍDO.
   - Recupere a memória do que já foi informado (produto, segmento, medidas) e dê continuidade de onde parou sem repetir perguntas já sanadas.

3. LEAD EM FASE DE SUPORTE / PÓS-ROTEAMENTO:
   - O vendedor já foi atribuído ou o cliente diz que já mandou dados e está aguardando retorno.
   - NÃO reinicie a qualificação comercial.
   - Registre a mensagem cordialmente, tranquilize o cliente e acione o suporte/SLA interno para cobrar agilidade do vendedor.

==================================================
2. PROCESSAMENTO DE MÍDIA (ÁUDIO, FOTO E TEXTO)
==================================================

- Se o cliente enviar FOTO, ÁUDIO ou DOCUMENTO solicitando orçamento:
  * Identifique o produto na foto/áudio (ex: chapa perfurada decorativa, grade de piso galvanizada, gradil de proteção).
  * Use a informação visual ou auditiva para preencher os dados técnicos sem fazer o cliente repetir o que a foto já mostra.

==================================================
3. ESPECIFICAÇÃO DE PRODUTO COMO FILTRO E-COMMERCE & TABELAS TÉCNICAS OFICIAIS
==================================================

O Lino atua como um consultor técnico inteligente guiando o cliente:

1. Identificar o PRODUTO / FAMÍLIA:
   - Ex: Gradil, Chapa Perfurada, Tela Expandida, Brise Metálico, Grade de Piso, Chapa Recalcada, Tela em Rolo, Bobina.

2. Identificar o MODELO:
   - Liste as opções disponíveis para o cliente escolher (como um filtro de e-commerce).
   - Exemplo Gradil: Artis, Stadium, Parque, Ômega, Leone, Sigma.

3. TABELAS TÉCNICAS OFICIAIS DE GRADIS (CONSULTAR RIGOROSAMENTE LINHA A LINHA):

---
A) GRADIL STADIUM
- Dimensões padronizadas:
  * Alturas: 1030 mm / 1530 mm / 2030 mm / 2430 mm
  * Largura padrão: 2500 mm
  * Malha: 50 x 200 mm
  * Arames: Ø 4,00 mm | Ø 4,80 mm
  * Pilares: Tubo 60 x 40 x 1,55 mm (Opção: Tubo 60 x 60 x 1,55 mm)
- Tabela de Painéis e Pilares em linha:
  * 1030 x 2500 mm | 2 dobras de reforço | Pilar chumbado: 1500 mm | Pilar parafusado: 1120 mm | 3 fixadores por pilar
  * 1530 x 2500 mm | 3 dobras de reforço | Pilar chumbado: 2000 mm | Pilar parafusado: 1610 mm | 5 fixadores por pilar
  * 2030 x 2500 mm | 4 dobras de reforço | Pilar chumbado: 2600 mm | Pilar parafusado: 2110 mm | 5 fixadores por pilar
  * 2430 x 2500 mm | 4 dobras de reforço | Pilar chumbado: 3000 mm | Pilar parafusado: 2500 mm | 7 fixadores por pilar

---
B) GRADIL ARTIS (e Leone, Sigma, Ômega)
- Tabela de Painéis e Pilares em linha:
  * 662 x 2170 mm | Pilar chumbado: 1060 mm | Pilar parafusado: 762 mm | 2 fixadores por pilar | Ferro chato pilar: 63 x 6,35 mm
  * 926 x 2170 mm | Pilar chumbado: 1320 mm | Pilar parafusado: 1026 mm | 2 fixadores por pilar | Ferro chato pilar: 63 x 6,35 mm
  * 1322 x 2170 mm | Pilar chumbado: 1720 mm | Pilar parafusado: 1422 mm | 2 fixadores por pilar | Ferro chato pilar: 63 x 6,35 mm
  * 1718 x 2170 mm | Pilar chumbado: 2120 mm | Pilar parafusado: 1818 mm | 2 fixadores por pilar | Ferro chato pilar: 63 x 6,35 mm
  * 2114 x 2170 mm | Pilar chumbado: 2610 mm | Pilar parafusado: 2214 mm | 3 fixadores por pilar | Ferro chato pilar: 76 x 6,35 mm
  * 2510 x 2170 mm | Pilar chumbado: 3000 mm | Pilar parafusado: 2610 mm | 3 fixadores por pilar | Ferro chato pilar: 76 x 6,35 mm
- Opções de largura: Artis e Leone: 1650 mm | Sigma e Ômega: 1723 mm
- Barras verticais: Aço galvanizado: 25 x 1,55 | 25 x 1,95 | 25 x 2,70 mm | Aço carbono: 25 x 2,00 | 25 x 3,00 | 30 x 3,00 mm
- Fios horizontais: Aço galvanizado: Ø 4,20 mm | Aço carbono: Ø 4,80 mm
- Padrão FDE: 25 x 2 | Moldura 25 x 4,75 | Ø 4,80 | Pilar 76 x 8 mm
- Pilares chatos: 63 x 6,35 | 76 x 6,35 | 76 x 8 mm

---
C) GRADIL PARQUE
- Passo: 140 mm
- Barras verticais: barra maciça quadrada de 3/4"
- Barras horizontais: barra chata de 1.1/2" x 3/8"
- Pilares: tubo 120 x 60 x 3,00 mm
- Fixação: pilares tubulares com parafusos de aço galvanizado
- Acabamentos: Bruto (aço natural) | Galvanizado a fogo | Pintura eletrostática
- Aplicações: Indústria | Supermercados | Condomínios | Parques | Estações metroviárias | Shopping centers | Escolas | Praças
- Descrição: Confeccionado com barras maciças quadradas na vertical e travamento em barras chatas na horizontal. Fixado em pilares tubulares com parafusos de aço galvanizado, oferecendo altíssima resistência mecânica e sendo indicado para áreas sujeitas a vandalismo.

---
4. REGRA DE OURO PARA CHAPAS PERFURADAS, EXPANDIDAS, RECALCADAS, TELAS EM ROLO OU BOBINAS:
   - Se o cliente solicitar qualquer tipo de Chapa Perfurada, Chapa Expandida, Chapa Recalcada, Tela em Rolo, Bobina ou item sob medida (ex: Conidur, Rib Lath, Tipo Cubana/Centrífuga, Tela Níquel, Tubos Perfurados) e o Lino NÃO encontrar a especificação exata no catálogo:
     * NUNCA DIGA QUE NÃO TEM OU NÃO FABRICA! A Permetal/Metalgrade fabrica chapas perfuradas e expandidas sob medida.
     * Apenas capture o Produto/Categoria (ex: Chapa Perfurada, Tela Expandida, etc.), a aplicação e quantidade, e avance normalmente para as demais coletas.

5. SE O CLIENTE NÃO SOUBER DADOS TÉCNICOS:
   - Não trave nem pressione o cliente!
   - Pegue apenas o produto e a aplicação aproximada e prossiga. O vendedor especialista ajudará a desenvolver a especificação exata.

6. DÚVIDAS SOBRE ACABAMENTOS (GALVANIZAÇÃO, INOX, PINTURA, CORES):
   - Informe os acabamentos que constam no RAG (Galvanizado a fogo, Pintura eletrostática poliéster, Inox 304/316/430, Alumínio, etc.).
   - Se houver qualquer dúvida técnica sobre acabamento especial ou cor personalizada, não trave: avance para o vendedor especialista, que esclarecerá tudo na proposta formal.

==================================================
4. DADOS CADASTRAIS BÁSICOS & SEGMENTO
==================================================

1. DADOS DE IDENTIFICAÇÃO (SEMPRE COLETAR):
   - Nome do Contato (ex: "Qual é o seu nome?")
   - Nome da Empresa (ex: "Qual é o nome da sua empresa?")

2. SEGMENTO E APLICAÇÃO (4 OPÇÕES EXATAS):
   Ao coletar o segmento do lead, ele SEMPRE deve ser classificado em UMA das 4 opções:
   - CONSTRUÇÃO: Obras, construtoras, incorporadoras, engenharia, arquitetura, obras públicas, empreiteiras, reformas, steel frame, fachadas, condomínios.
   - INDUSTRIAL: Máquinas, equipamentos, proteção mecânica, ventilação, filtragem, pisos industriais, silos, agroindústria, usinas, hospitais.
   - REVENDA: Lojas de materiais, distribuidores, clientes que compram para revender o item no comércio.
   - SERRALHERIA: Serralheiros, oficinas metalúrgicas, prestadores de serviços de montagem e estruturas soldadas.

Se o cliente tiver dúvida ou não souber, enquadre de acordo com a aplicação informada ou pergunte:
"Qual é a aplicação do material? Será para Construção/Obra, Indústria, Revenda ou Serralheria?"

3. QUANTIDADE / METRAGEM:
   - Sempre colete a quantidade acompanhada da unidade de medida (metros lineares, m², peças ou painéis).

==================================================
5. SCHEMA B2B (CAMPOS OBRIGATÓRIOS E OPCIONAIS)
==================================================

O Lino verifica o Schema B2B do produto configurado no sistema:

- CAMPOS OBRIGATÓRIOS:
  * Bloqueiam o roteamento. O lead NÃO avança para o vendedor até que todos os obrigatórios estejam preenchidos.
- CAMPOS OPCIONAIS (ex: CNPJ, E-mail Corporativo):
  * O Lino tenta coletar de forma amigável conforme a quantidade de tentativas configurada no Schema B2B para o produto.
  * Tentativa 1 (Benefício Comercial): Ex: "Para consultarmos se temos faturamento a prazo ou tabela especial para pessoa jurídica, qual o CNPJ da sua empresa?"
  * Tentativa 2 (Elaboração da Proposta): Ex: "Para que o consultor técnico já anexe as especificações na ficha da proposta formal, me informe seu e-mail corporativo ou CNPJ."
  * REGRA CRÍTICA PARA CNPJ / PESSOA FÍSICA: Se o cliente disser que NÃO TEM CNPJ, NÃO SABE, NÃO QUER PASSAR ou que VAI COMPRAR COMO PESSOA FÍSICA (PF / CPF): encerre imediatamente qualquer tentativa de CNPJ, não insista e avance normalmente com as demais coletas.
  * Se o cliente não quiser informar ou esgotar as tentativas, o Lino segue em frente sem travar o lead.

==================================================
6. LIMITES INVIOLÁVEIS DO LINO
==================================================

- NUNCA informe preços.
- NUNCA informe prazos de entrega.
- NUNCA confirme estoque ou disponibilidade.
- NUNCA faça orçamento ou cotação diretamente.
- NUNCA prometa retorno imediato ("em 5 minutos te chamam").
- NUNCA invente especificações técnicas — consulte o RAG.
- NUNCA escolha vendedor manualmente.
- NUNCA pergunte dados que o sistema já possui (como cidade/UF inferida por DDD).
- NUNCA transfira o atendimento antes da confirmação explícita do cliente.

==================================================
7. PROTOCOLO OBRIGATÓRIO DE RESUMO E CONFIRMAÇÃO COM "SIM OU NÃO"
==================================================

Quando todos os dados da solicitação estiverem coletados (Nome, Empresa, Segmento, Produto, Especificação, Quantidade, CNPJ/PF, E-mail, Cidade se houver):

PASSO 1: APRESENTAR O RESUMO FORMATADO NO SCHEMA PADRÃO DE SAÍDA:
O Lino NÃO PODE dar como finalizado e NÃO PODE transferir nesta mensagem.
O Lino deve apresentar o resumo e terminar com a pergunta obrigatória:

Exemplo Exato:
"Aqui está o resumo das informações do seu projeto:

- Nome: Leonardo
- Empresa: Permetal
- Segmento: Industrial
- Produto: Gradil Stadium
- Especificação: Painel 2430 x 2500 mm (4 dobras), Pilar Chumbado 3000 mm com 7 fixadores
- Quantidade: 400 metros lineares
- CNPJ: 16.998.512/0001-88
- E-mail: teste@teste.com
- Cidade da Sede da Empresa: Ribeirão Preto/SP
- Resumo da Aplicação: Cercamento perimetral de hospital com gradil de alta resistência

As informações acima estão corretas? Por favor, responda com 'Sim' para confirmar ou 'Não' se precisar atualizar algo."

PASSO 2: TRATAMENTO DA RESPOSTA DO CLIENTE:
- Se o cliente responder "NÃO" ou apontar que deseja mudar algum dado:
  * O Lino pergunta qual dado deseja corrigir, atualiza a informação e reapresenta o resumo para nova confirmação.
- Se o cliente responder "SIM" (ou confirmar positivamente):
  * O Lino registra a confirmação, aciona as regras comerciais de roteamento interno para encontrar o vendedor correto e envia a mensagem final de encerramento:
  “Perfeito, [Nome]! Suas informações foram confirmadas com sucesso e já encaminhei sua solicitação para o especialista responsável, que entrará em contato em breve com a proposta formal. Se precisar de algo mais, estou à disposição!”`;

const ROLES: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "#ef4444" },
  gestor: { label: "Gestor", color: "#f59e0b" },
  vendedor: { label: "Vendedor", color: "#3b82f6" },
};

export default function SettingsPage() {
  // Controle de Abas Macro
  const [macroTab, setMacroTab] = useState<'routing' | 'teams' | 'ia' | 'integrations'>('routing');
  // Controle de Sub-abas
  const [routingSubTab, setRoutingSubTab] = useState<'regions' | 'products' | 'segments' | 'rules' | 'bizrules' | 'schemas'>('regions');
  const [teamsSubTab, setTeamsSubTab] = useState<'teams' | 'sellers' | 'users'>('teams');
  const [iaSubTab, setIaSubTab] = useState<'cerebro' | 'skills' | 'flow'>('cerebro');
  const [integrationsSubTab, setIntegrationsSubTab] = useState<'whatsapp' | 'credentials'>('whatsapp');

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Dados do Banco
  const [regions, setRegions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [businessRules, setBusinessRules] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [skillRagLinks, setSkillRagLinks] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);

  // Cérebro IA Config
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [supportPrompt, setSupportPrompt] = useState("");
  const [masterPrompt, setMasterPrompt] = useState("");
  const [botActive, setBotActive] = useState(true);
  const [slaRules, setSlaRules] = useState({
    max_wait_hours: 2,
    retry_interval_minutes: 15,
    max_retries: 3,
    seller_notify_max: 3,
    seller_notify_interval_minutes: 15
  });
  const [savingCerebro, setSavingCerebro] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testingPrompt, setTestingPrompt] = useState(false);

  // APIs Globais (OpenAI e Evolution)
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  // Segurança (Senha)
  const [passwordEmail, setPasswordEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Variáveis de Extração IA
  const [variables, setVariables] = useState<any[]>([]);
  const [showVarForm, setShowVarForm] = useState(false);
  const [varForm, setVarForm] = useState({ name: "", description: "", required: false });
  const [editingVarIndex, setEditingVarIndex] = useState<number | null>(null);

  // RAG Document Form
  const [showRagForm, setShowRagForm] = useState(false);
  const [ragName, setRagName] = useState("");
  const [ragText, setRagText] = useState("");
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [uploadingRag, setUploadingRag] = useState(false);
  const [editingRag, setEditingRag] = useState<any>(null);

  // Skill Form
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [skillForm, setSkillForm] = useState({ name: "", type: "product", prompt: "" });
  const [selectedRags, setSelectedRags] = useState<string[]>([]);

  // Instâncias Form
  const [instForm, setInstForm] = useState({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" });
  const [showInstForm, setShowInstForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState<any>(null);

  // Rastreio de Fluxos
  const [flowSearchInput, setFlowSearchInput] = useState('');
  const [flowLeadId, setFlowLeadId] = useState('');

  // Formulários de Roteamento
  const [regionForm, setRegionForm] = useState({ name: "", ddd_codes: "" });
  const [productForm, setProductForm] = useState({ name: "", synonyms: "", brand_id: "", is_express_eligible: false, express_max_qty: "" });
  const [segmentForm, setSegmentForm] = useState({ name: "", keywords: "", collection_type: "normal" });
  const [teamForm, setTeamForm] = useState({ name: "", manager_id: "" });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "", team_id: "" });
  const [ruleForm, setRuleForm] = useState({ team_id: "", segment_id: "", priority: 1, is_express: false });

  // Outros estados de edição
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Filtros
  const [filterSegmentId, setFilterSegmentId] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterRegionId, setFilterRegionId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [savingAllSchemas, setSavingAllSchemas] = useState(false);

  const [ruleRegionIds, setRuleRegionIds] = useState<string[]>([]);
  const [ruleProductIds, setRuleProductIds] = useState<string[]>([]);
  const [ruleSellerIds, setRuleSellerIds] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, p, sg, t, u, b, rl, br, sk, lk, inst] = await Promise.all([
        supabase.from("regions").select("*").order("name"),
        supabase.from("products").select("*, brands(name)").order("name"),
        supabase.from("segments").select("*").order("name"),
        supabase.from("teams").select("*").order("created_at"),
        supabase.from("admin_users").select("*").order("created_at"),
        supabase.from("brands").select("*").order("name"),
        supabase.from("routing_rules").select("*").order("priority"),
        supabase.from("business_rules").select("*").order("rule_key"),
        supabase.from("skills").select("*").order("created_at", { ascending: false }),
        supabase.from("skill_rag_links").select("*"),
        supabase.from("instances").select("*").order("created_at"),
      ]);

      if (r.data) setRegions(r.data);
      if (p.data) {
        const processedProducts = p.data.map((prod: any) => {
          if (!prod.qualification_schema) {
            prod.qualification_schema = {
              obrigatorias: ["nome_cliente", "empresa", "email", "quantidade"],
              opcionais: [],
              rag_document_name: ""
            };
          }
          return prod;
        });
        setProducts(processedProducts);
      }
      if (sg.data) setSegments(sg.data);
      if (t.data) setTeams(t.data);
      if (u.data) setUsers(u.data);
      if (b.data) setBrands(b.data);
      if (rl.data) setRules(rl.data);
      if (br.data) setBusinessRules(br.data);
      if (sk.data) setSkills(sk.data);
      if (lk.data) setSkillRagLinks(lk.data);
      if (inst.data) setInstances(inst.data);

      // Carregar config do cérebro IA
      const { data: cfg } = await supabase.from("tenant_config").select("*").limit(1).single();
      if (cfg) {
        setTenantConfig(cfg);
        setSupportPrompt(cfg.support_prompt || "Você é o suporte do Grupo Permetal. O cliente já enviou os dados e aguarda o vendedor responsável. Registre a mensagem cordialmente e informe que você reforçou o contato diretamente com o especialista.");
        setMasterPrompt(cfg.master_prompt || FULL_OFFICIAL_MASTER_PROMPT);
        setBotActive(cfg.bot_active !== false);
        setEvolutionUrl(cfg.evolution_url || "");
        setEvolutionKey(cfg.evolution_key || "");
        setEvolutionInstanceName(cfg.evolution_instance_name || "");
        setOpenaiKey(cfg.openai_key || "");
        if (cfg.sla_rules) setSlaRules({ ...slaRules, ...cfg.sla_rules });
        if (cfg.extraction_variables) setVariables(cfg.extraction_variables);
      } else {
        setMasterPrompt(FULL_OFFICIAL_MASTER_PROMPT);
      }

      // Carregar RAG docs via API
      const res = await fetch("/api/rag");
      if (res.ok) {
        const data = await res.json();
        setRagDocs(data);
      }

    } catch (e) {
      console.error("Erro no carregamento:", e);
    } finally {
      setLoading(false);
    }
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  function getName(list: any[], id: string) {
    return list.find(i => i.id === id)?.name || "—";
  }

  // === CÉREBRO IA ===
  async function saveCerebro() {
    if (!tenantConfig?.id) return;
    setSavingCerebro(true);
    const { error } = await supabase.from("tenant_config").update({
      support_prompt: supportPrompt,
      master_prompt: masterPrompt,
      sla_rules: slaRules
    }).eq("id", tenantConfig.id);

    // Sincronizar diretamente com o motor de SLA determinístico
    try {
      await fetch("/api/settings/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hard_escalate_minutes: (slaRules.max_wait_hours || 4) * 60,
          first_contact_minutes: slaRules.retry_interval_minutes || 30,
          escalate_after_returns: slaRules.seller_notify_max || 3,
          min_minutes_between_charges: slaRules.seller_notify_interval_minutes || 10,
        }),
      });
    } catch (e) {
      console.error("Erro ao sincronizar SLA:", e);
    }

    setSavingCerebro(false);
    flash(error ? "Erro: " + error.message : "✔ Prompt Mestre e Regras de SLA ativadas e salvas com sucesso!");
    loadAll();
  }

  async function handleTestPrompt() {
    if (!testMessage.trim()) {
      flash("⚠️ Digite uma mensagem de teste.");
      return;
    }
    setTestingPrompt(true);
    setTestResponse("");
    try {
      const res = await fetch("/api/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_teste: masterPrompt,
          mensagem_cliente: testMessage
        })
      });
      const data = await res.json();
      if (data.resposta) {
        setTestResponse(data.resposta);
      } else {
        setTestResponse("Erro: " + (data.error || "Sem resposta."));
      }
    } catch (err: any) {
      setTestResponse("Erro: " + err.message);
    } finally {
      setTestingPrompt(false);
    }
  }

  // === REGION ===
  async function addRegion(e: React.FormEvent) {
    e.preventDefault();
    const codes = regionForm.ddd_codes.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("regions").insert([{ name: regionForm.name, ddd_codes: codes }]);
    if (error) { flash("Erro: " + error.message); return; }
    setRegionForm({ name: "", ddd_codes: "" }); flash("✔ Região criada!"); loadAll();
  }

  async function deleteRegion(id: string) {
    if (!confirm("Excluir região?")) return;
    await supabase.from("regions").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  // === PRODUCT ===
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const syns = productForm.synonyms.split(",").map(s => s.trim()).filter(Boolean);
    const payload: any = { 
      name: productForm.name, 
      synonyms: syns,
      is_express_eligible: productForm.is_express_eligible,
      express_max_qty: productForm.express_max_qty || null
    };
    if (productForm.brand_id) payload.brand_id = productForm.brand_id;
    
    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) { flash("Erro: " + error.message); return; }
      setEditingProduct(null);
      flash("✔ Produto atualizado!");
    } else {
      const { error } = await supabase.from("products").insert([payload]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Produto criado!");
    }
    setProductForm({ name: "", synonyms: "", brand_id: "", is_express_eligible: false, express_max_qty: "" }); 
    loadAll();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto?")) return;
    await supabase.from("products").delete().eq("id", id); flash("✔ Excluído!"); loadAll();
  }

  // === SEGMENT ===
  async function addSegment(e: React.FormEvent) {
    e.preventDefault();
    const kws = segmentForm.keywords.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("segments").insert([{ name: segmentForm.name, keywords: kws, collection_type: segmentForm.collection_type }]);
    if (error) { flash("Erro: " + error.message); return; }
    setSegmentForm({ name: "", keywords: "", collection_type: "normal" }); flash("✔ Segmento criado!"); loadAll();
  }

  async function deleteSegment(id: string) {
    if (!confirm("Excluir segmento?")) return;
    await supabase.from("segments").delete().eq("id", id); flash("✔ Excluído!"); loadAll();
  }

  // === TEAMS ===
  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!editingTeam;
    const finalName = isEdit ? editTeamName : teamForm.name;
    const finalManagerId = isEdit ? editingTeam.manager_id : teamForm.manager_id;
    
    if (!finalName.trim()) { flash("⚠️ Digite o nome da equipe"); return; }
    const payload: any = { name: finalName, manager_id: finalManagerId || null };

    if (isEdit) {
      const { error } = await supabase.from("teams").update(payload).eq("id", editingTeam.id);
      if (error) { flash("Erro: " + error.message); return; }
      setEditingTeam(null); setEditTeamName(""); flash("✔ Equipe atualizada!");
    } else {
      const { error } = await supabase.from("teams").insert([payload]);
      if (error) { flash("Erro: " + error.message); return; }
      setTeamForm({ name: "", manager_id: "" }); flash("✔ Equipe criada!");
    }
    loadAll();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Excluir equipe?")) return;
    await supabase.from("teams").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  // === USERS / ACESSOS (RBAC) ===
  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name || !userForm.email) return;

    if (editingUser) {
      const payload: any = { name: userForm.name, email: userForm.email, role: userForm.role, whatsapp_number: userForm.whatsapp_number };
      if (userForm.password) payload.password = userForm.password;
      await supabase.from("admin_users").update(payload).eq("id", editingUser.id);
      setEditingUser(null);
      flash("Usuário atualizado com sucesso.");
    } else {
      if (!userForm.password) { flash("Senha é obrigatória para novos usuários"); return; }
      const { error } = await supabase.from("admin_users").insert([{ 
        name: userForm.name, email: userForm.email, password: userForm.password, role: userForm.role, whatsapp_number: userForm.whatsapp_number 
      }]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("Usuário criado com sucesso.");
    }
    setUserForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "", team_id: "" });
    setEditingUser(null);
    loadAll();
  }

  async function toggleUserActive(u: any) {
    await supabase.from("admin_users").update({ active: !u.active }).eq("id", u.id);
    flash(u.active ? "Usuário desativado." : "Usuário ativado.");
    loadAll();
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir usuário permanentemente?")) return;
    await supabase.from("admin_users").delete().eq("id", id);
    flash("Usuário excluído.");
    loadAll();
  }

  // === VENDEDORES (ATRIBUIÇÃO DE EQUIPES) ===
  async function assignSellerTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    const { error } = await supabase.from("admin_users").update({ team_id: userForm.team_id || null }).eq("id", editingUser.id);
    if (error) { flash("Erro: " + error.message); return; }
    setEditingUser(null);
    setUserForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "", team_id: "" });
    flash("✔ Equipe atribuída ao vendedor!");
    loadAll();
  }

  // === REGRAS DE ROTEAMENTO ===
  function toggleChip<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (ruleRegionIds.length === 0 && ruleProductIds.length === 0) {
      flash("⚠️ Selecione ao menos uma região ou produto!"); return;
    }
    if (ruleSellerIds.length === 0) {
      flash("⚠️ Selecione ao menos um vendedor!"); return;
    }
    const payload: any = {
      priority: ruleForm.priority,
      is_express: ruleForm.is_express,
      region_ids: ruleRegionIds,
      product_ids: ruleProductIds,
      seller_ids: ruleSellerIds,
      last_seller_index: editingRule ? editingRule.last_seller_index : 0,
      team_id: ruleForm.team_id || null,
      segment_id: ruleForm.segment_id || null
    };

    if (editingRule) {
      const { error } = await supabase.from("routing_rules").update(payload).eq("id", editingRule.id);
      if (error) { flash("Erro: " + error.message); return; }
      setEditingRule(null);
      flash("✔ Regra atualizada!");
    } else {
      const { error } = await supabase.from("routing_rules").insert([payload]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Regra criada!");
    }
    setRuleForm({ team_id: "", segment_id: "", priority: 1, is_express: false });
    setRuleRegionIds([]); setRuleProductIds([]); setRuleSellerIds([]);
    loadAll();
  }

  async function deleteRule(id: string) {
    if (!confirm("Excluir regra?")) return;
    await supabase.from("routing_rules").delete().eq("id", id); flash("✔ Regra excluída!"); loadAll();
  }

  async function duplicateRule(rule: any) {
    const { id, created_at, ...cleanRule } = rule;
    const payload = { ...cleanRule, priority: (rule.priority || 0) + 1 };
    const { error } = await supabase.from("routing_rules").insert([payload]);
    if (error) { flash("Erro ao duplicar: " + error.message); return; }
    flash("✔ Regra duplicada!");
    loadAll();
  }

  // === REGRAS DE NEGÓCIO TÉCNICAS (EXPRESS) ===
  async function updateBusinessRuleConfig(id: string, newConfig: any) {
    const { error } = await supabase.from("business_rules").update({ config: newConfig, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { flash("❌ Erro ao salvar: " + error.message); } else { flash("✅ Regra Express salva!"); loadAll(); }
  }

  const handleBizConfigChange = (id: string, field: string, value: any, currentConfig: any) => {
    const updatedConfig = { ...currentConfig, [field]: value };
    if (field === 'exclusions' && typeof value === 'string') {
      updatedConfig[field] = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (['max_m2', 'max_pcs_2x1', 'max_pcs_3x1', 'max_m_lineares'].includes(field)) {
      updatedConfig[field] = Number(value);
    }
    setBusinessRules(businessRules.map(r => r.id === id ? { ...r, config: updatedConfig } : r));
  };

  // === SCHEMAS DE QUALIFICAÇÃO POR PRODUTO ===
  async function saveAllSchemas() {
    setSavingAllSchemas(true);
    try {
      const promises = products.map(p =>
        supabase.from("products").update({ qualification_schema: p.qualification_schema }).eq("id", p.id)
      );
      const results = await Promise.all(promises);
      const hasError = results.some(r => r.error);
      if (hasError) {
        flash("⚠️ Alguns schemas apresentaram erro ao salvar.");
      } else {
        flash(`✅ Todos os ${products.length} Schemas B2B foram salvos com sucesso no Supabase!`);
      }
      loadAll();
    } catch (e: any) {
      flash("❌ Erro ao salvar schemas em lote: " + e.message);
    } finally {
      setSavingAllSchemas(false);
    }
  }

  async function updateProductSchema(productId: string, schema: any) {
    const { error } = await supabase.from("products").update({ qualification_schema: schema }).eq("id", productId);
    if (error) { flash("❌ Erro ao salvar: " + error.message); } else { flash("✅ Schema salvo!"); loadAll(); }
  }

  const toggleObrigatoria = async (prodId: string, campo: string, schema: any) => {
    let obrigatorias = [...schema.obrigatorias];
    if (obrigatorias.includes(campo)) {
      obrigatorias = obrigatorias.filter(c => c !== campo);
    } else {
      obrigatorias.push(campo);
      schema.opcionais = (schema.opcionais || []).filter((opt: any) => opt.campo !== campo);
    }
    const newSchema = { ...schema, obrigatorias };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
    await supabase.from("products").update({ qualification_schema: newSchema }).eq("id", prodId);
  };

  const handleOpcionalChange = async (prodId: string, idx: number, field: string, value: any, schema: any) => {
    const opcionais = [...(schema.opcionais || [])];
    opcionais[idx] = { ...opcionais[idx], [field]: value };
    if (field === 'max_tentativas') opcionais[idx][field] = Number(value);
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
    await supabase.from("products").update({ qualification_schema: newSchema }).eq("id", prodId);
  };

  const baseCampos = [
    { value: "nome_cliente", label: "Nome do Cliente" },
    { value: "empresa", label: "Nome da Empresa" },
    { value: "cnpj", label: "CNPJ" },
    { value: "email", label: "E-mail Corporativo" },
    { value: "endereco_sede", label: "Endereço Sede Empresa" },
    { value: "segmento", label: "Segmento" },
    { value: "quantidade", label: "Quantidade / Metragem" }
  ];
  
  const customCampos = variables.map(v => ({ value: v.name, label: v.description || v.name }));
  const camposDisponiveis = [...baseCampos];
  customCampos.forEach(c => {
    if (!camposDisponiveis.find(b => b.value === c.value)) camposDisponiveis.push(c);
  });

  const addOpcionalField = async (prodId: string, schema: any) => {
    const opcionais = [...(schema.opcionais || [])];
    const jaUsados = new Set([...schema.obrigatorias, ...opcionais.map(o => o.campo)]);
    const disponivel = camposDisponiveis.find(c => !jaUsados.has(c.value));
    if (!disponivel) return;

    opcionais.push({ campo: disponivel.value, max_tentativas: 2 });
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
    await supabase.from("products").update({ qualification_schema: newSchema }).eq("id", prodId);
  };

  const removeOpcionalField = async (prodId: string, idx: number, schema: any) => {
    const opcionais = (schema.opcionais || []).filter((_: any, i: number) => i !== idx);
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
    await supabase.from("products").update({ qualification_schema: newSchema }).eq("id", prodId);
  };

  const handleProductRagChange = async (prodId: string, value: string, schema: any) => {
    const newSchema = { ...schema, rag_document_name: value };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
    await supabase.from("products").update({ qualification_schema: newSchema }).eq("id", prodId);
  };

  // === VARIAVEIS DE EXTRAÇÃO ===
  async function saveVariablesToDb(newVars: any[]) {
    const { data } = await supabase.from("tenant_config").select("id").limit(1).single();
    if (data) {
      await supabase.from("tenant_config").update({ extraction_variables: newVars }).eq("id", data.id);
    }
    setVariables(newVars);
    flash("✔ Variáveis de extração salvas!");
  }

  function handleSaveVariable(e: React.FormEvent) {
    e.preventDefault();
    if (!varForm.name.trim()) return;
    const cleanName = varForm.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    let updatedVars = [...variables];
    if (editingVarIndex !== null) {
      updatedVars[editingVarIndex] = { ...varForm, name: cleanName };
    } else {
      updatedVars.push({ ...varForm, name: cleanName });
    }
    
    saveVariablesToDb(updatedVars);
    setVarForm({ name: "", description: "", required: false });
    setEditingVarIndex(null);
    setShowVarForm(false);
  }

  function deleteVariable(index: number) {
    if (!confirm("Excluir esta variável?")) return;
    const updatedVars = variables.filter((_, i) => i !== index);
    saveVariablesToDb(updatedVars);
  }

  // === RAG BASE ===
  async function handleUploadRag(e: React.FormEvent) {
    e.preventDefault();
    setUploadingRag(true);
    try {
      const formData = new FormData();
      if (editingRag) formData.append("id", editingRag.id);
      formData.append("name", ragName);
      if (ragFile) {
        formData.append("file", ragFile);
      } else {
        formData.append("text", ragText);
      }

      const method = editingRag ? "PUT" : "POST";
      const res = await fetch("/api/rag/upload", { method, body: formData });
      const data = await res.json();

      if (!res.ok) { flash("Erro: " + data.error); setUploadingRag(false); return; }
      
      flash(editingRag ? `✔ Documento "${ragName}" atualizado!` : `✔ Documento "${ragName}" adicionado!`);
      setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(false); setEditingRag(null);
      loadAll();
    } catch (err: any) {
      flash("Erro: " + err.message);
    } finally {
      setUploadingRag(false);
    }
  }

  async function deleteRagDoc(id: string) {
    if (!confirm("Excluir documento RAG?")) return;
    await fetch(`/api/rag?id=${id}`, { method: "DELETE" });
    flash("✔ Documento excluído!");
    loadAll();
  }

  // === SKILLS (HABILIDADES IA) ===
  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!skillForm.name || !skillForm.prompt) return;
    let skillId = editingSkill?.id;

    if (editingSkill) {
      await supabase.from("skills").update({ name: skillForm.name, type: skillForm.type, prompt: skillForm.prompt }).eq("id", editingSkill.id);
      flash("✔ Habilidade atualizada!");
    } else {
      const { data, error } = await supabase.from("skills").insert([{ name: skillForm.name, type: skillForm.type, prompt: skillForm.prompt }]).select().single();
      if (error) { flash("Erro: " + error.message); return; }
      skillId = data?.id;
      flash("✔ Habilidade criada!");
    }

    if (skillId) {
      await supabase.from("skill_rag_links").delete().eq("skill_id", skillId);
      if (selectedRags.length > 0) {
        const links = selectedRags.map(ragId => ({ skill_id: skillId, rag_document_id: ragId }));
        await supabase.from("skill_rag_links").insert(links);
      }
    }

    setSkillForm({ name: "", type: "product", prompt: "" });
    setSelectedRags([]);
    setShowSkillForm(false);
    setEditingSkill(null);
    loadAll();
  }

  async function toggleSkillActive(s: any) {
    await supabase.from("skills").update({ active: !s.active }).eq("id", s.id);
    flash(s.active ? "Habilidade desativada" : "✔ Habilidade ativada!");
    loadAll();
  }

  async function deleteSkill(id: string) {
    if (!confirm("Excluir esta habilidade permanentemente?")) return;
    await supabase.from("skills").delete().eq("id", id);
    flash("✔ Habilidade excluída!");
    loadAll();
  }


  // === APIS E INTEGRAÇÕES ===
  async function saveAPIConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantConfig) return;
    const { error } = await supabase.from("tenant_config").update({
      evolution_url: evolutionUrl, evolution_key: evolutionKey, evolution_instance_name: evolutionInstanceName, openai_key: openaiKey,
    }).eq("id", tenantConfig.id);
    if (error) { flash("Erro: " + error.message); return; }
    flash("✔ Credenciais salvas com sucesso!");
    loadAll();
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordEmail || !newPassword) { flash("Preencha todos os campos."); return; }
    const { data, error } = await supabase.from("admin_users").update({ password: newPassword }).eq("email", passwordEmail).select();
    if (error) { flash("Erro: " + error.message); return; }
    if (!data || data.length === 0) { flash("Nenhum usuário encontrado com este e-mail."); return; }
    setPasswordEmail(""); setNewPassword("");
    flash("✔ Senha atualizada!");
  }

  // === WHATSAPP / INSTÂNCIAS ===
  async function saveInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!instForm.name) { flash("Erro: nome da instância é obrigatório."); return; }
    const payload: any = { 
      name: instForm.name, phone_number: instForm.phone_number || null, 
      evolution_instance_name: instForm.evolution_instance_name || null, 
      evolution_url: instForm.evolution_url || null, evolution_key: instForm.evolution_key || null,
      assigned_user_id: instForm.assigned_user_id || null
    };

    if (editingInstance) {
      await supabase.from("instances").update(payload).eq("id", editingInstance.id);
      setEditingInstance(null); flash("✔ Instância atualizada!");
    } else {
      await supabase.from("instances").insert([payload]);
      flash("✔ Instância criada!");
    }
    setInstForm({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" });
    setShowInstForm(false);
    loadAll();
  }

  async function toggleInstanceActive(inst: any) {
    await supabase.from("instances").update({ active: !inst.active }).eq("id", inst.id);
    flash(inst.active ? "Instância desativada" : "✔ Instância ativada!");
    loadAll();
  }

  async function deleteInstance(id: string) {
    if (!confirm("Excluir esta instância?")) return;
    await supabase.from("instances").delete().eq("id", id);
    flash("✔ Instância excluída!");
    loadAll();
  }

  function startEditInstance(inst: any) {
    setEditingInstance(inst);
    setInstForm({
      name: inst.name,
      phone_number: inst.phone_number || "",
      evolution_instance_name: inst.evolution_instance_name || "",
      evolution_url: inst.evolution_url || "",
      evolution_key: inst.evolution_key || "",
      assigned_user_id: inst.assigned_user_id || ""
    });
    setShowInstForm(true);
  }

  return (
    <div className="p-8 md:p-10 w-full h-full text-[var(--text-primary)] bg-white overflow-y-auto select-none">
      {msg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#111111] text-white text-xs px-4 py-3 rounded-md border border-[var(--border-strong)] shadow-md animate-fade-in">
          {msg}
        </div>
      )}

      {/* Cabeçalho do Painel */}
      <header className="mb-6 border-b border-[var(--border-light)] pb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Configurações Globais</h2>
          <p className="text-[var(--text-muted)] mt-0.5 text-[10px] font-medium uppercase tracking-wider">Parametrização de roteamento, equipe, IA e integrações</p>
        </div>

        {/* Ativação Lino Bot & Zerar Histórico */}
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={async () => {
              const newState = !botActive;
              setBotActive(newState);
              await supabase.from("tenant_config").update({ bot_active: newState }).neq("id", "0");
              flash(newState ? "🤖 Lino Bot ATIVADO!" : "💤 Lino Bot PAUSADO!");
              loadAll();
            }}
            className={`px-3 py-1.5 border rounded text-xs font-semibold transition-all cursor-pointer ${
              botActive ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {botActive ? '🤖 Lino Bot ON' : '💤 Lino Bot OFF'}
          </button>
          <button 
            onClick={async () => {
              if (confirm('Deseja zerar COMPLETAMENTE o histórico do número de teste 16991415319?\n\nIsso apagará todas as mensagens, dados coletados (produto, medidas, empresa) e memória no Supabase para iniciar um fluxo 100% novo.')) {
                try {
                  const res = await fetch('/api/test/clear-history', {
                    method: 'POST',
                    body: JSON.stringify({ whatsapp_number: '5516991415319' }),
                    headers: { 'Content-Type': 'application/json' }
                  });
                  const json = await res.json();
                  if (res.ok) {
                    flash('✔ Histórico, dados coletados e memória 100% zerados!');
                    alert('Sucesso! Histórico e memória do número 16991415319 foram completamente apagados no Supabase.');
                  } else {
                    alert('Erro ao zerar: ' + (json.error || 'Erro desconhecido'));
                  }
                } catch (e: any) {
                  alert('Erro de rede: ' + e.message);
                }
              }
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-md shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            style={{ color: '#ffffff', backgroundColor: '#dc2626' }}
          >
            🗑️ Zerar Histórico de Teste (16991415319)
          </button>
        </div>
      </header>

      {/* MENU DE ABAS MACRO (Estilo Linear) */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 border-b border-[var(--border-light)] mb-8 scrollbar-hide">
        <button onClick={() => setMacroTab('routing')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${macroTab === 'routing' ? 'border-black text-black' : 'border-transparent text-[var(--text-muted)] hover:text-black'}`}>
          Roteamento Comercial
        </button>
        <button onClick={() => setMacroTab('teams')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${macroTab === 'teams' ? 'border-black text-black' : 'border-transparent text-[var(--text-muted)] hover:text-black'}`}>
          Equipes & Acessos
        </button>
        <button onClick={() => setMacroTab('ia')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${macroTab === 'ia' ? 'border-black text-black' : 'border-transparent text-[var(--text-muted)] hover:text-black'}`}>
          Cérebro IA & Automação
        </button>
        <button onClick={() => setMacroTab('integrations')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${macroTab === 'integrations' ? 'border-black text-black' : 'border-transparent text-[var(--text-muted)] hover:text-black'}`}>
          WhatsApp & APIs
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="max-w-4xl animate-fade-in pb-16">
          
          {/* ==============================================
              1. MACRO TAB: ROTEAMENTO COMERCIAL
              ============================================== */}
          {macroTab === 'routing' && (
            <div className="space-y-6">
              {/* SUB TABS ROTEAMENTO */}
              <div className="tabs-container-clean mb-6">
                <button onClick={() => setRoutingSubTab('regions')} className={`tab-item-clean ${routingSubTab === 'regions' ? 'active' : ''}`}>Regiões</button>
                <button onClick={() => setRoutingSubTab('products')} className={`tab-item-clean ${routingSubTab === 'products' ? 'active' : ''}`}>Produtos</button>
                <button onClick={() => setRoutingSubTab('segments')} className={`tab-item-clean ${routingSubTab === 'segments' ? 'active' : ''}`}>Segmentos</button>
                <button onClick={() => setRoutingSubTab('rules')} className={`tab-item-clean ${routingSubTab === 'rules' ? 'active' : ''}`}>Regras de Rota</button>
                <button onClick={() => setRoutingSubTab('bizrules')} className={`tab-item-clean ${routingSubTab === 'bizrules' ? 'active' : ''}`}>Regras Express</button>
                <button onClick={() => setRoutingSubTab('schemas')} className={`tab-item-clean ${routingSubTab === 'schemas' ? 'active' : ''}`}>Schemas B2B</button>
              </div>

              {/* ROTEAMENTO - REGIÕES */}
              {routingSubTab === 'regions' && (
                <div className="space-y-6">
                  <form onSubmit={addRegion} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Nova Região Comercial</h3>
                    <input type="text" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} placeholder="Nome da Região (ex: SP01, NORDESTE)" className="input-clean" required />
                    <input type="text" value={regionForm.ddd_codes} onChange={e => setRegionForm({...regionForm, ddd_codes: e.target.value})} placeholder="Códigos DDD separados por vírgula (ex: 11, 12, 19)" className="input-clean" required />
                    <button type="submit" className="btn-primary w-full h-[38px]">+ Criar Região</button>
                  </form>
                  <div className="list-container-clean">
                    {regions.map(r => (
                      <div key={r.id} className="list-item-clean flex justify-between items-center group">
                        <div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)]">{r.name}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(r.ddd_codes || []).map((d: string) => (
                              <span key={d} className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-[var(--border-light)]">{d}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => deleteRegion(r.id)} className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">Excluir</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROTEAMENTO - PRODUTOS */}
              {routingSubTab === 'products' && (
                <div className="space-y-6">
                  <form onSubmit={addProduct} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{editingProduct ? "Editar Produto" : "Novo Produto Comercial"}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Nome do produto" className="input-clean" required />
                      <input type="text" value={productForm.synonyms} onChange={e => setProductForm({...productForm, synonyms: e.target.value})} placeholder="Sinônimos separados por vírgula" className="input-clean" />
                    </div>
                    <select value={productForm.brand_id} onChange={e => setProductForm({...productForm, brand_id: e.target.value})} className="input-clean">
                      <option value="">Marca Associada (Opcional)</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={productForm.is_express_eligible} onChange={e => setProductForm({...productForm, is_express_eligible: e.target.checked})} className="w-4 h-4 accent-black" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Elegível para Express</span>
                      </label>
                      {productForm.is_express_eligible && (
                        <input type="text" value={productForm.express_max_qty} onChange={e => setProductForm({...productForm, express_max_qty: e.target.value})} placeholder="Qtd Máxima (ex: 20m²)" className="input-clean flex-1" />
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1 h-[38px]">{editingProduct ? "Atualizar" : "Salvar Produto"}</button>
                      {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setProductForm({ name: "", synonyms: "", brand_id: "", is_express_eligible: false, express_max_qty: "" }); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>}
                    </div>
                  </form>
                  <div className="list-container-clean">
                    {products.map(p => (
                      <div key={p.id} className="list-item-clean flex justify-between items-start group">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{p.name}</h4>
                            {p.brands?.name && <span className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-[var(--border-light)] font-bold">{p.brands.name}</span>}
                            {p.is_express_eligible && <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">Express: {p.express_max_qty || "Sem limite"}</span>}
                          </div>
                          {(p.synonyms || []).length > 0 && <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Sinônimos: {p.synonyms.join(", ")}</p>}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingProduct(p); setProductForm({ name: p.name, synonyms: (p.synonyms || []).join(", "), brand_id: p.brand_id || "", is_express_eligible: !!p.is_express_eligible, express_max_qty: p.express_max_qty || "" }); }} className="text-[10px] bg-white border border-[var(--border-strong)] px-2.5 py-1 rounded font-bold cursor-pointer hover:bg-neutral-50">Editar</button>
                          <button onClick={() => deleteProduct(p.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded font-bold cursor-pointer hover:bg-red-100">Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROTEAMENTO - SEGMENTOS */}
              {routingSubTab === 'segments' && (
                <div className="space-y-6">
                  <form onSubmit={addSegment} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Novo Segmento Comercial</h3>
                    <input type="text" value={segmentForm.name} onChange={e => setSegmentForm({...segmentForm, name: e.target.value})} placeholder="Nome (ex: Construtora, Distribuidor)" className="input-clean" required />
                    <input type="text" value={segmentForm.keywords} onChange={e => setSegmentForm({...segmentForm, keywords: e.target.value})} placeholder="Keywords separadas por vírgula" className="input-clean" />
                    <select value={segmentForm.collection_type} onChange={e => setSegmentForm({...segmentForm, collection_type: e.target.value})} className="input-clean">
                      <option value="normal">Coleta Normal (Todos os campos obrigatórios)</option>
                      <option value="short">Coleta Curta (Apenas contato e produto)</option>
                    </select>
                    <button type="submit" className="btn-primary w-full h-[38px]">+ Criar Segmento</button>
                  </form>
                  <div className="list-container-clean">
                    {segments.map(s => (
                      <div key={s.id} className="list-item-clean flex justify-between items-start group">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{s.name}</h4>
                            <span className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-[var(--border-light)] font-bold">{s.collection_type === 'short' ? 'Coleta Curta' : 'Coleta Completa'}</span>
                          </div>
                          {(s.keywords || []).length > 0 && <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Keywords: {s.keywords.join(", ")}</p>}
                        </div>
                        <button onClick={() => deleteSegment(s.id)} className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">Excluir</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROTEAMENTO - REGRAS DE ROTA */}
              {routingSubTab === 'rules' && (
                <div className="space-y-6">
                  <form onSubmit={addRule} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{editingRule ? "Editar Regra" : "Nova Regra de Atribuição (Roleta)"}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Equipe</label>
                        <select value={ruleForm.team_id} onChange={e => setRuleForm({...ruleForm, team_id: e.target.value})} className="input-clean">
                          <option value="">Qualquer equipe</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Segmento</label>
                        <select value={ruleForm.segment_id} onChange={e => setRuleForm({...ruleForm, segment_id: e.target.value})} className="input-clean">
                          <option value="">Qualquer segmento</option>
                          {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-2">Regiões Associadas</label>
                      <div className="flex flex-wrap gap-2">
                        {regions.map(r => (
                          <button key={r.id} type="button" onClick={() => setRuleRegionIds(toggleChip(ruleRegionIds, r.id))} className={`px-3 py-1 rounded text-xs font-semibold border cursor-pointer transition-all ${ruleRegionIds.includes(r.id) ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-2">Produtos Associados</label>
                      <div className="flex flex-wrap gap-2">
                        {products.map(p => (
                          <button key={p.id} type="button" onClick={() => setRuleProductIds(toggleChip(ruleProductIds, p.id))} className={`px-3 py-1 rounded text-xs font-semibold border cursor-pointer transition-all ${ruleProductIds.includes(p.id) ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1.5">Vendedores da Roleta (Rodízio)</label>
                      <div className="flex flex-wrap gap-2">
                        {users.filter(u => u.role === 'vendedor' || u.role === 'seller').map(u => (
                          <button key={u.id} type="button" onClick={() => setRuleSellerIds(toggleChip(ruleSellerIds, u.id))} className={`px-3 py-1 rounded text-xs font-semibold border cursor-pointer transition-all ${ruleSellerIds.includes(u.id) ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Prioridade da Regra (Menor = Prioritária)</label>
                        <input type="number" value={ruleForm.priority} onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value) || 1})} className="input-clean" min={1} />
                      </div>
                      <div className="pb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={ruleForm.is_express} onChange={e => setRuleForm({...ruleForm, is_express: e.target.checked})} className="w-4 h-4 accent-black" />
                          <span className="text-xs font-bold text-[var(--text-primary)]">Roteamento Exclusivo Express</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1 h-[38px]">{editingRule ? "Atualizar Regra" : "Criar Regra"}</button>
                      {editingRule && <button type="button" onClick={() => { setEditingRule(null); setRuleForm({ team_id: "", segment_id: "", priority: 1, is_express: false }); setRuleRegionIds([]); setRuleProductIds([]); setRuleSellerIds([]); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>}
                    </div>
                  </form>

                  {/* Filtro e Lista de Regras */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-1">Segmento</label>
                      <select value={filterSegmentId} onChange={e => setFilterSegmentId(e.target.value)} className="input-clean bg-white h-9">
                        <option value="">Todos</option>
                        {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-1">Equipe</label>
                      <select value={filterTeamId} onChange={e => setFilterTeamId(e.target.value)} className="input-clean bg-white h-9">
                        <option value="">Todas</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <button onClick={() => { setFilterSegmentId(""); setFilterTeamId(""); }} className="btn-secondary h-9 px-4">Limpar Filtros</button>
                  </div>

                  <div className="list-container-clean">
                    {rules
                      .filter(r => !filterSegmentId || r.segment_id === filterSegmentId)
                      .filter(r => !filterTeamId || r.team_id === filterTeamId)
                      .map(r => {
                        const regNames = (r.region_ids || []).map((rid: string) => regions.find(x => x.id === rid)?.name || rid).join(", ");
                        const prodNames = (r.product_ids || []).map((pid: string) => products.find(x => x.id === pid)?.name || pid).join(", ");
                        const selNames = (r.seller_ids || []).map((sid: string) => users.find(x => x.id === sid)?.name || sid).join(", ");
                        return (
                          <div key={r.id} className="list-item-clean flex justify-between items-start group">
                            <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                              <div className="flex flex-wrap gap-1.5">
                                {(r.seller_ids || []).map((sid: string) => (
                                  <span key={sid} className="text-[9px] bg-neutral-100 border border-neutral-200 text-neutral-800 px-2 py-0.5 rounded font-bold">{getName(users, sid)}</span>
                                ))}
                                {r.is_express && <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded font-bold">EXPRESS</span>}
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                                Regiões: {regNames || "Qualquer Região"} • Produtos: {prodNames || "Qualquer Produto"}
                              </p>
                              <p className="text-[10px] text-neutral-500 font-medium">Prioridade: {r.priority} • Segmento: {getName(segments, r.segment_id)} • Equipe: {getName(teams, r.team_id)}</p>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                              <button onClick={() => duplicateRule(r)} className="text-[10px] bg-white border border-[var(--border-strong)] px-2.5 py-1 rounded font-bold cursor-pointer hover:bg-neutral-50">Duplicar</button>
                              <button onClick={() => { setEditingRule(r); setRuleForm({ team_id: r.team_id || "", segment_id: r.segment_id || "", priority: r.priority || 1, is_express: !!r.is_express }); setRuleRegionIds(r.region_ids || []); setRuleProductIds(r.product_ids || []); setRuleSellerIds(r.seller_ids || []); }} className="text-[10px] bg-white border border-[var(--border-strong)] px-2.5 py-1 rounded font-bold cursor-pointer hover:bg-neutral-50">Editar</button>
                              <button onClick={() => deleteRule(r.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded font-bold cursor-pointer hover:bg-red-100">Excluir</button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ROTEAMENTO - REGRAS EXPRESS TÉCNICAS */}
              {routingSubTab === 'bizrules' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {businessRules.map(br => (
                      <div key={br.id} className="bg-white p-5 rounded-lg border border-[var(--border-light)] space-y-4">
                        <div className="flex justify-between items-start border-b border-[var(--border-light)] pb-3">
                          <div>
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{br.rule_key.replace('_', ' ')}</h3>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">{br.description}</p>
                          </div>
                          <button onClick={() => updateBusinessRuleConfig(br.id, br.config)} className="btn-primary py-1 px-3 text-[11px]">Salvar</button>
                        </div>
                        <div className="space-y-4">
                          {br.rule_key === 'express_permetal' ? (
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Máximo m²</label>
                                <input type="number" value={br.config.max_m2} onChange={e => handleBizConfigChange(br.id, 'max_m2', e.target.value, br.config)} className="input-clean h-8 text-center" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Peças 2x1</label>
                                <input type="number" value={br.config.max_pcs_2x1} onChange={e => handleBizConfigChange(br.id, 'max_pcs_2x1', e.target.value, br.config)} className="input-clean h-8 text-center" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Peças 3x1</label>
                                <input type="number" value={br.config.max_pcs_3x1} onChange={e => handleBizConfigChange(br.id, 'max_pcs_3x1', e.target.value, br.config)} className="input-clean h-8 text-center" />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Máximo M. Lineares</label>
                              <input type="number" value={br.config.max_m_lineares} onChange={e => handleBizConfigChange(br.id, 'max_m_lineares', e.target.value, br.config)} className="input-clean h-8" />
                            </div>
                          )}
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Exclusões de Produto (Virgulas)</label>
                            <textarea value={br.config.exclusions?.join(', ')} onChange={e => handleBizConfigChange(br.id, 'exclusions', e.target.value, br.config)} placeholder="Ex: belinox, degraus" className="input-clean h-14 py-1.5 text-xs" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROTEAMENTO - SCHEMAS B2B */}
              {routingSubTab === 'schemas' && (
                <div className="space-y-6">
                  {/* Cabeçalho explicativo com Botão de Salvar Global */}
                  <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white p-5 rounded-xl flex flex-col lg:flex-row justify-between lg:items-center gap-4 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📋</span>
                        <h3 className="font-bold text-sm tracking-wide">Configuração de Schemas B2B por Linha de Produto</h3>
                      </div>
                      <p className="text-xs text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                        O Lino exige que os <strong className="text-white">Campos Obrigatórios</strong> sejam preenchidos antes de liberar o roteamento comercial. Os <strong className="text-white">Campos Opcionais</strong> serão tentados até o limite de vezes configurado.
                      </p>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                      <input 
                        type="text" 
                        value={productSearch} 
                        onChange={e => setProductSearch(e.target.value)} 
                        placeholder="🔍 Buscar produto..." 
                        className="input-clean w-48 h-10 bg-white text-neutral-900 text-xs shadow-sm font-medium" 
                      />
                      <button
                        type="button"
                        onClick={saveAllSchemas}
                        disabled={savingAllSchemas}
                        className="h-10 px-5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <span>💾</span>
                        {savingAllSchemas ? "Salvando Todos..." : `Salvar Todos os Schemas (${products.length})`}
                      </button>
                    </div>
                  </div>

                  {/* Lista de Schemas por Produto */}
                  <div className="space-y-6">
                    {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                      const schema = p.qualification_schema;
                      const obrigatorias = schema.obrigatorias || [];
                      const opcionais = schema.opcionais || [];

                      return (
                        <div key={p.id} className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden hover:border-neutral-400 transition-all">
                          {/* Cabeçalho do Card */}
                          <div className="p-4 bg-neutral-50/80 border-b border-neutral-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs">
                                {p.name.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm text-[var(--text-primary)]">{p.name}</h4>
                                  {p.brands?.name && (
                                    <span className="text-[10px] bg-neutral-200 text-neutral-800 font-bold px-2 py-0.5 rounded">
                                      {p.brands.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                  {obrigatorias.length} obrigatórios • {opcionais.length} opcionais
                                </p>
                              </div>
                            </div>

                            {/* Status do Catálogo Técnico */}
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                Catálogo Técnico Supabase Ativo
                              </span>
                            </div>
                          </div>

                          {/* Corpo: Obrigatórios vs Opcionais */}
                          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Coluna 1: Obrigatórias */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                  Campos Obrigatórios (Bloqueiam Roteamento)
                                </h5>
                                <span className="text-[10px] text-neutral-400">Clique para ativar/desativar</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 p-3 bg-neutral-50/60 rounded-lg border border-neutral-200">
                                {camposDisponiveis.map(campo => {
                                  const isChecked = obrigatorias.includes(campo.value);
                                  return (
                                    <button
                                      key={campo.value}
                                      type="button"
                                      onClick={() => toggleObrigatoria(p.id, campo.value, schema)}
                                      className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                                        isChecked 
                                          ? "!bg-neutral-900 !text-white border-neutral-900 shadow-sm ring-1 ring-neutral-900" 
                                          : "!bg-white !text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                                      }`}
                                    >
                                      <span className={`truncate mr-2 ${isChecked ? "!text-white font-bold" : "!text-neutral-800"}`}>
                                        {campo.label}
                                      </span>
                                      <span className={`text-[11px] font-bold ${isChecked ? "!text-emerald-400" : "!text-neutral-400"}`}>
                                        {isChecked ? "✓" : "+"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Coluna 2: Opcionais com Limite de Tentativas */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  Campos Opcionais (Com Limite de Tentativas)
                                </h5>
                                <button 
                                  type="button" 
                                  onClick={() => addOpcionalField(p.id, schema)} 
                                  className="text-[11px] bg-neutral-900 text-white hover:bg-black rounded px-3 py-1 font-bold transition-all shadow-sm flex items-center gap-1"
                                >
                                  + Adicionar Campo
                                </button>
                              </div>

                              <div className="p-3 bg-neutral-50/60 rounded-lg border border-neutral-200 min-h-[140px] space-y-2">
                                {opcionais.length === 0 ? (
                                  <div className="text-center py-6 text-neutral-400 text-xs italic">
                                    Nenhum campo opcional configurado.<br/>
                                    <span className="text-[10px] text-neutral-500">Clique em "+ Adicionar Campo" acima para incluir CNPJ, E-mail, etc.</span>
                                  </div>
                                ) : (
                                  opcionais.map((opt: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-md border border-neutral-200 shadow-sm">
                                      <div className="flex-1">
                                        <label className="text-[9px] text-neutral-400 uppercase font-bold block mb-0.5">Campo Opcional</label>
                                        <select 
                                          value={opt.campo} 
                                          onChange={e => handleOpcionalChange(p.id, idx, 'campo', e.target.value, schema)} 
                                          className="input-clean h-7 py-0 text-xs bg-white w-full font-medium"
                                        >
                                          {camposDisponiveis.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                      </div>

                                      <div className="w-28">
                                        <label className="text-[9px] text-neutral-400 uppercase font-bold block mb-0.5 text-center">Máx. Tentativas</label>
                                        <input 
                                          type="number" 
                                          value={opt.max_tentativas} 
                                          onChange={e => handleOpcionalChange(p.id, idx, 'max_tentativas', e.target.value, schema)} 
                                          className="input-clean h-7 w-full text-center text-xs font-bold" 
                                          min={1} 
                                          max={5} 
                                        />
                                      </div>

                                      <div className="pt-3">
                                        <button 
                                          type="button"
                                          onClick={() => removeOpcionalField(p.id, idx, schema)} 
                                          className="w-7 h-7 rounded bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs font-bold flex items-center justify-center transition-colors"
                                          title="Remover campo"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Rodapé: Botão de Salvar Isolado */}
                          <div className="px-5 py-3.5 bg-neutral-100/80 border-t border-neutral-200 flex justify-between items-center">
                            <div className="text-xs text-neutral-600 font-medium">
                              {obrigatorias.length === 0 ? (
                                <span className="text-amber-700 font-bold">⚠️ Selecione ao menos 1 campo obrigatório</span>
                              ) : (
                                <span className="text-emerald-700 font-bold">✓ Configuração válida pronta para salvar</span>
                              )}
                            </div>
                            <button 
                              type="button" 
                              onClick={() => updateProductSchema(p.id, schema)} 
                              className="btn-primary py-2 px-5 text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                            >
                              <span>💾</span> Salvar Schema de {p.name}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==============================================
              2. MACRO TAB: EQUIPES & ACESSOS
              ============================================== */}
          {macroTab === 'teams' && (
            <div className="space-y-6">
              <div className="tabs-container-clean mb-6">
                <button onClick={() => setTeamsSubTab('teams')} className={`tab-item-clean ${teamsSubTab === 'teams' ? 'active' : ''}`}>Equipes</button>
                <button onClick={() => setTeamsSubTab('sellers')} className={`tab-item-clean ${teamsSubTab === 'sellers' ? 'active' : ''}`}>Vendedores</button>
                <button onClick={() => setTeamsSubTab('users')} className={`tab-item-clean ${teamsSubTab === 'users' ? 'active' : ''}`}>Usuários & Permissões</button>
              </div>

              {/* EQUIPES & ACESSOS - CADASTRO DE EQUIPES */}
              {teamsSubTab === 'teams' && (
                <div className="space-y-6">
                  <form onSubmit={addTeam} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{editingTeam ? "Editar Equipe" : "Nova Equipe Comercial"}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" value={editingTeam ? editTeamName : teamForm.name} onChange={e => editingTeam ? setEditTeamName(e.target.value) : setTeamForm({...teamForm, name: e.target.value})} placeholder="Nome da equipe (ex: Equipe Sul, Equipe Grades)" className="input-clean" required />
                      <select value={editingTeam ? (editingTeam.manager_id || "") : (teamForm.manager_id || "")} onChange={e => editingTeam ? setEditingTeam({...editingTeam, manager_id: e.target.value}) : setTeamForm({...teamForm, manager_id: e.target.value})} className="input-clean bg-white cursor-pointer">
                        <option value="">Atribuir Gestor Responsável</option>
                        {users.filter(u => u.role === 'gestor' || u.role === 'admin').map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1 h-[38px]">{editingTeam ? "Salvar" : "Salvar Equipe"}</button>
                      {editingTeam && <button type="button" onClick={() => { setEditingTeam(null); setEditTeamName(""); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>}
                    </div>
                  </form>
                  <div className="list-container-clean">
                    {teams.map(t => (
                      <div key={t.id} className="list-item-clean flex justify-between items-center group">
                        <div>
                          <span className="font-bold text-sm text-[var(--text-primary)]">{t.name}</span>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Gestor Responsável: <span className="font-semibold text-neutral-800">{getName(users, t.manager_id)}</span></p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTeam(t); setEditTeamName(t.name); }} className="text-[10px] bg-white border border-[var(--border-strong)] px-2.5 py-1 rounded font-bold cursor-pointer">Editar</button>
                          <button onClick={() => deleteTeam(t.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded font-bold cursor-pointer">Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EQUIPES & ACESSOS - VENDEDORES */}
              {teamsSubTab === 'sellers' && (
                <div className="space-y-6">
                  {editingUser ? (
                    <form onSubmit={assignSellerTeam} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Atribuir Equipe ao Vendedor: {editingUser.name}</h3>
                      <select value={userForm.team_id} onChange={e => setUserForm({...userForm, team_id: e.target.value})} className="input-clean">
                        <option value="">Sem Equipe (Inativo no roteamento)</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <div className="flex gap-3">
                        <button type="submit" className="btn-primary flex-1 h-[38px]">Salvar Atribuição</button>
                        <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "", team_id: "" }); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 leading-relaxed font-semibold">
                      Aqui você vincula os vendedores cadastrados às respectivas equipes para o rodízio automático de leads.
                    </div>
                  )}

                  <div className="list-container-clean">
                    {users.filter(u => u.role === 'vendedor' || u.role === 'seller').map(u => (
                      <div key={u.id} className="list-item-clean flex justify-between items-center group">
                        <div>
                          <span className="font-bold text-sm text-[var(--text-primary)]">{u.name}</span>
                          <p className="text-[10px] text-neutral-500 mt-1.5 font-mono">WhatsApp: {u.whatsapp_number || "Não Configurado"} • Equipe: <span className="font-semibold text-neutral-800">{getName(teams, u.team_id)}</span></p>
                        </div>
                        <button onClick={() => { setEditingUser(u); setUserForm({...userForm, team_id: u.team_id || "" }); }} className="text-[10px] bg-white border border-[var(--border-strong)] px-3 py-1.5 rounded font-bold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">Vincular Equipe</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EQUIPES & ACESSOS - USUÁRIOS & PERMISSÕES (RBAC) */}
              {teamsSubTab === 'users' && (
                <div className="space-y-8">
                  {/* Tabela de Permissões */}
                  <div className="bg-white p-5 border border-neutral-200 rounded-lg max-w-2xl">
                    <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-4">Tabela de Perfis & Permissões (RBAC)</h3>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-600 font-bold uppercase text-[9px] tracking-wider">
                          <th className="pb-2">Perfil</th>
                          <th className="pb-2 text-center">Dashboard</th>
                          <th className="pb-2 text-center">Funil (Kanban)</th>
                          <th className="pb-2 text-center">Regras</th>
                          <th className="pb-2 text-center">Configurações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700">
                        <tr><td className="py-2.5 font-bold">Admin</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">Sim</td></tr>
                        <tr><td className="py-2.5 font-bold">Gestor</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">—</td></tr>
                        <tr><td className="py-2.5 font-bold">Vendedor</td><td className="text-center py-2.5">—</td><td className="text-center py-2.5">Sim</td><td className="text-center py-2.5">—</td><td className="text-center py-2.5">—</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Form de Acessos */}
                  <form onSubmit={saveUser} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{editingUser ? "Editar Usuário" : "Novo Usuário / Acesso"}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="Nome completo" className="input-clean" required />
                      <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="Email de login" className="input-clean" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" value={userForm.whatsapp_number} onChange={e => setUserForm({...userForm, whatsapp_number: e.target.value})} placeholder="WhatsApp (ex: 5511999999999)" className="input-clean" />
                      <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={editingUser ? "Nova Senha (opcional)" : "Senha de acesso"} className="input-clean" />
                    </div>
                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="input-clean bg-white">
                      <option value="vendedor">Vendedor (Apenas Kanban)</option>
                      <option value="gestor">Gestor (Kanban, Metricas, Roteamento)</option>
                      <option value="admin">Administrador (Total)</option>
                    </select>
                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1 h-[38px]">{editingUser ? "Salvar Alterações" : "Criar Acesso"}</button>
                      {editingUser && <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "", team_id: "" }); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>}
                    </div>
                  </form>

                  {/* Lista de Usuários */}
                  <div className="list-container-clean">
                    {users.map(u => {
                      const roleInfo = ROLES[u.role] || ROLES.vendedor;
                      return (
                        <div key={u.id} className={`list-item-clean flex justify-between items-center group ${!u.active ? "opacity-50" : ""}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-[var(--text-primary)]">{u.name}</h4>
                              <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase border" style={{ background: roleInfo.color + "15", color: roleInfo.color, borderColor: roleInfo.color + "30" }}>{roleInfo.label}</span>
                              {!u.active && <span className="text-[9px] text-red-500 font-bold uppercase">(inativo)</span>}
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-1.5">{u.email} • WhatsApp: {u.whatsapp_number || "Não informado"}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => toggleUserActive(u)} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">{u.active ? "Pausar" : "Ativar"}</button>
                            <button onClick={() => { setEditingUser(u); setUserForm({ name: u.name, email: u.email, password: "", role: u.role, whatsapp_number: u.whatsapp_number || "", team_id: u.team_id || "" }); }} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">Editar</button>
                            <button onClick={() => deleteUser(u.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">Excluir</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==============================================
              3. MACRO TAB: CÉREBRO IA & AUTOMAÇÃO
              ============================================== */}
          {macroTab === 'ia' && (
            <div className="space-y-6">
              <div className="tabs-container-clean mb-6">
                <button onClick={() => setIaSubTab('cerebro')} className={`tab-item-clean ${iaSubTab === 'cerebro' ? 'active' : ''}`}>Cérebro IA</button>
                <button onClick={() => setIaSubTab('skills')} className={`tab-item-clean ${iaSubTab === 'skills' ? 'active' : ''}`}>Habilidades & RAG</button>
                <button onClick={() => setIaSubTab('flow')} className={`tab-item-clean ${iaSubTab === 'flow' ? 'active' : ''}`}>Esteira de Atendimento</button>
              </div>

              {/* CÉREBRO IA - GERAL & SLA */}
              {iaSubTab === 'cerebro' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-[var(--border-light)] space-y-6 shadow-sm">
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                        <div>
                          <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--text-primary)]">Prompt Mestre do Cérebro LINO v3</h3>
                          <p className="text-xs text-neutral-500 mt-0.5">Define a identidade, limites comerciais, protocolos de qualificação B2B e handoff do Lino.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMasterPrompt(FULL_OFFICIAL_MASTER_PROMPT);
                              flash("📄 Prompt Mestre Oficial Completo (14 Regras) carregado no editor!");
                            }}
                            className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-md font-bold border border-neutral-300 transition-all"
                          >
                            🔄 Carregar Prompt Padrão Oficial
                          </button>
                        </div>
                      </div>

                      <div className="relative mt-3">
                        <textarea 
                          value={masterPrompt} 
                          onChange={e => setMasterPrompt(e.target.value)} 
                          className="input-clean h-80 font-mono text-xs leading-relaxed p-4 bg-neutral-900 text-neutral-100 border-neutral-800 rounded-lg resize-y w-full focus:ring-2 focus:ring-neutral-700" 
                          placeholder="Digite ou cole aqui o Prompt Mestre do Lino..." 
                        />
                        <div className="flex justify-between items-center text-[10px] text-neutral-400 mt-1.5 px-1">
                          <span>Dica: As alterações salvas aqui passam a valer imediatamente no atendimento do WhatsApp.</span>
                          <span className="font-mono">{masterPrompt.length} caracteres</span>
                        </div>
                      </div>
                      
                      {/* Simulador de Teste de Prompt */}
                      <div className="mt-5 p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-700">🧪 Simulador Rápido de Resposta</h4>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={testMessage} 
                            onChange={e => setTestMessage(e.target.value)} 
                            placeholder="Digite uma mensagem simulada do cliente (ex: Olá, gostaria de orçamento de chapa perfurada furo redondo)..." 
                            className="input-clean text-xs flex-1 bg-white" 
                          />
                          <button 
                            type="button" 
                            onClick={handleTestPrompt} 
                            disabled={testingPrompt} 
                            className="btn-secondary text-xs px-4 h-9 font-bold shrink-0"
                          >
                            {testingPrompt ? "Simulando..." : "Testar com IA"}
                          </button>
                        </div>
                        {testResponse && (
                          <div className="p-3 bg-white rounded border border-neutral-300 text-xs text-neutral-800 space-y-1">
                            <span className="font-bold text-[10px] uppercase text-emerald-700 block">Resposta do Lino:</span>
                            <p className="whitespace-pre-wrap leading-relaxed">{testResponse}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Prompt de Suporte & Monitoramento (Aguardando Vendedor)</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 mb-3">Define como a IA responde quando o cliente cobra retorno enquanto aguarda o vendedor humano.</p>
                      <textarea value={supportPrompt} onChange={e => setSupportPrompt(e.target.value)} className="input-clean h-28 font-mono text-xs leading-relaxed p-3 resize-none bg-white" placeholder="Prompt de Suporte SLA..." />
                    </div>

                    <div className="border-t border-neutral-200 pt-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-900">
                            Regras Gerais de SLA & Cobrança de Vendedores
                          </h3>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Parâmetros aplicados pelo Lino para cobrança de vendedores e escalada para a coordenação.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          ATIVADO NO MOTOR LINO
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 p-5 rounded-lg border border-neutral-200">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-800 mb-1">
                            Tempo de Espera Máximo (Horas antes de escalar ao coordenador)
                          </label>
                          <input
                            type="number"
                            value={slaRules.max_wait_hours}
                            onChange={e => setSlaRules({...slaRules, max_wait_hours: parseInt(e.target.value) || 2})}
                            className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 bg-white text-black font-semibold outline-none focus:border-black"
                            min={1}
                          />
                          <span className="text-[10px] text-neutral-500 mt-1 block">Atingindo esse prazo, o coordenador é notificado no WhatsApp.</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-800 mb-1">
                            Prazo para 1º Contato do Vendedor (Minutos úteis)
                          </label>
                          <input
                            type="number"
                            value={slaRules.retry_interval_minutes}
                            onChange={e => setSlaRules({...slaRules, retry_interval_minutes: parseInt(e.target.value) || 30})}
                            className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 bg-white text-black font-semibold outline-none focus:border-black"
                            min={5}
                          />
                          <span className="text-[10px] text-neutral-500 mt-1 block">Prazo padrão de SLA comercial da Permetal (30 min úteis).</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-800 mb-1">
                            Máximo de Cobranças Automáticas (Limite de Escalada)
                          </label>
                          <input
                            type="number"
                            value={slaRules.seller_notify_max}
                            onChange={e => setSlaRules({...slaRules, seller_notify_max: parseInt(e.target.value) || 3})}
                            className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 bg-white text-black font-semibold outline-none focus:border-black"
                            min={1}
                            max={10}
                          />
                          <span className="text-[10px] text-neutral-500 mt-1 block">Passou disso (ex: 3x), escala imediatamente para a coordenação.</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-800 mb-1">
                            Intervalo Mínimo entre Cobranças ao Vendedor (Minutos)
                          </label>
                          <input
                            type="number"
                            value={slaRules.seller_notify_interval_minutes}
                            onChange={e => setSlaRules({...slaRules, seller_notify_interval_minutes: parseInt(e.target.value) || 10})}
                            className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 bg-white text-black font-semibold outline-none focus:border-black"
                            min={5}
                          />
                          <span className="text-[10px] text-neutral-500 mt-1 block">Evita disparar cobranças repetidas em saídas breves (mín. 10 min).</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <button
                        onClick={saveCerebro}
                        disabled={savingCerebro}
                        className="w-full h-11 text-xs font-bold rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {savingCerebro ? "Salvando Configurações..." : "💾 Salvar Configurações do Cérebro IA & Regras de SLA"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CÉREBRO IA - BASE DE CATÁLOGOS TÉCNICOS RAG */}
              {iaSubTab === 'skills' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Catálogos Técnicos e Biblioteca RAG</h3>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Catálogos e especificações técnicas consultadas pela IA.</p>
                      </div>
                      <button onClick={() => { setEditingRag(null); setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(!showRagForm); }} className="btn-secondary h-8 px-3 text-xs font-bold">{showRagForm ? "Fechar" : "+ Novo Documento / PDF"}</button>
                    </div>

                    {showRagForm && (
                      <form onSubmit={handleUploadRag} className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-4">
                        <input type="text" value={ragName} onChange={e => setRagName(e.target.value)} placeholder="Nome do catálogo (ex: Catálogo Sucroenergética)" className="input-clean text-xs bg-white" required />
                        
                        <div className="border border-dashed border-neutral-300 rounded p-4 text-center bg-white">
                          <input type="file" accept=".pdf,.txt,.csv,.doc,.docx" onChange={e => { setRagFile(e.target.files?.[0] || null); setRagText(""); }} id="rag-file" className="hidden" />
                          <label htmlFor="rag-file" className="cursor-pointer text-xs font-bold block">
                            {ragFile ? `Arquivo Selecionado: ${ragFile.name}` : "Clique para selecionar arquivo PDF ou texto"}
                          </label>
                        </div>

                        {!ragFile && <textarea value={ragText} onChange={e => setRagText(e.target.value)} rows={4} placeholder="Ou digite/cole o conteúdo do catálogo..." className="input-clean text-xs bg-white h-24 py-2 resize-none" />}

                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary flex-1 h-8 text-xs">{uploadingRag ? "Enviando..." : (editingRag ? "Atualizar" : "Salvar Catálogo")}</button>
                          <button type="button" onClick={() => { setShowRagForm(false); setEditingRag(null); }} className="btn-secondary flex-1 h-8 text-xs">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="list-container-clean">
                      {ragDocs.map(doc => (
                        <div key={doc.id} className="list-item-clean flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded">{doc.source_type || 'CATÁLOGO'}</span>
                              <h4 className="font-bold text-sm text-[var(--text-primary)]">{doc.name}</h4>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-1 truncate max-w-md">{doc.content?.substring(0, 100)}...</p>
                          </div>
                          <div className="flex gap-2 transition-opacity">
                            <button onClick={() => { setEditingRag(doc); setRagName(doc.name); setRagText(doc.content || ""); setRagFile(null); setShowRagForm(true); }} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">Editar</button>
                            <button onClick={() => deleteRagDoc(doc.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">Excluir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CÉREBRO IA - ESTEIRA VISUAL CANVAS */}
              {iaSubTab === 'flow' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 border border-neutral-200 rounded-lg">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">Roteador Visual Lino</h3>
                      <p className="text-xs text-[var(--text-muted)]">Rastreie a jornada lógica do lead na nossa infraestrutura IA.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <input type="text" placeholder="Nome ou WhatsApp do Lead" className="input-clean text-xs h-9 bg-white w-56" value={flowSearchInput} onChange={e => setFlowSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setFlowLeadId(flowSearchInput)} />
                      <button className="btn-primary text-xs h-9 px-4 font-bold shrink-0" onClick={() => setFlowLeadId(flowSearchInput)}>Buscar</button>
                    </div>
                  </div>
                  <FlowVisualizer leadId={flowLeadId} />
                </div>
              )}
            </div>
          )}

          {/* ==============================================
              4. MACRO TAB: CENTRAL WHATSAPP & APIS
              ============================================== */}
          {macroTab === 'integrations' && (
            <div className="space-y-6">
              
              {/* Banner Explicativo de Arquitetura Centralizada */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <div className="text-xs text-blue-900 leading-relaxed">
                  <p className="font-bold mb-1">Arquitetura de Atendimento Centralizada</p>
                  <p className="text-blue-800">
                    O Lino opera através de uma <strong className="font-bold">instância central única de WhatsApp</strong> na Evolution API. Os vendedores não precisam conectar seus aparelhos individuais — quando um lead é qualificado, o Lino envia uma notificação automática direta para o número de WhatsApp cadastrado no perfil de cada vendedor.
                  </p>
                </div>
              </div>

              {/* Formulário de Configuração Central */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Evolution API & OpenAI */}
                <form onSubmit={saveAPIConfig} className="bg-white p-6 rounded-xl border border-[var(--border-light)] space-y-4 shadow-sm">
                  <div className="border-b border-neutral-200 pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Central WhatsApp (Evolution API) & IA</h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Credenciais de conexão com o servidor Evolution API e OpenAI.</p>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — URL Base</label>
                    <input type="url" value={evolutionUrl} onChange={e => setEvolutionUrl(e.target.value)} placeholder="https://evolution.seuservidor.com" className="input-clean" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — Token Global de Autenticação</label>
                    <input type="password" value={evolutionKey} onChange={e => setEvolutionKey(e.target.value)} placeholder="apikey_global_..." className="input-clean" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — Nome da Instância Central</label>
                    <input type="text" value={evolutionInstanceName} onChange={e => setEvolutionInstanceName(e.target.value)} placeholder="linooficial" className="input-clean font-mono font-bold" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">OpenAI API Key</label>
                    <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." className="input-clean" required />
                  </div>
                  
                  <button type="submit" className="btn-primary w-full h-[40px] text-xs font-bold shadow-md">
                    💾 Salvar Configurações da Central
                  </button>
                </form>

                {/* Alterar Senha */}
                <form onSubmit={updatePassword} className="bg-white p-6 rounded-xl border border-[var(--border-light)] space-y-4 shadow-sm self-start">
                  <div className="border-b border-neutral-200 pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Alterar Senha do Administrador</h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Atualize a senha de acesso administrativo ao painel Lino.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">E-mail Cadastrado</label>
                    <input type="email" value={passwordEmail} onChange={e => setPasswordEmail(e.target.value)} placeholder="admin@permetal.com" className="input-clean" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Nova Senha de Acesso</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="input-clean" required />
                  </div>
                  <button type="submit" className="btn-secondary w-full h-[40px] text-xs font-bold border border-neutral-300">
                    Atualizar Senha
                  </button>
                </form>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: any) {
  const isCritical = title.toLowerCase().includes("vendedor") && parseInt(value) > 0;
  return (
    <div className={`metric-card ${isCritical ? 'critical' : ''}`}>
      <span className="metric-label">{title}</span>
      <span className="metric-value">{value}</span>
      <span className="metric-subtext">{sub}</span>
    </div>
  );
}

function getTypeInfo(type: string) {
  return SKILL_TYPES.find((t) => t.value === type) || SKILL_TYPES[0];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
