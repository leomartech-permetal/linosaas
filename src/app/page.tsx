"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import LeadDrawer from "@/app/components/LeadDrawer";

const COLUMNS = [
  { key: "SDR_QUALIFICATION", label: "SDR Qualificando", color: "#3b82f6" },
  { key: "WAITING_SELLER", label: "Aguardando Vendedor", color: "#f59e0b" },
  { key: "IN_NEGOTIATION", label: "Em Negociação", color: "#8b5cf6" },
  { key: "CLOSED_WON", label: "Venda Fechada", color: "#10b981" },
];

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", whatsapp_number: "", gtm_tag: "", status: "SDR_QUALIFICATION" });

  useEffect(() => { 
    carregarLeads(); 
    carregarAdminUsers();
  }, []);

  async function carregarAdminUsers() {
    const { data } = await supabase.from("admin_users").select("id, name");
    if (data) setAdminUsers(data);
  }

  async function carregarLeads() {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*, seller:current_owner_id(name, whatsapp_number)")
      .order("updated_at", { ascending: false });
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

  const handleUpdateLead = async (field: string, value: any) => {
    if (!selectedLead) return;

    let updatePayload: any = { [field]: value };
    if (field === 'empresa') {
      updatePayload.company = value;
    } else if (field === 'company') {
      updatePayload.empresa = value;
    } else if (field === 'produto') {
      updatePayload.detected_product = value;
    } else if (field === 'detected_product') {
      updatePayload.produto = value;
    } else if (field === 'cidade_empresa') {
      updatePayload.detected_city = value;
    } else if (field === 'detected_city') {
      updatePayload.cidade_empresa = value;
    }

    const { error } = await supabase.from('leads').update(updatePayload).eq('id', selectedLead.id);
    if (!error) {
      const updated = { ...selectedLead, ...updatePayload };
      setSelectedLead(updated);
      setLeads(leads.map(l => l.id === selectedLead.id ? updated : l));
    }
  };

  function handleDragStart(id: string) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(colKey: string) {
    if (draggedId) {
      atualizarStatus(draggedId, colKey);
      setDraggedId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[var(--theme-bg)] text-[var(--theme-fg)] flex flex-col overflow-hidden transition-colors duration-200">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Fluxo Comercial</h2>
          <p className="text-gray-400 mt-1 font-medium">Gestão tática do pipeline de vendas em tempo real</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)} 
          className="bg-[hsl(var(--tenant-primary))] text-white dark:text-black font-black py-3 px-8 rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_hsl(var(--tenant-primary)/0.3)] uppercase text-xs tracking-widest cursor-pointer"
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
              </div>              {/* Área de Cards */}
              <div className="flex-1 bg-black/[0.02] dark:bg-[#111]/40 border border-[var(--theme-border)] rounded-2xl p-3 space-y-4 overflow-y-auto scrollbar-hide">
                {loading ? (
                  <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-800 border-t-blue-500 rounded-full animate-spin"></div></div>
                ) : colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 border-2 border-dashed border-gray-200 dark:border-gray-900 rounded-2xl">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-800 uppercase">Vazio</span>
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const seller = adminUsers.find(u => u.id === lead.current_owner_id);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => setSelectedLead(lead)}
                        className="bg-[var(--theme-card)] p-5 rounded-xl border border-[var(--theme-border)] cursor-grab active:cursor-grabbing hover:border-[hsl(var(--tenant-primary)/0.4)] transition-all hover:bg-[var(--theme-hover)] shadow-sm hover:shadow group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-20 transition-opacity">
                          <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                        </div>
                        <h4 className="font-bold text-sm text-[var(--theme-fg)] mb-1 group-hover:text-[hsl(var(--tenant-primary))]">{lead.name || "Interesse Anônimo"}</h4>
                        <p className="text-[10px] text-gray-400 font-medium mb-1">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</p>
                        
                        {seller && (
                          <p className="text-[10px] text-yellow-500/90 font-bold mb-3 flex items-center gap-1 bg-yellow-500/5 border border-yellow-500/20 px-2 py-0.5 rounded w-fit">
                            <span>👤 {seller.name}</span>
                          </p>
                        )}
                        {!seller && <div className="h-2"></div>}
 
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 truncate max-w-[150px]">
                            {lead.produto || lead.detected_product || "Sem Produto"}
                          </span>
                          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[8px] font-black text-gray-500">
                            {lead.support_attempts > 0 ? '🚨' : (lead.name || '?').charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Lead */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowNewModal(false)}>
          <div className="bg-[var(--theme-card)] p-8 rounded-3xl border border-[var(--theme-border)] w-full max-w-md shadow-2xl text-[var(--theme-fg)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-6 tracking-tighter">Inserção Tática</h3>
            <form onSubmit={criarLead} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Nome do Cliente</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-xl p-3 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" placeholder="Ex: João Silva" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">WhatsApp</label>
                <input type="text" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="5511999999999" className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-xl p-3 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Código de Origem (GTM)</label>
                <input type="text" value={form.gtm_tag} onChange={(e) => setForm({ ...form, gtm_tag: e.target.value })} placeholder="LINO.ADS" className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-xl p-3 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-white dark:text-black font-black py-3 rounded-xl hover:opacity-90 uppercase text-xs tracking-widest cursor-pointer">Criar Lead</button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 border border-[var(--theme-border)] text-gray-400 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 uppercase text-xs tracking-widest cursor-pointer">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gaveta Detalhes (Unificada) */}
      <LeadDrawer 
        selectedLead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdateLead={handleUpdateLead}
        onDeleteLead={excluirLead}
      />
    </div>
  );
}
