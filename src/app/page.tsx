"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const COLUMNS = [
  { key: "SDR_QUALIFICATION", label: "SDR Qualificando", color: "#3b82f6" },
  { key: "WAITING_SELLER", label: "Aguardando Vendedor", color: "#f59e0b" },
  { key: "IN_NEGOTIATION", label: "Em Negociação", color: "#8b5cf6" },
  { key: "CLOSED_WON", label: "Venda Fechada", color: "#10b981" },
];

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", whatsapp_number: "", gtm_tag: "", status: "SDR_QUALIFICATION" });

  useEffect(() => { carregarLeads(); }, []);

  async function carregarLeads() {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
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

  function handleDragStart(id: string) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(colKey: string) {
    if (draggedId) {
      atualizarStatus(draggedId, colKey);
      setDraggedId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Fluxo Comercial</h2>
          <p className="text-gray-500 mt-1 font-medium">Gestão tática do pipeline de vendas em tempo real</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)} 
          className="bg-[hsl(var(--tenant-primary))] text-black font-black py-3 px-8 rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_hsl(var(--tenant-primary)/0.3)] uppercase text-xs tracking-widest"
        >
          + Inserir Lead Manual
        </button>
      </header>

      {/* Kanban Premium */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.key);
          return (
            <div
              key={col.key}
              className="w-80 min-w-[320px] flex-shrink-0 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Header da coluna */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: col.color }}></div>
                  <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">{col.label}</h3>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400">{colLeads.length}</span>
              </div>

              {/* Área de Cards */}
              <div className="flex-1 bg-[#111]/40 border border-white/5 rounded-2xl p-3 space-y-4 overflow-y-auto scrollbar-hide">
                {loading ? (
                  <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div></div>
                ) : colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 border-2 border-dashed border-gray-900 rounded-2xl">
                    <span className="text-[10px] font-black text-gray-800 uppercase">Vazio</span>
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800/50 cursor-grab active:cursor-grabbing hover:border-[hsl(var(--tenant-primary)/0.4)] transition-all hover:bg-[#1f1f1f] shadow-lg group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-20 transition-opacity">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                      </div>
                      <h4 className="font-bold text-sm text-white mb-1 group-hover:text-[hsl(var(--tenant-primary))]">{lead.name || "Interesse Anônimo"}</h4>
                      <p className="text-[10px] text-gray-500 font-medium mb-3">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 truncate max-w-[150px]">
                          {lead.produto || lead.detected_product || "Sem Produto"}
                        </span>
                        <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[8px] font-black text-gray-500">
                          {lead.support_attempts > 0 ? '🚨' : (lead.name || '?').charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Lead (Dark) */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowNewModal(false)}>
          <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-6 tracking-tighter">Inserção Tática</h3>
            <form onSubmit={criarLead} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Nome do Cliente</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-[hsl(var(--tenant-primary))]" placeholder="Ex: João Silva" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">WhatsApp</label>
                <input type="text" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="5511999999999" className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-[hsl(var(--tenant-primary))]" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Código de Origem (GTM)</label>
                <input type="text" value={form.gtm_tag} onChange={(e) => setForm({ ...form, gtm_tag: e.target.value })} placeholder="LINO.ADS" className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-[hsl(var(--tenant-primary))]" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-black py-3 rounded-xl hover:opacity-90 uppercase text-xs tracking-widest">Criar Lead</button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 border border-gray-800 text-gray-400 py-3 rounded-xl hover:bg-white/5 uppercase text-xs tracking-widest">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes (Dark) */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setSelectedLead(null)}>
          <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-gray-800 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black tracking-tighter">{selectedLead.name || "Interesse Anônimo"}</h3>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{selectedLead.whatsapp_number}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-500 hover:text-white bg-white/5 p-2 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Status Atual</p>
                <p className="text-xs font-bold text-blue-400">{COLUMNS.find(c => c.key === selectedLead.status)?.label || selectedLead.status}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Empresa</p>
                <p className="text-xs font-bold text-white">{selectedLead.empresa || selectedLead.company || "—"}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Produto</p>
                <p className="text-xs font-bold text-white">{selectedLead.produto || selectedLead.detected_product || "—"}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Intervenção (SLA)</p>
                <p className={`text-xs font-bold ${selectedLead.support_attempts > 0 ? 'text-red-500' : 'text-green-500'}`}>{selectedLead.support_attempts} Tentativas</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setSelectedLead(null)} className="flex-1 bg-white text-black font-black py-4 rounded-2xl hover:opacity-90 uppercase text-xs tracking-widest transition-all">Fechar Detalhes</button>
              <button onClick={() => excluirLead(selectedLead.id)} className="px-6 border border-red-500/30 text-red-500 rounded-2xl hover:bg-red-500/10 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
