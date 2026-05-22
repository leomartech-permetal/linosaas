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
    <div className="flex h-full w-full bg-[var(--theme-bg)] text-[var(--theme-fg)] overflow-hidden relative">
      {/* Lista Principal */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedLead ? 'mr-[450px]' : ''}`}>
        <div className="p-6 md:p-8 overflow-y-auto h-full">
          <header className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--theme-fg)]">Pipeline de Qualificação</h2>
              <p className="text-gray-500 mt-1">Gestão de leads multimodais e triagem inteligente</p>
            </div>
            <div className="flex gap-4 items-center">
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
                className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-muted)] border border-[var(--theme-border)] px-4 py-2 rounded-lg hover:bg-[var(--theme-hover)] transition-all"
              >
                📥 Exportar CSV
              </button>
              <div className="flex bg-[var(--theme-card)] p-1 rounded-lg border border-[var(--theme-border)]">
                <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-[var(--theme-hover)] text-[var(--theme-fg)] shadow-lg' : 'text-[var(--theme-muted)] hover:text-[var(--theme-fg)]'}`}>TODOS OS LEADS</button>
                <button onClick={() => setFilter('incomplete')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'incomplete' ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--theme-muted)] hover:text-[var(--theme-fg)]'}`}>PENDENTES</button>
                <button onClick={() => setFilter('complete')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'complete' ? 'bg-green-600 text-white shadow-lg' : 'text-[var(--theme-muted)] hover:text-[var(--theme-fg)]'}`}>QUALIFICADOS</button>
                <button onClick={() => setFilter('outros')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'outros' ? 'bg-purple-600 text-white shadow-lg' : 'text-[var(--theme-muted)] hover:text-[var(--theme-fg)]'}`}>OUTROS CONTATOS</button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-[hsl(var(--tenant-primary))] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 animate-pulse">Sincronizando com a IA...</p>
              </div>
            ) : filteredLeads.map((lead) => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className={`group flex items-center justify-between p-5 bg-[var(--theme-card)] border rounded-xl cursor-pointer transition-all hover:border-[hsl(var(--tenant-primary)/0.5)] hover:bg-[var(--theme-hover)] ${selectedLead?.id === lead.id ? 'border-[hsl(var(--tenant-primary))] bg-[var(--theme-hover)]' : 'border-[var(--theme-border)]'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-gray-700 text-lg font-bold text-gray-400 group-hover:text-[hsl(var(--tenant-primary))]">
                    {(lead.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--theme-fg)] group-hover:text-[hsl(var(--tenant-primary))] transition-colors">{lead.name || "Visitante Desconhecido"}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{lead.whatsapp_number.replace('@s.whatsapp.net','')}</span>
                      {(lead.company || lead.empresa) && <span className="w-1 h-1 bg-gray-700 rounded-full"></span>}
                      <span>{lead.company || lead.empresa}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="hidden lg:block text-center">
                    <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-1">Interesse</p>
                    <p className="text-xs text-blue-400 font-medium">{lead.detected_product || lead.produto || "—"}</p>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <span className={`text-[10px] px-2 py-1 rounded font-black tracking-tighter uppercase ${
                      lead.status === 'SDR_QUALIFICATION' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' : 
                      lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'bg-purple-900/20 text-purple-400 border border-purple-500/20' :
                      'bg-green-900/20 text-green-400 border border-green-500/20'
                    }`}>
                      {lead.status === 'SDR_QUALIFICATION' ? 'Em Qualificação' : lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'Outro Setor' : 'Qualificado'}
                    </span>
                    <p className="text-[10px] text-gray-600 mt-2">{new Date(lead.updated_at).toLocaleDateString()}</p>
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
