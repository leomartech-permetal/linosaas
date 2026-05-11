'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';

// Componentes UI simplificados com Tailwind
const Card = ({ title, value, subValue, type }: any) => (
  <div className="bg-[#1a1f2e] border border-[#2d3550] rounded-2xl p-6 relative overflow-hidden transition-all hover:translate-y-[-2px]">
    <div className={`absolute top-0 left-0 right-0 h-1 ${
      type === 'invest' ? 'bg-gradient-to-r from-green-500 to-green-300' :
      type === 'results' ? 'bg-gradient-to-r from-purple-600 to-purple-400' :
      type === 'cpa' ? 'bg-gradient-to-r from-orange-500 to-yellow-400' :
      'bg-gradient-to-r from-blue-500 to-blue-300'
    }`} />
    <p className="text-[11px] text-[#8892b0] uppercase tracking-widest font-semibold">{title}</p>
    <h3 className="text-3xl font-extrabold text-white my-2">{value}</h3>
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        subValue?.includes('+') || subValue?.includes('✓') 
        ? 'bg-green-500/15 text-green-500' 
        : 'bg-orange-500/15 text-orange-500'
      }`}>
        {subValue}
      </span>
    </div>
  </div>
);

export default function CatalisaDashboard() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('Farmácia Piloto Teste');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('ads_metrics_catalisa')
        .select('*')
        .eq('client_name', selectedClient)
        .order('period_start', { ascending: true });
      
      if (data) setMetrics(data);
      setLoading(false);
    }
    fetchData();
  }, [selectedClient]);

  // Cálculos agregados
  const totalSpend = metrics.reduce((acc, m) => acc + (Number(m.spend) || 0), 0);
  const totalResults = metrics.reduce((acc, m) => acc + (Number(m.results) || 0), 0);
  const avgCPA = totalResults > 0 ? totalSpend / totalResults : 0;
  
  const chartData = metrics.map(m => ({
    name: m.period_start,
    spend: m.spend,
    results: m.results
  }));

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e8eaf6] p-6 font-sans">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center bg-gradient-to-br from-[#1a1f2e] to-[#252b3b] border border-[#2d3550] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-3 text-white font-black text-xs leading-tight">
            CATALISA<br />FARMA
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🏪 {selectedClient} <span className="text-sm font-normal text-[#8892b0]">| Relatório de Mídia Paga</span>
            </h1>
            <p className="text-xs text-[#8892b0]">Atualização: Diária • Plataforma: Meta/Google Ads</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          <select 
            className="bg-[#1e2a3a] border border-[#3d5a80] text-[#64b5f6] rounded-lg px-4 py-2 text-sm outline-none cursor-pointer"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="Farmácia Piloto Teste">Farmácia Piloto Teste</option>
            <option value="Droga Nova - Adalberto">Droga Nova - Adalberto</option>
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* SCORECARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card title="Investimento" value={`R$ ${totalSpend.toLocaleString('pt-BR')}`} subValue="✓ 100% da meta" type="invest" />
          <Card title="Resultados Totais" value={totalResults} subValue="+14% vs meta" type="results" />
          <Card title="Custo / Resultado" value={`R$ ${avgCPA.toFixed(2)}`} subValue="✓ Abaixo da meta" type="cpa" />
          <Card title="Escala Disponível" value="+ R$ 600" subValue="↑ Disponível" type="scale" />
        </div>

        {/* CHARTS & INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Gráfico de Evolução */}
          <div className="lg:col-span-2 bg-[#1a1f2e] border border-[#2d3550] rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-6">Evolução Diária</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3550" vertical={false} />
                  <XAxis dataKey="name" stroke="#8892b0" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8892b0" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #2d3550', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="spend" stroke="#4CAF50" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Investimento" />
                  <Line type="monotone" dataKey="results" stroke="#7c4dff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Resultados" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seção de Insights */}
          <div className="space-y-4">
            <div className="bg-[#1a1f2e] border border-[#2d3550] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💡</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">O Que Estamos Fazendo</h3>
              </div>
              <p className="text-sm text-[#b0b8d0] leading-relaxed">
                {metrics[metrics.length - 1]?.insights || "Analisando performance dos criativos locais para otimização do CPA. Testes de público por raio estão em andamento."}
              </p>
            </div>
            
            <div className="bg-[#1a1f2e] border border-[#2d3550] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">➡️</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">Próximo Passo</h3>
              </div>
              <div className="space-y-3">
                {(metrics[metrics.length - 1]?.next_steps || "Escalar campanha vencedora;Testar novo criativo de oferta").split(';').map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-purple-600 to-green-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-[#b0b8d0]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TABELA DE CAMPANHAS */}
        <div className="bg-[#1a1f2e] border border-[#2d3550] rounded-2xl p-6 overflow-x-auto">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-6">📋 Campanhas Ativas</h3>
          <table className="w-full text-left">
            <thead>
              <tr className="border-bottom border-[#2d3550]">
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold">Campanha</th>
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold">Objetivo</th>
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold text-right">Investido</th>
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold text-right">Resultados</th>
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold text-right">Custo/Res</th>
                <th className="pb-4 text-[11px] text-[#8892b0] uppercase tracking-wider font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3550]/20">
              {metrics.map((m, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors">
                  <td className="py-4 text-sm font-medium text-[#cdd6f4]">{m.campaign_name || 'Geral'}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                      m.campaign_type === 'Engajamento' ? 'bg-purple-500/15 text-purple-400' : 'bg-green-500/15 text-green-400'
                    }`}>
                      {m.campaign_type}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-right text-[#cdd6f4]">R$ {m.spend.toFixed(2)}</td>
                  <td className="py-4 text-sm text-right text-[#cdd6f4]">{m.results}</td>
                  <td className="py-4 text-sm text-right text-[#cdd6f4]">R$ {(m.spend / m.results).toFixed(2)}</td>
                  <td className="py-4 text-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block shadow-[0_0_8px_#4CAF50]"></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="text-center py-8 text-[11px] text-[#4a5568]">
          Catalisa Farma • Relatório gerado automaticamente via App Script & Supabase
        </div>
      </div>
    </div>
  );
}
