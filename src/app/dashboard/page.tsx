"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  SDR_QUALIFICATION: "Qualificando",
  WAITING_SELLER: "Aguardando",
  IN_NEGOTIATION: "Negociando",
  CLOSED_WON: "Fechado",
  CLOSED_LOST: "Perdido",
};

const statusColors: Record<string, string> = {
  SDR_QUALIFICATION: "#3b82f6",
  WAITING_SELLER: "#f59e0b",
  IN_NEGOTIATION: "#8b5cf6",
  CLOSED_WON: "#10b981",
  CLOSED_LOST: "#ef4444",
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadData = async () => {
    // 1. Busca leads brutos (sempre funciona)
    const { data: leadsData } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    // 2. Busca nomes de vendedores
    const { data: users } = await supabase.from("admin_users").select("id, name");
    // 3. Busca gargalos
    const { data: bData } = await supabase.from("attendance_bottlenecks").select("*, leads(name)").order("created_at", { ascending: false }).limit(5);
    
    if (leadsData) {
      const mapped = leadsData.map(l => ({
        ...l,
        vendedor_nome: users?.find(u => u.id === l.current_owner_id)?.name || "Não atribuído"
      }));
      setLeads(mapped);
    }
    if (bData) setBottlenecks(bData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      supabase.from("interactions").select("*").eq("lead_id", selectedLead.id).order("created_at", { ascending: true })
        .then(({ data }) => { if (data) setHistory(data); });
    }
  }, [selectedLead]);

  const total = leads.length;
  const fechados = leads.filter((l) => l.status === "CLOSED_WON").length;
  const taxa = total > 0 ? Math.round((fechados / total) * 100) : 0;
  const porStatus: Record<string, number> = {};
  leads.forEach((l) => { porStatus[l.status] = (porStatus[l.status] || 0) + 1; });

  // Gráfico semanal
  const hoje = new Date();
  const porDia: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = leads.filter((l) => (l.created_at || "").slice(0, 10) === key).length;
    porDia.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, count });
  }
  const maxDia = Math.max(...porDia.map((d) => d.count), 1);

  return (
    <div className="w-full h-full text-[var(--text-primary)] bg-white overflow-hidden relative">
      {/* Conteúdo Principal */}
      <div className={`w-full transition-all duration-300 ${selectedLead ? 'pr-[450px]' : ''}`}>
        <header className="page-header flex justify-between items-start">
          <div>
            <h1 className="page-title">Lino Intelligence</h1>
            <p className="page-description">Visão estratégica da sua operação de vendas</p>
          </div>
          <button onClick={loadData} className="btn-secondary">
            Atualizar
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Total de Leads</span>
                <span className="metric-value">{total}</span>
                <span className="metric-subtext">Total histórico</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Vendas Concluídas</span>
                <span className="metric-value">{fechados}</span>
                <span className="metric-subtext">CLOSED_WON</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Taxa de Conversão</span>
                <span className="metric-value">{taxa}%</span>
                <span className="metric-subtext">Leads fechados</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">SDR em Aberto</span>
                <span className="metric-value">{porStatus["SDR_QUALIFICATION"] || 0}</span>
                <span className="metric-subtext">Fase inicial</span>
              </div>
              {/* Card de SLA Crítico com cor vermelha regulamentada */}
              <div className={`metric-card ${leads.filter(l => l.status === 'WAITING_SELLER').length > 0 ? 'critical' : ''}`}>
                <span className="metric-label">SLA em Risco</span>
                <span className="metric-value">{leads.filter(l => l.status === 'WAITING_SELLER').length}</span>
                <span className="metric-subtext">Aguardando vendedor</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              {/* Gargalos Recentes */}
              <div className="lg:col-span-1 content-block">
                <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Gargalos Recentes</h3>
                </div>
                <div className="p-4 space-y-3">
                  {bottlenecks.map(b => (
                    <div key={b.id} className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-light)] rounded text-xs">
                      <div className="flex justify-between font-semibold mb-1">
                        <span>{b.leads?.name || "Lead"}</span>
                        <span className={b.severity === 'critical' ? 'text-[var(--status-critical-text)] uppercase font-bold' : 'text-[var(--text-muted)] uppercase'}>{b.severity}</span>
                      </div>
                      <p className="text-[var(--text-muted)]">{b.description}</p>
                    </div>
                  ))}
                  {bottlenecks.length === 0 && (
                    <p className="text-xs text-[var(--text-soft)] text-center py-4">Nenhum gargalo detectado.</p>
                  )}
                </div>
              </div>

              {/* Fluxo Semanal */}
              <div className="lg:col-span-2 content-block">
                 <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Fluxo Semanal</h3>
                 </div>
                 <div className="p-6 flex items-end gap-3 h-48">
                    {porDia.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-[#111111] rounded-t" style={{ height: `${(d.count / maxDia) * 100}%`, minHeight: '4px' }}></div>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">{d.label}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Atividade Recente */}
            <div className="content-block">
              <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Atividade Recente</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] text-[var(--text-muted)] uppercase font-semibold border-b border-[var(--border-light)]">
                      <th>Lead</th>
                      <th>Produto</th>
                      <th>Status</th>
                      <th>Vendedor</th>
                      <th className="text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {leads.slice(0, 10).map((lead) => (
                      <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-[var(--bg-surface-muted)] cursor-pointer transition-colors">
                        <td>
                          <div className="font-semibold text-sm text-[var(--text-primary)]">{lead.name || "Interesse Anônimo"}</div>
                          <div className="text-[10px] text-[var(--text-soft)] font-mono">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</div>
                        </td>
                        <td className="text-xs font-medium text-[var(--link-color)]">{lead.detected_product || lead.produto || "—"}</td>
                        <td>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border border-[var(--border-light)] bg-[var(--bg-surface-muted)]">
                            {STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </td>
                        <td className="text-xs font-medium">{lead.vendedor_nome}</td>
                        <td className="text-right text-[10px] text-[var(--text-soft)] font-mono">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* COMPILADOR DE DADOS (Drawer) */}
      <div className={`fixed top-0 right-0 h-screen w-[450px] bg-white border-l border-[var(--border-strong)] transition-transform duration-300 transform z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLead && (
          <>
            <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-sidebar)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Compilador do Lead</h3>
              <button onClick={() => setSelectedLead(null)} className="text-[var(--text-muted)] hover:text-black cursor-pointer text-sm">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide text-xs">
              <section className="bg-[var(--bg-surface-muted)] p-4 rounded border border-[var(--border-light)]">
                <h5 className="text-[10px] text-[var(--text-soft)] font-bold uppercase mb-4 tracking-wider">Informações Coletadas</h5>
                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div><span className="text-[var(--text-soft)] text-[10px] uppercase">Nome:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.name || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[10px] uppercase">Empresa:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.empresa || selectedLead.company || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[10px] uppercase">CNPJ:</span> <p className="font-bold text-[var(--link-color)]">{selectedLead.cnpj || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[10px] uppercase">E-mail:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.email_corporativo || selectedLead.email || "—"}</p></div>
                  <div className="pt-4 border-t border-[var(--border-light)]">
                    <span className="text-[var(--text-soft)] text-[10px] uppercase">Produto/Demanda:</span> 
                    <p className="font-bold text-[var(--text-primary)]">{selectedLead.produto || selectedLead.detected_product || "—"}</p>
                    <p className="text-[var(--text-muted)] mt-1">{selectedLead.especificacao || "Sem detalhes adicionais."}</p>
                  </div>
                  <div className="pt-4 border-t border-[var(--border-light)] flex justify-between items-center">
                    <span className="text-[var(--text-soft)] text-[10px] uppercase">Skill Utilizada pela IA:</span> 
                    <span className="px-2 py-0.5 bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[10px] font-semibold rounded border border-[var(--border-light)]">
                      {selectedLead.last_skill_used || "SDR General"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="text-[10px] text-[var(--text-soft)] font-bold uppercase tracking-wider">Status do Atendimento</h5>
                <div className="flex justify-between p-3 bg-[var(--bg-surface-muted)] rounded border border-[var(--border-light)]">
                  <span className="text-[10px] text-[var(--text-soft)] uppercase">Vendedor:</span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{selectedLead.vendedor_nome}</span>
                </div>
                <div className="flex justify-between p-3 bg-[var(--bg-surface-muted)] rounded border border-[var(--border-light)]">
                  <span className="text-[10px] text-[var(--text-soft)] uppercase">Notificado via WhatsApp?</span>
                  <span className={`text-[10px] font-bold ${selectedLead.sent_to_seller_at ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedLead.sent_to_seller_at ? 'SIM' : 'NÃO'}
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="text-[10px] text-[var(--text-soft)] font-bold uppercase tracking-wider">Histórico Real</h5>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {history.map((msg, i) => (
                    <div key={i} className={`p-3 rounded text-xs border ${msg.sender_type === 'lead' ? 'bg-white text-[var(--text-secondary)] border-[var(--border-light)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-light)]'}`}>
                      {msg.message_content}
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="p-6 bg-[var(--bg-sidebar)] border-t border-[var(--border-light)]">
              <button onClick={() => setSelectedLead(null)} className="btn-primary w-full py-4 text-xs font-bold cursor-pointer">Fechar Compilador</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
