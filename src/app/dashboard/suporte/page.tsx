"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";

const COLORS = ["#10B981", "#F5A623", "#E5484D", "#3B82F6", "#8B5CF6"];

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
    if (severity === 'critical') return 'text-[#E5484D] bg-[#E5484D]/10 border-[#E5484D]/20';
    if (severity === 'high') return 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/20';
    return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="p-6 md:p-10 bg-[var(--theme-bg)] min-h-screen text-[var(--theme-fg)] overflow-y-auto">
      {msg && (
        <div className="fixed bottom-5 right-5 z-50 bg-green-900/90 backdrop-blur-sm border border-green-700 text-green-300 font-bold px-4 py-3 rounded-xl shadow-2xl animate-bounce">
          {msg}
        </div>
      )}
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[#171717]">LINO SUPORTE 🚨</h1>
        <p className="text-[#666666]">Monitoramento de Fiscalização e Gargalos de Atendimento B2B</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[hsl(var(--tenant-primary))]"></div>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Leads em Suporte" value={stats.totalLeads} sub="Total histórico" icon="📁" />
            <StatCard title="Aguardando Vendedor" value={stats.waitingSeller} sub={`${stats.criticalSLA} Críticos (>40m)`} icon="⏳" color={stats.criticalSLA > 0 ? "text-red-500" : ""} />
            <StatCard title="SLA Compliance" value={`${stats.slaCompliance}%`} sub="Meta: 95%" icon="🎯" color={stats.slaCompliance < 90 ? "text-orange-500" : "text-green-500"} />
            <StatCard title="Tempo Médio Resposta" value={`${stats.avgResponseMinutes} min`} sub="Últimas 24h" icon="⚡" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* GRÁFICO DE GARGALOS */}
            <div className="xl:col-span-2 bg-[var(--theme-card)] p-6 rounded-2xl border border-[var(--theme-border)] shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">📊 Tipos de Gargalos Detectados</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.bottlenecksByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #EAEAEA', borderRadius: '6px', color: '#171717' }} />
                    <Bar dataKey="value" fill="#0070F3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PERFORMANCE VENDEDORES */}
            <div className="bg-[var(--theme-card)] p-6 rounded-2xl border border-[var(--theme-border)] shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">🏆 Performance (Leads vs Escalações)</h3>
              <div className="space-y-4">
                {stats.sellerPerformance.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#FFFFFF] rounded-lg border border-[#EAEAEA]">
                    <span className="text-sm font-medium text-[#171717]">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded">Leads: {s.leads}</span>
                      {s.escalations > 0 && <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded">Escalações: {s.escalations}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MONITORAMENTO CRÍTICO */}
          <div className="bg-[var(--theme-card)] p-6 rounded-2xl border border-[var(--theme-border)] shadow-2xl overflow-hidden">
            <h3 className="font-bold mb-6 flex items-center gap-2">🚨 Monitoramento de Leads Estagnados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[#666666] text-[10px] uppercase tracking-wider border-b border-[#EAEAEA]">
                    <th className="pb-4 font-semibold">Lead</th>
                    <th className="pb-4 font-semibold">Status</th>
                    <th className="pb-4 font-semibold">Vendedor</th>
                    <th className="pb-4 font-semibold">Tempo de Espera</th>
                    <th className="pb-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)]">
                  {stats.criticalLeads.map((l, i) => {
                    const waitMin = Math.round((new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60));
                    return (
                      <tr key={i} className="group hover:bg-[#F1F5F9] transition-colors border-b border-[#EAEAEA]">
                        <td className="py-4">
                          <div className="font-semibold text-sm text-[#171717]">{l.name}</div>
                          <div className="text-[10px] text-[#666666]">{l.whatsapp_number}</div>
                        </td>
                        <td className="py-4">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase ${waitMin > 80 ? 'bg-[#E5484D]/10 text-[#E5484D] border border-[#E5484D]/20' : 'bg-[#F5A623]/10 text-yellow-800 border border-[#F5A623]/20'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-[#666666]">{l.admin_users?.name || 'Não atribuído'}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={waitMin > 80 ? 'text-[#E5484D] font-semibold' : 'text-yellow-700 font-semibold'}>{waitMin} min</span>
                            {waitMin > 80 ? '🚨' : '⚠️'}
                          </div>
                        </td>
                        <td className="py-4 text-right space-x-2">
                           <button 
                             onClick={() => handleNotify(l.id)} 
                             disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                             className="text-[11px] bg-white border border-[#D4D4D8] text-[#171717] px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] font-medium transition-all disabled:opacity-50"
                           >
                             {actionLoading === `notify-${l.id}` ? 'Enviando...' : 'Notificar'}
                           </button>
                           <button 
                             onClick={() => handleEscalate(l.id)} 
                             disabled={actionLoading === `notify-${l.id}` || actionLoading === `escalate-${l.id}`}
                             className="text-[11px] bg-[#E5484D] text-white px-3 py-1.5 rounded-md hover:bg-[#c93b40] font-medium transition-all disabled:opacity-50"
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
            <div className="bg-[var(--theme-card)] p-6 rounded-2xl border border-[var(--theme-border)] shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">🔍 Log de Auditoria de Gargalos</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {stats.bottlenecks.map((b, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${getSeverityColor(b.severity)}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest">{b.bottleneck_type}</span>
                      <span className="text-[10px] opacity-60">{new Date(b.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-xs font-medium mb-1">Lead: {b.leads?.name || 'N/A'}</p>
                    <p className="text-[10px] opacity-80">{b.description}</p>
                    <div className="mt-2 text-[10px] font-bold">Aguardou: {b.hours_waited}h</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ESCALAÇÕES PARA SUPERVISOR */}
            <div className="bg-[var(--theme-card)] p-6 rounded-2xl border border-[var(--theme-border)] shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">👨‍✈️ Escalações de Supervisão</h3>
              <div className="space-y-4">
                {stats.escalations.map((e, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-[#FFFFFF] rounded-xl border border-[#EAEAEA]">
                    <div className="w-10 h-10 bg-red-50 flex items-center justify-center rounded-lg text-lg">🚩</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold text-[#171717]">{e.leads?.name}</h4>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${e.resolved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {e.resolved ? 'Resolvido' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-xs text-[#666666] mt-0.5">Vendedor: {e.admin_users?.name}</p>
                      <p className="text-[10px] text-[#666666] mt-2 bg-[#F1F5F9] p-2 rounded border border-[#EAEAEA] italic">"{e.escalation_reason}"</p>
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

function StatCard({ title, value, sub, icon, color = "text-[#0070F3]" }: any) {
  return (
    <div className="bg-[#FFFFFF] p-6 rounded-2xl border border-[#EAEAEA] shadow-sm hover:border-[#D4D4D8] transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-[#FAFAFA] rounded-xl flex items-center justify-center text-xl border border-[#EAEAEA]">
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-xs text-[#666666] font-semibold uppercase tracking-wider mb-1">{title}</h4>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
        <p className="text-[10px] text-[#888888] mt-1 font-medium">{sub}</p>
      </div>
    </div>
  );
}
