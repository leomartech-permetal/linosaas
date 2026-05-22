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
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadData = async () => {
    // 1. Busca leads brutos (sempre funciona)
    const { data: leadsData } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    // 2. Busca nomes de vendedores
    const { data: users } = await supabase.from("admin_users").select("id, name");
    // 3. Busca gargalos
    const { data: bData } = await supabase.from("attendance_bottlenecks").select("*, leads(name)").order("created_at", { ascending: false }).limit(5);
    
    if (leadsData) {
      const mapped = leadsData.map(l => ({
        ...l,
        vendedor_nome: users?.find(u => u.id === l.current_owner_id)?.name || "Não atribuído"
      }));
      setLeads(mapped);
    }
    if (bData) setBottlenecks(bData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      supabase.from("interactions").select("*").eq("lead_id", selectedLead.id).order("created_at", { ascending: true })
        .then(({ data }) => { if (data) setHistory(data); });
    }
  }, [selectedLead]);

  const total = leads.length;
  const fechados = leads.filter((l) => l.status === "CLOSED_WON").length;
  const taxa = total > 0 ? Math.round((fechados / total) * 100) : 0;
  const porStatus: Record<string, number> = {};
  leads.forEach((l) => { porStatus[l.status] = (porStatus[l.status] || 0) + 1; });

  // Gráfico semanal
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

  return (
    <div className="flex h-full w-full bg-[var(--theme-bg)] text-[var(--theme-fg)] overflow-hidden relative transition-colors duration-200">
      {/* Conteúdo Principal */}
      <div className={`flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide transition-all duration-300 ${selectedLead ? 'mr-[450px]' : ''}`}>
        <header className="mb-10 flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">Lino Intelligence</h2>
            <p className="text-[var(--theme-muted)] mt-1 font-medium italic">Visão estratégica da sua operação de vendas</p>
          </div>
          <button onClick={loadData} className="bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-fg)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--theme-hover)] transition-all cursor-pointer">
            Atualizar
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[hsl(var(--tenant-primary))] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
              {[
                { label: "Total de Leads", val: total, color: "var(--theme-fg)", icon: "🔥" },
                { label: "Vendas Concluídas", val: fechados, color: "#10b981", icon: "💰" },
                { label: "Taxa de Conversão", val: `${taxa}%`, color: "hsl(var(--tenant-primary))", icon: "📈" },
                { label: "SDR em Aberto", val: porStatus["SDR_QUALIFICATION"] || 0, color: "#3b82f6", icon: "🤖" },
                { label: "SLA em Risco", val: leads.filter(l => l.status === 'WAITING_SELLER').length, color: "#f43f5e", icon: "🚨" },
              ].map((kpi, i) => (
                <div key={i} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-[hsl(var(--tenant-primary)/0.4)] transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-20 text-2xl">{kpi.icon}</div>
                  <p className="text-[9px] text-[var(--theme-muted)] uppercase font-black tracking-widest mb-2">{kpi.label}</p>
                  <p className="text-3xl font-black" style={{ color: kpi.color }}>{kpi.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              <div className="lg:col-span-1 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-2xl p-6">
                <h3 className="font-black text-xs text-orange-500 uppercase tracking-widest mb-6">Gargalos Recentes</h3>
                <div className="space-y-4">
                  {bottlenecks.map(b => (
                    <div key={b.id} className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl text-[10px]">
                      <div className="flex justify-between font-bold mb-1">
                        <span>{b.leads?.name || "Lead"}</span>
                        <span className="text-red-500 uppercase">{b.severity}</span>
                      </div>
                      <p className="text-[var(--theme-muted)]">{b.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-2xl p-8 h-64">
                 <h3 className="font-black text-xs text-[var(--theme-muted)] uppercase tracking-widest mb-8">Fluxo Semanal</h3>
                 <div className="flex items-end gap-3 h-32">
                    {porDia.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-[hsl(var(--tenant-primary))] rounded-t-lg" style={{ height: `${(d.count / maxDia) * 100}%`, minHeight: '4px' }}></div>
                        <span className="text-[9px] font-black text-[var(--theme-muted)]">{d.label}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 bg-[var(--theme-hover)] border-b border-[var(--theme-border)] font-black text-xs uppercase tracking-widest text-[var(--theme-muted)]">Atividade Recente</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-[var(--theme-muted)] uppercase font-black tracking-widest border-b border-[var(--theme-border)]">
                      <th className="p-6">Lead</th>
                      <th className="p-6">Produto</th>
                      <th className="p-6">Status</th>
                      <th className="p-6">Vendedor</th>
                      <th className="p-6 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]">
                    {leads.slice(0, 10).map((lead) => (
                      <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-[var(--theme-hover)] cursor-pointer group transition-colors">
                        <td className="p-6">
                          <div className="font-black text-sm group-hover:text-[hsl(var(--tenant-primary))]">{lead.name || "Interesse Anônimo"}</div>
                          <div className="text-[10px] text-[var(--theme-muted)]">{lead.whatsapp_number.replace('@s.whatsapp.net','')}</div>
                        </td>
                        <td className="p-6 text-xs text-blue-500 dark:text-blue-400 font-bold">{lead.detected_product || lead.produto || "—"}</td>
                        <td className="p-6">
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded" style={{ backgroundColor: (statusColors[lead.status] || "#666") + "20", color: statusColors[lead.status] || "#666" }}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </td>
                        <td className="p-6 text-xs font-bold text-[var(--theme-fg)]">{lead.vendedor_nome}</td>
                        <td className="p-6 text-right text-[10px] text-[var(--theme-muted)] font-black">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* COMPILADOR DE DADOS (Drawer) */}
      <div className={`fixed top-0 right-0 h-screen w-[450px] bg-[var(--theme-card)] border-l border-[var(--theme-border)] shadow-2xl transition-transform duration-300 transform z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedLead && (
          <>
            <div className="p-6 border-b border-[var(--theme-border)] flex justify-between items-center bg-[var(--theme-hover)]">
              <h3 className="font-bold text-lg flex items-center gap-2">📑 Compilador do Lead</h3>
              <button onClick={() => setSelectedLead(null)} className="text-[var(--theme-muted)] hover:text-[var(--theme-fg)] cursor-pointer">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <section className="bg-[var(--theme-hover)] p-4 rounded-xl border border-[var(--theme-border)]">
                <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase mb-4">Informações Coletadas</h5>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div><span className="text-[var(--theme-muted)] text-[10px] uppercase">Nome:</span> <p className="font-bold">{selectedLead.name || "—"}</p></div>
                  <div><span className="text-[var(--theme-muted)] text-[10px] uppercase">Empresa:</span> <p className="font-bold">{selectedLead.empresa || selectedLead.company || "—"}</p></div>
                  <div><span className="text-[var(--theme-muted)] text-[10px] uppercase">CNPJ:</span> <p className="font-bold text-blue-500">{selectedLead.cnpj || "—"}</p></div>
                  <div><span className="text-[var(--theme-muted)] text-[10px] uppercase">E-mail:</span> <p className="font-bold">{selectedLead.email_corporativo || selectedLead.email || "—"}</p></div>
                  <div className="pt-4 border-t border-[var(--theme-border)]">
                    <span className="text-[var(--theme-muted)] text-[10px] uppercase">Produto/Demanda:</span> 
                    <p className="font-bold text-[hsl(var(--tenant-primary))]">{selectedLead.produto || selectedLead.detected_product || "—"}</p>
                    <p className="text-xs text-[var(--theme-muted)] mt-1">{selectedLead.especificacao || "Sem detalhes adicionais."}</p>
                  </div>
                  <div className="pt-4 border-t border-[var(--theme-border)] flex justify-between items-center">
                    <span className="text-[var(--theme-muted)] text-[10px] uppercase">Skill Utilizada pela IA:</span> 
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black rounded border border-purple-500/20">
                      {selectedLead.last_skill_used || "SDR General"}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase mb-4">Status do Atendimento</h5>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-[var(--theme-hover)] rounded-lg border border-[var(--theme-border)]">
                    <span className="text-[10px] text-[var(--theme-muted)] uppercase">Vendedor:</span>
                    <span className="text-xs font-bold text-[var(--theme-fg)]">{selectedLead.vendedor_nome}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-[var(--theme-hover)] rounded-lg border border-[var(--theme-border)]">
                    <span className="text-[10px] text-[var(--theme-muted)] uppercase">Notificado via WhatsApp?</span>
                    <span className={`text-[10px] font-black uppercase ${selectedLead.sent_to_seller_at ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedLead.sent_to_seller_at ? '✓ SIM' : '✗ NÃO'}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase mb-4">Histórico Real</h5>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {history.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-lg text-xs ${msg.sender_type === 'lead' ? 'bg-[var(--theme-hover)] text-[var(--theme-fg)]' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'}`}>
                      {msg.message_content}
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="p-6 bg-[var(--theme-hover)] border-t border-[var(--theme-border)]">
              <button onClick={() => setSelectedLead(null)} className="w-full bg-[var(--theme-fg)] text-[var(--theme-bg)] font-black py-4 rounded-xl text-[10px] uppercase tracking-widest cursor-pointer hover:opacity-90">Fechar Compilador</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
