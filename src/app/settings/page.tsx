"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FlowVisualizer from "@/app/components/FlowVisualizer";

const CAMPOS_DISPONIVEIS = [
  { value: "nome_cliente", label: "Nome do Cliente" },
  { value: "empresa", label: "Nome da Empresa" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail Corporativo" },
  { value: "quantidade", label: "Quantidade / Metragem" },
  { value: "espessura", label: "Espessura da Chapa" },
  { value: "ec", label: "Espaçamento entre Centros (EC)" },
  { value: "dimensoes", label: "Dimensões da Chapa" },
  { value: "material", label: "Material (Aço Carbono, Inox, etc.)" },
  { value: "acabamento", label: "Acabamento / Pintura" },
];

const SKILL_TYPES = [
  { value: "product", label: "Produto", color: "#3b82f6", desc: "Conhecimento técnico de um produto" },
  { value: "atendimento", label: "Atendimento", color: "#10b981", desc: "Tom de voz e saudação" },
  { value: "objecao", label: "Objeção", color: "#f59e0b", desc: "Resposta a objeções comerciais" },
  { value: "qualificacao", label: "Qualificação", color: "#ec4899", desc: "Perguntas de qualificação SDR" },
];

const ROLES: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "#ef4444" },
  gestor: { label: "Gestor", color: "#f59e0b" },
  vendedor: { label: "Vendedor", color: "#3b82f6" },
};

export default function SettingsPage() {
  // Controle de Abas Macro
  const [macroTab, setMacroTab] = useState<'routing' | 'teams' | 'ia' | 'integrations'>('routing');
  // Controle de Sub-abas
  const [routingSubTab, setRoutingSubTab] = useState<'regions' | 'products' | 'segments' | 'rules' | 'bizrules'>('regions');
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
        setSupportPrompt(cfg.support_prompt || "");
        setMasterPrompt(cfg.master_prompt || "");
        setBotActive(cfg.bot_active !== false);
        setEvolutionUrl(cfg.evolution_url || "");
        setEvolutionKey(cfg.evolution_key || "");
        setEvolutionInstanceName(cfg.evolution_instance_name || "");
        setOpenaiKey(cfg.openai_key || "");
        if (cfg.sla_rules) setSlaRules({ ...slaRules, ...cfg.sla_rules });
        if (cfg.extraction_variables) setVariables(cfg.extraction_variables);
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
    setSavingCerebro(false);
    flash(error ? "Erro: " + error.message : "✔ Prompt Mestre e SLAs salvos!");
    loadAll();
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

  const addOpcionalField = async (prodId: string, schema: any) => {
    const opcionais = [...(schema.opcionais || [])];
    const jaUsados = new Set([...schema.obrigatorias, ...opcionais.map(o => o.campo)]);
    const disponivel = CAMPOS_DISPONIVEIS.find(c => !jaUsados.has(c.value));
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
              if (confirm('Zerar histórico do número de testes 5516991415319?')) {
                const res = await fetch('/api/test/clear-history', {
                  method: 'POST',
                  body: JSON.stringify({ whatsapp_number: '5516991415319' }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) alert('Histórico apagado!');
              }
            }}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-semibold rounded transition-all cursor-pointer"
          >
            Zerador de Testes
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
                  {/* Schema de Qualificação de Produto */}
                  <div className="border border-[var(--border-light)] rounded-lg overflow-hidden bg-white mt-0">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Schemas de Qualificação B2B</h3>
                      <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Pesquisar produto..." className="input-clean w-48 h-8" />
                    </div>
                    <div className="p-4 space-y-6">
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                        const schema = p.qualification_schema;
                        return (
                          <div key={p.id} className="p-4 border border-[var(--border-light)] rounded bg-gray-50/50 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-neutral-200 pb-3">
                              <div>
                                <h4 className="font-bold text-sm text-[var(--text-primary)]">{p.name}</h4>
                                <p className="text-[10px] text-neutral-500 font-semibold mt-0.5">Catálogo técnico associado ao RAG:</p>
                              </div>
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <select value={schema.rag_document_name || ""} onChange={e => handleProductRagChange(p.id, e.target.value, schema)} className="input-clean h-8 text-xs bg-white flex-1 sm:w-48">
                                  <option value="">Nenhum Catálogo Técnico</option>
                                  {ragDocs.map(doc => <option key={doc.id} value={doc.name}>{doc.name}</option>)}
                                </select>
                                <button onClick={() => updateProductSchema(p.id, schema)} className="btn-primary py-1 px-3 text-[11px] h-8 shrink-0">Salvar Schema</button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Obrigatórias */}
                              <div>
                                <h5 className="text-[10px] font-bold text-neutral-600 uppercase mb-2">Campos Obrigatórios</h5>
                                <div className="grid grid-cols-2 gap-1.5 p-3 border border-neutral-200 rounded bg-white max-h-40 overflow-y-auto">
                                  {CAMPOS_DISPONIVEIS.map(campo => (
                                    <label key={campo.value} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-neutral-50 p-1 rounded">
                                      <input type="checkbox" checked={schema.obrigatorias.includes(campo.value)} onChange={() => toggleObrigatoria(p.id, campo.value, schema)} className="accent-black w-3.5 h-3.5" />
                                      <span className={schema.obrigatorias.includes(campo.value) ? "font-bold text-black" : "text-neutral-500"}>{campo.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Opcionais */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="text-[10px] font-bold text-neutral-600 uppercase">Campos Opcionais (Com Limite)</h5>
                                  <button onClick={() => addOpcionalField(p.id, schema)} className="text-[10px] bg-white border border-neutral-300 rounded px-2 py-0.5 font-bold hover:bg-neutral-50">Adicionar Campo</button>
                                </div>
                                <div className="space-y-1.5 p-3 border border-neutral-200 rounded bg-white max-h-40 overflow-y-auto">
                                  {(schema.opcionais || []).map((opt: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center bg-gray-50 p-1.5 rounded border border-neutral-200">
                                      <select value={opt.campo} onChange={e => handleOpcionalChange(p.id, idx, 'campo', e.target.value, schema)} className="input-clean h-7 py-0 text-[11px] bg-white flex-1">
                                        {CAMPOS_DISPONIVEIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                      </select>
                                      <span className="text-[10px] text-neutral-500">Tentativas:</span>
                                      <input type="number" value={opt.max_tentativas} onChange={e => handleOpcionalChange(p.id, idx, 'max_tentativas', e.target.value, schema)} className="input-clean h-7 w-12 text-center text-xs" min={1} max={5} />
                                      <button onClick={() => removeOpcionalField(p.id, idx, schema)} className="text-red-500 hover:text-red-700 text-xs px-2 font-bold">✕</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                  <div className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-6">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Prompt Mestre do Cérebro</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 mb-3">Define as instruções base e a identidade da Inteligência SDR.</p>
                      <textarea value={masterPrompt} onChange={e => setMasterPrompt(e.target.value)} className="input-clean h-48 font-mono text-[11px] leading-relaxed p-3 resize-none" placeholder="Identidade e regras da IA..." />
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Prompt de Suporte (Enquanto o Vendedor Não Chega)</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 mb-3">Define como a IA deve acalmar e manter o cliente respondido enquanto ele aguarda o vendedor humano.</p>
                      <textarea value={supportPrompt} onChange={e => setSupportPrompt(e.target.value)} className="input-clean h-32 font-mono text-[11px] leading-relaxed p-3 resize-none" placeholder="Prompt de Suporte SLA..." />
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-4">Regras Gerais de SLA & Cobrança</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tempo de Espera Máximo (Horas antes de escalar)</label>
                          <input type="number" value={slaRules.max_wait_hours} onChange={e => setSlaRules({...slaRules, max_wait_hours: parseInt(e.target.value) || 2})} className="input-clean" min={1} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Intervalo de Cobrança ao Vendedor (Minutos)</label>
                          <input type="number" value={slaRules.retry_interval_minutes} onChange={e => setSlaRules({...slaRules, retry_interval_minutes: parseInt(e.target.value) || 15})} className="input-clean" min={1} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Máximo de Notificações / Cobranças</label>
                          <input type="number" value={slaRules.seller_notify_max} onChange={e => setSlaRules({...slaRules, seller_notify_max: parseInt(e.target.value) || 3})} className="input-clean" min={1} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Intervalo entre Notificações (Minutos)</label>
                          <input type="number" value={slaRules.seller_notify_interval_minutes} onChange={e => setSlaRules({...slaRules, seller_notify_interval_minutes: parseInt(e.target.value) || 15})} className="input-clean" min={1} />
                        </div>
                      </div>
                    </div>

                    <button onClick={saveCerebro} disabled={savingCerebro} className="btn-primary w-full h-[40px] text-xs font-bold">{savingCerebro ? "Salvando Configurações..." : "Salvar Configurações do Cérebro"}</button>
                  </div>
                </div>
              )}

              {/* CÉREBRO IA - HABILIDADES MODULARES & BASE RAG */}
              {iaSubTab === 'skills' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* Variáveis de Extração */}
                  <div className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Variaveis de Coleta de Dados</h3>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Campos que a IA deve capturar no roteamento.</p>
                      </div>
                      <button onClick={() => { setVarForm({ name: "", description: "", required: false }); setEditingVarIndex(null); setShowVarForm(!showVarForm); }} className="btn-secondary h-8 px-3 text-xs font-bold">{showVarForm ? "Fechar" : "+ Nova Variável"}</button>
                    </div>

                    {showVarForm && (
                      <form onSubmit={handleSaveVariable} className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="text" value={varForm.name} onChange={e => setVarForm({...varForm, name: e.target.value})} placeholder="Nome da variável (ex: cnpj)" className="input-clean text-xs bg-white" required />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={varForm.required} onChange={e => setVarForm({...varForm, required: e.target.checked})} className="w-4 h-4 accent-black" />
                            <span className="text-xs font-bold text-neutral-800">Roteamento Obrigatório</span>
                          </label>
                        </div>
                        <input type="text" value={varForm.description} onChange={e => setVarForm({...varForm, description: e.target.value})} placeholder="Descrição e instruções de extração da IA" className="input-clean text-xs bg-white" required />
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary flex-1 h-8 text-xs">{editingVarIndex !== null ? "Atualizar" : "Salvar"}</button>
                          <button type="button" onClick={() => setShowVarForm(false)} className="btn-secondary flex-1 h-8 text-xs">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="list-container-clean">
                      {variables.map((v, i) => (
                        <div key={i} className="list-item-clean flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[var(--text-primary)]">{v.name}</span>
                              <span className={`text-[8px] px-2 py-0.5 rounded font-bold border ${v.required ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}>{v.required ? 'Obrigatória' : 'Opcional'}</span>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-1">{v.description}</p>
                          </div>
                          <div className="flex gap-2 transition-opacity">
                            <button onClick={() => { setVarForm(v); setEditingVarIndex(i); setShowVarForm(true); }} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">Editar</button>
                            <button onClick={() => deleteVariable(i)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">Excluir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bases RAG */}
                  <div className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Catálogos e Biblioteca RAG</h3>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Informações técnicas lidas pela IA para resolver dúvidas.</p>
                      </div>
                      <button onClick={() => { setEditingRag(null); setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(!showRagForm); }} className="btn-secondary h-8 px-3 text-xs font-bold">{showRagForm ? "Fechar" : "+ Novo Documento RAG"}</button>
                    </div>

                    {showRagForm && (
                      <form onSubmit={handleUploadRag} className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-4">
                        <input type="text" value={ragName} onChange={e => setRagName(e.target.value)} placeholder="Nome do documento (ex: Grade Industrial SP)" className="input-clean text-xs bg-white" required />
                        
                        <div className="border border-dashed border-neutral-300 rounded p-4 text-center bg-white">
                          <input type="file" accept=".pdf,.txt,.csv,.doc,.docx" onChange={e => { setRagFile(e.target.files?.[0] || null); setRagText(""); }} id="rag-file" className="hidden" />
                          <label htmlFor="rag-file" className="cursor-pointer text-xs font-bold block">
                            {ragFile ? `Arquivo Selecionado: ${ragFile.name}` : "Clique para selecionar arquivo de texto ou PDF"}
                          </label>
                        </div>

                        {!ragFile && <textarea value={ragText} onChange={e => setRagText(e.target.value)} rows={4} placeholder="Ou digite o conteúdo manualmente..." className="input-clean text-xs bg-white h-24 py-2 resize-none" />}

                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary flex-1 h-8 text-xs">{uploadingRag ? "Enviando..." : (editingRag ? "Atualizar" : "Salvar")}</button>
                          <button type="button" onClick={() => { setShowRagForm(false); setEditingRag(null); }} className="btn-secondary flex-1 h-8 text-xs">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="list-container-clean">
                      {ragDocs.map(doc => (
                        <div key={doc.id} className="list-item-clean flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded">{doc.source_type || 'TXT'}</span>
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

                  {/* Habilidades Específicas */}
                  <div className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Habilidades Modulares (Skills)</h3>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Ativadas automaticamente de acordo com as conversas.</p>
                      </div>
                      <button onClick={() => { setEditingSkill(null); setSkillForm({ name: "", type: "product", prompt: "" }); setSelectedRags([]); setShowSkillForm(!showSkillForm); }} className="btn-secondary h-8 px-3 text-xs font-bold">{showSkillForm ? "Fechar" : "+ Nova Habilidade"}</button>
                    </div>

                    {showSkillForm && (
                      <form onSubmit={saveSkill} className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="text" value={skillForm.name} onChange={e => setSkillForm({...skillForm, name: e.target.value})} placeholder="Nome da Skill" className="input-clean text-xs bg-white" required />
                          <select value={skillForm.type} onChange={e => setSkillForm({...skillForm, type: e.target.value})} className="input-clean text-xs bg-white">
                            {SKILL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <textarea value={skillForm.prompt} onChange={e => setSkillForm({...skillForm, prompt: e.target.value})} rows={4} placeholder="Instruções para a IA nesta skill..." className="input-clean text-xs bg-white h-24 py-2 resize-none" required />
                        
                        {ragDocs.length > 0 && (
                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-bold text-neutral-500 uppercase">Vincular Base RAG</label>
                            <div className="grid grid-cols-2 gap-2 p-2 border border-neutral-200 rounded bg-white max-h-28 overflow-y-auto">
                              {ragDocs.map(doc => (
                                <label key={doc.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-neutral-50 p-1 rounded">
                                  <input type="checkbox" checked={selectedRags.includes(doc.id)} onChange={() => setSelectedRags(toggleChip(selectedRags, doc.id))} className="accent-black w-3.5 h-3.5" />
                                  <span className="truncate">{doc.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary flex-1 h-8 text-xs">{editingSkill ? "Atualizar" : "Salvar"}</button>
                          <button type="button" onClick={() => { setShowSkillForm(false); setEditingSkill(null); }} className="btn-secondary flex-1 h-8 text-xs">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {skills.map(s => {
                        const info = getTypeInfo(s.type);
                        return (
                          <div key={s.id} className={`p-4 border border-[var(--border-light)] rounded-lg bg-white flex justify-between items-start group ${!s.active ? "opacity-50" : ""}`}>
                            <div className="space-y-2 flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase" style={{ background: info.color + "15", color: info.color }}>{info.label}</span>
                                <h4 className="font-bold text-sm text-[var(--text-primary)]">{s.name}</h4>
                              </div>
                              <p className="text-xs text-neutral-600 font-mono leading-relaxed bg-neutral-50 border border-neutral-200 p-2.5 rounded max-h-20 overflow-y-auto scrollbar-hide">{s.prompt}</p>
                            </div>
                            <div className="flex gap-2 transition-opacity ml-2 shrink-0">
                              <button onClick={() => toggleSkillActive(s)} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">{s.active ? "Pausar" : "Ativar"}</button>
                              <button onClick={() => { setEditingSkill(s); setSkillForm({ name: s.name, type: s.type, prompt: s.prompt }); const linked = skillRagLinks.filter(l => l.skill_id === s.id).map(l => l.rag_document_id); setSelectedRags(linked); setShowSkillForm(true); }} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">Editar</button>
                              <button onClick={() => deleteSkill(s.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">Excluir</button>
                            </div>
                          </div>
                        );
                      })}
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
                      <button onClick={() => setFlowLeadId(flowSearchInput)} className="btn-secondary h-9 text-xs font-bold">Rastrear</button>
                    </div>
                  </div>
                  <div className="h-[600px] border border-neutral-200 rounded-lg overflow-hidden bg-[#fafafa] relative">
                    <FlowVisualizer leadId={flowLeadId} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==============================================
              4. MACRO TAB: WHATSAPP & APIS
              ============================================== */}
          {macroTab === 'integrations' && (
            <div className="space-y-6">
              <div className="tabs-container-clean mb-6">
                <button onClick={() => setIntegrationsSubTab('whatsapp')} className={`tab-item-clean ${integrationsSubTab === 'whatsapp' ? 'active' : ''}`}>WhatsApp (Instâncias)</button>
                <button onClick={() => setIntegrationsSubTab('credentials')} className={`tab-item-clean ${integrationsSubTab === 'credentials' ? 'active' : ''}`}>Credenciais de APIs</button>
              </div>

              {/* WHATSAPP & APIS - INSTÂNCIAS DO CELULAR */}
              {integrationsSubTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Conexões WhatsApp dos Vendedores</h3>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Cadastre cada celular corporativo como uma instância na Evolution API.</p>
                    </div>
                    <button onClick={() => { setEditingInstance(null); setInstForm({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" }); setShowInstForm(!showInstForm); }} className="btn-primary h-8 text-xs font-bold">+ Nova Instância</button>
                  </div>

                  {showInstForm && (
                    <form onSubmit={saveInstance} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{editingInstance ? "Editar Instância" : "Nova Instância WhatsApp"}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={instForm.name} onChange={e => setInstForm({...instForm, name: e.target.value})} placeholder="Nome (ex: Celular Vendas)" className="input-clean bg-white text-xs" required />
                        <input type="text" value={instForm.phone_number} onChange={e => setInstForm({...instForm, phone_number: e.target.value})} placeholder="Número (ex: 5511999999999)" className="input-clean bg-white text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={instForm.evolution_instance_name} onChange={e => setInstForm({...instForm, evolution_instance_name: e.target.value})} placeholder="Nome da Instância na Evolution API" className="input-clean bg-white text-xs" />
                        <select value={instForm.assigned_user_id} onChange={e => setInstForm({...instForm, assigned_user_id: e.target.value})} className="input-clean bg-white text-xs cursor-pointer">
                          <option value="">Distribuição de Leads Automática</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="url" value={instForm.evolution_url} onChange={e => setInstForm({...instForm, evolution_url: e.target.value})} placeholder="URL Evolution específica (opcional)" className="input-clean bg-white text-xs" />
                        <input type="password" value={instForm.evolution_key} onChange={e => setInstForm({...instForm, evolution_key: e.target.value})} placeholder="Token Evolution específico (opcional)" className="input-clean bg-white text-xs" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="submit" className="btn-primary flex-1 h-[38px]">{editingInstance ? "Atualizar" : "Criar"}</button>
                        <button type="button" onClick={() => { setShowInstForm(false); setEditingInstance(null); }} className="btn-secondary flex-1 h-[38px]">Cancelar</button>
                      </div>
                    </form>
                  )}

                  <div className="list-container-clean">
                    {instances.map(inst => (
                      <div key={inst.id} className={`list-item-clean flex justify-between items-center group ${!inst.active ? "opacity-50" : ""}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${inst.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{inst.name}</h4>
                          </div>
                          <p className="text-[10px] text-neutral-500 mt-1.5">📱 WhatsApp: {inst.phone_number || '—'} • Evolution: {inst.evolution_instance_name || '—'} • Vendedor Associado: <span className="font-semibold text-neutral-800">{getName(users, inst.assigned_user_id)}</span></p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => startEditInstance(inst)} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">Editar</button>
                          <button onClick={() => toggleInstanceActive(inst)} className="text-[10px] bg-white border border-neutral-300 px-2 py-1 rounded font-bold">{inst.active ? "Desativar" : "Ativar"}</button>
                          <button onClick={() => deleteInstance(inst.id)} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">Excluir</button>
                        </div>
                      </div>
                    ))}
                    {instances.length === 0 && (
                      <p className="text-xs text-neutral-500 text-center py-10 uppercase font-bold">Nenhuma conexão WhatsApp registrada.</p>
                    )}
                  </div>
                </div>
              )}

              {/* WHATSAPP & APIS - CREDENCIAIS DE APIS */}
              {integrationsSubTab === 'credentials' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                  
                  {/* Evolution API & OpenAI */}
                  <form onSubmit={saveAPIConfig} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4 self-start">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Credenciais de Servidores</h3>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — URL Base</label>
                      <input type="url" value={evolutionUrl} onChange={e => setEvolutionUrl(e.target.value)} placeholder="https://api.vendas.com" className="input-clean" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — Token Global</label>
                      <input type="password" value={evolutionKey} onChange={e => setEvolutionKey(e.target.value)} placeholder="apikey_global_..." className="input-clean" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Evolution API — Instância Global</label>
                      <input type="text" value={evolutionInstanceName} onChange={e => setEvolutionInstanceName(e.target.value)} placeholder="permetal_sp" className="input-clean" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">OpenAI API Key</label>
                      <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." className="input-clean" required />
                    </div>
                    <button type="submit" className="btn-primary w-full h-[38px] text-xs font-bold">Salvar Credenciais</button>
                  </form>

                  {/* Atualização de Senha */}
                  <form onSubmit={updatePassword} className="bg-white p-6 rounded-lg border border-[var(--border-light)] space-y-4 self-start">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">Alterar Senha Administrativa</h3>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">E-mail Cadastrado</label>
                      <input type="email" value={passwordEmail} onChange={e => setPasswordEmail(e.target.value)} placeholder="ex: admin@permetal.com" className="input-clean" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Nova Senha de Acesso</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="input-clean" required />
                    </div>
                    <button type="submit" className="btn-secondary w-full h-[38px] text-xs font-bold border border-neutral-300">Atualizar Senha</button>
                  </form>

                </div>
              )}
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
