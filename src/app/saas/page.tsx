"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SaaSPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form identidade
  const [companyName, setCompanyName] = useState("");
  const [companySubtitle, setCompanySubtitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ecab2");
  const [secondaryColor, setSecondaryColor] = useState("#087f71");
  const [bgType, setBgType] = useState("texture");
  const [bgColor1, setBgColor1] = useState("#0a0a0a");
  const [bgColor2, setBgColor2] = useState("#1a1a1a");
  const [bgOpacity, setBgOpacity] = useState(0.2);
  const [logoUrl, setLogoUrl] = useState("");
  const [textureUrl, setTextureUrl] = useState("");
  const [fontHeading, setFontHeading] = useState("Roboto Condensed");
  const [fontBody, setFontBody] = useState("Assistant");

  // API
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [botActive, setBotActive] = useState(true);

  // Senha
  const [passwordEmail, setPasswordEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Instâncias
  const [instances, setInstances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [instForm, setInstForm] = useState({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" });
  const [showInstForm, setShowInstForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState<any>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [cfgRes, instRes, usersRes] = await Promise.all([
      supabase.from("tenant_config").select("*").limit(1).single(),
      supabase.from("instances").select("*").order("created_at"),
      supabase.from("admin_users").select("*").order("name"),
    ]);
    if (cfgRes.data) {
      const d = cfgRes.data;
      setConfig(d);
      setCompanyName(d.company_name || "");
      setCompanySubtitle(d.company_subtitle || "");
      setPrimaryColor(d.primary_color || "#0ecab2");
      setSecondaryColor(d.secondary_color || "#087f71");
      setBgType(d.bg_type || "texture");
      setBgColor1(d.bg_color1 || "#0a0a0a");
      setBgColor2(d.bg_color2 || "#1a1a1a");
      setBgOpacity(d.bg_opacity || 0.2);
      setLogoUrl(d.logo_url || "");
      setTextureUrl(d.texture_url || "");
      setFontHeading(d.font_heading || "Roboto Condensed");
      setFontBody(d.font_body || "Assistant");
      setEvolutionUrl(d.evolution_url || "");
      setEvolutionKey(d.evolution_key || "");
      setEvolutionInstanceName(d.evolution_instance_name || "");
      setOpenaiKey(d.openai_key || "");
      setBotActive(d.bot_active !== false); // Default to true if undefined
    }
    if (instRes.data) setInstances(instRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 4000); }

  async function saveDesign(e: React.FormEvent) {
    e.preventDefault();
    if (!config) { flash("Erro: configuração não encontrada no banco."); return; }
    const { error } = await supabase.from("tenant_config").update({
      company_name: companyName, company_subtitle: companySubtitle,
      primary_color: primaryColor, secondary_color: secondaryColor,
      bg_type: bgType, bg_color1: bgColor1, bg_color2: bgColor2,
      bg_opacity: bgOpacity, logo_url: logoUrl, texture_url: textureUrl,
      font_heading: fontHeading, font_body: fontBody,
    }).eq("id", config.id);
    if (error) { flash("Erro: " + error.message); return; }
    flash("✔ Design aplicado com sucesso! Recarregue para ver as mudanças.");
  }

  async function saveAPI(e: React.FormEvent) {
    e.preventDefault();
    if (!config) { flash("Erro: configuração não encontrada."); return; }
    const { error } = await supabase.from("tenant_config").update({
      evolution_url: evolutionUrl, evolution_key: evolutionKey, evolution_instance_name: evolutionInstanceName, openai_key: openaiKey,
    }).eq("id", config.id);
    if (error) { flash("Erro: " + error.message); return; }
    flash("✔ Credenciais salvas com sucesso!");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordEmail || !newPassword) { flash("Preencha o e-mail e a nova senha."); return; }
    const { data, error } = await supabase.from("admin_users").update({ password: newPassword }).eq("email", passwordEmail).select();
    if (error) { flash("Erro: " + error.message); return; }
    if (!data || data.length === 0) { flash("Nenhum usuário encontrado com este e-mail."); return; }
    setPasswordEmail("");
    setNewPassword("");
    flash("✔ Senha atualizada! Use a nova senha no próximo login.");
  }

  // === INSTÂNCIAS ===
  async function addInstance(e: React.FormEvent) {
    e.preventDefault();
    console.log("Iniciando salvamento de instância...", instForm);
    if (!instForm.name) { flash("Erro: nome da instância é obrigatório."); return; }
    
    const payload: any = { 
      name: instForm.name, 
      phone_number: instForm.phone_number || null, 
      evolution_instance_name: instForm.evolution_instance_name || null, 
      evolution_url: instForm.evolution_url || null, 
      evolution_key: instForm.evolution_key || null 
    };
    
    if (instForm.assigned_user_id) payload.assigned_user_id = instForm.assigned_user_id;
    else payload.assigned_user_id = null;
    
    try {
      if (editingInstance) {
        const { error } = await supabase.from("instances").update(payload).eq("id", editingInstance.id);
        console.log("Resultado Update:", { error, payload });
        if (error) { flash("Erro ao atualizar: " + error.message); return; }
        setEditingInstance(null);
        flash("✔ Instância atualizada!");
      } else {
        const { error } = await supabase.from("instances").insert([payload]);
        console.log("Resultado Insert:", { error, payload });
        if (error) { flash("Erro ao criar: " + error.message); return; }
        flash("✔ Instância criada!");
      }
      
      setInstForm({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" });
      setShowInstForm(false);
      loadAll();
    } catch (err: any) {
      console.error("Erro crítico no salvamento:", err);
      flash("Erro crítico: " + err.message);
    }
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

  async function toggleInstance(inst: any) {
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

  function getUserName(id: string) { return users.find(u => u.id === id)?.name || "—"; }

  return (
    <div className="p-6 md:p-10 w-full h-full text-[#171717] overflow-y-auto">
      <header className="sticky top-[-40px] z-20 bg-[#FAFAFA] pt-10 mb-8 border-b border-[#EAEAEA] pb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#171717]">Configurações SaaS</h2>
          <p className="text-[#666666] mt-2">Personalize a marca, gerencie conexões e segurança.</p>
        </div>
        <div className="flex flex-row md:flex-col lg:flex-row gap-3 w-full md:w-auto">
          <button 
            onClick={async () => {
              const newState = !botActive;
              setBotActive(newState);
              await supabase.from("tenant_config").update({ bot_active: newState }).neq("id", "0");
              flash(newState ? "🤖 Lino ATIVADO!" : "💤 Lino DESATIVADO!");
            }}
            className={`flex-1 md:flex-none px-4 py-2.5 font-semibold rounded-md shadow-sm transition-colors text-sm ${botActive ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700'}`}
          >
            {botActive ? '🤖 Lino está ON' : '💤 Lino está OFF'}
          </button>
          <button 
            onClick={async () => {
              if (confirm('Tem certeza que deseja apagar o histórico de testes do número 5516991415319?')) {
                const res = await fetch('/api/test/clear-history', {
                  method: 'POST',
                  body: JSON.stringify({ whatsapp_number: '5516991415319' }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) alert('Histórico apagado! O Lino vai iniciar uma nova conversa no próximo Oi.');
                else alert('Erro ao apagar histórico.');
              }
            }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold rounded-md shadow-sm transition-colors text-sm"
          >
            🗑️ Zerar Histórico de Testes
          </button>
        </div>
      </header>

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="space-y-8">

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl">
            {/* IDENTIDADE VISUAL */}
            <div className="bg-white p-6 rounded-lg border border-[#EAEAEA] shadow-sm">
              <h3 className="text-lg font-bold text-[#171717] mb-5 flex items-center">
                <span className="w-1.5 h-5 bg-black rounded-full mr-2.5"></span>Identidade Visual
              </h3>
              <form onSubmit={saveDesign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#666666] mb-1.5">Nome da Empresa</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#666666] mb-1.5">Subtítulo</label>
                  <input type="text" value={companySubtitle} onChange={(e) => setCompanySubtitle(e.target.value)} className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#666666] mb-1.5">URL da Logomarca (PNG/SVG)</label>
                  <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://seusite.com/logo.png" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  {logoUrl && (
                    <div className="mt-3 p-2 bg-neutral-50 rounded-lg border border-[#EAEAEA] inline-block">
                      <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Cor Primária (Tema)</label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded-md cursor-pointer border border-[#EAEAEA]" />
                      <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 bg-white border border-[#EAEAEA] text-[#171717] rounded-md px-3 py-2 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Cor Secundária</label>
                    <div className="flex gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-10 rounded-md cursor-pointer border border-[#EAEAEA]" />
                      <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 bg-white border border-[#EAEAEA] text-[#171717] rounded-md px-3 py-2 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Fonte Títulos</label>
                    <select value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors">
                      <option value="Roboto Condensed">Roboto Condensed</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Inter">Inter</option>
                      <option value="Oswald">Oswald</option>
                      <option value="Poppins">Poppins</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Fonte Corpo</label>
                    <select value={fontBody} onChange={(e) => setFontBody(e.target.value)} className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors">
                      <option value="Assistant">Assistant</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Lato">Lato</option>
                      <option value="Inter">Inter</option>
                    </select>
                  </div>
                </div>
                
                {/* Preview de Marca */}
                <div className="border border-[#EAEAEA] rounded-lg overflow-hidden bg-[#FAFAFA] p-4 mt-2">
                  <p className="text-[10px] uppercase font-bold text-[#888888] mb-2 tracking-wider">Visualização da Marca:</p>
                  <div className="h-16 rounded-md flex items-center justify-center text-sm font-bold shadow-sm" style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #EAEAEA',
                    color: primaryColor,
                  }}>
                    {logoUrl ? <img src={logoUrl} alt="" className="h-10 object-contain" /> : companyName}
                  </div>
                </div>
                <button type="submit" className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 rounded-md font-semibold text-sm transition-colors shadow-sm">Aplicar Identidade</button>
              </form>
            </div>

            <div className="space-y-6">
              {/* CHAVES API */}
              <div className="bg-white p-6 rounded-lg border border-[#EAEAEA] shadow-sm">
                <h3 className="text-lg font-bold text-[#171717] mb-5 flex items-center">
                  <span className="w-1.5 h-5 bg-[#0070F3] rounded-full mr-2.5"></span>Chaves de API (Globais)
                </h3>
                <form onSubmit={saveAPI} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Evolution API — URL Base</label>
                    <input type="url" value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="https://evolution.sua-vps.com" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Evolution API — Token Global</label>
                    <input type="password" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} placeholder="Chave da Evolution" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Evolution API — Nome da Instância</label>
                    <input type="text" value={evolutionInstanceName} onChange={(e) => setEvolutionInstanceName(e.target.value)} placeholder="Ex: minha_instancia" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">OpenAI API Key</label>
                    <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <button type="submit" className="w-full bg-black text-white hover:bg-neutral-800 py-2.5 rounded-md font-semibold text-sm transition-colors shadow-sm">Salvar Credenciais</button>
                </form>
              </div>

              {/* SENHA */}
              <div className="bg-white p-6 rounded-lg border border-[#EAEAEA] shadow-sm">
                <h3 className="text-lg font-bold text-[#171717] mb-5 flex items-center">
                  <span className="w-1.5 h-5 bg-[#E5484D] rounded-full mr-2.5"></span>Senha de Acesso
                </h3>
                <form onSubmit={savePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">E-mail do Usuário</label>
                    <input type="email" value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} placeholder="admin@lino.com" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Nova Senha</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" required />
                  </div>
                  <button type="submit" className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 py-2.5 rounded-md font-semibold text-sm transition-colors shadow-sm">Atualizar Senha</button>
                </form>
              </div>
            </div>
          </div>

          {/* INSTÂNCIAS EVOLUTION */}
          <div className="bg-white p-6 rounded-lg border border-[#EAEAEA] shadow-sm max-w-7xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#171717] flex items-center">
                  <span className="w-1.5 h-5 bg-emerald-500 rounded-full mr-2.5"></span>Instâncias WhatsApp ({instances.length})
                </h3>
                <p className="text-xs text-[#666666] mt-1.5">Cada celular de vendedor é uma instância da Evolution API que recebe mensagens no sistema.</p>
              </div>
              <button 
                onClick={() => setShowInstForm(!showInstForm)} 
                className="bg-black hover:bg-neutral-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
              >
                + Nova Instância
              </button>
            </div>

            {/* Form nova instância */}
            {showInstForm && (
              <div className="bg-[#FAFAFA] p-6 rounded-lg border border-[#EAEAEA] mb-6 animate-slide-down">
                <h4 className="font-bold text-sm text-[#171717] mb-4">{editingInstance ? "Editar Instância" : "Cadastrar Nova Instância"}</h4>
                <form onSubmit={addInstance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Nome da Instância *</label>
                    <input type="text" value={instForm.name} onChange={(e) => setInstForm({ ...instForm, name: e.target.value })} placeholder="Ex: Celular Vendas SP" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Número do WhatsApp</label>
                    <input type="text" value={instForm.phone_number} onChange={(e) => setInstForm({ ...instForm, phone_number: e.target.value })} placeholder="5511999999999" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Nome da Instância na Evolution</label>
                    <input type="text" value={instForm.evolution_instance_name} onChange={(e) => setInstForm({ ...instForm, evolution_instance_name: e.target.value })} placeholder="Ex: permetal_sp" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Vendedor Responsável</label>
                    <select value={instForm.assigned_user_id} onChange={(e) => setInstForm({ ...instForm, assigned_user_id: e.target.value })} className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors">
                      <option value="">Nenhum (distribuição automática)</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">URL da Evolution (se diferente da global)</label>
                    <input type="url" value={instForm.evolution_url} onChange={(e) => setInstForm({ ...instForm, evolution_url: e.target.value })} placeholder="https://..." className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#666666] mb-1.5">Token da Evolution (se diferente)</label>
                    <input type="password" value={instForm.evolution_key} onChange={(e) => setInstForm({ ...instForm, evolution_key: e.target.value })} placeholder="Token específico" className="w-full bg-white border border-[#EAEAEA] text-[#171717] rounded-md p-2.5 text-sm outline-none focus:border-[#A1A1AA] transition-colors" />
                  </div>
                  <div className="md:col-span-2 flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-md font-semibold text-white transition-colors shadow-sm">{editingInstance ? "Salvar Alterações" : "Criar Instância"}</button>
                    <button type="button" onClick={() => { setShowInstForm(false); setEditingInstance(null); setInstForm({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" }); }} className="flex-1 border border-[#D4D4D8] text-[#171717] bg-white hover:bg-[#F1F5F9] py-2.5 rounded-md text-sm font-semibold transition-colors">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de instâncias */}
            <div className="space-y-3">
              {instances.map(inst => (
                <div key={inst.id} className={`bg-white p-4 rounded-lg border border-[#EAEAEA] flex justify-between items-center group shadow-sm hover:shadow-md transition-all ${!inst.active ? "opacity-60" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${inst.active ? "bg-emerald-500 shadow-[0_0_6px_#10B981]" : "bg-red-500"}`}></span>
                      <h4 className="font-bold text-sm text-[#171717]">{inst.name}</h4>
                      {!inst.active && <span className="text-[10px] text-red-500 font-medium">(offline)</span>}
                    </div>
                    <p className="text-xs text-[#666666] mt-1.5">
                      📱 {inst.phone_number || "—"} • Evolution: {inst.evolution_instance_name || "—"} • Vendedor: {getUserName(inst.assigned_user_id)}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => startEditInstance(inst)} 
                      className="text-[10px] bg-white text-[#171717] border border-[#D4D4D8] px-2.5 py-1 rounded-md font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => toggleInstance(inst)} 
                      className={`text-[10px] px-2.5 py-1 rounded-md font-semibold border ${inst.active ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"} transition-colors`}
                    >
                      {inst.active ? "Desativar" : "Ativar"}
                    </button>
                    <button 
                      onClick={() => deleteInstance(inst.id)} 
                      className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-md font-semibold hover:bg-red-100 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
              {instances.length === 0 && !showInstForm && (
                <div className="border border-dashed border-[#EAEAEA] rounded-lg p-8 text-center text-gray-500 text-sm">
                  Nenhuma instância cadastrada. Clique em &quot;+ Nova Instância&quot; acima.
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
