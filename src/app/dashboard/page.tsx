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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (data) setLeads(data);
      setLoading(false);
    }
    load();
  }, []);

  const total = leads.length;
  const fechados = leads.filter((l) => l.status === "CLOSED_WON").length;
  const taxa = total > 0 ? Math.round((fechados / total) * 100) : 0;

  const porStatus: Record<string, number> = {};
  leads.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  });

  const hoje = new Date();
  const porDia: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = leads.filter((l) => l.created_at?.slice(0, 10) === key).length;
    porDia.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, count });
  }
  const maxDia = Math.max(...porDia.map((d) => d.count), 1);

  let pieGradient = "";
  let acc = 0;
  Object.entries(porStatus).forEach(([status, count]) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const color = statusColors[status] || "#666";
    pieGradient += `${color} ${acc}% ${acc + pct}%, `;
    acc += pct;
  });
  if (!pieGradient) pieGradient = "#333 0% 100%,";

  const ultimos = leads.slice(0, 8);

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[#0a0a0a] text-white overflow-y-auto scrollbar-hide">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">Lino Intelligence</h2>
          <p className="text-gray-500 mt-1 font-medium italic">Visão estratégica da sua operação de vendas</p>
        </div>
        <div className="flex items-center gap-3 bg-[#111] p-2 rounded-xl border border-gray-800 shadow-xl">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Updates</span>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-[hsl(var(--tenant-primary))] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 animate-pulse font-bold uppercase tracking-widest text-xs">Carregando métricas de elite...</p>
        </div>
      ) : (
        <>
          {/* KPIs Estilo Premium */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: "Total de Leads", val: total, color: "white", icon: "🔥" },
              { label: "Vendas Concluídas", val: fechados, color: "#10b981", icon: "💰" },
              { label: "Taxa de Conversão", val: `${taxa}%`, color: "hsl(var(--tenant-primary))", icon: "📈" },
              { label: "SDR em Aberto", val: porStatus["SDR_QUALIFICATION"] || 0, color: "#3b82f6", icon: "🤖" },
            ].map((kpi, i) => (
              <div key={i} className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-gray-800/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-[hsl(var(--tenant-primary)/0.4)] transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-20 text-3xl group-hover:scale-125 transition-transform">{kpi.icon}</div>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">{kpi.label}</p>
                <p className="text-4xl font-black" style={{ color: kpi.color }}>{kpi.val}</p>
                <div className="mt-4 h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full bg-current opacity-30" style={{ width: '70%', color: kpi.color }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            {/* Gráfico de Barras Moderno */}
            <div className="lg:col-span-2 bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
              <h3 className="font-black text-xs text-gray-500 uppercase tracking-widest mb-8">Fluxo Semanal de Captação</h3>
              <div className="flex items-end gap-3 h-56">
                {porDia.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                    <span className="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                    <div
                      className="w-full rounded-xl transition-all duration-500 hover:brightness-125"
                      style={{
                        height: `${(d.count / maxDia) * 100}%`,
                        minHeight: d.count > 0 ? "12px" : "4px",
                        background: "linear-gradient(to top, hsl(var(--tenant-primary)), hsl(var(--tenant-primary)/0.6))",
                        boxShadow: d.count > 0 ? "0 0 20px hsl(var(--tenant-primary)/0.2)" : "none",
                      }}
                    ></div>
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribuição por Status */}
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
              <h3 className="font-black text-xs text-gray-500 uppercase tracking-widest mb-8 w-full">Composição do Funil</h3>
              <div className="relative mb-8 group">
                <div
                  className="w-40 h-40 rounded-full border-8 border-black shadow-2xl transition-transform group-hover:scale-105"
                  style={{ background: `conic-gradient(${pieGradient.slice(0, -2)})` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-[#0a0a0a] w-24 h-24 rounded-full flex flex-col items-center justify-center border border-gray-800 shadow-inner">
                    <span className="text-xl font-black">{total}</span>
                    <span className="text-[8px] text-gray-600 uppercase font-black">Leads</span>
                  </div>
                </div>
              </div>
              <div className="w-full space-y-3">
                {Object.entries(porStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: statusColors[status] || "#666", color: statusColors[status] || "#666" }}></span>
                    <span className="text-gray-400">{STATUS_LABELS[status] || status}</span>
                    <span className="ml-auto text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de Leads High-End */}
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-1 shadow-2xl overflow-hidden mb-10">
            <div className="p-8 flex justify-between items-center bg-[#161616] border-b border-gray-800">
              <h3 className="font-black text-xs text-gray-500 uppercase tracking-widest">Atividade Recente</h3>
              <a href="/dashboard/sdr" className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--tenant-primary))] bg-[hsl(var(--tenant-primary)/0.1)] px-4 py-2 rounded-full border border-[hsl(var(--tenant-primary)/0.2)] hover:bg-[hsl(var(--tenant-primary)/0.2)] transition-all">Gerenciar SDR →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-gray-600 uppercase font-black tracking-widest border-b border-gray-800">
                    <th className="p-6">Lead / Identidade</th>
                    <th className="p-6">Inteligência de Venda</th>
                    <th className="p-6">Status Operacional</th>
                    <th className="p-6 text-right">Data de Entrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {ultimos.map((lead) => (
                    <tr key={lead.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-black text-gray-500 group-hover:border-[hsl(var(--tenant-primary)/0.5)] transition-colors">
                            {(lead.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-sm text-white group-hover:text-[hsl(var(--tenant-primary))] transition-colors">{lead.name || "Interesse Anônimo"}</div>
                            <div className="text-[10px] font-bold text-gray-600 uppercase">{lead.company || lead.whatsapp_number.replace('@s.whatsapp.net','')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="text-xs font-black text-blue-400 uppercase tracking-tighter">{lead.detected_product || "Aguardando..."}</div>
                        <div className="text-[10px] font-bold text-gray-600 uppercase">{lead.detected_city || "Geolocalizando..."}</div>
                      </td>
                      <td className="p-6">
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border" style={{ 
                          backgroundColor: (statusColors[lead.status] || "#666") + "15", 
                          color: statusColors[lead.status] || "#666",
                          borderColor: (statusColors[lead.status] || "#666") + "30"
                        }}>
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="p-6 text-right text-[10px] font-black text-gray-600 uppercase">
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
