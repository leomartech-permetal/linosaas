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
  const [editingRag, setEditingRag] = useState<any>(null);

  // Pesquisas
  const [skillSearch, setSkillSearch] = useState("");
  const [ragSearch, setRagSearch] = useState("");

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
  function startEditRag(doc: any) {
    setEditingRag(doc);
    setRagName(doc.name);
    setRagText(doc.content || "");
    setRagFile(null);
    setShowRagForm(true);
  }

  async function uploadRag(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);

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

      if (!res.ok) { flash("Erro: " + data.error); setUploading(false); return; }
      
      flash(editingRag ? `✔ Documento "${ragName}" atualizado!` : `✔ Documento "${ragName}" adicionado! (${data.extracted_chars || 0} caracteres extraídos)`);
      setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(false); setEditingRag(null);
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
    <div className="p-6 md:p-10 w-full h-full text-[var(--text-primary)] overflow-y-auto bg-[var(--bg-app)]">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Cérebro IA e Habilidades</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Treine o comportamento do Lino. Defina o prompt mestre e vincule bases de dados RAG.</p>
      </header>

      {msg && (
        <div className="bg-[#E6F4EA] border border-[var(--status-success)] text-[#137333] px-4 py-2.5 rounded-md mb-6 text-sm flex items-center gap-2">
          <span>{msg}</span>
        </div>
      )}

      {loading ? (
        <p className="text-[var(--text-secondary)] text-sm">Carregando dados...</p>
      ) : (
        <>
          {/* PROMPT MESTRE */}
          <div className="card-base mb-8 max-w-4xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold flex items-center text-[var(--text-primary)]">
                  <span className="bg-[var(--brand-accent)] w-1 h-5 mr-2 rounded-full"></span>
                  Prompt Mestre (Comportamento Geral)
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-[var(--text-secondary)]">Este prompt define a personalidade base e a identidade geral do Lino.</p>
                  <div className="group relative">
                    <span className="cursor-help text-[var(--brand-accent)] text-[10px] border border-[var(--brand-accent)]/30 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                    <div className="absolute left-6 top-0 w-72 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed text-[var(--text-secondary)]">
                      <b className="text-[var(--text-primary)] block mb-2 font-bold uppercase tracking-wider">🧠 Como escrever o Prompt:</b>
                      Instrua o assistente como se fosse um atendente real.
                      <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
                        <li>• <b>Identidade:</b> &quot;Você é Lino, assistente comercial...&quot;</li>
                        <li>• <b>Tom:</b> &quot;Seja direto, amigável e use parágrafos curtos.&quot;</li>
                        <li>• <b>Regra:</b> &quot;Nunca dê preços fixos, consulte o vendedor.&quot;</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <textarea
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              rows={10}
              placeholder="Descreva aqui o comportamento geral do robô..."
              className="input-search-clean mb-3 font-mono leading-relaxed h-auto p-3"
            />
            <div className="flex justify-between items-center">
              <button 
                onClick={saveMasterPrompt} 
                className="btn-primary"
              >
                Salvar Prompt Mestre
              </button>
              <p className="text-[10px] text-[var(--text-tertiary)] italic">* Aplicação imediata para todas as novas interações.</p>
            </div>
          </div>

          {/* BASE RAG */}
          <div className="card-base mb-8 max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold flex items-center text-[var(--text-primary)]">
                  <span className="bg-[var(--chart-purple)] w-1 h-5 mr-2 rounded-full"></span>
                  Base de Conhecimento RAG ({ragDocs.length})
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-[var(--text-secondary)]">Arquivos e catálogos que a IA pode ler para responder dúvidas muito específicas.</p>
                  <div className="group relative">
                    <span className="cursor-help text-[var(--chart-purple)] text-[10px] border border-[var(--chart-purple)]/30 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                    <div className="absolute left-6 top-0 w-80 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-xs leading-relaxed text-[var(--text-secondary)]">
                      <b className="text-[var(--text-primary)] block mb-2 font-bold uppercase tracking-wider">📚 RAG (Biblioteca)</b>
                      Permite que a IA leia e pesquise em manuais técnicos, PDFs, planilhas CSV ou textos antes de enviar uma resposta técnica.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={ragSearch} 
                  onChange={(e) => setRagSearch(e.target.value)} 
                  placeholder="Pesquisar RAG..." 
                  className="input-search-clean w-48 py-1.5 text-xs"
                />
                <button 
                  onClick={() => { setEditingRag(null); setRagName(""); setRagText(""); setRagFile(null); setShowRagForm(!showRagForm); }} 
                  className="btn-primary py-1.5 text-xs"
                >
                  {showRagForm ? "Fechar" : "+ Novo Documento"}
                </button>
              </div>
            </div>

            {showRagForm && (
              <div className="bg-[var(--bg-app)] p-4 rounded-md border border-[var(--border-subtle)] mb-4">
                <h4 className="font-bold text-xs mb-3 text-[var(--text-primary)]">{editingRag ? "✏️ Editar Documento RAG" : "Adicionar Documento RAG"}</h4>
                <form onSubmit={uploadRag} className="space-y-3">
                  <input 
                    type="text" 
                    value={ragName} 
                    onChange={(e) => setRagName(e.target.value)} 
                    placeholder="Nome do documento (ex: Catálogo Técnico Chapas)" 
                    className="input-search-clean py-2 text-xs" 
                    required 
                  />

                  {/* Upload de arquivo */}
                  <div className="border-2 border-dashed border-[var(--border-default)] rounded-md p-4 text-center bg-[var(--bg-surface)] hover:border-[var(--chart-purple)] transition-colors">
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
                          <span className="text-[var(--chart-purple)] text-xs font-bold">📄 {ragFile.name}</span>
                          <span className="text-[var(--text-secondary)] text-[10px]">({formatSize(ragFile.size)})</span>
                          <button type="button" onClick={(e) => { e.preventDefault(); setRagFile(null); }} className="text-[var(--status-error)] text-xs ml-2 hover:underline">✕ Remover</button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[var(--text-secondary)] text-xs font-medium">📎 Clique para anexar arquivo</p>
                          <p className="text-[var(--text-tertiary)] text-[9px] mt-0.5">PDF, DOCX, XLSX, CSV, TXT (até 10MB)</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Texto manual */}
                  {!ragFile && (
                    <>
                      <p className="text-center text-[var(--text-tertiary)] text-[10px]">— ou digite o conteúdo manualmente —</p>
                      <textarea 
                        value={ragText} 
                        onChange={(e) => setRagText(e.target.value)} 
                        rows={4} 
                        placeholder="Cole aqui o conteúdo técnico..." 
                        className="input-search-clean py-2 text-xs h-auto" 
                      />
                    </>
                  )}

                  <div className="flex gap-3">
                    <button 
                      type="submit" 
                      disabled={uploading || (!ragFile && !ragText)} 
                      className="flex-1 btn-primary py-2 text-xs disabled:opacity-50"
                    >
                      {uploading ? "Salvando..." : (editingRag ? "Atualizar Documento" : "Adicionar Documento")}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setShowRagForm(false); setRagFile(null); setRagText(""); setEditingRag(null); }} 
                      className="flex-1 btn-secondary py-2 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista RAG */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {ragDocs.filter(doc => (doc.name || "").toLowerCase().includes(ragSearch.toLowerCase()) || (doc.content || "").toLowerCase().includes(ragSearch.toLowerCase())).map(doc => (
                <div key={doc.id} className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-subtle)] flex justify-between items-center group transition-colors hover:bg-[var(--bg-hover)]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--chart-purple)] text-[9px] font-bold bg-[#8B5CF6]/10 px-2 py-0.5 rounded uppercase">{doc.source_type || 'TXT'}</span>
                      <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">{doc.name}</h4>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
                      {doc.content?.substring(0, 100)}... • {formatSize(doc.file_size || 0)} • {doc.content?.length || 0} caracteres
                    </p>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity ml-2 gap-2">
                    <button 
                      onClick={() => startEditRag(doc)} 
                      className="text-[10px] btn-secondary px-2 py-1 h-auto"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => deleteRag(doc.id)} 
                      className="text-[10px] btn-secondary text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/10 px-2 py-1 h-auto"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
              {ragDocs.length > 0 && ragDocs.filter(doc => (doc.name || "").toLowerCase().includes(ragSearch.toLowerCase()) || (doc.content || "").toLowerCase().includes(ragSearch.toLowerCase())).length === 0 && (
                <div className="text-center text-[var(--text-tertiary)] text-xs py-4">Nenhum RAG encontrado.</div>
              )}
              {ragDocs.length === 0 && !showRagForm && (
                <div className="border border-dashed border-[var(--border-default)] rounded-md p-6 text-center text-[var(--text-secondary)] text-xs">
                  Nenhum documento RAG cadastrado.
                </div>
              )}
            </div>
          </div>

          {/* SKILLS */}
          <div className="max-w-4xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Habilidades Específicas ({skills.length})</h3>
                <p className="text-xs text-[var(--text-secondary)]">Habilidades modulares extras ativadas de acordo com as intenções e fluxos de atendimento.</p>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={skillSearch} 
                  onChange={(e) => setSkillSearch(e.target.value)} 
                  placeholder="Pesquisar Skills..." 
                  className="input-search-clean w-48 py-1.5 text-xs"
                />
                <button
                  onClick={() => { setEditing(null); setForm({ name: "", type: "product", prompt: "" }); setSelectedRags([]); setShowForm(true); }}
                  className="btn-primary py-1.5 text-xs"
                >
                  + Adicionar Skill
                </button>
              </div>
            </div>

            {/* Form Skill */}
            {showForm && (
              <div className="card-base mb-8">
                <h4 className="font-bold text-sm mb-4 text-[var(--text-primary)]">
                  {editing ? "✏️ Editar Habilidade" : "✨ Criar Nova Habilidade"}
                </h4>
                <form onSubmit={saveSkill} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Nome da Habilidade</label>
                      <input 
                        type="text" 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                        placeholder="Ex: Grade de Piso Especiais" 
                        className="input-search-clean py-2 text-xs" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Tipo de Conhecimento</label>
                      <select 
                        value={form.type} 
                        onChange={(e) => setForm({ ...form, type: e.target.value })} 
                        className="input-search-clean py-2 text-xs"
                      >
                        {SKILL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Prompt da Habilidade (Instruções)</label>
                    <textarea 
                      value={form.prompt} 
                      onChange={(e) => setForm({ ...form, prompt: e.target.value })} 
                      rows={5} 
                      placeholder="Descreva detalhadamente o conhecimento ou instrução dessa skill..." 
                      className="input-search-clean py-2 text-xs font-mono leading-relaxed h-auto" 
                      required 
                    />
                  </div>

                  {/* Vincular RAGs */}
                  {ragDocs.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">
                        📚 Vincular Conhecimento RAG Relacionado
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-[var(--bg-app)] rounded-md border border-[var(--border-subtle)] p-2">
                        {ragDocs.map(doc => (
                          <label key={doc.id} className={`flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-surface)] p-1.5 rounded-md border border-transparent transition-colors ${selectedRags.includes(doc.id) ? '!border-[#8B5CF6]/30 bg-purple-500/5' : ''}`}>
                            <input 
                              type="checkbox" 
                              checked={selectedRags.includes(doc.id)} 
                              onChange={() => toggleRagSelection(doc.id)} 
                              className="accent-[#8B5CF6] w-3.5 h-3.5" 
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{doc.name}</p>
                              <p className="text-[9px] text-[var(--text-tertiary)] uppercase">{doc.source_type}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="submit" 
                      className="flex-1 btn-primary py-2 text-xs"
                    >
                      {editing ? "Atualizar Habilidade" : "Criar Habilidade"}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setShowForm(false); setEditing(null); }} 
                      className="flex-1 btn-secondary py-2 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista Skills */}
            <div className="grid grid-cols-1 gap-3">
              {skills.filter(s => (s.name || "").toLowerCase().includes(skillSearch.toLowerCase()) || (s.prompt || "").toLowerCase().includes(skillSearch.toLowerCase())).map((s) => {
                const info = getTypeInfo(s.type);
                const linked = getLinkedRags(s.id);
                return (
                  <div key={s.id} className={`card-base transition-all hover:border-[var(--border-strong)] ${!s.active ? "opacity-50" : ""}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span 
                            className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" 
                            style={{ background: info.color + "15", color: info.color }}
                          >
                            {info.label}
                          </span>
                          <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">{s.name}</h4>
                          {!s.active && <span className="text-[9px] bg-red-100 text-[var(--status-error)] px-2 py-0.5 rounded-full uppercase font-bold">Inativa</span>}
                        </div>
                        <p className="code-block-container-clean">{s.prompt}</p>
                        {linked.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
                            {linked.map((doc: any) => (
                              <span key={doc.id} className="text-[9px] bg-[#8B5CF6]/5 text-[#8B5CF6] px-2.5 py-0.5 rounded-full border border-[#8B5CF6]/20 flex items-center gap-1 font-medium">
                                📚 {doc.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleActive(s)} 
                          className="btn-secondary w-7 h-7 p-0 flex items-center justify-center" 
                          title={s.active ? "Desativar" : "Ativar"}
                        >
                          {s.active ? "⏸️" : "▶️"}
                        </button>
                        <button 
                          onClick={() => startEdit(s)} 
                          className="btn-secondary w-7 h-7 p-0 flex items-center justify-center text-blue-500" 
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => deleteSkill(s.id)} 
                          className="btn-secondary w-7 h-7 p-0 flex items-center justify-center text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/10" 
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {skills.length > 0 && skills.filter(s => (s.name || "").toLowerCase().includes(skillSearch.toLowerCase()) || (s.prompt || "").toLowerCase().includes(skillSearch.toLowerCase())).length === 0 && (
                <div className="text-center text-[var(--text-tertiary)] text-xs py-8">Nenhuma habilidade encontrada.</div>
              )}
              {skills.length === 0 && !showForm && (
                <div className="border border-dashed border-[var(--border-default)] rounded-md p-10 text-center">
                  <p className="text-[var(--text-secondary)] text-xs">Nenhuma habilidade modular configurada.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
