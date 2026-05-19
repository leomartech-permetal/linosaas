"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

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
    if (severity === 'critical') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (severity === 'high') return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
  };

  return (
    <div className="p-6 md:p-10 bg-[#0a0a0a] min-h-screen text-white overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter">LINO SUPORTE 🚨</h1>
        <p className="text-gray-400">Monitoramento de Fiscalização e Gargalos de Atendimento B2B</p>
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
            <div className="xl:col-span-2 bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">📊 Tipos de Gargalos Detectados</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.bottlenecksByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="hsl(var(--tenant-primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PERFORMANCE VENDEDORES */}
            <div className="bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">🏆 Performance (Leads vs Escalações)</h3>
              <div className="space-y-4">
                {stats.sellerPerformance.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-gray-800/50">
                    <span className="text-sm font-medium">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-green-900/20 text-green-400 px-2 py-1 rounded">L: {s.leads}</span>
                      {s.escalations > 0 && <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-1 rounded">E: {s.escalations}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MONITORAMENTO CRÍTICO */}
          <div className="bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-2xl overflow-hidden">
            <h3 className="font-bold mb-6 flex items-center gap-2">🚨 Monitoramento de Leads Estagnados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-800">
                    <th className="pb-4 font-black">Lead</th>
                    <th className="pb-4 font-black">Status</th>
                    <th className="pb-4 font-black">Vendedor</th>
                    <th className="pb-4 font-black">Tempo de Espera</th>
                    <th className="pb-4 font-black text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {stats.criticalLeads.map((l, i) => {
                    const waitMin = Math.round((new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60));
                    return (
                      <tr key={i} className="group hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <div className="font-bold text-sm">{l.name}</div>
                          <div className="text-[10px] text-gray-500">{l.whatsapp_number}</div>
                        </td>
                        <td className="py-4">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${waitMin > 80 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-gray-400">{l.admin_users?.name || 'Não atribuído'}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={waitMin > 80 ? 'text-red-500' : 'text-yellow-500'}>{waitMin} min</span>
                            {waitMin > 80 ? '🚨' : '⚠️'}
                          </div>
                        </td>
                        <td className="py-4 text-right space-x-2">
                           <button className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Notificar</button>
                           <button className="text-[10px] bg-red-600/20 text-red-400 px-2 py-1 rounded border border-red-500/20 hover:bg-red-600 hover:text-white transition-all">Escalar</button>
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
            <div className="bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-2xl">
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
            <div className="bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2">👨‍✈️ Escalações de Supervisão</h3>
              <div className="space-y-4">
                {stats.escalations.map((e, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-black/20 rounded-xl border border-gray-800/50">
                    <div className="w-10 h-10 bg-red-500/10 flex items-center justify-center rounded-lg text-lg">🚩</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold">{e.leads?.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.resolved ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                          {e.resolved ? 'Resolvido' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Vendedor: {e.admin_users?.name}</p>
                      <p className="text-[10px] text-gray-400 mt-2 bg-black/40 p-2 rounded italic">"{e.escalation_reason}"</p>
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

function StatCard({ title, value, sub, icon, color = "text-[hsl(var(--tenant-primary))]" }: any) {
  return (
    <div className="bg-[#141414] p-6 rounded-2xl border border-gray-800/50 shadow-xl hover:border-[hsl(var(--tenant-primary))]/50 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-xl shadow-inner border border-gray-800">
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{title}</h4>
        <div className={`text-2xl font-black ${color}`}>{value}</div>
        <p className="text-[10px] text-gray-600 mt-1 font-medium">{sub}</p>
      </div>
    </div>
  );
}
