"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  SDR_QUALIFICATION: "Qualificando",
  WAITING_SELLER: "Aguardando",
  IN_NEGOTIATION: "Negociando",
  CLOSED_WON: "Fechado",
  CLOSED_LOST: "Perdido",
};

export default function UnifiedDashboardPage() {
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'support' | 'logs'>('metrics');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estados de Dados
  const [leads, setLeads] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [leadHistory, setLeadHistory] = useState<any[]>([]);
  const [justificativa, setJustificativa] = useState("");

  // Estados calculados de Suporte
  const [supportStats, setSupportStats] = useState({
    avgResponseMinutes: 0,
    bottlenecksByType: [] as any[],
    sellerPerformance: [] as any[],
    criticalLeads: [] as any[],
  });

  const flash = (t: string) => { 
    setMsg(t); 
    setTimeout(() => setMsg(""), 4000); 
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Busca leads brutos
      const { data: leadsData } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      // 2. Busca vendedores
      const { data: users } = await supabase.from("admin_users").select("id, name");
      // 3. Busca gargalos de suporte
      const { data: bts } = await supabase.from("attendance_bottlenecks").select("*, leads(name)").order("created_at", { ascending: false });
      // 4. Busca escalações
      const { data: esc } = await supabase.from("supervisor_escalations").select("*, leads(name), admin_users:user_id(name)").order("created_at", { ascending: false });
      // 5. Busca logs de debug
      const { data: logsData } = await supabase.from("debug_logs").select("*").order("created_at", { ascending: false }).limit(100);
      // 6. Busca histórico de status para cálculo de SLA
      const { data: statusHistory } = await supabase.from('lead_status_history').select('lead_id, to_status, created_at').order('created_at', { ascending: true });

      const mappedUsers = users || [];
      const mappedLeads = (leadsData || []).map(l => ({
        ...l,
        vendedor_nome: mappedUsers.find(u => u.id === l.current_owner_id)?.name || "Não atribuído"
      }));

      setLeads(mappedLeads);
      setAdminUsers(mappedUsers);
      setBottlenecks(bts || []);
      setEscalations(esc || []);
      
      const mappedLogs = (logsData || []).map(log => ({
        ...log,
        leads: leadsData?.find(l => l.id === log.lead_id)
      }));
      setLogs(mappedLogs);

      // Cálculos de SLA e Métricas de Suporte
      const waitingLeads = mappedLeads.filter(l => l.status === 'WAITING_SELLER');
      const criticalWaiting = waitingLeads.filter(l => {
        const waitTime = (new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60);
        return waitTime > 40; // Estagnado > 40 minutos
      });

      // Agrupar gargalos por tipo para o gráfico
      const btGroups = (bts || []).reduce((acc: any, curr) => {
        acc[curr.bottleneck_type] = (acc[curr.bottleneck_type] || 0) + 1;
        return acc;
      }, {});
      const chartData = Object.keys(btGroups).map(key => ({ name: key, value: btGroups[key] }));

      // Performance de Vendedores
      const sellerPerf = mappedUsers.map(u => ({
        name: u.name,
        leads: mappedLeads.filter(l => l.current_owner_id === u.id).length,
        escalations: (esc || []).filter(e => e.user_id === u.id).length
      })).sort((a, b) => b.leads - a.leads).slice(0, 5);

      // Calcular Tempo Médio de Resposta
      let avgResponse = 0;
      if (statusHistory && statusHistory.length > 0) {
        const waitStarts: Record<string, number> = {};
        const responseTimes: number[] = [];

        statusHistory.forEach(h => {
          if (h.to_status === 'WAITING_SELLER' || h.to_status === 'SENT_TO_SELLER') {
            waitStarts[h.lead_id] = new Date(h.created_at).getTime();
          } else if (h.to_status === 'IN_NEGOTIATION' || h.to_status === 'ATTENDANCE_STARTED' || h.to_status === 'SELLER_RECEIVED') {
            if (waitStarts[h.lead_id]) {
              const diffMin = (new Date(h.created_at).getTime() - waitStarts[h.lead_id]) / (1000 * 60);
              if (diffMin >= 0) responseTimes.push(diffMin);
              delete waitStarts[h.lead_id];
            }
          }
        });

        if (responseTimes.length > 0) {
          const sum = responseTimes.reduce((acc, val) => acc + val, 0);
          avgResponse = Math.round(sum / responseTimes.length);
        }
      }

      setSupportStats({
        avgResponseMinutes: avgResponse,
        bottlenecksByType: chartData,
        sellerPerformance: sellerPerf,
        criticalLeads: waitingLeads.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()).slice(0, 10),
      });

    } catch (e) {
      console.error("Erro ao carregar dados do dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Inscreve no canal de alterações de gargalos e logs para tempo real
    const btChannel = supabase.channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_bottlenecks' }, loadAllData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debug_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(btChannel);
    };
  }, []);

  // Monitora seleção de lead para o histórico
  useEffect(() => {
    if (selectedLead) {
      setJustificativa(selectedLead.qualification_state?.valores?.justificativa_sla || "");
      supabase.from("interactions")
        .select("*")
        .eq("lead_id", selectedLead.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (data) setLeadHistory(data);
        });
    }
  }, [selectedLead]);

  // Ações de Suporte (Notificar e Escalar)
  async function handleNotify(leadId: string) {
    setActionLoading(`notify-${leadId}`);
    try {
      const res = await fetch('/api/support/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Erro: ' + (data.error || 'Falha ao notificar'));
      } else {
        flash('✔ Vendedor notificado com sucesso!');
        loadAllData();
      }
    } catch (err: any) {
      alert('Erro de conexão: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEscalate(leadId: string) {
    if (!confirm('Deseja realmente escalar este lead para o supervisor?')) return;
    setActionLoading(`escalate-${leadId}`);
    try {
      const res = await fetch('/api/support/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Erro: ' + (data.error || 'Falha ao escalar'));
      } else {
        flash('✔ Lead escalado para supervisor com sucesso!');
        loadAllData();
      }
    } catch (err: any) {
      alert('Erro de conexão: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveJustificativa() {
    if (!selectedLead) return;
    setActionLoading('save-justificativa');
    try {
      const qState = selectedLead.qualification_state || { valores: {}, tentativas: {} };
      if (!qState.valores) qState.valores = {};
      qState.valores.justificativa_sla = justificativa;

      // Atualiza o state e salva
      await supabase.from('leads').update({ qualification_state: qState }).eq('id', selectedLead.id);
      
      // Registra como nota no histórico
      await supabase.from('interactions').insert([{
        lead_id: selectedLead.id,
        sender_type: 'system',
        message_content: `[JUSTIFICATIVA VENDEDOR]: ${justificativa}`
      }]);

      flash('✔ Justificativa salva e SLA documentado!');
      loadAllData();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  // Estatísticas e Cálculos
  const totalLeadsCount = leads.length;
  const fechadosCount = leads.filter((l) => l.status === "CLOSED_WON").length;
  const conversionRate = totalLeadsCount > 0 ? Math.round((fechadosCount / totalLeadsCount) * 100) : 0;
  const porStatus: Record<string, number> = {};
  leads.forEach((l) => { porStatus[l.status] = (porStatus[l.status] || 0) + 1; });

  const waitingSellerCount = leads.filter(l => l.status === 'WAITING_SELLER').length;
  const criticalSLACount = leads.filter(l => {
    if (l.status !== 'WAITING_SELLER') return false;
    const waitTime = (new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60);
    return waitTime > 40;
  }).length;

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

  // Auxiliares de Estilo
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
      case 'WARN': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'DEBUG': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'text-[var(--status-critical-text)] bg-[var(--status-critical-bg)] border-[var(--status-critical-border)]';
    if (severity === 'high') return 'text-neutral-900 bg-neutral-50 border-neutral-300';
    return 'text-neutral-600 bg-neutral-50 border-neutral-200';
  };

  return (
    <div className="w-full h-full text-[var(--text-primary)] bg-white overflow-y-auto select-none">
      {msg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#111111] text-white text-xs px-4 py-3 rounded-md border border-[var(--border-strong)] shadow-md animate-fade-in">
          {msg}
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className={`p-8 md:p-10 transition-all duration-300 ${selectedLead ? 'pr-[470px]' : ''}`}>
        
        {/* Cabeçalho do Painel com Abas de Roteamento Internas */}
        <header className="page-header flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-8">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Central de Métricas</h1>
              <p className="text-[var(--text-muted)] mt-0.5 text-[10px] font-medium uppercase tracking-wider">Visão macro, SLA e auditoria operacional</p>
            </div>

            {/* Controle Segmentado das Sub-abas */}
            <div className="tabs-container-clean">
              <button 
                onClick={() => setActiveSubTab('metrics')} 
                className={`tab-item-clean ${activeSubTab === 'metrics' ? 'active' : ''}`}
              >
                Indicadores
              </button>
              <button 
                onClick={() => setActiveSubTab('support')} 
                className={`tab-item-clean ${activeSubTab === 'support' ? 'active' : ''}`}
              >
                SLA & Suporte
              </button>
              <button 
                onClick={() => setActiveSubTab('logs')} 
                className={`tab-item-clean ${activeSubTab === 'logs' ? 'active' : ''}`}
              >
                Logs do Sistema
              </button>
            </div>
          </div>

          <button onClick={loadAllData} className="btn-secondary h-9 px-4 text-xs font-bold self-start sm:self-auto">
            Recarregar Dados
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[var(--text-muted)] mt-3 text-xs animate-pulse">Buscando indicadores operacionais...</p>
          </div>
        ) : (
          <>
            {/* 1. ABA INDICADORES DE VENDAS */}
            {activeSubTab === 'metrics' && (
              <div className="space-y-8 animate-fade-in">
                {/* KPIs Superiores */}
                <div className="metrics-grid">
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Total de Leads</span>
                    <span className="metric-value">{totalLeadsCount}</span>
                    <span className="metric-subtext">Registrados no CRM</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Vendas Concluídas</span>
                    <span className="metric-value">{fechadosCount}</span>
                    <span className="metric-subtext">Fase CLOSED_WON</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Taxa de Conversão</span>
                    <span className="metric-value">{conversionRate}%</span>
                    <span className="metric-subtext">Leads fechados</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">SDR Qualificando</span>
                    <span className="metric-value">{porStatus["SDR_QUALIFICATION"] || 0}</span>
                    <span className="metric-subtext">Triagem inicial IA</span>
                  </div>
                  <div className={`metric-card bg-white border p-5 rounded-lg ${waitingSellerCount > 0 ? 'critical' : 'border-[var(--border-light)]'}`}>
                    <span className="metric-label">Aguardando Vendedor</span>
                    <span className="metric-value">{waitingSellerCount}</span>
                    <span className="metric-subtext">{criticalSLACount} leads com SLA em risco</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Gargalos Recentes */}
                  <div className="lg:col-span-1 content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Gargalos Recentes</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {bottlenecks.slice(0, 4).map(b => (
                        <div key={b.id} className="p-3 bg-gray-50 border border-[var(--border-light)] rounded text-xs">
                          <div className="flex justify-between font-bold mb-1">
                            <span className="text-[var(--text-primary)]">{b.leads?.name || "Lead"}</span>
                            <span className={b.severity === 'critical' ? 'text-[var(--status-critical-text)] uppercase font-bold text-[9px]' : 'text-[var(--text-muted)] uppercase text-[9px]'}>
                              {b.severity}
                            </span>
                          </div>
                          <p className="text-[var(--text-muted)] mt-1 text-[11px] leading-relaxed">{b.description}</p>
                        </div>
                      ))}
                      {bottlenecks.length === 0 && (
                        <p className="text-xs text-[var(--text-soft)] text-center py-8">Nenhum gargalo detectado na operação.</p>
                      )}
                    </div>
                  </div>

                  {/* Fluxo Semanal */}
                  <div className="lg:col-span-2 content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Novos Leads (Últimos 7 dias)</h3>
                    </div>
                    <div className="p-6 flex items-end gap-4 h-56 bg-white">
                      {porDia.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div 
                            className="w-full bg-[#111111] hover:bg-neutral-800 transition-colors rounded-t" 
                            style={{ height: `${(d.count / maxDia) * 100}%`, minHeight: '4px' }}
                            title={`${d.count} novos leads`}
                          ></div>
                          <span className="text-[10px] font-bold text-[var(--text-muted)]">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tabela de Atividade Recente */}
                <div className="content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Atividade Recente dos Leads</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[var(--border-light)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                          <th className="p-4">Lead</th>
                          <th className="p-4">Produto Interesse</th>
                          <th className="p-4">Etapa Atual</th>
                          <th className="p-4">Responsável</th>
                          <th className="p-4 text-right">Criado em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {leads.slice(0, 10).map((lead) => (
                          <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-sm text-[var(--text-primary)]">{lead.name || "Interesse Anônimo"}</div>
                              <div className="text-[10px] text-[var(--text-soft)] font-mono mt-0.5">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</div>
                            </td>
                            <td className="p-4 text-xs font-semibold text-neutral-800">
                              {lead.detected_product || lead.produto || "—"}
                            </td>
                            <td className="p-4">
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-[var(--border-light)] bg-gray-100/80 text-neutral-700">
                                {STATUS_LABELS[lead.status] || lead.status}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-semibold text-neutral-800">{lead.vendedor_nome}</td>
                            <td className="p-4 text-right text-[10px] text-[var(--text-soft)] font-mono">
                              {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ABA SLA & SUPORTE */}
            {activeSubTab === 'support' && (
              <div className="space-y-8 animate-fade-in">
                {/* KPIs Suporte */}
                <div className="metrics-grid">
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Leads em Espera</span>
                    <span className="metric-value">{supportStats.criticalLeads.length}</span>
                    <span className="metric-subtext">Aguardando vendedor</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Meta de Resposta B2B</span>
                    <span className="metric-value">40 min</span>
                    <span className="metric-subtext">Acordo de nível de serviço</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Média Resposta (SLA)</span>
                    <span className="metric-value">{supportStats.avgResponseMinutes} min</span>
                    <span className="metric-subtext">Fase WAITING_SELLER</span>
                  </div>
                  <div className="metric-card bg-white border border-[var(--border-light)] p-5 rounded-lg">
                    <span className="metric-label">Incidentes Gravados</span>
                    <span className="metric-value">{bottlenecks.length}</span>
                    <span className="metric-subtext">Histórico total de gargalos</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Gráfico de Tipos de Gargalos */}
                  <div className="xl:col-span-2 content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Tipos de Gargalos Detectados</h3>
                    </div>
                    <div className="p-6 h-[300px] bg-white">
                      {supportStats.bottlenecksByType.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-xs text-[var(--text-soft)]">
                          Nenhum gargalo com dados suficientes para gerar o gráfico.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={supportStats.bottlenecksByType}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f3" vertical={false} />
                            <XAxis dataKey="name" stroke="#888888" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#888888" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '11px' }} />
                            <Bar dataKey="value" fill="#111111" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Performance Recente */}
                  <div className="content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Carga de Vendedores & Falhas</h3>
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      {supportStats.sellerPerformance.map((s: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-[var(--border-light)] rounded text-xs">
                          <span className="font-bold text-[var(--text-primary)]">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white text-neutral-700 border border-[var(--border-light)] px-2 py-0.5 rounded font-mono font-semibold">Leads: {s.leads}</span>
                            {s.escalations > 0 && (
                              <span className="text-[10px] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border border-[var(--status-critical-border)] px-2 py-0.5 rounded font-mono font-bold">
                                Falhas: {s.escalations}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monitoramento de Leads Estagnados */}
                <div className="content-block border border-[var(--border-light)] rounded-lg overflow-hidden bg-white">
                  <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Monitoramento de SLA em Tempo Real</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[var(--border-light)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                          <th className="p-4">Lead Estagnado</th>
                          <th className="p-4">Etapa</th>
                          <th className="p-4">Vendedor Atribuído</th>
                          <th className="p-4">Espera Ininterrupta</th>
                          <th className="p-4 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {supportStats.criticalLeads.map((l: any, i: number) => {
                          const waitMin = Math.round((new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60));
                          const isCritical = waitMin > 40;
                          return (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-sm text-[var(--text-primary)]">{l.name}</div>
                                <div className="text-[10px] text-[var(--text-soft)] font-mono mt-0.5">{l.whatsapp_number}</div>
                              </td>
                              <td className="p-4">
                                <span className={`text-[9px] px-2.5 py-0.5 rounded font-bold uppercase border ${
                                  isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="p-4 text-xs font-semibold text-neutral-800">{l.admin_users?.name || 'Não atribuído'}</td>
                              <td className="p-4 font-mono font-bold text-xs">
                                <span className={isCritical ? 'text-red-600' : 'text-neutral-700'}>{waitMin} min</span>
                              </td>
                              <td className="p-4 text-right space-x-2">
                                <button 
                                  onClick={() => handleNotify(l.id)} 
                                  disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                                  className="btn-secondary h-8 text-[11px] font-bold"
                                >
                                  {actionLoading === `notify-${l.id}` ? 'Notificando...' : 'WhatsApp Alert'}
                                </button>
                                <button 
                                  onClick={() => handleEscalate(l.id)} 
                                  disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                                  className="btn-primary h-8 text-[11px] font-bold"
                                >
                                  {actionLoading === `escalate-${l.id}` ? 'Escalando...' : 'Escalar Supervisor'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {supportStats.criticalLeads.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-xs text-[var(--text-soft)] uppercase font-bold bg-gray-50/35">
                              Nenhum lead estagnado aguardando vendedor no momento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Logs e Escalações de Suporte */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Auditoria de Gargalos */}
                  <div className="content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Histórico de Incidentes Operacionais</h3>
                    </div>
                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto bg-white scrollbar-hide">
                      {bottlenecks.map((b, i) => (
                        <div key={i} className={`p-4 rounded border text-xs ${getSeverityColor(b.severity)}`}>
                          <div className="flex justify-between items-start mb-2 font-bold text-[9px] uppercase tracking-wider">
                            <span>{b.bottleneck_type}</span>
                            <span className="text-[var(--text-soft)]">{new Date(b.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="font-bold text-sm text-neutral-800 mb-1">Lead: {b.leads?.name || 'N/A'}</p>
                          <p className="text-[11px] text-neutral-600 leading-relaxed">{b.description}</p>
                          <div className="mt-3 text-[10px] font-bold font-mono">Tempo de Espera Acumulado: {b.hours_waited}h</div>
                        </div>
                      ))}
                      {bottlenecks.length === 0 && (
                        <p className="text-xs text-[var(--text-soft)] text-center py-10 uppercase font-bold">Nenhum incidente registrado.</p>
                      )}
                    </div>
                  </div>

                  {/* Escalações de Supervisão */}
                  <div className="content-block border border-[var(--border-light)] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-light)] bg-gray-50/50">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Incidentes Escalados para Supervisor</h3>
                    </div>
                    <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto bg-white scrollbar-hide">
                      {escalations.map((e, i) => (
                        <div key={i} className="p-4 bg-gray-50 rounded border border-[var(--border-light)] text-xs">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-neutral-800">{e.leads?.name}</h4>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                              e.resolved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {e.resolved ? 'Resolvido' : 'Pendente'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 mt-1 font-semibold">Vendedor Inoperante: {e.admin_users?.name}</p>
                          <p className="text-[10px] text-neutral-600 mt-3 bg-white p-3 rounded border border-[var(--border-light)] italic leading-relaxed">
                            "{e.escalation_reason}"
                          </p>
                        </div>
                      ))}
                      {escalations.length === 0 && (
                        <p className="text-xs text-[var(--text-soft)] text-center py-10 uppercase font-bold">Nenhuma escalação ativa.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ABA LOGS DO SISTEMA */}
            {activeSubTab === 'logs' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-[var(--border-light)] pb-4">
                  <div>
                    <h3 className="text-base font-bold">Debug & Audit Logs</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Rastreio em tempo real de webhooks, OpenAI e roteamento</p>
                  </div>
                </div>

                <div className="list-container-clean border border-[var(--border-light)] bg-white rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[var(--border-light)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                          <th className="p-4 w-40">Data/Hora</th>
                          <th className="p-4 w-24">Nível</th>
                          <th className="p-4 w-32">Módulo</th>
                          <th className="p-4">Ação / Resumo</th>
                          <th className="p-4">Contexto Lead</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-[10px] font-mono text-[var(--text-muted)]">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-4">
                              <span className={`text-[8px] px-2 py-0.5 rounded font-bold border ${getLevelColor(log.level)}`}>
                                {log.level}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-[9px] font-bold uppercase text-[var(--text-muted)]">{log.module}</span>
                            </td>
                            <td className="p-4">
                              <div className="text-xs font-bold text-[var(--text-primary)] mb-1">{log.action}</div>
                              <pre className="text-[9px] font-mono text-neutral-600 bg-neutral-50 border border-neutral-200 p-3 rounded max-h-24 overflow-y-auto scrollbar-hide">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </td>
                            <td className="p-4">
                              {log.leads ? (
                                <div>
                                  <div className="text-xs font-bold text-[var(--text-primary)]">{log.leads.name}</div>
                                  <div className="text-[9px] text-[var(--text-soft)] font-mono mt-0.5">{log.leads.whatsapp_number}</div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-[var(--text-soft)] italic">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {logs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-20 text-center text-xs text-[var(--text-soft)] uppercase font-bold">
                              Nenhum log registrado no banco de dados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* COMPILADOR DE DADOS (Drawer lateral unificado) */}
      <div className={`fixed top-0 right-0 h-screen w-[450px] bg-white border-l border-[var(--border-strong)] transition-transform duration-300 transform z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLead && (
          <>
            <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-sidebar)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Compilador do Lead</h3>
              <button onClick={() => setSelectedLead(null)} className="text-[var(--text-muted)] hover:text-black cursor-pointer text-sm">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide text-xs bg-white">
              <section className="bg-gray-50 p-4 rounded border border-[var(--border-light)]">
                <h5 className="text-[9px] text-[var(--text-soft)] font-bold uppercase mb-4 tracking-wider">Informações Extraídas pela IA</h5>
                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div><span className="text-[var(--text-soft)] text-[9px] uppercase">Nome:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.name || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[9px] uppercase">Empresa:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.empresa || selectedLead.company || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[9px] uppercase">CNPJ:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.cnpj || "—"}</p></div>
                  <div><span className="text-[var(--text-soft)] text-[9px] uppercase">E-mail:</span> <p className="font-bold text-[var(--text-primary)]">{selectedLead.email_corporativo || selectedLead.email || "—"}</p></div>
                  <div className="pt-4 border-t border-[var(--border-light)]">
                    <span className="text-[var(--text-soft)] text-[9px] uppercase">Produto Comercial:</span> 
                    <p className="font-bold text-[var(--text-primary)]">{selectedLead.produto || selectedLead.detected_product || "—"}</p>
                    <p className="text-[var(--text-muted)] mt-1.5 leading-relaxed">{selectedLead.especificacao || "Sem detalhes adicionais fornecidos."}</p>
                  </div>
                  <div className="pt-4 border-t border-[var(--border-light)] flex justify-between items-center">
                    <span className="text-[var(--text-soft)] text-[9px] uppercase">Habilidade de Roteamento:</span> 
                    <span className="px-2 py-0.5 bg-white text-[var(--text-primary)] text-[9px] font-bold rounded border border-[var(--border-light)]">
                      {selectedLead.last_skill_used || "SDR General"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="text-[9px] text-[var(--text-soft)] font-bold uppercase tracking-wider">Metadados e SLA</h5>
                <div className="flex justify-between p-3 bg-gray-50 rounded border border-[var(--border-light)]">
                  <span className="text-[9px] text-[var(--text-soft)] uppercase">Vendedor:</span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{selectedLead.vendedor_nome}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded border border-[var(--border-light)]">
                  <span className="text-[9px] text-[var(--text-soft)] uppercase">WhatsApp Notificado:</span>
                  <span className={`text-[9px] font-bold ${selectedLead.sent_to_seller_at ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedLead.sent_to_seller_at ? 'SIM' : 'NÃO'}
                  </span>
                </div>
                
                <div className="pt-2">
                  <label className="text-[9px] text-[var(--text-soft)] font-bold uppercase tracking-wider block mb-1">Justificativa de SLA</label>
                  <textarea 
                    rows={2} 
                    value={justificativa} 
                    onChange={(e) => setJustificativa(e.target.value)} 
                    placeholder="Se o lead não responde ou o orçamento travou, justifique aqui..."
                    className="w-full bg-white border border-[var(--border-light)] rounded p-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-all resize-none mb-2" 
                  />
                  <button 
                    onClick={handleSaveJustificativa}
                    disabled={actionLoading === 'save-justificativa'}
                    className="btn-secondary w-full py-1.5 text-[10px] font-bold"
                  >
                    {actionLoading === 'save-justificativa' ? 'Salvando...' : 'Salvar Justificativa'}
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="text-[9px] text-[var(--text-soft)] font-bold uppercase tracking-wider">Histórico de Mensagens</h5>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {leadHistory.map((msg, i) => (
                    <div key={i} className={`p-3 rounded text-xs border ${msg.sender_type === 'lead' ? 'bg-white text-neutral-700 border-neutral-200' : 'bg-neutral-50 text-neutral-800 border-neutral-200'}`}>
                      <div className="text-[9px] text-[var(--text-soft)] uppercase font-bold mb-1 font-mono">{msg.sender_type === 'lead' ? 'Cliente' : 'IA Lino'}</div>
                      <p className="leading-relaxed">{msg.message_content}</p>
                    </div>
                  ))}
                  {leadHistory.length === 0 && (
                    <p className="text-xs text-[var(--text-soft)] italic text-center py-4">Nenhuma mensagem registrada.</p>
                  )}
                </div>
              </section>
            </div>
            
            <div className="p-6 bg-[var(--bg-sidebar)] border-t border-[var(--border-light)]">
              <button onClick={() => setSelectedLead(null)} className="btn-primary w-full py-4 text-xs font-bold cursor-pointer">Fechar Drawer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
