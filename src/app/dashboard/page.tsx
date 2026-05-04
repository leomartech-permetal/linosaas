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

  // Leads por status
  const porStatus: Record<string, number> = {};
  leads.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  });

  // Leads por dia (últimos 7 dias)
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

  // Pie chart via conic-gradient
  const statusColors: Record<string, string> = {
    SDR_QUALIFICATION: "#3b82f6",
    WAITING_SELLER: "#f59e0b",
    IN_NEGOTIATION: "#8b5cf6",
    CLOSED_WON: "#10b981",
    CLOSED_LOST: "#ef4444",
  };
  let pieGradient = "";
  let acc = 0;
  Object.entries(porStatus).forEach(([status, count]) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const color = statusColors[status] || "#666";
    pieGradient += `${color} ${acc}% ${acc + pct}%, `;
    acc += pct;
  });
  if (!pieGradient) pieGradient = "#333 0% 100%,";

  const ultimos = leads.slice(0, 10);

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-gray-400 mt-1">Visão geral do seu negócio em tempo real</p>
      </header>

      {loading ? (
        <p className="text-gray-500">Carregando métricas...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total de Leads</p>
              <p className="text-4xl font-bold mt-2 text-white">{total}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Fechados</p>
              <p className="text-4xl font-bold mt-2 text-green-400">{fechados}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Taxa de Conversão</p>
              <p className="text-4xl font-bold mt-2 text-[hsl(var(--tenant-primary))]">{taxa}%</p>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Em Qualificação</p>
              <p className="text-4xl font-bold mt-2 text-blue-400">{porStatus["SDR_QUALIFICATION"] || 0}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Barras */}
            <div className="lg:col-span-2 bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <h3 className="font-bold text-sm text-gray-400 mb-4">Leads por dia (últimos 7 dias)</h3>
              <div className="flex items-end gap-2 h-40">
                {porDia.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">{d.count}</span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(d.count / maxDia) * 100}%`,
                        minHeight: d.count > 0 ? "8px" : "2px",
                        background: "hsl(var(--tenant-primary))",
                        opacity: d.count > 0 ? 1 : 0.2,
                      }}
                    ></div>
                    <span className="text-[10px] text-gray-600">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pizza */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
              <h3 className="font-bold text-sm text-gray-400 mb-4">Distribuição por Status</h3>
              <div className="flex justify-center mb-4">
                <div
                  className="w-32 h-32 rounded-full"
                  style={{ background: `conic-gradient(${pieGradient.slice(0, -2)})` }}
                ></div>
              </div>
              <div className="space-y-1">
                {Object.entries(porStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: statusColors[status] || "#666" }}></span>
                    <span className="text-gray-400">{STATUS_LABELS[status] || status}</span>
                    <span className="ml-auto font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela últimos leads */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-gray-400">Últimos 10 Leads</h3>
              <a href="/dashboard/sdr" className="text-xs text-[hsl(var(--tenant-primary))] hover:underline">Ver todos / Qualificação →</a>
            </div>
            {ultimos.length === 0 ? (
              <p className="text-gray-600 text-sm">Nenhum lead registrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-left">
                      <th className="pb-2">Nome / Empresa</th>
                      <th className="pb-2">WhatsApp</th>
                      <th className="pb-2">Produto Interesse</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimos.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2">
                          <div className="font-medium">{lead.name || "—"}</div>
                          <div className="text-[10px] text-gray-500">{lead.company || "—"}</div>
                        </td>
                        <td className="py-2 text-gray-400">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</td>
                        <td className="py-2">
                          <div className="text-blue-400">{lead.detected_product || "—"}</div>
                          <div className="text-[10px] text-gray-500">{lead.detected_city || "—"}</div>
                        </td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-1 rounded" style={{ background: (statusColors[lead.status] || "#666") + "22", color: statusColors[lead.status] || "#666" }}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
