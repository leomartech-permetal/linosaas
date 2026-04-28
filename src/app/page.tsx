"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulação de configuração de tela vinda do SaaS
  const pageConfig = {
    tituloPrincipal: "Pipeline Comercial",
    subtitulo: "Gestão de leads da equipe",
    textoBotaoNovo: "+ Novo Lead de Teste"
  };

  useEffect(() => {
    carregarLeads();
  }, []);

  async function carregarLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setLeads(data);
    setLoading(false);
  }

  async function criarNovoLeadTest() {
    const novoLead = {
      name: "Lead Teste Manual",
      whatsapp_number: "551199999999" + Math.floor(Math.random() * 10),
      status: "SDR_QUALIFICATION",
      gtm_tag: "Lino.TESTE"
    };

    await supabase.from('leads').insert([novoLead]);
    carregarLeads(); // Recarrega a tela imediatamente
  }

  return (
    <div className="p-10 w-full h-full">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white shadow-black drop-shadow-md">{pageConfig.tituloPrincipal}</h2>
          <p className="text-gray-300 mt-1">{pageConfig.subtitulo}</p>
        </div>
        <button 
          onClick={criarNovoLeadTest} 
          className="btn-dynamic transform hover:scale-105 transition-all"
        >
          {pageConfig.textoBotaoNovo}
        </button>
      </header>

      {/* Quadro Kanban (Fundo Branco Clean) */}
      <div className="card-clean h-[70vh] flex gap-6 overflow-x-auto bg-white/95 backdrop-blur-md">
        
        {/* Coluna SDR */}
        <div className="w-80 flex-shrink-0 bg-gray-50 rounded-lg p-4 border border-gray-100 h-full overflow-y-auto">
          <h3 className="font-bold text-gray-800 mb-4 flex justify-between">
            Fila de Leads <span className="bg-gray-200 text-gray-700 px-2 rounded-full text-sm">{leads.length}</span>
          </h3>
          
          {loading ? (
            <p className="text-gray-500 text-sm">Carregando leads do banco...</p>
          ) : leads.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum lead encontrado. Clique no botão acima para testar.</p>
          ) : (
            leads.map(lead => (
              <div key={lead.id} className="bg-white p-4 rounded-md shadow-sm border border-gray-200 mb-3 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="badge-dynamic text-xs px-2 py-1 bg-teal-100 text-teal-800 rounded">{lead.status}</span>
                </div>
                <h4 className="font-bold text-gray-900">{lead.name || "Lead s/ Nome"}</h4>
                <p className="text-xs text-gray-400 mt-1">{lead.whatsapp_number}</p>
                {lead.gtm_tag && <p className="text-xs text-blue-500 mt-1">TAG: {lead.gtm_tag}</p>}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
