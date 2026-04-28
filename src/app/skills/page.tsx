"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SKILL_TYPES = [
  { value: "product", label: "Produto", color: "#3b82f6", desc: "Conhecimento técnico de um produto" },
  { value: "atendimento", label: "Atendimento", color: "#10b981", desc: "Tom de voz e saudação" },
  { value: "objecao", label: "Objeção", color: "#f59e0b", desc: "Resposta a objeções comerciais" },
  { value: "rag", label: "RAG / Base de Conhecimento", color: "#8b5cf6", desc: "Texto de referência para a IA consultar" },
];

export default function SkillsPage() {
  const [masterPrompt, setMasterPrompt] = useState("");
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", type: "product", prompt: "" });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [configRes, skillsRes] = await Promise.all([
      supabase.from("tenant_config").select("master_prompt").limit(1).single(),
      supabase.from("skills").select("*").order("created_at", { ascending: false }),
    ]);
    if (configRes.data?.master_prompt) setMasterPrompt(configRes.data.master_prompt);
    if (skillsRes.data) setSkills(skillsRes.data);
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

  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.prompt) return;

    if (editing) {
      await supabase.from("skills").update({ name: form.name, type: form.type, prompt: form.prompt }).eq("id", editing.id);
      setEditing(null);
      flash("✔ Skill atualizada!");
    } else {
      const { error } = await supabase.from("skills").insert([{ name: form.name, type: form.type, prompt: form.prompt }]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Skill criada!");
    }
    setForm({ name: "", type: "product", prompt: "" });
    setShowForm(false);
    loadAll();
  }

  function startEdit(s: any) {
    setEditing(s);
    setForm({ name: s.name, type: s.type, prompt: s.prompt });
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

  function getTypeInfo(type: string) {
    return SKILL_TYPES.find((t) => t.value === type) || SKILL_TYPES[0];
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Skills da Inteligência Artificial</h2>
        <p className="text-gray-400 mt-2">Treine o cérebro do Lino. Defina comportamentos e conhecimentos.</p>
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
              rows={5}
              className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm outline-none focus:border-[hsl(var(--tenant-primary))] mb-3"
            />
            <button onClick={saveMasterPrompt} className="bg-[hsl(var(--tenant-primary))] px-6 py-2 rounded font-bold text-black hover:opacity-90 transition-opacity">
              Salvar Prompt Mestre
            </button>
          </div>

          {/* SKILLS */}
          <div className="max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Habilidades Específicas ({skills.length})</h3>
              <button
                onClick={() => { setEditing(null); setForm({ name: "", type: "product", prompt: "" }); setShowForm(true); }}
                className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold text-black hover:opacity-90"
              >
                + Adicionar Skill
              </button>
            </div>

            {/* Form */}
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
                  <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={4} placeholder={form.type === "rag" ? "Cole aqui o texto do catálogo, manual ou documento de referência..." : "Instrução para a IA quando este assunto surgir..."} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">{editing ? "Atualizar" : "Criar Skill"}</button>
                    <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 border border-gray-700 py-2 rounded hover:bg-gray-800">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista */}
            <div className="space-y-3">
              {skills.map((s) => {
                const info = getTypeInfo(s.type);
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
