"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    const subscription = supabase
      .channel('debug_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debug_logs' }, (payload) => {
        setLogs((prev) => [payload.new, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function loadLogs() {
    setLoading(true);
    // 1. Busca logs puros
    const { data: logsData } = await supabase
      .from("debug_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    
    // 2. Busca leads relacionados separadamente
    const { data: leadsData } = await supabase.from("leads").select("id, name, whatsapp_number");
    
    if (logsData) {
      const mapped = logsData.map(log => ({
        ...log,
        leads: leadsData?.find(l => l.id === log.lead_id)
      }));
      setLogs(mapped);
    }
    setLoading(false);
  }

  function getLevelColor(level: string) {
    switch (level) {
      case 'ERROR': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'WARN': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'DEBUG': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  }

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[#0a0a0a] text-white overflow-y-auto scrollbar-hide">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">Debug & Audit Logs</h2>
          <p className="text-gray-500 mt-1 font-medium italic">Rastreio em tempo real de eventos e erros do sistema</p>
        </div>
        <button onClick={loadLogs} className="bg-[#111] border border-gray-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors">
          Atualizar Manual
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[hsl(var(--tenant-primary))] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-[#111] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase font-black tracking-widest border-b border-gray-800 bg-[#161616]">
                  <th className="p-5 w-40">Data/Hora</th>
                  <th className="p-5 w-24">Nível</th>
                  <th className="p-5 w-32">Módulo</th>
                  <th className="p-5">Ação / Detalhes</th>
                  <th className="p-5">Lead Relacionado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-5 text-[10px] font-mono text-gray-500">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-5">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black border ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="text-[10px] font-black uppercase text-gray-400">{log.module}</span>
                    </td>
                    <td className="p-5">
                      <div className="text-sm font-bold text-white mb-1">{log.action}</div>
                      <pre className="text-[9px] font-mono text-gray-600 bg-black/30 p-2 rounded max-h-20 overflow-y-auto scrollbar-hide">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                    <td className="p-5">
                      {log.leads ? (
                        <div>
                          <div className="text-xs font-bold text-white">{log.leads.name}</div>
                          <div className="text-[10px] text-gray-600">{log.leads.whatsapp_number}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-700 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-gray-600 italic uppercase text-xs tracking-widest font-black">
                      Nenhum log registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
