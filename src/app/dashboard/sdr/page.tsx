"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SDRLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setLeads(data);
      setLoading(false);
    }
    load();
  }, []);

  const filteredLeads = leads.filter(l => {
    if (filter === 'incomplete') return l.status === 'SDR_QUALIFICATION';
    if (filter === 'complete') return l.status !== 'SDR_QUALIFICATION';
    return true;
  });

  const handleExport = () => {
    const headers = ["Data Criacao", "Nome", "WhatsApp", "Status", "Produto", "Material", "DDD", "Cidade", "Empresa", "Ultima Modificacao"];
    const csvContent = [
      headers.join(","),
      ...filteredLeads.map(l => [
        new Date(l.created_at).toLocaleDateString(),
        l.name || "N/A",
        l.whatsapp_number,
        l.status,
        l.detected_product || "N/A",
        l.detected_material || "N/A",
        l.detected_ddd || "N/A",
        l.detected_city || "N/A",
        l.company || "N/A",
        new Date(l.updated_at).toLocaleString()
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${filter}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-10 text-white w-full h-full overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold">Qualificação SDR</h2>
          <p className="text-gray-400 mt-1">Acompanhe leads em processo de qualificação pela IA</p>
        </div>
        <button 
          onClick={handleExport}
          className="bg-[hsl(var(--tenant-primary))] hover:opacity-90 text-black font-bold py-2 px-4 rounded flex items-center gap-2 transition-all"
        >
          <span>Exportar CSV</span>
        </button>
      </header>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-white text-black' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'}`}
        >
          Todos ({leads.length})
        </button>
        <button 
          onClick={() => setFilter('incomplete')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'incomplete' ? 'bg-blue-600 text-white' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'}`}
        >
          Em Aberto / Incompletos ({leads.filter(l => l.status === 'SDR_QUALIFICATION').length})
        </button>
        <button 
          onClick={() => setFilter('complete')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'complete' ? 'bg-green-600 text-white' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'}`}
        >
          Qualificados / Completos ({leads.filter(l => l.status !== 'SDR_QUALIFICATION').length})
        </button>
      </div>

      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Carregando leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Nenhum lead encontrado nesta categoria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0a0a0a] text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome / Empresa</th>
                  <th className="px-4 py-3 font-medium">WhatsApp</th>
                  <th className="px-4 py-3 font-medium">Produto / Mat.</th>
                  <th className="px-4 py-3 font-medium">Localização</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Última Modif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{lead.name || "Visitante"}</div>
                      <div className="text-xs text-gray-500">{lead.company || "Sem empresa"}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-400">
                      {lead.whatsapp_number.replace('@s.whatsapp.net', '')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-blue-400 font-medium">{lead.detected_product || "—"}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{lead.detected_material || "—"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white">{lead.detected_city || "—"}</div>
                      <div className="text-xs text-gray-400">{lead.detected_ddd ? `DDD ${lead.detected_ddd}` : "—"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${lead.status === 'SDR_QUALIFICATION' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
                        {lead.status === 'SDR_QUALIFICATION' ? 'Qualificando' : 'Qualificado'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-500 text-xs">
                      {new Date(lead.updated_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
