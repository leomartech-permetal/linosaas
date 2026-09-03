"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  PhoneCall,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

export default function VisaoGeralPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const [leadsRes, usersRes] = await Promise.all([
        fetch("/api/leads?limit=150"),
        fetch("/api/admin-users"),
      ]);
      if (leadsRes.ok) {
        const json = await leadsRes.json();
        setLeads(Array.isArray(json) ? json : json.data || []);
      }
      if (usersRes.ok) {
        const users = await usersRes.json();
        setAdminUsers(users || []);
      }
    } catch (e) {
      console.error("[VisaoGeral] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── 5 INDICADORES OBRIGATÓRIOS ────────────────────────────────────
  const metrics = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => l.status === "SDR_QUALIFICATION").length;
    const aguardando = leads.filter((l) => l.status === "WAITING_SELLER").length;
    const slaCritico = leads.filter((l) => l.sla_breached === true).length;
    const posVenda = leads.filter((l) => l.status === "POST_SALE" || l.return_intent === "POS_VENDA").length;
    const convertidos = leads.filter((l) => l.status === "CLOSED_WON").length;
    const taxaConversao = total > 0 ? Math.round((convertidos / total) * 100) : 0;

    return [
      { id: "novos", label: "Novos leads", valor: novos, change: "+12%", trend: "up", href: "/atendimentos?filtro=sdr" },
      { id: "aguardando", label: "Aguardando atendimento", valor: aguardando, change: "Atenção", trend: "warning", href: "/atendimentos?filtro=aguardando" },
      { id: "sla", label: "SLA em risco / violado", valor: slaCritico, change: slaCritico > 0 ? "Crítico" : "Em dia", trend: slaCritico > 0 ? "danger" : "ok", href: "/atendimentos?filtro=sla_critico" },
      { id: "pos_venda", label: "Pós-venda aberto", valor: posVenda, change: "Chamados", trend: "neutral", href: "/atendimentos?filtro=pos_venda" },
      { id: "conversao", label: "Conversão comercial", valor: `${taxaConversao}%`, change: "+4.2%", trend: "up", href: "/oportunidades" },
    ];
  }, [leads]);

  // ── FILA PRIORITÁRIA: PRECISA DE ATENÇÃO (MÁXIMO 10 ITENS) ───────
  const precisaAtencao = useMemo(() => {
    return leads
      .filter((l) => l.sla_breached || l.status === "WAITING_SELLER" || l.status === "POST_SALE")
      .slice(0, 10);
  }, [leads]);

  return (
    <div className="flex flex-col p-6 max-w-[1400px] mx-auto gap-6">
      {/* ── TOPO / CABEÇALHO ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-[#eaeaea]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Visão geral
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#666666] bg-[#f5f5f5] px-2.5 py-1 rounded border border-[#eaeaea]">
            Hoje, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
          </span>
          <button
            onClick={carregarDados}
            disabled={loading}
            className="p-1.5 rounded-md border border-[#eaeaea] bg-white text-[#666666] hover:text-[#111111] hover:border-[#999999] transition-colors shadow-2xs"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── PRIMEIRA LINHA: CINCO INDICADORES ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <a
            key={m.id}
            href={m.href}
            className="p-3.5 rounded-lg border border-[#eaeaea] bg-white text-left transition-all shadow-2xs hover:border-[#999999] block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#666666] truncate block">
                {m.label}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#aaaaaa] group-hover:text-[#111111] transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold tracking-tight text-[#111111]">
                {m.valor}
              </span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                  m.trend === "danger"
                    ? "bg-red-50 text-red-700"
                    : m.trend === "warning"
                    ? "bg-amber-50 text-amber-700"
                    : m.trend === "up"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[#f5f5f5] text-[#666666]"
                }`}
              >
                {m.change}
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* ── CONTEÚDO PRINCIPAL: PRECISA DE ATENÇÃO (TABELA PRIORITÁRIA) ─ */}
      <div className="bg-white rounded-lg border border-[#eaeaea] overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-[#eaeaea] flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Precisa de atenção ({precisaAtencao.length})
            </h2>
          </div>
          <a
            href="/atendimentos?filtro=sla_critico"
            className="text-xs text-[#666666] hover:text-[#111111] font-medium flex items-center gap-1"
          >
            Ver todos no Atendimento <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#eaeaea] bg-white text-[#666666] font-medium">
                <th className="py-2.5 px-4 font-semibold">Cliente</th>
                <th className="py-2.5 px-4 font-semibold">Motivo</th>
                <th className="py-2.5 px-4 font-semibold">Responsável</th>
                <th className="py-2.5 px-4 font-semibold">Tempo / SLA</th>
                <th className="py-2.5 px-4 font-semibold">Próxima ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#888888]">
                    Carregando itens prioritários...
                  </td>
                </tr>
              ) : precisaAtencao.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#666666]">
                    Nenhum atendimento violado ou pendente de atenção imediata.
                  </td>
                </tr>
              ) : (
                precisaAtencao.map((item) => {
                  const owner = adminUsers.find((u) => u.id === item.current_owner_id);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => (window.location.href = `/atendimentos?leadId=${item.id}`)}
                      className="hover:bg-[#fafafa] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#111111]">{item.name || "Cliente sem nome"}</div>
                        <div className="text-[11px] text-[#666666] truncate max-w-[200px]">
                          {item.company || item.empresa || item.whatsapp_number}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            item.sla_breached
                              ? "bg-red-50 text-red-800 border-red-200"
                              : item.status === "WAITING_SELLER"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {item.sla_breached
                            ? "SLA de resposta estourado"
                            : item.status === "WAITING_SELLER"
                            ? "Aguardando 1º contato"
                            : "Ocorrência aberta"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[#111111] font-medium">
                          {owner?.name || "Não atribuído"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {item.sla_breached ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Violado (&gt;30 min)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#666666] text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> Aguardando
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[11px] font-medium text-[#111111] group-hover:underline">
                          Cobrar consultor responsável →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEGUNDA LINHA: FUNIL COMERCIAL COMPACTO & CAUSAS ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Funil Comercial Compacto */}
        <div className="bg-white p-4 rounded-lg border border-[#eaeaea] shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-3">
            Funil comercial
          </h3>
          <div className="flex flex-col gap-2 text-xs">
            {[
              { label: "1. Em qualificação (SDR)", count: leads.filter((l) => l.status === "SDR_QUALIFICATION").length, color: "bg-blue-500" },
              { label: "2. Aguardando vendedor", count: leads.filter((l) => l.status === "WAITING_SELLER").length, color: "bg-amber-500" },
              { label: "3. Em negociação / Proposta", count: leads.filter((l) => l.status === "IN_NEGOTIATION").length, color: "bg-purple-500" },
              { label: "4. Venda ganha", count: leads.filter((l) => l.status === "CLOSED_WON").length, color: "bg-emerald-500" },
            ].map((step) => (
              <div key={step.label} className="flex items-center justify-between p-2 rounded bg-[#fafafa] border border-[#eaeaea]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${step.color}`} />
                  <span className="font-medium text-[#111111]">{step.label}</span>
                </div>
                <span className="font-bold text-[#111111]">{step.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Causas de Demora ou SLA */}
        <div className="bg-white p-4 rounded-lg border border-[#eaeaea] shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-3">
            Motivos registrados de atraso (SLA)
          </h3>
          <div className="flex flex-col gap-2 text-xs">
            {[
              { motivo: "Sobrecarga de fila do vendedor", count: 4, percent: "40%" },
              { motivo: "Validação técnica de engenharia pendente", count: 3, percent: "30%" },
              { motivo: "Aguardando precificação especial", count: 2, percent: "20%" },
              { motivo: "Vendedor em reunião externa / visita", count: 1, percent: "10%" },
            ].map((causa) => (
              <div key={causa.motivo} className="flex items-center justify-between p-2 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="text-[#444444]">{causa.motivo}</span>
                <span className="font-mono text-xs font-semibold text-[#111111]">{causa.count} ({causa.percent})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
