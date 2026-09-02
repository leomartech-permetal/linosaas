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

  // Controle de Abas Principais
  const [activeTab, setActiveTab] = useState<'kanban' | 'sdr'>('kanban');

  // Filtro de Fila SDR
  const [sdrFilter, setSdrFilter] = useState<'all' | 'incomplete' | 'complete' | 'outros'>('incomplete');

  // Estados para o Canvas Infinito
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".metric-card") || 
      target.closest("button") || 
      target.closest("input") || 
      target.closest("select") ||
      target.closest(".fixed") ||
      target.closest("header") ||
      target.closest(".tabs-container-clean")
    ) {
      return;
    }
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = 0.05;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(Math.max(scale + direction * zoomFactor, 0.5), 1.5);
      setScale(Number(newScale.toFixed(2)));
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 1.5));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => { 
    carregarLeads(); 
    carregarAdminUsers();
  }, []);

  async function carregarAdminUsers() {
    try {
      const res = await fetch("/api/admin-users");
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data || []);
        return;
      }
    } catch (e) {
      console.error("Erro ao carregar admin users:", e);
    }
  }

  async function carregarLeads() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar leads:", e);
    }
    setLoading(false);
  }

  async function criarLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.whatsapp_number) return;
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setForm({ name: "", whatsapp_number: "", gtm_tag: "", status: "SDR_QUALIFICATION" });
      setShowNewModal(false);
      carregarLeads();
    } catch (e) {
      console.error("Erro ao criar lead:", e);
    }
  }

  async function atualizarStatus(leadId: string, novoStatus: string) {
    try {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: novoStatus })
      });
      carregarLeads();
    } catch (e) {
      console.error("Erro ao atualizar status:", e);
    }
  }

  async function excluirLead(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;
    try {
      await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
      setSelectedLead(null);
      carregarLeads();
    } catch (e) {
      console.error("Erro ao excluir lead:", e);
    }
  }

  const handleUpdateLead = async (field: string, value: any) => {
    if (!selectedLead) return;

    let updatePayload: any = { id: selectedLead.id, [field]: value };
    if (field === 'empresa') {
      updatePayload.company = value;
    } else if (field === 'company') {
      updatePayload.empresa = value;
    } else if (field === 'produto') {
      updatePayload.detected_product = value;
    } else if (field === 'detected_product') {
      updatePayload.produto = value;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload)
      });
      if (res.ok) {
        const updated = { ...selectedLead, ...updatePayload };
        setSelectedLead(updated);
        setLeads(leads.map(l => l.id === selectedLead.id ? updated : l));
      }
    } catch (e) {
      console.error("Erro ao atualizar lead:", e);
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

  // Filtragem Fila SDR
  const filteredSdrLeads = leads.filter(l => {
    const isOutros = l.status === 'OTHER_DEPARTMENT' || l.status === 'CANCELED';
    if (sdrFilter === 'incomplete') return l.status === 'SDR_QUALIFICATION' || l.status === 'new' || !l.status;
    if (sdrFilter === 'complete') return l.status !== 'SDR_QUALIFICATION' && l.status !== 'new' && !isOutros;
    if (sdrFilter === 'outros') return isOutros;
    return !isOutros; // todos
  });

  const exportarCSV = () => {
    const headers = ["Data", "Nome", "Empresa", "Produto", "WhatsApp", "Status"];
    const csv = [headers.join(","), ...filteredSdrLeads.map(l => [new Date(l.created_at).toLocaleDateString(), l.name || "Visitante Desconhecido", l.empresa || l.company || "", l.produto || l.detected_product || "", l.whatsapp_number, l.status].join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'leads_qualificacao.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full h-screen bg-white text-[var(--text-primary)] flex flex-col overflow-hidden relative transition-colors duration-200 select-none">
      {/* Header Fixo e Translúcido com Abas de Modo */}
      <header className="absolute top-0 left-0 right-0 z-30 flex flex-col sm:flex-row justify-between sm:items-center px-8 py-4 bg-white/80 backdrop-blur-md border-b border-[var(--border-light)] gap-4 select-none">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Leads & Funil</h2>
            <p className="text-[var(--text-muted)] mt-0.5 text-[10px] font-medium uppercase tracking-wider">Gestão operacional do fluxo comercial</p>
          </div>
          
          {/* Seletor Segmentado Principal */}
          <div className="tabs-container-clean">
            <button 
              onClick={() => setActiveTab('kanban')} 
              className={`tab-item-clean ${activeTab === 'kanban' ? 'active' : ''}`}
            >
              Kanban Comercial
            </button>
            <button 
              onClick={() => setActiveTab('sdr')} 
              className={`tab-item-clean ${activeTab === 'sdr' ? 'active' : ''}`}
            >
              Fila SDR
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'sdr' && (
            <button 
              onClick={exportarCSV} 
              className="btn-secondary h-9 px-4 text-xs font-bold"
            >
              📥 Exportar CSV
            </button>
          )}
          <button 
            onClick={() => setShowNewModal(true)} 
            className="btn-primary h-9 px-4 text-xs font-bold"
          >
            + Inserir Lead Manual
          </button>
        </div>
      </header>

      {/* Renderização Condicional com base na Aba ativa */}
      {activeTab === 'kanban' ? (
        /* VIEWPORT DO KANBAN */
        <div 
          className="w-full h-full canvas-grid relative overflow-hidden select-none pt-20"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Contêiner Móvel do Canvas */}
          <div 
            className="canvas-container"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: isDraggingCanvas ? "none" : "transform 0.1s ease-out"
            }}
          >
            {COLUMNS.map((col) => {
              const colLeads = leads.filter((l) => {
                if (col.key === "SDR_QUALIFICATION") {
                  return l.status === "SDR_QUALIFICATION" || l.status === "new" || !l.status;
                }
                return l.status === col.key;
              });
              return (
                <div
                  key={col.key}
                  className="w-80 min-w-[320px] flex-shrink-0 flex flex-col h-[calc(100vh-220px)]"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.key)}
                >
                  {/* Header da coluna */}
                  <div className="flex items-center justify-between mb-4 px-2 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#111111] rounded"></div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{col.label}</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-light)] text-[var(--text-muted)]">
                      {colLeads.length}
                    </span>
                  </div>
                  {/* Área de Cards */}
                  <div className="flex-1 bg-[var(--bg-sidebar)] border border-[var(--border-light)] rounded-lg p-4 space-y-4 overflow-y-auto scrollbar-hide">
                    {loading ? (
                      <div className="flex justify-center py-10">
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : colLeads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 gap-2 border border-dashed border-[var(--border-strong)] rounded-lg bg-white/50">
                        <span className="text-[10px] font-semibold text-[var(--text-soft)] uppercase text-center">Sem Leads</span>
                      </div>
                    ) : (
                      colLeads.map((lead) => {
                        const seller = lead.seller || adminUsers.find(u => u.id === lead.current_owner_id);
                        return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={() => handleDragStart(lead.id)}
                            onClick={() => setSelectedLead(lead)}
                            className="metric-card bg-white p-4 border border-[var(--border-light)] hover:border-[var(--border-strong)] cursor-grab active:cursor-grabbing transition-all group relative overflow-hidden select-none"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-30 transition-opacity">
                              <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
                              </svg>
                            </div>
                            
                            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1 truncate block" title={lead.name}>
                              {lead.name || "Interesse Anônimo"}
                            </h4>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono mb-2">
                              {lead.whatsapp_number.replace('@s.whatsapp.net','')}
                            </p>
                            
                            {seller && (
                              <p className="text-[10px] text-[var(--text-secondary)] font-semibold mb-3 flex items-center gap-1 bg-[var(--bg-surface-muted)] border border-[var(--border-light)] px-2 py-0.5 rounded w-fit max-w-full truncate" title={seller.name}>
                                <span className="truncate">Vendedor: {seller.name}</span>
                              </p>
                            )}
                            {!seller && <div className="h-2"></div>}
      
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9px] font-bold uppercase text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-2 py-0.5 rounded border border-[var(--border-light)] truncate max-w-[140px]" title={lead.produto || lead.detected_product || "Sem Produto"}>
                                {lead.produto || lead.detected_product || "Sem Produto"}
                              </span>
                              
                              {lead.support_attempts > 0 ? (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border border-[var(--status-critical-border)] rounded shrink-0">
                                  SLA Alerta ({lead.support_attempts})
                                </span>
                              ) : (
                                <div className="w-5 h-5 rounded bg-[var(--bg-surface-muted)] flex items-center justify-center text-[9px] font-semibold text-[var(--text-secondary)] border border-[var(--border-light)] shrink-0">
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

          {/* Controles do Canvas */}
          <div className="canvas-controls select-none">
            <button onClick={zoomOut} className="canvas-btn" title="Zoom Out">-</button>
            <span className="text-[10px] font-mono font-bold flex items-center justify-center px-1.5 text-[var(--text-secondary)] w-12">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="canvas-btn" title="Zoom In">+</button>
            <button onClick={resetZoom} className="canvas-btn" title="Resetar Posicionamento">Resetar</button>
          </div>
        </div>
      ) : (
        /* FILA SDR (TRIAGEM) */
        <div className="flex-1 w-full bg-white overflow-y-auto px-8 pt-24 pb-8 select-none">
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            
            {/* Ferramentas e Filtros de Fila SDR */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[var(--border-light)] pb-4 gap-4">
              <div>
                <h3 className="text-base font-bold">Fila de Qualificação</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Acompanhamento e triagem inteligente de conversas da IA</p>
              </div>

              {/* Filtros Segmentados da Fila */}
              <div className="tabs-container-clean">
                <button 
                  onClick={() => setSdrFilter('incomplete')} 
                  className={`tab-item-clean ${sdrFilter === 'incomplete' ? 'active' : ''}`}
                >
                  Pendentes
                </button>
                <button 
                  onClick={() => setSdrFilter('complete')} 
                  className={`tab-item-clean ${sdrFilter === 'complete' ? 'active' : ''}`}
                >
                  Qualificados
                </button>
                <button 
                  onClick={() => setSdrFilter('outros')} 
                  className={`tab-item-clean ${sdrFilter === 'outros' ? 'active' : ''}`}
                >
                  Outros
                </button>
                <button 
                  onClick={() => setSdrFilter('all')} 
                  className={`tab-item-clean ${sdrFilter === 'all' ? 'active' : ''}`}
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Listagem Clean de Leads */}
            <div className="list-container-clean border border-[var(--border-light)]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[var(--text-muted)] animate-pulse text-xs">Carregando fila de leads...</p>
                </div>
              ) : filteredSdrLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-center bg-gray-50/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-soft)]">Nenhum Lead Encontrado</span>
                  <p className="text-[11px] text-[var(--text-muted)]">Nenhum registro corresponde aos filtros selecionados.</p>
                </div>
              ) : (
                filteredSdrLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    onClick={() => setSelectedLead(lead)}
                    className="list-item-clean flex items-center justify-between cursor-pointer transition-all hover:bg-gray-50 border-b border-[var(--border-light)] last:border-b-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-[var(--border-light)] text-sm font-bold text-[var(--text-primary)]">
                        {(lead.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)] hover:underline">
                          {lead.name || "Visitante Desconhecido"}
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                          <span>{lead.whatsapp_number.replace('@s.whatsapp.net','')}</span>
                          {(lead.company || lead.empresa) && <span className="w-1 h-1 bg-gray-300 rounded-full"></span>}
                          <span>{lead.company || lead.empresa}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="hidden md:block text-right">
                        <p className="text-[9px] text-[var(--text-soft)] uppercase font-bold tracking-wider mb-0.5">Produto Interesse</p>
                        <p className="text-xs text-[var(--text-primary)] font-semibold">
                          {lead.detected_product || lead.produto || "Não Identificado"}
                        </p>
                      </div>

                      <div className="text-right min-w-[120px]">
                        <span className={`text-[9px] px-2.5 py-0.5 rounded font-bold uppercase border ${
                          lead.status === 'SDR_QUALIFICATION' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {lead.status === 'SDR_QUALIFICATION' ? 'Qualificando' : 
                           lead.status === 'OTHER_DEPARTMENT' || lead.status === 'CANCELED' ? 'Outro Setor' : 
                           'Qualificado'}
                        </span>
                        <p className="text-[10px] text-[var(--text-soft)] mt-1.5 font-mono">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

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
