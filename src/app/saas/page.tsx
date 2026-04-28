"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SaaSPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form
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
  const [openaiKey, setOpenaiKey] = useState("");

  // Senha
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    setLoading(true);
    const { data } = await supabase.from("tenant_config").select("*").limit(1).single();
    if (data) {
      setConfig(data);
      setCompanyName(data.company_name || "");
      setCompanySubtitle(data.company_subtitle || "");
      setPrimaryColor(data.primary_color || "#0ecab2");
      setSecondaryColor(data.secondary_color || "#087f71");
      setBgType(data.bg_type || "texture");
      setBgColor1(data.bg_color1 || "#0a0a0a");
      setBgColor2(data.bg_color2 || "#1a1a1a");
      setBgOpacity(data.bg_opacity || 0.2);
      setLogoUrl(data.logo_url || "");
      setTextureUrl(data.texture_url || "");
      setEvolutionUrl(data.evolution_url || "");
      setEvolutionKey(data.evolution_key || "");
      setOpenaiKey(data.openai_key || "");
    }
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  async function saveDesign(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    await supabase.from("tenant_config").update({
      company_name: companyName,
      company_subtitle: companySubtitle,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      bg_type: bgType,
      bg_color1: bgColor1,
      bg_color2: bgColor2,
      bg_opacity: bgOpacity,
      logo_url: logoUrl,
      texture_url: textureUrl,
    }).eq("id", config.id);
    flash("✔ Design aplicado! Recarregue a página para ver as mudanças.");
  }

  async function saveAPI(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    await supabase.from("tenant_config").update({
      evolution_url: evolutionUrl,
      evolution_key: evolutionKey,
      openai_key: openaiKey,
    }).eq("id", config.id);
    flash("✔ Credenciais salvas com sucesso!");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !config) return;
    await supabase.from("tenant_config").update({ admin_password: newPassword }).eq("id", config.id);
    setNewPassword("");
    flash("✔ Senha atualizada! Use a nova senha no próximo login.");
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Configurações SaaS</h2>
        <p className="text-gray-400 mt-2">Personalize a marca, gerencie conexões de API e segurança.</p>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm">{msg}</div>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
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
              {bgType === "solid" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cor do Fundo</label>
                  <div className="flex gap-2">
                    <input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-black border-none" />
                    <input type="text" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                  </div>
                </div>
              )}
              {bgType === "gradient" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cor 1</label>
                    <div className="flex gap-2">
                      <input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-black border-none" />
                      <input type="text" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cor 2</label>
                    <div className="flex gap-2">
                      <input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-black border-none" />
                      <input type="text" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                  </div>
                </div>
              )}
              {bgType === "texture" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL da Textura (opcional)</label>
                  <input type="url" value={textureUrl} onChange={(e) => setTextureUrl(e.target.value)} placeholder="https://seusite.com/textura.jpg" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Opacidade do Fundo ({Math.round(bgOpacity * 100)}%)</label>
                <input type="range" min="0" max="1" step="0.05" value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--tenant-primary))]" />
              </div>

              {/* Preview */}
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <p className="text-[10px] text-gray-500 px-3 pt-2">Pré-visualização:</p>
                <div className="h-20 m-2 rounded flex items-center justify-center text-sm font-bold" style={{
                  background: bgType === "solid" ? bgColor1 : bgType === "gradient" ? `linear-gradient(135deg, ${bgColor1}, ${bgColor2})` : "#0a0a0a",
                  color: primaryColor,
                  opacity: bgOpacity + 0.5,
                }}>
                  {companyName || "LINO CRM"}
                </div>
              </div>

              <button type="submit" className="w-full bg-[hsl(var(--tenant-primary))] py-2 rounded font-bold text-black hover:opacity-90">Aplicar Design</button>
            </form>
          </div>

          <div className="space-y-6">
            {/* CHAVES API */}
            <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
              <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-orange-500 w-2 h-5 mr-2 rounded-sm"></span>Chaves de API</h3>
              <form onSubmit={saveAPI} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Evolution API — URL</label>
                  <input type="url" value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="https://evolution.sua-vps.com" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Evolution API — Token</label>
                  <input type="password" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} placeholder="Sua chave da Evolution" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
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
                  <label className="block text-xs text-gray-400 mb-1">Nova Senha</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                </div>
                <button type="submit" className="w-full bg-red-700 py-2 rounded font-bold text-white hover:bg-red-800">Atualizar Senha</button>
              </form>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
