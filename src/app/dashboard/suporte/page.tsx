"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";


export default function SupportDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    waitingSeller: 0,
    criticalSLA: 0,
    slaCompliance: 0,
    avgResponseMinutes: 0,
    bottlenecksByType: [] as any[],
    sellerPerformance: [] as any[],
    criticalLeads: [] as any[],
    escalations: [] as any[],
    bottlenecks: [] as any[]
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 4000); }

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
        loadData();
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
        loadData();
      }
    } catch (err: any) {
      alert('Erro de conexão: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    loadData();
    const sub = supabase.channel('support_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_bottlenecks' }, loadData).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function loadData() {
    setLoading(true);
    
    // 1. Leads em espera e Críticos
    const { data: leads } = await supabase
      .from('leads')
      .select('*, admin_users:current_owner_id(name)');
    const waiting = leads?.filter(l => l.status === 'WAITING_SELLER') || [];
    
    // 2. Gargalos
    const { data: bts } = await supabase.from('attendance_bottlenecks').select('*, leads(name)').order('created_at', { ascending: false });
    
    // 3. Performance de Vendedores
    const { data: users } = await supabase.from('admin_users').select('id, name, team_id');
    const { data: followups } = await supabase.from('lead_follow_ups').select('*');

    // Cálculos de métricas
    const total = leads?.length || 0;
    const critical = waiting.filter(l => {
      const waitTime = (new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60);
      return waitTime > 40; // Mais de 40 min sem resposta
    }).length;

    // Agrupar gargalos para gráfico
    const btGroups = bts?.reduce((acc: any, curr) => {
      acc[curr.bottleneck_type] = (acc[curr.bottleneck_type] || 0) + 1;
      return acc;
    }, {});
    const chartData = Object.keys(btGroups || {}).map(key => ({ name: key, value: btGroups[key] }));

    // Escalações
    const { data: esc } = await supabase
      .from('supervisor_escalations')
      .select('*, leads(name), admin_users:user_id(name)')
      .order('created_at', { ascending: false });

    // 4. Calcular Tempo Médio de Resposta via Histórico
    let avgResponse = 0;
    const { data: history } = await supabase
      .from('lead_status_history')
      .select('lead_id, to_status, created_at')
      .order('created_at', { ascending: true });

    if (history && history.length > 0) {
      const waitStarts: Record<string, number> = {};
      const responseTimes: number[] = [];

      history.forEach(h => {
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

    setStats({
      totalLeads: total,
      waitingSeller: waiting.length,
      criticalSLA: critical,
      slaCompliance: total > 0 ? Math.round(((total - critical) / total) * 100) : 100,
      avgResponseMinutes: avgResponse,
      bottlenecksByType: chartData,
      sellerPerformance: users?.map(u => ({
        name: u.name,
        leads: leads?.filter(l => l.current_owner_id === u.id).length || 0,
        escalations: esc?.filter(e => e.user_id === u.id).length || 0
      })).sort((a, b) => b.leads - a.leads).slice(0, 5) || [],
      criticalLeads: waiting.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()).slice(0, 10),
      escalations: esc || [],
      bottlenecks: bts || []
    });

    setLoading(false);
  }

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'text-[var(--status-critical-text)] bg-[var(--status-critical-bg)] border-[var(--status-critical-border)]';
    if (severity === 'high') return 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] border-[var(--border-strong)]';
    return 'text-[var(--text-muted)] bg-[var(--bg-surface-muted)] border-[var(--border-light)]';
  };

  const chartColors = ["#111111", "#333333", "#666666", "#a3a3a3", "#d4d4d4"];

  return (
    <div className="w-full h-full text-[var(--text-primary)] bg-white overflow-y-auto">
      {msg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#111111] text-white text-xs px-4 py-3 rounded-md border border-[var(--border-strong)] shadow-md">
          {msg}
        </div>
      )}
      
      <header className="page-header">
        <h1 className="page-title">Lino Suporte</h1>
        <p className="page-description">Monitoramento de fiscalização e gargalos de atendimento B2B</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-8 max-w-[1200px]">
          
          {/* KPI CARDS */}
          <div className="metrics-grid">
            <StatCard title="Leads em Suporte" value={stats.totalLeads} sub="Total histórico" />
            <StatCard title="Aguardando Vendedor" value={stats.waitingSeller} sub={`${stats.criticalSLA} Críticos (>40m)`} />
            <StatCard title="SLA Compliance" value={`${stats.slaCompliance}%`} sub="Meta: 95%" />
            <StatCard title="Tempo Médio Resposta" value={`${stats.avgResponseMinutes} min`} sub="Últimas 24h" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* GRÁFICO DE GARGALOS */}
            <div className="xl:col-span-2 content-block">
              <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Tipos de Gargalos Detectados</h3>
              </div>
              <div className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.bottlenecksByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-soft)" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--text-soft)" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#111111" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PERFORMANCE VENDEDORES */}
            <div className="content-block">
              <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Performance Recente</h3>
              </div>
              <div className="p-4 space-y-3">
                {stats.sellerPerformance.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded border border-[var(--border-light)] text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-light)] px-1.5 py-0.5 rounded font-mono">Leads: {s.leads}</span>
                      {s.escalations > 0 && <span className="text-[10px] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border border-[var(--status-critical-border)] px-1.5 py-0.5 rounded font-mono font-semibold">SLA Falhas: {s.escalations}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MONITORAMENTO CRÍTICO */}
          <div className="content-block">
            <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Monitoramento de Leads Estagnados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider border-b border-[var(--border-light)]">
                    <th>Lead</th>
                    <th>Status</th>
                    <th>Vendedor</th>
                    <th>Tempo de Espera</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {stats.criticalLeads.map((l, i) => {
                    const waitMin = Math.round((new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60));
                    const isCritical = waitMin > 40;
                    return (
                      <tr key={i} className="hover:bg-[var(--bg-surface-muted)] transition-colors">
                        <td>
                          <div className="font-semibold text-sm text-[var(--text-primary)]">{l.name}</div>
                          <div className="text-[10px] text-[var(--text-soft)] font-mono">{l.whatsapp_number}</div>
                        </td>
                        <td>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${isCritical ? 'bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border border-[var(--status-critical-border)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-light)]'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="text-[var(--text-secondary)]">{l.admin_users?.name || 'Não atribuído'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={isCritical ? 'text-[var(--status-critical-text)] font-semibold font-mono' : 'text-[var(--text-secondary)] font-mono'}>{waitMin} min</span>
                          </div>
                        </td>
                        <td className="text-right space-x-2">
                           <button 
                             onClick={() => handleNotify(l.id)} 
                             disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                             className="text-[11px] btn-secondary h-8 transition-all disabled:opacity-50 cursor-pointer"
                           >
                             {actionLoading === `notify-${l.id}` ? 'Enviando...' : 'Notificar'}
                           </button>
                           <button 
                             onClick={() => handleEscalate(l.id)} 
                             disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                             className="text-[11px] btn-primary bg-black hover:bg-neutral-800 h-8 transition-all disabled:opacity-50 cursor-pointer"
                           >
                             {actionLoading === `escalate-${l.id}` ? 'Escalando...' : 'Escalar'}
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* AUDITORIA DE GARGALOS */}
            <div className="content-block">
              <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Log de Auditoria de Gargalos</h3>
              </div>
              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide text-xs">
                {stats.bottlenecks.map((b, i) => (
                  <div key={i} className={`p-4 rounded border ${getSeverityColor(b.severity)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">{b.bottleneck_type}</span>
                      <span className="text-[10px] text-[var(--text-soft)]">{new Date(b.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="font-semibold mb-1">Lead: {b.leads?.name || 'N/A'}</p>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{b.description}</p>
                    <div className="mt-2 text-[10px] font-bold">Tempo de Espera: {b.hours_waited}h</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ESCALAÇÕES PARA SUPERVISOR */}
            <div className="content-block">
              <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-sidebar)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Escalações de Supervisão</h3>
              </div>
              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {stats.escalations.map((e, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white rounded border border-[var(--border-light)] text-xs">
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{e.leads?.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${e.resolved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border-[var(--status-critical-border)]'}`}>
                          {e.resolved ? 'Resolvido' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Vendedor: {e.admin_users?.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-2 bg-[var(--bg-surface-muted)] p-2 rounded border border-[var(--border-light)] italic">"{e.escalation_reason}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: any) {
  const isCritical = title.toLowerCase().includes("vendedor") && parseInt(value) > 0;
  return (
    <div className={`metric-card ${isCritical ? 'critical' : ''}`}>
      <span className="metric-label">{title}</span>
      <span className="metric-value">{value}</span>
      <span className="metric-subtext">{sub}</span>
    </div>
  );
}
