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
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 mb-8 max-w-3xl">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <span className="bg-[hsl(var(--tenant-primary))] w-2 h-5 mr-2 rounded-sm"></span>
              Prompt Mestre (Comportamento Geral)
            </h3>
            <p className="text-xs text-gray-500 mb-3">Este prompt define a personalidade base da IA em todas as conversas.</p>
            <textarea
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              rows={12}
              className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm outline-none focus:border-[hsl(var(--tenant-primary))] mb-3 font-mono"
            />
            <button onClick={saveMasterPrompt} className="bg-[hsl(var(--tenant-primary))] px-6 py-2 rounded font-bold text-black hover:opacity-90 transition-opacity">
              Salvar Prompt Mestre
            </button>
          </div>

          {/* BASE RAG */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 mb-8 max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center">
                  <span className="bg-purple-500 w-2 h-5 mr-2 rounded-sm"></span>
                  Base de Conhecimento RAG ({ragDocs.length})
                </h3>
                <p className="text-xs text-gray-500 mt-1">Faça upload de PDF, DOCX, XLSX ou cole textos. Vincule a skills específicas.</p>
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
          <div className="max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Habilidades Específicas ({skills.length})</h3>
              <button
                onClick={() => { setEditing(null); setForm({ name: "", type: "product", prompt: "" }); setSelectedRags([]); setShowForm(true); }}
                className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold text-black hover:opacity-90"
              >
                + Adicionar Skill
              </button>
            </div>

            {/* Form Skill */}
            {showForm && (
              <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-700 mb-6">
                <h4 className="font-bold mb-4">{editing ? "Editar Skill" : "Nova Skill"}</h4>
                <form onSubmit={saveSkill} className="space-y-3">
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da skill (ex: Chapa Perfurada)" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                    {SKILL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                    ))}
                  </select>
                  <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={4} placeholder="Instrução para a IA quando este assunto surgir..." className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />

                  {/* Vincular RAGs */}
                  {ragDocs.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">📚 Bases RAG vinculadas (selecione quais documentos esta skill pode consultar):</label>
                      <div className="space-y-1 max-h-32 overflow-y-auto bg-black rounded border border-gray-700 p-2">
                        {ragDocs.map(doc => (
                          <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 p-1 rounded">
                            <input type="checkbox" checked={selectedRags.includes(doc.id)} onChange={() => toggleRagSelection(doc.id)} className="accent-purple-500" />
                            <span className="text-xs text-purple-400 font-bold uppercase">{doc.source_type}</span>
                            <span className="text-sm truncate">{doc.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">{editing ? "Atualizar" : "Criar Skill"}</button>
                    <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 border border-gray-700 py-2 rounded hover:bg-gray-800">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista Skills */}
            <div className="space-y-3">
              {skills.map((s) => {
                const info = getTypeInfo(s.type);
                const linked = getLinkedRags(s.id);
                return (
                  <div key={s.id} className={`bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 group ${!s.active ? "opacity-50" : ""}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: info.color + "22", color: info.color }}>{info.label}</span>
                          <h4 className="font-bold text-sm">{s.name}</h4>
                          {!s.active && <span className="text-[10px] text-red-400">(desativada)</span>}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{s.prompt}</p>
                        {linked.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {linked.map((doc: any) => (
                              <span key={doc.id} className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">📚 {doc.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button onClick={() => toggleActive(s)} className={`text-[10px] px-2 py-1 rounded ${s.active ? "bg-yellow-900/50 text-yellow-400" : "bg-green-900/50 text-green-400"}`}>
                          {s.active ? "Desativar" : "Ativar"}
                        </button>
                        <button onClick={() => startEdit(s)} className="text-[10px] bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                        <button onClick={() => deleteSkill(s.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">X</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {skills.length === 0 && !showForm && (
                <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-600 text-sm">
                  Nenhuma skill cadastrada. Clique em &quot;+ Adicionar Skill&quot; acima.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
