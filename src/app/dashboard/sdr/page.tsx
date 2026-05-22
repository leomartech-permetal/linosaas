"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import LeadDrawer from "@/app/components/LeadDrawer";

export default function SDRLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete' | 'outros'>('incomplete');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedLead) {
      loadHistory(selectedLead.id);
    }
  }, [selectedLead]);

  async function loadHistory(leadId: string) {
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (data) setHistory(data);
  }

  const filteredLeads = leads.filter(l => {
    const isOutros = l.status === 'OTHER_DEPARTMENT' || l.status === 'CANCELED';
    if (filter === 'incomplete') return l.status === 'SDR_QUALIFICATION';
    if (filter === 'complete') return l.status !== 'SDR_QUALIFICATION' && !isOutros;
    if (filter === 'outros') return isOutros;
    return !isOutros; // all não mostra os lixos
  });

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

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;
    await supabase.from("leads").delete().eq("id", id);
    setSelectedLead(null);
    loadLeads();
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden relative">
      {/* Lista Principal */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedLead ? 'mr-[450px]' : ''}`}>
        <div className="p-6 md:p-8 overflow-y-auto h-full">
          <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Pipeline de Qualificação</h2>
              <p className="text-[var(--text-secondary)] mt-1">Gestão de leads multimodais e triagem inteligente</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <button 
                onClick={() => {
                  const headers = ["Data", "Nome", "Empresa", "Produto", "WhatsApp", "Status"];
                  const csv = [headers.join(","), ...filteredLeads.map(l => [new Date(l.created_at).toLocaleDateString(), l.name, l.empresa || l.company, l.produto || l.detected_product, l.whatsapp_number, l.status].join(","))].join("\n");
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.setAttribute('hidden', '');
                  a.setAttribute('href', url);
                  a.setAttribute('download', 'leads_qualificacao.csv');
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="btn-secondary text-xs"
              >
                📥 Exportar CSV
              </button>
              
              {/* Abas Modernas Clean UI */}
              <div className="tabs-container-clean">
                <button onClick={() => setFilter('all')} className={`tab-item-clean ${filter === 'all' ? 'active' : ''}`}>TODOS</button>
                <button onClick={() => setFilter('incomplete')} className={`tab-item-clean ${filter === 'incomplete' ? 'active' : ''}`}>PENDENTES</button>
                <button onClick={() => setFilter('complete')} className={`tab-item-clean ${filter === 'complete' ? 'active' : ''}`}>QUALIFICADOS</button>
                <button onClick={() => setFilter('outros')} className={`tab-item-clean ${filter === 'outros' ? 'active' : ''}`}>OUTROS</button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[var(--text-secondary)] animate-pulse text-sm">Sincronizando dados...</p>
              </div>
            ) : filteredLeads.map((lead) => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className={`card-base p-5 group flex items-center justify-between cursor-pointer transition-all hover:border-[var(--brand-accent)] ${selectedLead?.id === lead.id ? '!border-[var(--brand-accent)] bg-[var(--bg-hover)]' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-subtle)] text-lg font-semibold text-[var(--text-primary)] group-hover:border-[var(--brand-accent)] group-hover:text-[var(--brand-accent)] transition-colors">
                    {(lead.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-accent)] transition-colors">{lead.name || "Visitante Desconhecido"}</h4>
                    <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <span>{lead.whatsapp_number.replace('@s.whatsapp.net','')}</span>
                      {(lead.company || lead.empresa) && <span className="w-1 h-1 bg-[var(--border-default)] rounded-full"></span>}
                      <span>{lead.company || lead.empresa}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="hidden lg:block text-center">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider mb-1">Interesse</p>
                    <p className="text-xs text-[var(--brand-accent)] font-medium">{lead.detected_product || lead.produto || "—"}</p>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <span className={`text-[10px] px-2.5 py-1 rounded font-semibold uppercase border ${
                      lead.status === 'SDR_QUALIFICATION' ? 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/20' : 
                      lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'bg-[var(--chart-purple)]/10 text-[var(--chart-purple)] border-[var(--chart-purple)]/20' :
                      'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20'
                    }`}>
                      {lead.status === 'SDR_QUALIFICATION' ? 'Em Qualificação' : lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'Outro Setor' : 'Qualificado'}
                    </span>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{new Date(lead.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel Lateral (Drawer) */}
      <LeadDrawer 
        selectedLead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdateLead={handleUpdateLead}
        onDeleteLead={handleDeleteLead}
      />
    </div>
  );
}
