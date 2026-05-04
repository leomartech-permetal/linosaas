"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SDRLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
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
    if (filter === 'incomplete') return l.status === 'SDR_QUALIFICATION';
    if (filter === 'complete') return l.status !== 'SDR_QUALIFICATION';
    return true;
  });

  const handleUpdateLead = async (field: string, value: any) => {
    if (!selectedLead) return;
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', selectedLead.id);
    if (!error) {
      const updated = { ...selectedLead, [field]: value };
      setSelectedLead(updated);
      setLeads(leads.map(l => l.id === selectedLead.id ? updated : l));
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] overflow-hidden relative">
      {/* Lista Principal */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedLead ? 'mr-[450px]' : ''}`}>
        <div className="p-6 md:p-8 overflow-y-auto h-full">
          <header className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Pipeline de Qualificação</h2>
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
                className="text-[10px] font-black uppercase tracking-widest text-gray-400 border border-gray-800 px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
              >
                📥 Exportar CSV
              </button>
              <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-gray-800">
                <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>TODOS</button>
                <button onClick={() => setFilter('incomplete')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'incomplete' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>PENDENTES</button>
                <button onClick={() => setFilter('complete')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'complete' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>QUALIFICADOS</button>
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
                className={`group flex items-center justify-between p-5 bg-[#111] border rounded-xl cursor-pointer transition-all hover:border-[hsl(var(--tenant-primary)/0.5)] hover:bg-[#161616] ${selectedLead?.id === lead.id ? 'border-[hsl(var(--tenant-primary))] bg-[#161616]' : 'border-gray-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-gray-700 text-lg font-bold text-gray-400 group-hover:text-[hsl(var(--tenant-primary))]">
                    {(lead.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white group-hover:text-[hsl(var(--tenant-primary))] transition-colors">{lead.name || "Visitante Desconhecido"}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{lead.whatsapp_number.replace('@s.whatsapp.net','')}</span>
                      {lead.company && <span className="w-1 h-1 bg-gray-700 rounded-full"></span>}
                      <span>{lead.company}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="hidden lg:block text-center">
                    <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-1">Interesse</p>
                    <p className="text-xs text-blue-400 font-medium">{lead.detected_product || "—"}</p>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <span className={`text-[10px] px-2 py-1 rounded font-black tracking-tighter uppercase ${lead.status === 'SDR_QUALIFICATION' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' : 'bg-green-900/20 text-green-400 border border-green-500/20'}`}>
                      {lead.status === 'SDR_QUALIFICATION' ? 'Em Qualificação' : 'Qualificado'}
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
      <div className={`fixed top-0 right-0 h-screen w-[450px] bg-[#0f0f0f] border-l border-gray-800 shadow-2xl transition-transform duration-300 transform z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLead && (
          <>
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#111]">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedLead(null)} className="text-gray-500 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <h3 className="font-bold text-lg">Detalhes do Lead</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleUpdateLead('bot_active', !selectedLead.bot_active)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${selectedLead.bot_active ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40'}`}
                >
                  {selectedLead.bot_active ? '🤖 Bot Ativo' : '✋ Bot Pausado'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {/* Seção 1: Perfil Profissional */}
              <section>
                <h5 className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-4">Qualificação Profissional</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Nome</label>
                    <input value={selectedLead.name || ''} onChange={(e) => handleUpdateLead('name', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Cargo</label>
                    <input value={selectedLead.cargo || ''} onChange={(e) => handleUpdateLead('cargo', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Empresa</label>
                    <input value={selectedLead.empresa || selectedLead.company || ''} onChange={(e) => handleUpdateLead('empresa', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">CNPJ</label>
                    <input value={selectedLead.cnpj || ''} onChange={(e) => handleUpdateLead('cnpj', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">E-mail Corporativo</label>
                    <input value={selectedLead.email_corporativo || ''} onChange={(e) => handleUpdateLead('email_corporativo', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                </div>
              </section>

              {/* Seção 2: Interesse Técnico */}
              <section>
                <h5 className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-4">Interesse de Produto</h5>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Produto Detectado</label>
                    <input value={selectedLead.produto || selectedLead.detected_product || ''} onChange={(e) => handleUpdateLead('produto', e.target.value)} className="w-full bg-blue-900/10 border border-blue-500/30 rounded px-3 py-2 text-sm text-blue-400 outline-none focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase">Quantidade</label>
                      <input value={selectedLead.quantidade || ''} onChange={(e) => handleUpdateLead('quantidade', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase">Cidade/UF</label>
                      <input value={selectedLead.cidade_empresa || selectedLead.detected_city || ''} onChange={(e) => handleUpdateLead('cidade_empresa', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Especificação Detalhada</label>
                    <textarea rows={3} value={selectedLead.especificacao || ''} onChange={(e) => handleUpdateLead('especificacao', e.target.value)} className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-sm outline-none focus:border-[hsl(var(--tenant-primary))]" />
                  </div>
                </div>
              </section>

              {/* Seção 3: Histórico de Conversa */}
              <section>
                <h5 className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-4">Contexto da Conversa</h5>
                <div className="space-y-3 bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 max-h-[300px] overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-4 italic">Nenhuma interação registrada.</p>
                  ) : history.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender_type === 'lead' ? 'items-start' : 'items-end'}`}>
                      <div className={`max-w-[85%] p-3 rounded-lg text-xs ${msg.sender_type === 'lead' ? 'bg-[#1a1a1a] text-gray-300 rounded-bl-none' : 'bg-[hsl(var(--tenant-primary)/0.2)] text-[hsl(var(--tenant-primary))] border border-[hsl(var(--tenant-primary)/0.3)] rounded-br-none'}`}>
                        {msg.message_content}
                      </div>
                      <span className="text-[8px] text-gray-600 mt-1 uppercase">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 bg-[#111] border-t border-gray-800">
              <button 
                onClick={() => setSelectedLead(null)}
                className="w-full bg-white text-black font-bold py-3 rounded-lg text-sm hover:bg-gray-200 transition-all uppercase tracking-widest"
              >
                Concluído
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
