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

  // Forms
  const [regionForm, setRegionForm] = useState({ name: "", ddd_codes: "" });
  const [productForm, setProductForm] = useState({ name: "", synonyms: "", brand_id: "", express_max_qty: "", is_express_eligible: false });
  const [segmentForm, setSegmentForm] = useState({ name: "", keywords: "", collection_type: "normal" });
  const [teamForm, setTeamForm] = useState("");
  const [userForm, setUserForm] = useState({ name: "", whatsapp_number: "", team_id: "", role: "seller" });
  const [ruleForm, setRuleForm] = useState({ team_id: "", segment_id: "", priority: 1 });
  const [ruleRegionIds, setRuleRegionIds] = useState<string[]>([]);
  const [ruleProductIds, setRuleProductIds] = useState<string[]>([]);
  const [ruleSellerIds, setRuleSellerIds] = useState<string[]>([]);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);

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
    setLoading(false);
  }

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }
  function getName(list: any[], id: string) { return list.find(i => i.id === id)?.name || "—"; }

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
    const payload: any = { name: productForm.name, synonyms: syns, is_express_eligible: productForm.is_express_eligible, express_max_qty: productForm.express_max_qty || null };
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
    
    setProductForm({ name: "", synonyms: "", brand_id: "", express_max_qty: "", is_express_eligible: false }); 
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
    if (!teamForm.trim()) return;
    await supabase.from("teams").insert([{ name: teamForm }]);
    setTeamForm(""); flash("✔ Equipe criada!"); loadAll();
  }
  async function saveTeamEdit() {
    if (!editingTeam) return;
    await supabase.from("teams").update({ name: editTeamName }).eq("id", editingTeam.id);
    setEditingTeam(null); flash("✔ Renomeada!"); loadAll();
  }
  async function deleteTeam(id: string) {
    if (!confirm("Excluir equipe?")) return;
    await supabase.from("teams").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  // USERS
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
      flash("✔ Vendedor atualizado!");
    } else {
      const { error } = await supabase.from("admin_users").insert([payload]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Vendedor cadastrado!");
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
      region_ids: ruleRegionIds,
      product_ids: ruleProductIds,
      seller_ids: ruleSellerIds,
      last_seller_index: 0,
    };
    if (ruleForm.team_id) payload.team_id = ruleForm.team_id;
    if (ruleForm.segment_id) payload.segment_id = ruleForm.segment_id;
    const { error } = await supabase.from("routing_rules").insert([payload]);
    if (error) { flash("Erro: " + error.message); return; }
    setRuleForm({ team_id: "", segment_id: "", priority: 1 });
    setRuleRegionIds([]); setRuleProductIds([]); setRuleSellerIds([]);
    flash("✔ Regra criada!"); loadAll();
  }
  async function deleteRule(id: string) {
    if (!confirm("Excluir regra?")) return;
    await supabase.from("routing_rules").delete().eq("id", id); flash("✔ Excluída!"); loadAll();
  }

  const inputCls = "w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-[hsl(var(--tenant-primary))]";
  const btnCls = "w-full py-2 rounded font-bold text-sm hover:opacity-90";

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-3xl font-bold">Regras Comerciais</h2>
        <p className="text-gray-400 mt-1 text-sm">Regiões, produtos, segmentos, equipes e regras de roteamento.</p>
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
                  <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Nome do produto" className={inputCls} required />
                  <input type="text" value={productForm.synonyms} onChange={e => setProductForm({...productForm, synonyms: e.target.value})} placeholder="Sinônimos separados por vírgula" className={inputCls} />
                  <select value={productForm.brand_id} onChange={e => setProductForm({...productForm, brand_id: e.target.value})} className={inputCls}>
                    <option value="">Marca (automática)</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <div className="flex gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={productForm.is_express_eligible} onChange={e => setProductForm({...productForm, is_express_eligible: e.target.checked})} className="accent-green-500" />
                      Elegível para EXPRESS
                    </label>
                  </div>
                  {productForm.is_express_eligible && (
                    <input type="text" value={productForm.express_max_qty} onChange={e => setProductForm({...productForm, express_max_qty: e.target.value})} placeholder="Qtd máx EXPRESS (ex: até 10 peças ou 20m2)" className={inputCls} />
                  )}
                  <div className="flex gap-3">
                    <button type="submit" className={`${btnCls} bg-green-700 flex-1`}>{editingProduct ? "Atualizar Produto" : "+ Criar Produto"}</button>
                    {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setProductForm({ name: "", synonyms: "", brand_id: "", express_max_qty: "", is_express_eligible: false }); }} className={`${btnCls} border border-gray-700 flex-1`}>Cancelar</button>}
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
                        {p.is_express_eligible && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">EXPRESS</span>}
                      </div>
                      {(p.synonyms || []).length > 0 && <p className="text-[10px] text-gray-500 mt-1">Sinônimos: {p.synonyms.join(", ")}</p>}
                      {p.express_max_qty && <p className="text-[10px] text-yellow-500 mt-0.5">Limite: {p.express_max_qty}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 ml-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(p);
                          setProductForm({
                            name: p.name,
                            synonyms: (p.synonyms || []).join(", "),
                            brand_id: p.brand_id || "",
                            express_max_qty: p.express_max_qty || "",
                            is_express_eligible: p.is_express_eligible || false
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
                <form onSubmit={addTeam} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 flex gap-2 shadow-xl">
                  <input type="text" value={teamForm} onChange={e => setTeamForm(e.target.value)} placeholder="Nome da equipe" className={`flex-1 ${inputCls}`} required />
                  <button type="submit" className="bg-blue-600 px-4 rounded font-bold text-sm">+</button>
                </form>
                {msg && tab === 'teams' && <p className="text-[10px] text-green-400 font-bold animate-pulse mt-2">{msg}</p>}
              </div>
              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-center group">
                    {editingTeam?.id === t.id ? (
                      <div className="flex gap-2 flex-1">
                        <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} className={`flex-1 ${inputCls}`} autoFocus />
                        <button onClick={saveTeamEdit} className="text-xs bg-green-800 px-2 rounded text-green-300">Salvar</button>
                        <button onClick={() => setEditingTeam(null)} className="text-xs bg-gray-800 px-2 rounded">X</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-sm">{t.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => { setEditingTeam(t); setEditTeamName(t.name); }} className="text-[10px] bg-gray-800 px-2 py-1 rounded">Editar</button>
                          <button onClick={() => deleteTeam(t.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded">X</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VENDEDORES */}
          {tab === "sellers" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addUser} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm">{editingUser ? "Editar Vendedor" : "Novo Vendedor"}</h3>
                  <input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="Nome" className={inputCls} required />
                  <input type="text" value={userForm.whatsapp_number} onChange={e => setUserForm({...userForm, whatsapp_number: e.target.value})} placeholder="WhatsApp (5511...)" className={inputCls} required />
                  <select value={userForm.team_id} onChange={e => setUserForm({...userForm, team_id: e.target.value})} className={inputCls}>
                    <option value="">Sem equipe</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className={inputCls}>
                    <option value="seller">Vendedor</option>
                    <option value="manager">Gestor</option>
                  </select>
                  <button type="submit" className={`${btnCls} bg-green-700`}>{editingUser ? "Atualizar" : "Cadastrar"}</button>
                  {editingUser && <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: "", whatsapp_number: "", team_id: "", role: "seller" }); }} className={`${btnCls} border border-gray-700`}>Cancelar</button>}
                  {msg && tab === 'sellers' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-800 flex justify-between items-center group">
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-[10px] text-gray-500">{u.whatsapp_number} • {getName(teams, u.team_id)} • {u.role}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingUser(u); setUserForm({ name: u.name, whatsapp_number: u.whatsapp_number, team_id: u.team_id || "", role: u.role }); }} className="text-[10px] bg-gray-800 px-2 py-1 rounded">Editar</button>
                      <button onClick={() => deleteUser(u.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded">X</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REGRAS */}
          {tab === "rules" && (
            <div className="space-y-4">
              <div className="sticky top-[80px] z-10 bg-[#0a0a0a] pb-4">
                <form onSubmit={addRule} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 space-y-4 shadow-xl">
                  <h3 className="font-bold text-sm">Nova Regra de Roteamento</h3>

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

                  {/* Prioridade */}
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Prioridade
                      <span className="ml-2 text-gray-600 normal-case font-normal">
                        — menor número = maior prioridade (1 = primeira a ser testada)
                      </span>
                    </label>
                    <input
                      type="number"
                      value={ruleForm.priority}
                      onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value) || 1})}
                      className={`${inputCls} w-24`}
                      min={1}
                    />
                  </div>

                  <button type="submit" className={`${btnCls} bg-purple-700`}>Criar Regra</button>
                  {msg && tab === 'rules' && <p className="text-[10px] text-green-400 font-bold animate-pulse">{msg}</p>}
                </form>
              </div>

              {/* LISTAGEM DE REGRAS */}
              <div className="space-y-2">
                {rules.map(r => {
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
                      <button onClick={() => deleteRule(r.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded opacity-0 group-hover:opacity-100 ml-2 shrink-0">X</button>
                    </div>
                  );
                })}
                {rules.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Nenhuma regra cadastrada</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
