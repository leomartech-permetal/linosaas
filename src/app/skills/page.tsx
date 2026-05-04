"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SKILL_TYPES = [
  { value: "product", label: "Produto", color: "#3b82f6", desc: "Conhecimento técnico de um produto" },
  { value: "atendimento", label: "Atendimento", color: "#10b981", desc: "Tom de voz e saudação" },
  { value: "objecao", label: "Objeção", color: "#f59e0b", desc: "Resposta a objeções comerciais" },
  { value: "qualificacao", label: "Qualificação", color: "#ec4899", desc: "Perguntas de qualificação SDR" },
];

const DEFAULT_MASTER_PROMPT = `Você é o LINO, assistente virtual SDR e Suporte do Grupo Permetal — líder em chapas perfuradas, grades, painéis acústicos e fachadas metálicas.

🎯 SEU OBJETIVO:
- Qualificar leads captados via WhatsApp
- Identificar necessidade, produto, volume e região
- Encaminhar leads qualificados ao vendedor correto
- Prestar suporte técnico básico sobre produtos

🗣️ TOM DE VOZ:
- Profissional, mas amigável e objetivo
- Use linguagem técnica quando necessário, mas explique de forma simples
- Sempre trate o cliente pelo nome quando disponível
- Respostas curtas e diretas (máximo 3 parágrafos)

📋 FLUXO DE QUALIFICAÇÃO:
1. Saudação personalizada
2. Identificar o produto de interesse
3. Perguntar quantidade/volume estimado
4. Identificar região/estado do cliente
5. Verificar se precisa de projeto/instalação
6. Resumir e encaminhar ao vendedor

⚠️ REGRAS:
- NUNCA invente preços ou prazos de entrega
- Se não souber responder, diga que vai consultar a equipe técnica
- Sempre finalize oferecendo o contato direto com o vendedor especialista
- Use as Skills e Bases RAG vinculadas para enriquecer suas respostas`;

export default function SkillsPage() {
  const [masterPrompt, setMasterPrompt] = useState("");
  const [skills, setSkills] = useState<any[]>([]);
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form skill
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", type: "product", prompt: "" });
  const [selectedRags, setSelectedRags] = useState<string[]>([]);

  // Form RAG
  const [showRagForm, setShowRagForm] = useState(false);
  const [ragName, setRagName] = useState("");
  const [ragText, setRagText] = useState("");
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Skill-RAG links
  const [skillRagLinks, setSkillRagLinks] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [configRes, skillsRes, linksRes] = await Promise.all([
      supabase.from("tenant_config").select("master_prompt").limit(1).single(),
      supabase.from("skills").select("*").order("created_at", { ascending: false }),
      supabase.from("skill_rag_links").select("*"),
    ]);
    if (configRes.data?.master_prompt) setMasterPrompt(configRes.data.master_prompt);
    else setMasterPrompt(DEFAULT_MASTER_PROMPT);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (linksRes.data) setSkillRagLinks(linksRes.data);

    // Carregar RAG docs via API
    try {
      const res = await fetch("/api/rag");
      if (res.ok) { const data = await res.json(); setRagDocs(data); }
    } catch (e) {}
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  async function saveMasterPrompt() {
    const { data } = await supabase.from("tenant_config").select("id").limit(1).single();
    if (data) {
      await supabase.from("tenant_config").update({ master_prompt: masterPrompt }).eq("id", data.id);
    }
    flash("✔ Prompt mestre salvo com sucesso!");
  }

  // === SKILLS ===
  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.prompt) return;

    let skillId = editing?.id;

    if (editing) {
      await supabase.from("skills").update({ name: form.name, type: form.type, prompt: form.prompt }).eq("id", editing.id);
      flash("✔ Skill atualizada!");
    } else {
      const { data, error } = await supabase.from("skills").insert([{ name: form.name, type: form.type, prompt: form.prompt }]).select().single();
      if (error) { flash("Erro: " + error.message); return; }
      skillId = data?.id;
      flash("✔ Skill criada!");
    }

    // Salvar vínculos RAG
    if (skillId) {
      await supabase.from("skill_rag_links").delete().eq("skill_id", skillId);
      if (selectedRags.length > 0) {
        const links = selectedRags.map(ragId => ({ skill_id: skillId, rag_document_id: ragId }));
        await supabase.from("skill_rag_links").insert(links);
      }
    }

    setForm({ name: "", type: "product", prompt: "" });
    setSelectedRags([]);
    setShowForm(false);
    setEditing(null);
    loadAll();
  }

  function startEdit(s: any) {
    setEditing(s);
    setForm({ name: s.name, type: s.type, prompt: s.prompt });
    const linked = skillRagLinks.filter(l => l.skill_id === s.id).map(l => l.rag_document_id);
    setSelectedRags(linked);
    setShowForm(true);
  }

  async function toggleActive(s: any) {
    await supabase.from("skills").update({ active: !s.active }).eq("id", s.id);
    flash(s.active ? "Skill desativada" : "✔ Skill ativada!");
    loadAll();
  }

  async function deleteSkill(id: string) {
    if (!confirm("Excluir esta skill permanentemente?")) return;
    await supabase.from("skills").delete().eq("id", id);
    flash("✔ Skill excluída!");
    loadAll();
  }

  // === RAG ===
  async function uploadRag(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("name", ragName);
      if (ragFile) {
        formData.append("file", ragFile);
      } else {
        formData.append("text", ragText);
      }

      const res = await fetch("/api/rag/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) { flash("Erro: " + data.error); setUploading(false); return; }
      flash(`✔ Documento "${ragName}" adicionado! (${data.extracted_chars || 0} caracteres extraídos)`);
      setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(false);
      loadAll();
    } catch (err: any) {
      flash("Erro: " + err.message);
    }
    setUploading(false);
  }

  async function deleteRag(id: string) {
    if (!confirm("Excluir este documento RAG?")) return;
    await fetch(`/api/rag?id=${id}`, { method: "DELETE" });
    flash("✔ Documento excluído!");
    loadAll();
  }

  function toggleRagSelection(ragId: string) {
    setSelectedRags(prev => prev.includes(ragId) ? prev.filter(r => r !== ragId) : [...prev, ragId]);
  }

  function getTypeInfo(type: string) {
    return SKILL_TYPES.find((t) => t.value === type) || SKILL_TYPES[0];
  }

  function getLinkedRags(skillId: string) {
    return skillRagLinks.filter(l => l.skill_id === skillId).map(l => ragDocs.find(r => r.id === l.rag_document_id)).filter(Boolean);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Skills da Inteligência Artificial</h2>
        <p className="text-gray-400 mt-2">Treine o cérebro do Lino. Defina comportamentos, conhecimentos e bases RAG.</p>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm">{msg}</div>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <>
          {/* PROMPT MESTRE */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 mb-8 max-w-4xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center">
                  <span className="bg-[hsl(var(--tenant-primary))] w-2 h-5 mr-2 rounded-sm"></span>
                  Prompt Mestre (Comportamento Geral)
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-500">Este prompt define a <b>personalidade base</b> e a <b>identidade</b> do Lino.</p>
                  <div className="group relative">
                    <span className="cursor-help text-blue-400 text-[10px] border border-blue-400/30 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                    <div className="absolute left-6 top-0 w-72 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed">
                      <b className="text-blue-400 block mb-2 font-bold uppercase tracking-wider">🧠 Como preencher o Mestre:</b>
                      Imagine que você está contratando um funcionário. O que ele precisa saber sobre a empresa? Como ele deve falar?
                      <ul className="mt-2 space-y-2 text-gray-300">
                        <li>• <b>Quem ele é:</b> "Você é Lino, assistente virtual da Permetal."</li>
                        <li>• <b>Tom de voz:</b> "Seja técnico, porém amigável. Use 'você'."</li>
                        <li>• <b>Regras de Ouro:</b> "Nunca invente preços. Nunca diga que é um robô."</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <textarea
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              rows={12}
              placeholder="Ex: Você é Lino, assistente comercial da Permetal. Seu objetivo é ajudar clientes com dúvidas sobre chapas e grades..."
              className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm outline-none focus:border-[hsl(var(--tenant-primary))] mb-3 font-mono leading-relaxed"
            />
            <div className="flex justify-between items-center">
              <button onClick={saveMasterPrompt} className="bg-[hsl(var(--tenant-primary))] px-6 py-2 rounded font-bold text-black hover:opacity-90 transition-opacity">
                Salvar Prompt Mestre
              </button>
              <p className="text-[10px] text-gray-600 italic">* Alterações aqui afetam todas as conversas imediatamente.</p>
            </div>
          </div>

          {/* BASE RAG */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 mb-8 max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center">
                  <span className="bg-purple-500 w-2 h-5 mr-2 rounded-sm"></span>
                  Base de Conhecimento RAG ({ragDocs.length})
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-500">Documentos e tabelas que o Lino pode consultar para tirar dúvidas técnicas.</p>
                  <div className="group relative">
                    <span className="cursor-help text-purple-400 text-[10px] border border-purple-400/30 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                    <div className="absolute left-6 top-0 w-72 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed">
                      <b className="text-purple-400 block mb-2 font-bold uppercase tracking-wider">📚 O que é RAG?</b>
                      É a "biblioteca" do Lino. Em vez de decorar tudo, ele lê esses arquivos quando o cliente faz uma pergunta difícil.
                      <ul className="mt-2 space-y-2 text-gray-300">
                        <li>• <b>Use para:</b> Tabelas de furos, catálogos em PDF, listas de preços técnicos, FAQs da empresa.</li>
                        <li>• <b>Dica:</b> Prefira arquivos de texto limpos ou tabelas simples (CSV/XLSX).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowRagForm(!showRagForm)} className="bg-purple-700 px-4 py-2 rounded text-sm font-bold hover:bg-purple-800">
                + Novo Documento
              </button>
            </div>

            {showRagForm && (
              <div className="bg-black p-4 rounded-lg border border-gray-700 mb-4">
                <h4 className="font-bold text-sm mb-3">Adicionar Documento RAG</h4>
                <form onSubmit={uploadRag} className="space-y-3">
                  <input type="text" value={ragName} onChange={(e) => setRagName(e.target.value)} placeholder="Nome do documento (ex: Catálogo Chapas 2026)" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" required />

                  {/* Upload de arquivo */}
                  <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
                      onChange={(e) => { setRagFile(e.target.files?.[0] || null); setRagText(""); }}
                      className="hidden"
                      id="rag-file-input"
                    />
                    <label htmlFor="rag-file-input" className="cursor-pointer">
                      {ragFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-purple-400 text-sm font-bold">📄 {ragFile.name}</span>
                          <span className="text-gray-500 text-xs">({formatSize(ragFile.size)})</span>
                          <button type="button" onClick={(e) => { e.preventDefault(); setRagFile(null); }} className="text-red-400 text-xs ml-2 hover:text-red-300">✕ Remover</button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-400 text-sm">📎 Clique para enviar arquivo</p>
                          <p className="text-gray-600 text-[10px] mt-1">PDF, DOCX, XLSX, CSV, TXT (máx 10MB)</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* OU texto manual */}
                  {!ragFile && (
                    <>
                      <p className="text-center text-gray-600 text-xs">— ou cole o texto diretamente —</p>
                      <textarea value={ragText} onChange={(e) => setRagText(e.target.value)} rows={4} placeholder="Cole aqui o conteúdo do catálogo, manual, FAQ..." className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={uploading || (!ragFile && !ragText)} className="flex-1 bg-purple-700 py-2 rounded font-bold text-sm hover:bg-purple-800 disabled:opacity-50">
                      {uploading ? "Processando..." : "Adicionar Documento"}
                    </button>
                    <button type="button" onClick={() => { setShowRagForm(false); setRagFile(null); setRagText(""); }} className="flex-1 border border-gray-700 py-2 rounded text-sm hover:bg-gray-800">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista RAG */}
            <div className="space-y-2">
              {ragDocs.map(doc => (
                <div key={doc.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 text-xs font-bold uppercase">{doc.source_type}</span>
                      <h4 className="font-bold text-sm truncate">{doc.name}</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 truncate">
                      {doc.content?.substring(0, 100)}... • {formatSize(doc.file_size || 0)} • {doc.content?.length || 0} chars
                    </p>
                  </div>
                  <button onClick={() => deleteRag(doc.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900 opacity-0 group-hover:opacity-100 transition-opacity ml-2">Excluir</button>
                </div>
              ))}
              {ragDocs.length === 0 && !showRagForm && (
                <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-600 text-sm">
                  Nenhum documento RAG. Clique em &quot;+ Novo Documento&quot; acima.
                </div>
              )}
            </div>
          </div>

          {/* SKILLS */}
          <div className="max-w-4xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold">Habilidades Específicas ({skills.length})</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-500">Módulos de especialização que complementam o Prompt Mestre.</p>
                  <div className="group relative">
                    <span className="cursor-help text-green-400 text-[10px] border border-green-400/30 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                    <div className="absolute left-6 top-0 w-80 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed">
                      <b className="text-green-400 block mb-2 font-bold uppercase tracking-wider">🎯 Como funcionam as Habilidades:</b>
                      O Lino combina o Mestre com as Habilidades Ativas. Cada habilidade deve focar em um <b>assunto único</b>.
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-blue-900/20 p-2 rounded">
                          <b className="text-blue-400 block mb-1">PRODUTO:</b>
                          Dados técnicos e especificações.
                        </div>
                        <div className="bg-green-900/20 p-2 rounded">
                          <b className="text-green-400 block mb-1">ATENDIMENTO:</b>
                          Saudações e tom de voz inicial.
                        </div>
                        <div className="bg-yellow-900/20 p-2 rounded">
                          <b className="text-yellow-400 block mb-1">OBJEÇÃO:</b>
                          Respostas para "tá caro" ou "demora muito".
                        </div>
                        <div className="bg-pink-900/20 p-2 rounded">
                          <b className="text-pink-400 block mb-1">QUALIFICAÇÃO:</b>
                          Perguntas para filtrar o lead.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setEditing(null); setForm({ name: "", type: "product", prompt: "" }); setSelectedRags([]); setShowForm(true); }}
                className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold text-black hover:opacity-90"
              >
                + Adicionar Skill
              </button>
            </div>

            {/* Form Skill */}
            {showForm && (
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-700 mb-8 shadow-xl">
                <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                  {editing ? "✏️ Editar Habilidade" : "✨ Criar Nova Habilidade"}
                </h4>
                <form onSubmit={saveSkill} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase mb-2">Nome da Habilidade</label>
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Chapas Perfuradas PSA" className="w-full bg-black border border-gray-700 rounded p-2.5 text-white text-sm outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase mb-2">Tipo de Conhecimento</label>
                      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2.5 text-white text-sm outline-none focus:border-blue-500">
                        {SKILL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 uppercase mb-2">Prompt da Habilidade (Instruções)</label>
                    <textarea 
                      value={form.prompt} 
                      onChange={(e) => setForm({ ...form, prompt: e.target.value })} 
                      rows={6} 
                      placeholder="Descreva aqui o conhecimento específico. Ex: Se o cliente perguntar de furos, explique que temos modelos redondos, quadrados e hexagonais..." 
                      className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm outline-none focus:border-blue-500 font-mono leading-relaxed" 
                      required 
                    />
                  </div>

                  {/* Vincular RAGs */}
                  {ragDocs.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-500 uppercase mb-3 flex items-center gap-2">
                        📚 Vincular Conhecimento RAG
                        <span className="text-[10px] text-gray-600 normal-case">(Opcional: selecione quais arquivos esta skill pode ler)</span>
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-black rounded border border-gray-800 p-3">
                        {ragDocs.map(doc => (
                          <label key={doc.id} className={`flex items-center gap-3 cursor-pointer hover:bg-gray-900 p-2 rounded border transition-colors ${selectedRags.includes(doc.id) ? 'border-purple-500/50 bg-purple-900/10' : 'border-transparent'}`}>
                            <input type="checkbox" checked={selectedRags.includes(doc.id)} onChange={() => toggleRagSelection(doc.id)} className="accent-purple-500 w-4 h-4" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{doc.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase">{doc.source_type}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-3 rounded-lg hover:opacity-90 shadow-lg shadow-[hsl(var(--tenant-primary))]/10 transition-all">{editing ? "Atualizar Habilidade" : "Criar Habilidade"}</button>
                    <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 border border-gray-700 py-3 rounded-lg hover:bg-gray-800 transition-colors text-gray-400">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista Skills */}
            <div className="grid grid-cols-1 gap-4">
              {skills.map((s) => {
                const info = getTypeInfo(s.type);
                const linked = getLinkedRags(s.id);
                return (
                  <div key={s.id} className={`bg-[#1a1a1a] p-5 rounded-lg border border-gray-800 group hover:border-gray-700 transition-all ${!s.active ? "opacity-40" : ""}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider" style={{ background: info.color + "22", color: info.color }}>{info.label}</span>
                          <h4 className="font-bold text-base truncate">{s.name}</h4>
                          {!s.active && <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded uppercase font-bold">Desativada</span>}
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{s.prompt}</p>
                        {linked.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-800/50">
                            {linked.map((doc: any) => (
                              <span key={doc.id} className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-1 rounded-full border border-purple-800/30 flex items-center gap-1">
                                📚 {doc.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => toggleActive(s)} className={`p-2 rounded hover:bg-gray-800 transition-colors ${s.active ? "text-yellow-500" : "text-green-500"}`} title={s.active ? "Desativar" : "Ativar"}>
                          {s.active ? "⏸️" : "▶️"}
                        </button>
                        <button onClick={() => startEdit(s)} className="p-2 rounded hover:bg-gray-800 text-blue-400" title="Editar">✏️</button>
                        <button onClick={() => deleteSkill(s.id)} className="p-2 rounded hover:bg-gray-800 text-red-500" title="Excluir">🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {skills.length === 0 && !showForm && (
                <div className="border border-dashed border-gray-800 rounded-xl p-12 text-center">
                  <div className="text-4xl mb-4 opacity-20">🧠</div>
                  <p className="text-gray-500 text-sm">O Lino ainda não tem habilidades específicas.</p>
                  <p className="text-gray-600 text-xs mt-1">Adicione uma habilidade para treinar o robô em assuntos específicos.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
