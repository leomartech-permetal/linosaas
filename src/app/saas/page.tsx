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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [cfgRes, instRes, usersRes] = await Promise.all([
      supabase.from("tenant_config").select("*").limit(1).single(),
      supabase.from("instances").select("*").order("created_at"),
      supabase.from("users").select("*").order("name"),
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
    if (!instForm.name) return;
    const payload: any = { name: instForm.name, phone_number: instForm.phone_number, evolution_instance_name: instForm.evolution_instance_name, evolution_url: instForm.evolution_url, evolution_key: instForm.evolution_key };
    if (instForm.assigned_user_id) payload.assigned_user_id = instForm.assigned_user_id;
    const { error } = await supabase.from("instances").insert([payload]);
    if (error) { flash("Erro: " + error.message); return; }
    setInstForm({ name: "", phone_number: "", evolution_instance_name: "", evolution_url: "", evolution_key: "", assigned_user_id: "" });
    setShowInstForm(false);
    flash("✔ Instância criada!");
    loadAll();
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
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">Configurações SaaS</h2>
          <p className="text-gray-400 mt-2">Personalize a marca, gerencie conexões e segurança.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={async () => {
              const newState = !botActive;
              setBotActive(newState);
              await supabase.from("tenant_config").update({ bot_active: newState }).neq("id", "0");
              flash(newState ? "🤖 Lino ATIVADO!" : "💤 Lino DESATIVADO!");
            }}
            className={`px-4 py-2 font-bold rounded shadow transition text-sm ${botActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-gray-300'}`}
          >
            {botActive ? '🤖 Lino está ON' : '💤 Lino está OFF'}
          </button>
          <button 
            onClick={async () => {
              if (confirm('Tem certeza que deseja apagar o histórico de testes do número 5516991415319?')) {
                const res = await fetch('/api/test/clear-history', {
                  method: 'POST',
                  body: JSON.stringify({ phone: '5516991415319' }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) alert('Histórico apagado! O Lino vai iniciar uma nova conversa no próximo Oi.');
                else alert('Erro ao apagar histórico.');
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow transition text-sm"
          >
            🗑️ Zerar Histórico de Testes (Meu Número)
          </button>
        </div>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm font-bold">{msg}</div>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="space-y-8">

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* IDENTIDADE VISUAL */}
            <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
              <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-[hsl(var(--tenant-primary))] w-2 h-5 mr-2 rounded-sm"></span>Identidade Visual</h3>
              <form onSubmit={saveDesign} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome da Empresa</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Subtítulo</label>
                  <input type="text" value={companySubtitle} onChange={(e) => setCompanySubtitle(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL da Logomarca (PNG/SVG)</label>
                  <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://seusite.com/logo.png" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 h-12 object-contain bg-black rounded p-1" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cor Primária</label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-black border-none" />
                      <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cor Secundária</label>
                    <div className="flex gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-black border-none" />
                      <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo de Fundo</label>
                  <select value={bgType} onChange={(e) => setBgType(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                    <option value="solid">Cor Sólida</option>
                    <option value="gradient">Degradê</option>
                    <option value="texture">Textura Metálica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Opacidade ({Math.round(bgOpacity * 100)}%)</label>
                  <input type="range" min="0" max="1" step="0.05" value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--tenant-primary))]" />
                </div>
                {/* Preview */}
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <p className="text-[10px] text-gray-500 px-3 pt-2">Pré-visualização:</p>
                  <div className="h-20 m-2 rounded flex items-center justify-center text-sm font-bold" style={{
                    background: bgType === "solid" ? bgColor1 : bgType === "gradient" ? `linear-gradient(135deg, ${bgColor1}, ${bgColor2})` : "#0a0a0a",
                    color: primaryColor, opacity: bgOpacity + 0.5,
                  }}>
                    {logoUrl ? <img src={logoUrl} alt="" className="h-10 object-contain mr-2" /> : null}
                    {companyName || "LINO CRM"}
                  </div>
                </div>
                <button type="submit" className="w-full bg-[hsl(var(--tenant-primary))] py-2 rounded font-bold text-black hover:opacity-90">Aplicar Design</button>
              </form>
            </div>

            <div className="space-y-6">
              {/* CHAVES API */}
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
                <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-orange-500 w-2 h-5 mr-2 rounded-sm"></span>Chaves de API (Globais)</h3>
                <form onSubmit={saveAPI} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Evolution API — URL Base</label>
                    <input type="url" value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="https://evolution.sua-vps.com" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Evolution API — Token Global</label>
                    <input type="password" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} placeholder="Chave da Evolution" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Evolution API — Nome da Instância</label>
                    <input type="text" value={evolutionInstanceName} onChange={(e) => setEvolutionInstanceName(e.target.value)} placeholder="Ex: minha_instancia" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">OpenAI API Key</label>
                    <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-orange-600 py-2 rounded font-bold text-white hover:bg-orange-700">Salvar Credenciais</button>
                </form>
              </div>

              {/* SENHA */}
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
                <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-red-500 w-2 h-5 mr-2 rounded-sm"></span>Senha de Acesso</h3>
                <form onSubmit={savePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">E-mail do Usuário</label>
                    <input type="email" value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} placeholder="admin@lino.com" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nova Senha</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  </div>
                  <button type="submit" className="w-full bg-red-700 py-2 rounded font-bold text-white hover:bg-red-800">Atualizar Senha</button>
                </form>
              </div>
            </div>
          </div>

          {/* INSTÂNCIAS EVOLUTION */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center"><span className="bg-green-500 w-2 h-5 mr-2 rounded-sm"></span>Instâncias WhatsApp ({instances.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Cada celular de vendedor é uma instância da Evolution API que recebe mensagens no sistema.</p>
              </div>
              <button onClick={() => setShowInstForm(!showInstForm)} className="bg-green-700 px-4 py-2 rounded text-sm font-bold hover:bg-green-800">+ Nova Instância</button>
            </div>

            {/* Form nova instância */}
            {showInstForm && (
              <div className="bg-black p-4 rounded-lg border border-gray-700 mb-4">
                <h4 className="font-bold text-sm mb-3">Cadastrar Nova Instância</h4>
                <form onSubmit={addInstance} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Nome da Instância *</label>
                    <input type="text" value={instForm.name} onChange={(e) => setInstForm({ ...instForm, name: e.target.value })} placeholder="Ex: Celular Vendas SP" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Número do WhatsApp</label>
                    <input type="text" value={instForm.phone_number} onChange={(e) => setInstForm({ ...instForm, phone_number: e.target.value })} placeholder="5511999999999" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Nome da Instância na Evolution</label>
                    <input type="text" value={instForm.evolution_instance_name} onChange={(e) => setInstForm({ ...instForm, evolution_instance_name: e.target.value })} placeholder="Ex: permetal_sp" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Vendedor Responsável</label>
                    <select value={instForm.assigned_user_id} onChange={(e) => setInstForm({ ...instForm, assigned_user_id: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none">
                      <option value="">Nenhum (distribuição automática)</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">URL da Evolution (se diferente da global)</label>
                    <input type="url" value={instForm.evolution_url} onChange={(e) => setInstForm({ ...instForm, evolution_url: e.target.value })} placeholder="https://..." className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Token da Evolution (se diferente)</label>
                    <input type="password" value={instForm.evolution_key} onChange={(e) => setInstForm({ ...instForm, evolution_key: e.target.value })} placeholder="Token específico" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="flex-1 bg-green-700 py-2 rounded font-bold text-sm hover:bg-green-800">Criar Instância</button>
                    <button type="button" onClick={() => setShowInstForm(false)} className="flex-1 border border-gray-700 py-2 rounded text-sm hover:bg-gray-800">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de instâncias */}
            <div className="space-y-2">
              {instances.map(inst => (
                <div key={inst.id} className={`bg-black p-4 rounded border border-gray-800 flex justify-between items-center group ${!inst.active ? "opacity-50" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${inst.active ? "bg-green-400" : "bg-red-400"}`}></span>
                      <h4 className="font-bold text-sm">{inst.name}</h4>
                      {!inst.active && <span className="text-[10px] text-red-400">(offline)</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      📱 {inst.phone_number || "—"} • Evolution: {inst.evolution_instance_name || "—"} • Vendedor: {getUserName(inst.assigned_user_id)}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleInstance(inst)} className={`text-[10px] px-2 py-1 rounded ${inst.active ? "bg-yellow-900/50 text-yellow-400" : "bg-green-900/50 text-green-400"}`}>
                      {inst.active ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => deleteInstance(inst.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">Excluir</button>
                  </div>
                </div>
              ))}
              {instances.length === 0 && !showInstForm && (
                <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-600 text-sm">
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
