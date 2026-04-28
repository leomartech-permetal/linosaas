"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const COLUMNS = [
  { key: "SDR_QUALIFICATION", label: "SDR Qualificando", color: "#3b82f6" },
  { key: "WAITING_SELLER", label: "Aguardando Vendedor", color: "#f59e0b" },
  { key: "IN_NEGOTIATION", label: "Em Negociação", color: "#8b5cf6" },
  { key: "CLOSED_WON", label: "Fechado ✔", color: "#10b981" },
];

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  // Form novo lead
  const [form, setForm] = useState({ name: "", whatsapp_number: "", gtm_tag: "", status: "SDR_QUALIFICATION" });

  useEffect(() => { carregarLeads(); }, []);

  async function carregarLeads() {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  }

  async function criarLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.whatsapp_number) return;
    await supabase.from("leads").insert([{ ...form }]);
    setForm({ name: "", whatsapp_number: "", gtm_tag: "", status: "SDR_QUALIFICATION" });
    setShowNewModal(false);
    carregarLeads();
  }

  async function atualizarStatus(leadId: string, novoStatus: string) {
    await supabase.from("leads").update({ status: novoStatus, updated_at: new Date().toISOString() }).eq("id", leadId);
    carregarLeads();
  }

  async function excluirLead(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;
    await supabase.from("leads").delete().eq("id", id);
    setSelectedLead(null);
    carregarLeads();
  }

  // Drag and Drop
  function handleDragStart(id: string) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(colKey: string) {
    if (draggedId) {
      atualizarStatus(draggedId, colKey);
      setDraggedId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white flex flex-col">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Pipeline Comercial</h2>
          <p className="text-gray-400 mt-1">Arraste os cards entre as colunas para atualizar o status</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-dynamic transform hover:scale-105 transition-all">+ Novo Lead</button>
      </header>

      {/* Kanban */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.key);
          return (
            <div
              key={col.key}
              className="w-72 min-w-[280px] flex-shrink-0 bg-white/95 backdrop-blur rounded-lg flex flex-col"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Header da coluna */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center" style={{ borderTopColor: col.color, borderTopWidth: "3px" }}>
                <h3 className="font-bold text-gray-800 text-sm">{col.label}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: col.color + "22", color: col.color }}>{colLeads.length}</span>
              </div>

              {/* Cards */}
              <div className="p-3 flex-1 overflow-y-auto space-y-2 max-h-[60vh]">
                {loading ? (
                  <p className="text-gray-400 text-xs text-center py-4">Carregando...</p>
                ) : colLeads.length === 0 ? (
                  <p className="text-gray-300 text-xs text-center py-8">Vazio</p>
                ) : (
                  colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white p-3 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:border-gray-300 active:scale-95"
                    >
                      <h4 className="font-bold text-gray-900 text-sm">{lead.name || "Lead s/ Nome"}</h4>
                      <p className="text-xs text-gray-400 mt-1">{lead.whatsapp_number}</p>
                      {lead.gtm_tag && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">TAG: {lead.gtm_tag}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Lead */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Novo Lead</h3>
            <form onSubmit={criarLead} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none focus:border-[hsl(var(--tenant-primary))]" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">WhatsApp *</label>
                <input type="text" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="5511999999999" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none focus:border-[hsl(var(--tenant-primary))]" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">TAG GTM</label>
                <input type="text" value={form.gtm_tag} onChange={(e) => setForm({ ...form, gtm_tag: e.target.value })} placeholder="Lino.XXXXXX" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none focus:border-[hsl(var(--tenant-primary))]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">Salvar Lead</button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 border border-gray-600 py-2 rounded hover:bg-gray-800">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Lead */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSelectedLead(null)}>
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold">{selectedLead.name || "Lead s/ Nome"}</h3>
              <button onClick={() => setSelectedLead(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">WhatsApp</span>
                <span>{selectedLead.whatsapp_number}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">TAG GTM</span>
                <span className="text-blue-400">{selectedLead.gtm_tag || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">UTM Source</span>
                <span>{selectedLead.utm_source || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Criado em</span>
                <span>{new Date(selectedLead.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div className="border-b border-gray-800 pb-2">
                <span className="text-gray-500 block mb-2">Status</span>
                <select
                  value={selectedLead.status}
                  onChange={(e) => {
                    atualizarStatus(selectedLead.id, e.target.value);
                    setSelectedLead({ ...selectedLead, status: e.target.value });
                  }}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                  <option value="CLOSED_LOST">Perdido ✕</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelectedLead(null)} className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">Fechar</button>
              <button onClick={() => excluirLead(selectedLead.id)} className="flex-1 bg-red-900/50 text-red-400 font-bold py-2 rounded hover:bg-red-900">Excluir Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
