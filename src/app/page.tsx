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
    <div className="p-6 md:p-8 w-full h-full bg-white text-[var(--text-primary)] flex flex-col overflow-hidden transition-colors duration-200">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--border-light)]">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fluxo Comercial</h2>
          <p className="text-[var(--text-muted)] mt-1 text-xs font-medium">Gestão tática do pipeline de vendas em tempo real</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)} 
          className="btn-primary"
        >
          + Inserir Lead Manual
        </button>
      </header>

      {/* Kanban Minimalista */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.key);
          return (
            <div
              key={col.key}
              className="w-80 min-w-[300px] flex-shrink-0 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Header da coluna */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-[#111111] rounded"></div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{col.label}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-light)] text-[var(--text-muted)]">{colLeads.length}</span>
              </div>
              {/* Área de Cards */}
              <div className="flex-1 bg-[var(--bg-sidebar)] border border-[var(--border-light)] rounded-lg p-3 space-y-3 overflow-y-auto scrollbar-hide">
                {loading ? (
                  <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div></div>
                ) : colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 border border-dashed border-[var(--border-strong)] rounded-lg">
                    <span className="text-[10px] font-semibold text-[var(--text-soft)] uppercase">Vazio</span>
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
                        className="metric-card bg-white p-4 border border-[var(--border-light)] hover:border-[var(--border-strong)] cursor-grab active:cursor-grabbing transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-30 transition-opacity">
                          <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                        </div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1">{lead.name || "Interesse Anônimo"}</h4>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mb-2">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</p>
                        
                        {seller && (
                          <p className="text-[10px] text-[var(--text-secondary)] font-semibold mb-3 flex items-center gap-1 bg-[var(--bg-surface-muted)] border border-[var(--border-light)] px-2 py-0.5 rounded w-fit">
                            <span>Vendedor: {seller.name}</span>
                          </p>
                        )}
                        {!seller && <div className="h-2"></div>}
 
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-2 py-0.5 rounded border border-[var(--border-light)] truncate max-w-[150px]">
                            {lead.produto || lead.detected_product || "Sem Produto"}
                          </span>
                          
                          {lead.support_attempts > 0 ? (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border border-[var(--status-critical-border)] rounded">
                              SLA Alerta ({lead.support_attempts})
                            </span>
                          ) : (
                            <div className="w-5 h-5 rounded bg-[var(--bg-surface-muted)] flex items-center justify-center text-[9px] font-semibold text-[var(--text-secondary)] border border-[var(--border-light)]">
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowNewModal(false)}>
          <div className="bg-white p-6 rounded-lg border border-[var(--border-strong)] w-full max-w-sm text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Inserção Manual</h3>
            <form onSubmit={criarLead} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Nome do Cliente</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-search-clean w-full h-9 px-3" placeholder="Ex: João Silva" required />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">WhatsApp</label>
                <input type="text" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="5511999999999" className="input-search-clean w-full h-9 px-3" required />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Código de Origem (GTM)</label>
                <input type="text" value={form.gtm_tag} onChange={(e) => setForm({ ...form, gtm_tag: e.target.value })} placeholder="LINO.ADS" className="input-search-clean w-full h-9 px-3" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 btn-primary">Criar Lead</button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 btn-secondary">Cancelar</button>
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
