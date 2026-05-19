"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const TABS = [
  { key: "regions", label: "Regiões", icon: "🗺️" },
  { key: "products", label: "Produtos", icon: "📦" },
  { key: "segments", label: "Segmentos", icon: "🏭" },
  { key: "teams", label: "Equipes", icon: "👥" },
  { key: "sellers", label: "Vendedores", icon: "🧑‍💼" },
  { key: "rules", label: "Regras", icon: "⚙️" },
  { key: "cerebro", label: "Cérebro IA", icon: "🧠" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("regions");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [regions, setRegions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [supportPrompt, setSupportPrompt] = useState("");
  const [slaRules, setSlaRules] = useState({
    max_wait_hours: 2,
    retry_interval_minutes: 15,
    max_retries: 3,
    seller_notify_max: 3,
    seller_notify_interval_minutes: 15
  });
  const [savingCerebro, setSavingCerebro] = useState(false);

  // Forms
  const [regionForm, setRegionForm] = useState({ name: "", ddd_codes: "" });
  const [productForm, setProductForm] = useState({ name: "", synonyms: "", brand_id: "" });
  const [segmentForm, setSegmentForm] = useState({ name: "", keywords: "", collection_type: "normal" });
  const [teamForm, setTeamForm] = useState({ name: "", manager_id: "" });
  const [userForm, setUserForm] = useState({ name: "", whatsapp_number: "", team_id: "", role: "seller" });
  const [ruleForm, setRuleForm] = useState({ team_id: "", segment_id: "", priority: 1, is_express: false });
  const [ruleRegionIds, setRuleRegionIds] = useState<string[]>([]);
  const [ruleProductIds, setRuleProductIds] = useState<string[]>([]);
  const [ruleSellerIds, setRuleSellerIds] = useState<string[]>([]);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  // Filtros de Regras
  const [filterSegmentId, setFilterSegmentId] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterRegionId, setFilterRegionId] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [r, p, sg, t, u, b, rl] = await Promise.all([
      supabase.from("regions").select("*").order("name"),
      supabase.from("products").select("*, brands(name)").order("name"),
      supabase.from("segments").select("*").order("name"),
      supabase.from("teams").select("*").order("created_at"),
      supabase.from("admin_users").select("*").order("created_at"),
      supabase.from("brands").select("*").order("name"),
      supabase.from("routing_rules").select("*").order("priority"),
    ]);
    if (r.data) setRegions(r.data);
    if (p.data) setProducts(p.data);
    if (sg.data) setSegments(sg.data);
    if (t.data) setTeams(t.data);
    if (u.data) setUsers(u.data);
    if (b.data) setBrands(b.data);
    if (rl.data) setRules(rl.data);
    if (rl.error) console.error("Erro ao carregar regras:", rl.error);
    if (rl.data?.length === 0) console.log("Nenhuma regra encontrada no banco.");

    // Carregar config do cérebro IA
    const { data: cfg } = await supabase.from("tenant_config").select("*").limit(1).single();
    if (cfg) {
      setTenantConfig(cfg);
      setSupportPrompt(cfg.support_prompt || "");
      if (cfg.sla_rules) setSlaRules({ ...slaRules, ...cfg.sla_rules });
    }

    setLoading(false);
  }

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }
  function getName(list: any[], id: string) { return list.find(i => i.id === id)?.name || "—"; }

  async function saveCerebro() {
    if (!tenantConfig?.id) return;
    setSavingCerebro(true);
    const { error } = await supabase.from("tenant_config").update({
      support_prompt: supportPrompt,
      sla_rules: slaRules
    }).eq("id", tenantConfig.id);
    setSavingCerebro(false);
    flash(error ? "Erro: " + error.message : "✔ Configurações do Cérebro IA salvas!");
  }

  // REGION
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

  // PRODUCT
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const syns = productForm.synonyms.split(",").map(s => s.trim()).filter(Boolean);
    const payload: any = { name: productForm.name, synonyms: syns };
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
    
    setProductForm({ name: "", synonyms: "", brand_id: "" }); 
    loadAll();
  }
  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto?")) return;
    await supabase.from("products").delete().eq("id", id); flash("✔ Excluído!"); loadAll();
  }

  // SEGMENT
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

  // TEAMS
  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!editingTeam;
    const finalName = isEdit ? editTeamName : teamForm.name;
    const finalManagerId = isEdit ? editingTeam.manager_id : teamForm.manager_id;
    
    if (!finalName.trim()) {
      flash("⚠️ Digite o nome da equipe");
      return;
    }
    
    const payload: any = { 
      name: finalName,
      manager_id: finalManagerId || null
    };

    if (isEdit) {
      console.log("Atualizando equipe:", editingTeam.id, payload);
      const { error } = await supabase.from("teams").update(payload).eq("id", editingTeam.id);
      if (error) { 
        console.error("Erro Supabase:", error);
        flash("Erro: " + error.message); 
        return; 
      }
      setEditingTeam(null);
      setEditTeamName("");
      flash("✔ Equipe atualizada!");
    } else {
      console.log("Criando nova equipe:", payload);
      const { error } = await supabase.from("teams").insert([payload]);
      if (error) { 
        console.error("Erro Supabase:", error);
        flash("Erro: " + error.message); 
        return; 
      }
      setTeamForm({ name: "", manager_id: "" });
      flash("✔ Equipe criada!");
    }
    loadAll();
  }
  async function deleteTeam(id: string) {
    if (!confirm("Excluir equipe?")) return;
    await supabase.from("teams").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  // USERS / SELLERS
  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { 
      name: userForm.name, 
      whatsapp_number: userForm.whatsapp_number, 
      role: userForm.role,
      team_id: userForm.team_id || null
    };

    if (editingUser) {
      const { error } = await supabase.from("admin_users").update(payload).eq("id", editingUser.id);
      if (error) { flash("Erro: " + error.message); return; }
      setEditingUser(null); 
      flash("✔ Usuário/Vendedor atualizado!");
    } else {
      // Para novos via regras comerciais, vamos pedir uma senha padrão ou email?
      // O ideal é que o usuário já exista, mas se for criar aqui:
      flash("⚠️ Use a aba 'Usuários' para criar novos acessos. Aqui você edita o perfil comercial.");
      return;
    }
    setUserForm({ name: "", whatsapp_number: "", team_id: "", role: "seller" }); 
    loadAll();
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir vendedor?")) return;
    await supabase.from("admin_users").delete().eq("id", id); flash("✔ Excluído!"); loadAll();
  }

  // RULES
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
    await supabase.from("routing_rules").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  async function duplicateRule(rule: any) {
    const { id, created_at, ...cleanRule } = rule;
    const payload = {
      ...cleanRule,
      priority: (rule.priority || 0) + 1 // Sugere uma prioridade próxima
    };
    const { error } = await supabase.from("routing_rules").insert([payload]);
    if (error) { flash("Erro ao duplicar: " + error.message); return; }
    flash("✔ Regra duplicada com sucesso!");
    loadAll();
  }

  const inputCls = "w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-[hsl(var(--tenant-primary))]";
  const btnCls = "w-full py-2 rounded font-bold text-sm hover:opacity-90";

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-3xl font-bold">Regras Comerciais</h2>
        <p className="text-gray-400 mt-1 text-sm">Configure sua operação comercial e vincule seus usuários.</p>
      </header>

      {/* TABS (Sticky) */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a] pt-2 pb-6 border-b border-gray-800/50 mb-6">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${tab === t.key ? "bg-[hsl(var(--tenant-primary))] text-black" : "bg-[#1a1a1a] text-gray-400 hover:bg-gray-800"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="max-w-4xl">
          
          {/* REGIÕES */}
          {tab === "regions" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addRegion} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm">Nova Região</h3>
                  <input type="text" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} placeholder="Nome (ex: SP01, SUL, NORDESTE)" className={inputCls} required />
                  <input type="text" value={regionForm.ddd_codes} onChange={e => setRegionForm({...regionForm, ddd_codes: e.target.value})} placeholder="DDDs separados por vírgula (ex: 11,12,13,15)" className={inputCls} required />
                  <button type="submit" className={`${btnCls} bg-blue-600`}>+ Criar Região</button>
                  {msg && tab === 'regions' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>
              <div className="space-y-2">
                {regions.map(r => (
                  <div key={r.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-center group">
                    <div>
                      <h4 className="font-bold text-sm">{r.name}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">{(r.ddd_codes || []).map((d: string) => <span key={d} className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">{d}</span>)}</div>
                    </div>
                    <button onClick={() => deleteRegion(r.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded opacity-0 group-hover:opacity-100">X</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRODUTOS */}
          {tab === "products" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addProduct} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm">{editingProduct ? "Editar Produto" : "Novo Produto"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Nome do produto" className={inputCls} required />
                    <input type="text" value={productForm.synonyms} onChange={e => setProductForm({...productForm, synonyms: e.target.value})} placeholder="Sinônimos separados por vírgula" className={inputCls} />
                  </div>
                  <select value={productForm.brand_id} onChange={e => setProductForm({...productForm, brand_id: e.target.value})} className={inputCls}>
                    <option value="">Marca (automática)</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <div className="flex gap-3">
                    <button type="submit" className={`${btnCls} bg-green-700 flex-1`}>{editingProduct ? "Atualizar Produto" : "+ Criar Produto"}</button>
                    {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setProductForm({ name: "", synonyms: "", brand_id: "" }); }} className={`${btnCls} border border-gray-700 flex-1`}>Cancelar</button>}
                  </div>
                  {msg && tab === 'products' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-start group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{p.name}</h4>
                        {p.brands?.name && <span className="text-[10px] bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">{p.brands.name}</span>}
                      </div>
                      {(p.synonyms || []).length > 0 && <p className="text-[10px] text-gray-500 mt-1">Sinônimos: {p.synonyms.join(", ")}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 ml-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(p);
                          setProductForm({
                            name: p.name,
                            synonyms: (p.synonyms || []).join(", "),
                            brand_id: p.brand_id || ""
                          });
                        }} 
                        className="text-[10px] bg-gray-800 px-2 py-1 rounded"
                      >
                        Editar
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded">X</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEGMENTOS */}
          {tab === "segments" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addSegment} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm">Novo Segmento</h3>
                  <input type="text" value={segmentForm.name} onChange={e => setSegmentForm({...segmentForm, name: e.target.value})} placeholder="Nome (ex: Indústria, Construção)" className={inputCls} required />
                  <input type="text" value={segmentForm.keywords} onChange={e => setSegmentForm({...segmentForm, keywords: e.target.value})} placeholder="Keywords separadas por vírgula" className={inputCls} />
                  <select value={segmentForm.collection_type} onChange={e => setSegmentForm({...segmentForm, collection_type: e.target.value})} className={inputCls}>
                    <option value="normal">Coleta Normal (todos os campos)</option>
                    <option value="short">Coleta Curta (nome, email, produto)</option>
                  </select>
                  <button type="submit" className={`${btnCls} bg-purple-700`}>+ Criar Segmento</button>
                  {msg && tab === 'segments' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>
              <div className="space-y-2">
                {segments.map(s => (
                  <div key={s.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-start group">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{s.name}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.collection_type === 'short' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>{s.collection_type === 'short' ? 'Coleta Curta' : 'Coleta Normal'}</span>
                      </div>
                      {(s.keywords || []).length > 0 && <p className="text-[10px] text-gray-500 mt-1">Keywords: {s.keywords.join(", ")}</p>}
                    </div>
                    <button onClick={() => deleteSegment(s.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded opacity-0 group-hover:opacity-100">X</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EQUIPES */}
          {tab === "teams" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addTeam} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm">{editingTeam ? "Editar Equipe" : "Nova Equipe"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      value={editingTeam ? editTeamName : teamForm.name} 
                      onChange={e => editingTeam ? setEditTeamName(e.target.value) : setTeamForm({...teamForm, name: e.target.value})} 
                      placeholder="Nome da equipe (ex: Indústria)" 
                      className={inputCls} 
                      required 
                    />
                    <select 
                      value={editingTeam ? (editingTeam.manager_id || "") : (teamForm.manager_id || "")} 
                      onChange={e => editingTeam ? setEditingTeam({...editingTeam, manager_id: e.target.value}) : setTeamForm({...teamForm, manager_id: e.target.value})}
                      className={inputCls}
                    >
                      <option value="">Atribuir Gestor Responsável</option>
                      {users.filter(u => u.role === 'gestor' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className={`${btnCls} bg-blue-600`}>{editingTeam ? "Salvar Alterações" : "+ Criar Equipe"}</button>
                    {editingTeam && <button type="button" onClick={() => setEditingTeam(null)} className={`${btnCls} border border-gray-700`}>Cancelar</button>}
                  </div>
                </form>
                {msg && tab === 'teams' && <p className="text-[10px] text-green-400 font-bold animate-pulse mt-2">{msg}</p>}
              </div>
              <div className="space-y-2">
                {teams.map(t => {
                  const manager = users.find(u => u.id === t.manager_id);
                  return (
                    <div key={t.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-center group">
                      <div>
                        <span className="font-bold text-sm">{t.name}</span>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-[10px] text-gray-500">Gestor: <span className="text-gray-300">{manager?.name || "Não atribuído"}</span></p>
                          {manager?.whatsapp_number && <p className="text-[10px] text-gray-600">WhatsApp: {manager.whatsapp_number}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => { setEditingTeam(t); setEditTeamName(t.name); }} className="text-[10px] bg-gray-800 px-2 py-1 rounded">Editar</button>
                        <button onClick={() => deleteTeam(t.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded">X</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VENDEDORES (GESTAO DE USUARIOS COMERCIAIS) */}
          {tab === "sellers" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                {editingUser ? (
                  <form onSubmit={addUser} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm text-blue-400">Vincular Vendedor: {editingUser.name}</h3>
                      <a href="/usuarios" className="text-[10px] text-gray-500 hover:text-white underline">Editar dados cadastrais</a>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Equipe</label>
                      <select value={userForm.team_id} onChange={e => setUserForm({...userForm, team_id: e.target.value})} className={inputCls}>
                        <option value="">Sem equipe (Inativo no roteamento)</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className={`${btnCls} bg-green-700`}>Salvar Atribuição</button>
                      <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: "", whatsapp_number: "", team_id: "", role: "seller" }); }} className={`${btnCls} border border-gray-700`}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-lg text-xs text-blue-300">
                    💡 <strong>Entidade Usuário:</strong> Todas as informações de nome, e-mail e whatsapp são gerenciadas em <strong>Configurações &gt; Usuários</strong>. Aqui você apenas atribui cada vendedor à sua equipe.
                  </div>
                )}
                {msg && tab === 'sellers' && <p className="text-[10px] text-green-400 font-bold animate-pulse mt-2">{msg}</p>}
              </div>
              <div className="space-y-2">
                {users.filter(u => u.role === 'vendedor' || u.role === 'seller').map(u => (
                  <div key={u.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-center group">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{u.name}</p>
                        <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">Vendedor</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {u.whatsapp_number ? `📞 ${u.whatsapp_number}` : "🚫 Sem WhatsApp"} • 👥 Equipe: {getName(teams, u.team_id)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingUser(u); setUserForm({ name: u.name, whatsapp_number: u.whatsapp_number || "", team_id: u.team_id || "", role: u.role }); }} className="text-[10px] bg-[hsl(var(--tenant-primary))] text-black font-bold px-3 py-1 rounded">
                        Mudar Equipe
                      </button>
                    </div>
                  </div>
                ))}
                {users.filter(u => u.role === 'vendedor' || u.role === 'seller').length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-8">Nenhum vendedor cadastrado em Usuários.</p>
                )}
              </div>
            </div>
          )}

          {/* REGRAS */}
          {tab === "rules" && (
            <div className="space-y-4">
              <div className="bg-[#0a0a0a] pb-4">
                <form onSubmit={addRule} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-4 shadow-xl">
                  <h3 className="font-bold text-sm">{editingRule ? "Editar Regra" : "Nova Regra de Roteamento"}</h3>

                  {/* Equipe + Segmento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Equipe</label>
                      <select value={ruleForm.team_id} onChange={e => setRuleForm({...ruleForm, team_id: e.target.value})} className={inputCls}>
                        <option value="">Qualquer equipe</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Segmento</label>
                      <select value={ruleForm.segment_id} onChange={e => setRuleForm({...ruleForm, segment_id: e.target.value})} className={inputCls}>
                        <option value="">Qualquer segmento</option>
                        {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Multi-select: REGIÕES */}
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                      Regiões <span className="text-gray-600 normal-case font-normal">(selecione uma ou mais)</span>
                    </label>
                    {regions.length === 0 && <p className="text-[10px] text-gray-600">Nenhuma região cadastrada</p>}
                    <div className="flex flex-wrap gap-2">
                      {regions.map(r => {
                        const sel = ruleRegionIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRuleRegionIds(toggleChip(ruleRegionIds, r.id))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              sel
                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_8px_rgba(37,99,235,0.5)]'
                                : 'bg-[#111] border-gray-700 text-gray-400 hover:border-blue-700 hover:text-blue-400'
                            }`}
                          >
                            {sel ? '✓ ' : ''}{r.name}
                            {(r.ddd_codes || []).length > 0 && <span className="ml-1 opacity-60 font-normal">({r.ddd_codes.slice(0,2).join(',')}…)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-select: PRODUTOS */}
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                      Produtos <span className="text-gray-600 normal-case font-normal">(selecione um ou mais)</span>
                    </label>
                    {products.length === 0 && <p className="text-[10px] text-gray-600">Nenhum produto cadastrado</p>}
                    <div className="flex flex-wrap gap-2">
                      {products.map(p => {
                        const sel = ruleProductIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setRuleProductIds(toggleChip(ruleProductIds, p.id))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              sel
                                ? 'bg-green-700 border-green-600 text-white shadow-[0_0_8px_rgba(21,128,61,0.5)]'
                                : 'bg-[#111] border-gray-700 text-gray-400 hover:border-green-800 hover:text-green-400'
                            }`}
                          >
                            {sel ? '✓ ' : ''}{p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-select: VENDEDORES (Roleta) */}
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      🎰 Roleta de Vendedores <span className="text-gray-600 normal-case font-normal">(leads alternados automaticamente)</span>
                    </label>
                    <p className="text-[10px] text-gray-600 mb-2">Se mais de um vendedor atende a mesma região/produto/segmento, selecione todos — o sistema fará rodízio automático.</p>
                    {users.length === 0 && <p className="text-[10px] text-gray-600">Nenhum vendedor cadastrado</p>}
                    <div className="flex flex-wrap gap-2">
                      {users.map(u => {
                        const sel = ruleSellerIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setRuleSellerIds(toggleChip(ruleSellerIds, u.id))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              sel
                                ? 'bg-purple-700 border-purple-600 text-white shadow-[0_0_8px_rgba(126,34,206,0.5)]'
                                : 'bg-[#111] border-gray-700 text-gray-400 hover:border-purple-800 hover:text-purple-400'
                            }`}
                          >
                            {sel ? `✓ ${u.name}` : u.name}
                          </button>
                        );
                      })}
                    </div>
                    {ruleSellerIds.length > 1 && (
                      <p className="text-[10px] text-purple-400 mt-2 font-bold animate-pulse">
                        🎰 {ruleSellerIds.length} vendedores em rodízio — o sistema vai alternar automaticamente
                      </p>
                    )}
                  </div>

                  {/* Prioridade e Express */}
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                        Prioridade
                        <span className="ml-2 text-gray-600 normal-case font-normal">
                          — menor número = maior prioridade
                        </span>
                      </label>
                      <input
                        type="number"
                        value={ruleForm.priority}
                        onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value) || 1})}
                        className={`${inputCls} w-full`}
                        min={1}
                      />
                    </div>
                    <div className="pb-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={ruleForm.is_express} 
                          onChange={e => setRuleForm({...ruleForm, is_express: e.target.checked})} 
                          className="w-4 h-4 accent-green-500" 
                        />
                        <span className="text-sm font-bold text-green-400 group-hover:text-green-300">Regra de Atendimento EXPRESS</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" className={`${btnCls} bg-purple-700 flex-1`}>{editingRule ? "Atualizar Regra" : "Criar Regra"}</button>
                    {editingRule && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingRule(null);
                          setRuleForm({ team_id: "", segment_id: "", priority: 1, is_express: false });
                          setRuleRegionIds([]); setRuleProductIds([]); setRuleSellerIds([]);
                        }} 
                        className={`${btnCls} border border-gray-700 flex-1`}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  {msg && tab === 'rules' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>

              {/* Barra de Filtros */}
              <div className="bg-[#111] p-4 rounded-xl border border-gray-800 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Segmento</label>
                  <select 
                    value={filterSegmentId} 
                    onChange={(e) => setFilterSegmentId(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs text-gray-300 outline-none focus:border-[#0ecab2]"
                  >
                    <option value="">Todos</option>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Equipe</label>
                  <select 
                    value={filterTeamId} 
                    onChange={(e) => setFilterTeamId(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs text-gray-300 outline-none focus:border-[#0ecab2]"
                  >
                    <option value="">Todas</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Região</label>
                  <select 
                    value={filterRegionId} 
                    onChange={(e) => setFilterRegionId(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs text-gray-300 outline-none focus:border-[#0ecab2]"
                  >
                    <option value="">Todas</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <button 
                  onClick={() => { setFilterSegmentId(""); setFilterTeamId(""); setFilterRegionId(""); }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs transition-colors h-[34px]"
                >
                  Limpar
                </button>
              </div>

              {/* LISTAGEM DE REGRAS */}
              <div className="space-y-2">
                {rules
                  .filter(r => !filterSegmentId || r.segment_id === filterSegmentId)
                  .filter(r => !filterTeamId || r.team_id === filterTeamId)
                  .filter(r => !filterRegionId || (r.region_ids && r.region_ids.includes(filterRegionId)))
                  .map(r => {
                  // Suporte a ambos os formatos (legado e novo)
                  const regionNames = (r.region_ids || []).map((rid: string) => regions.find(x => x.id === rid)?.name || rid);
                  const productNames = (r.product_ids || []).map((pid: string) => products.find(x => x.id === pid)?.name || pid);
                  const sellerNames = (r.seller_ids || []).map((sid: string) => users.find(x => x.id === sid)?.name || sid);
                  // fallback legado
                  const regionDisplay = regionNames.length > 0 ? regionNames.join(', ') : (r.region || 'Todas');
                  const productDisplay = productNames.length > 0 ? productNames.join(', ') : getName(products, r.product_id);
                  const sellerDisplay = sellerNames.length > 0 ? sellerNames : [getName(users, r.assigned_user_id)];

                  return (
                    <div key={r.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-start group">
                      <div className="flex-1 min-w-0">
                        {/* Vendedores */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {sellerDisplay.filter(Boolean).map((name: string) => (
                            <span key={name} className="text-[10px] bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded font-bold">{name}</span>
                          ))}
                          {sellerDisplay.filter(Boolean).length > 1 && (
                            <span className="text-[10px] text-purple-500 px-1">🎰 rodízio</span>
                          )}
                          {r.is_express && (
                            <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded font-bold border border-green-500/30 ml-2">EXPRESS</span>
                          )}
                        </div>
                        {/* Região e Produto */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {regionDisplay !== 'Todas' && regionDisplay.split(', ').map((n: string) => (
                            <span key={n} className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">{n}</span>
                          ))}
                          {productDisplay !== '—' && productDisplay.split(', ').map((n: string) => (
                            <span key={n} className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">{n}</span>
                          ))}
                          {getName(segments, r.segment_id) !== '—' && (
                            <span className="text-[10px] bg-orange-900/30 text-orange-400 px-1.5 py-0.5 rounded">{getName(segments, r.segment_id)}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-600">Prioridade {r.priority} • {getName(teams, r.team_id) !== '—' ? `Equipe: ${getName(teams, r.team_id)}` : 'Qualquer equipe'}</p>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <button 
                          onClick={() => duplicateRule(r)} 
                          className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-1 rounded hover:bg-blue-900"
                          title="Duplicar esta regra"
                        >
                          Duplicar
                        </button>
                        <button 
                          onClick={() => {
                            setEditingRule(r);
                            setRuleForm({
                              team_id: r.team_id || "",
                              segment_id: r.segment_id || "",
                              priority: r.priority || 1,
                              is_express: r.is_express || false
                            });
                            setRuleRegionIds(r.region_ids || []);
                            setRuleProductIds(r.product_ids || []);
                            setRuleSellerIds(r.seller_ids || []);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          className="text-[10px] bg-gray-800 px-2 py-1 rounded"
                        >
                          Editar
                        </button>
                        <button onClick={() => deleteRule(r.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded">X</button>
                      </div>
                    </div>
                  );
                })}
                {rules
                  .filter(r => !filterSegmentId || r.segment_id === filterSegmentId)
                  .filter(r => !filterTeamId || r.team_id === filterTeamId)
                  .filter(r => !filterRegionId || (r.region_ids && r.region_ids.includes(filterRegionId)))
                  .length === 0 && (
                    <p className="text-gray-600 text-xs text-center py-8 bg-[#111] rounded-xl border border-dashed border-gray-800">
                      Nenhuma regra encontrada com os filtros selecionados.
                    </p>
                  )
                }
              </div>
            </div>
          )}
          {/* CÉREBRO IA */}
          {tab === "cerebro" && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <h3 className="font-bold text-lg">Prompt do Lino Suporte</h3>
                    <p className="text-xs text-gray-500">Define como a IA deve se comportar após o lead ser entregue ao vendedor.</p>
                  </div>
                </div>
                
                <textarea 
                  value={supportPrompt} 
                  onChange={e => setSupportPrompt(e.target.value)}
                  className={`${inputCls} h-40 resize-none font-mono text-[13px] leading-relaxed mb-4`}
                  placeholder="Ex: Você é o Lino Suporte da Permetal. Seja empático e ajude o cliente enquanto o vendedor não chega..."
                />

                <div className="border-t border-gray-800 pt-6 mt-6">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🕒</span>
                    <div>
                      <h3 className="font-bold text-lg">Regras de SLA e Escalação</h3>
                      <p className="text-xs text-gray-500">Configure os tempos de resposta e gatilhos de supervisão.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Tempo Máximo de Espera (Horas)</label>
                        <input 
                          type="number" 
                          value={slaRules.max_wait_hours} 
                          onChange={e => setSlaRules({...slaRules, max_wait_hours: parseInt(e.target.value)})}
                          className={inputCls}
                        />
                        <p className="text-[10px] text-gray-600 mt-1">Tempo total antes de escalar para o supervisor.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Intervalo de Cobrança (Minutos)</label>
                        <input 
                          type="number" 
                          value={slaRules.retry_interval_minutes} 
                          onChange={e => setSlaRules({...slaRules, retry_interval_minutes: parseInt(e.target.value)})}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Máximo de Notificações ao Vendedor</label>
                        <input 
                          type="number" 
                          value={slaRules.seller_notify_max} 
                          onChange={e => setSlaRules({...slaRules, seller_notify_max: parseInt(e.target.value)})}
                          className={inputCls}
                        />
                        <p className="text-[10px] text-gray-600 mt-1">Quantas vezes o Lino deve "cutucar" o vendedor.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Intervalo entre Notificações (Minutos)</label>
                        <input 
                          type="number" 
                          value={slaRules.seller_notify_interval_minutes} 
                          onChange={e => setSlaRules({...slaRules, seller_notify_interval_minutes: parseInt(e.target.value)})}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                  <button 
                    onClick={saveCerebro} 
                    disabled={savingCerebro}
                    className={`${btnCls} bg-[hsl(var(--tenant-primary))] text-black text-base py-3 shadow-lg shadow-primary/20 flex items-center justify-center gap-2`}
                  >
                    {savingCerebro ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                        Salvando...
                      </>
                    ) : "Salvar Configurações do Cérebro"}
                  </button>
                  {msg && <p className="text-center text-sm text-green-400 font-bold mt-4 animate-bounce">{msg}</p>}
                </div>
              </div>

              <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-lg text-xs text-blue-300 leading-relaxed">
                <strong>💡 Como funciona:</strong> O Lino SDR qualifica o lead usando o Master Prompt e as Skills. Assim que o vendedor é atribuído, o sistema entra em modo de <strong>Monitoramento de Suporte</strong>. A IA passa a usar este Prompt de Suporte para manter o cliente engajado enquanto o vendedor não inicia o atendimento humano.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
