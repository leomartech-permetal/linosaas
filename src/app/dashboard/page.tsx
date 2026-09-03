"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  Package,
  Layers,
  Users,
  Search,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<"comercial" | "atendimento" | "pos_venda">("comercial");
  const [leads, setLeads] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    carregarRelatorios();
  }, []);

  async function carregarRelatorios() {
    setLoading(true);
    try {
      // Carregar via API segura (nunca direct browser supabase sem token)
      const [leadsRes, usersRes] = await Promise.all([
        fetch("/api/leads?limit=200"),
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
      console.error("[Relatorios] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── MÉTRICAS COMERCIAIS ───────────────────────────────────────────
  const metricasComerciais = useMemo(() => {
    const total = leads.length;
    const qualificados = leads.filter((l) => l.qualification_completed || l.status !== "SDR_QUALIFICATION").length;
    const emNegociacao = leads.filter((l) => l.status === "IN_NEGOTIATION").length;
    const fechados = leads.filter((l) => l.status === "CLOSED_WON").length;
    const perdidos = leads.filter((l) => l.status === "CLOSED_LOST").length;
    const taxaConversao = total > 0 ? Math.round((fechados / total) * 100) : 0;
    const taxaQualificacao = total > 0 ? Math.round((qualificados / total) * 100) : 0;

    return { total, qualificados, emNegociacao, fechados, perdidos, taxaConversao, taxaQualificacao };
  }, [leads]);

  // ── MÉTRICAS DE ATENDIMENTO & SLA ────────────────────────────────
  const metricasAtendimento = useMemo(() => {
    const aguardando = leads.filter((l) => l.status === "WAITING_SELLER").length;
    const slaViolado = leads.filter((l) => l.sla_breached === true).length;
    const slaEmDia = leads.filter((l) => !l.sla_breached && l.status === "WAITING_SELLER").length;

    return { aguardando, slaViolado, slaEmDia };
  }, [leads]);

  // ── MÉTRICAS DE PÓS-VENDA ─────────────────────────────────────────
  const metricasPosVenda = useMemo(() => {
    const totalPosVenda = leads.filter((l) => l.status === "POST_SALE" || l.return_intent === "POS_VENDA").length;
    const entregas = leads.filter((l) => (l.observacao || "").includes("DELIVERY")).length;
    const financeiro = leads.filter((l) => (l.observacao || "").includes("INVOICE") || (l.observacao || "").includes("BOLETO")).length;

    return { totalPosVenda, entregas, financeiro };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.whatsapp_number && l.whatsapp_number.includes(q)) ||
        (l.tracking_code && l.tracking_code.toLowerCase().includes(q))
      );
    });
  }, [leads, searchQuery]);

  return (
    <div className="flex flex-col p-6 max-w-[1500px] mx-auto gap-6 min-h-full">
      {/* ── TOPO / CABEÇALHO COMPACTO ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#eaeaea]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Relatórios & Auditoria
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Análise de conversão comercial, tempos de SLA e ocorrências
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Período */}
          <div className="flex items-center p-0.5 rounded-md bg-[#f0f0f0] border border-[#eaeaea] text-xs font-medium">
            {[
              { id: "7d", label: "7 dias" },
              { id: "30d", label: "30 dias" },
              { id: "all", label: "Histórico todo" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id as any)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedPeriod === p.id
                    ? "bg-white text-[#111111] shadow-2xs font-semibold"
                    : "text-[#666666] hover:text-[#111111]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={carregarRelatorios}
            disabled={loading}
            className="p-1.5 rounded-md border border-[#eaeaea] bg-white text-[#666666] hover:text-[#111111] hover:border-[#999999] transition-colors shadow-2xs"
            title="Atualizar relatórios"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── TRÊS ABAS OBRIGATÓRIAS (COMERCIAL, ATENDIMENTO, PÓS-VENDA) ─ */}
      <div className="flex items-center gap-2 border-b border-[#eaeaea] pb-2 text-xs font-medium">
        {[
          { key: "comercial", label: "Desempenho Comercial", icon: TrendingUp },
          { key: "atendimento", label: "SLA & Atendimento", icon: Clock },
          { key: "pos_venda", label: "Pós-Venda & Chamados", icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? "bg-[#111111] text-white font-semibold"
                  : "bg-white border border-[#eaeaea] text-[#666666] hover:text-[#111111]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO DA ABA: COMERCIAL ──────────────────────────────── */}
      {activeTab === "comercial" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Total de Leads</span>
              <span className="text-2xl font-bold text-[#111111] mt-1 block">{metricasComerciais.total}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Qualificados (SDR)</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{metricasComerciais.qualificados}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Em Negociação</span>
              <span className="text-2xl font-bold text-purple-600 mt-1 block">{metricasComerciais.emNegociacao}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Vendas Ganhas</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{metricasComerciais.fechados}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Taxa de Qualificação</span>
              <span className="text-2xl font-bold text-[#111111] mt-1 block">{metricasComerciais.taxaQualificacao}%</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-[11px] text-[#666666] block">Conversão Final</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">{metricasComerciais.taxaConversao}%</span>
            </div>
          </div>

          {/* Funil Visual Limpo */}
          <div className="p-5 rounded-lg bg-white border border-[#eaeaea] shadow-2xs flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Conversão de Etapas do Pipeline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="text-[#666666] block text-[11px]">Entrada</span>
                <span className="text-lg font-bold text-[#111111]">{metricasComerciais.total}</span>
                <div className="w-full bg-[#eaeaea] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-600 h-full w-full" />
                </div>
              </div>

              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="text-[#666666] block text-[11px]">SDR Qualificado</span>
                <span className="text-lg font-bold text-blue-600">{metricasComerciais.qualificados}</span>
                <div className="w-full bg-[#eaeaea] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${metricasComerciais.taxaQualificacao}%` }} />
                </div>
              </div>

              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="text-[#666666] block text-[11px]">Em Negociação</span>
                <span className="text-lg font-bold text-purple-600">{metricasComerciais.emNegociacao}</span>
                <div className="w-full bg-[#eaeaea] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-purple-600 h-full" style={{ width: `${metricasComerciais.total > 0 ? (metricasComerciais.emNegociacao / metricasComerciais.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="text-[#666666] block text-[11px]">Venda Fechada</span>
                <span className="text-lg font-bold text-emerald-600">{metricasComerciais.fechados}</span>
                <div className="w-full bg-[#eaeaea] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full" style={{ width: `${metricasComerciais.taxaConversao}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA: ATENDIMENTO & SLA ──────────────────────── */}
      {activeTab === "atendimento" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">Aguardando 1º Contato</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{metricasAtendimento.aguardando}</span>
              <span className="text-[11px] text-[#888888] mt-1 block">Leads distribuídos sem resposta</span>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">SLA em Atraso (&gt;30 min úteis)</span>
              <span className="text-2xl font-bold text-red-600 mt-1 block">{metricasAtendimento.slaViolado}</span>
              <span className="text-[11px] text-red-700 font-medium mt-1 block">Exigem ação imediata</span>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">Atendimentos no Prazo</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{metricasAtendimento.slaEmDia}</span>
              <span className="text-[11px] text-[#888888] mt-1 block">Dentro da janela comercial</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Regras do Calendário Útil Lino v4 (Permetal)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#444444]">
              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="font-bold text-[#111111] block mb-1">Horário de Expediente</span>
                <p>Segunda a Quinta: 07:00–12:00 e 13:00–17:00 (9h úteis/dia)</p>
                <p>Sexta-feira: 07:00–12:00 e 13:00–16:00 (8h úteis/dia)</p>
                <p className="text-[11px] text-[#666666] mt-1">Almoço (12h–13h), fins de semana e feriados são ignorados no cálculo de SLA.</p>
              </div>

              <div className="p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                <span className="font-bold text-[#111111] block mb-1">Prazos e Escalada</span>
                <p>1º Contato do Vendedor: <strong>30 minutos úteis</strong></p>
                <p>Janela de Agrupamento de Retornos: <strong>15 minutos corridos</strong></p>
                <p>Escalada para Coordenação: <strong>4 horas úteis</strong> ou <strong>5 cobranças</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA: PÓS-VENDA ──────────────────────────────── */}
      {activeTab === "pos_venda" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">Ocorrências de Pós-Venda</span>
              <span className="text-2xl font-bold text-[#111111] mt-1 block">{metricasPosVenda.totalPosVenda}</span>
              <span className="text-[11px] text-[#888888] mt-1 block">Chamados abertos</span>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">Rastreio e Entrega</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{metricasPosVenda.entregas}</span>
              <span className="text-[11px] text-[#888888] mt-1 block">Previsão logística</span>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-2xs">
              <span className="text-xs text-[#666666] block">Notas Fiscais e Boletos</span>
              <span className="text-2xl font-bold text-purple-600 mt-1 block">{metricasPosVenda.financeiro}</span>
              <span className="text-[11px] text-[#888888] mt-1 block">2ª via de faturamento</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TABELA AUDITÁVEL DE LEADS (COM DADOS REAIS VIA API) ──────── */}
      <div className="bg-white rounded-lg border border-[#eaeaea] overflow-hidden shadow-2xs flex-1">
        <div className="p-3 border-b border-[#eaeaea] flex flex-wrap items-center justify-between gap-3 bg-[#fafafa]">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Registros da Operação ({filteredLeads.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              placeholder="Filtrar por nome, fone, código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded border border-[#eaeaea] bg-white text-[#111111] outline-none focus:border-[#111111]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#eaeaea] bg-white text-[#666666] font-medium">
                <th className="py-2.5 px-4 font-semibold">Código / Lead</th>
                <th className="py-2.5 px-4 font-semibold">Empresa / WhatsApp</th>
                <th className="py-2.5 px-4 font-semibold">Etapa</th>
                <th className="py-2.5 px-4 font-semibold">Responsável</th>
                <th className="py-2.5 px-4 font-semibold">Produto / Demanda</th>
                <th className="py-2.5 px-4 font-semibold">Data de Criação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#888888]">
                    Carregando atendimentos da API segura...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#888888]">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((l) => {
                  const owner = adminUsers.find((u) => u.id === l.current_owner_id);

                  return (
                    <tr
                      key={l.id}
                      onClick={() => (window.location.href = `/atendimentos?leadId=${l.id}`)}
                      className="hover:bg-[#fafafa] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-mono text-[11px] font-semibold text-blue-700">
                          {l.tracking_code || `LINO.${l.id.slice(0, 6).toUpperCase()}`}
                        </div>
                        <div className="font-semibold text-[#111111] mt-0.5">{l.name || "Cliente sem nome"}</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="text-[#111111]">{l.company || l.empresa || "Sem empresa"}</div>
                        <div className="text-[11px] text-[#666666] font-mono">{l.whatsapp_number}</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            l.status === "WAITING_SELLER"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : l.status === "IN_NEGOTIATION"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : l.status === "CLOSED_WON"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-neutral-100 text-neutral-800 border-neutral-200"
                          }`}
                        >
                          {l.status || "Ativo"}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-[#111111] font-medium">
                        {owner?.name || l.seller?.name || "Não atribuído"}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-medium text-[#111111] truncate max-w-[200px]">
                          {l.detected_product || l.produto || "Pendente"}
                        </div>
                        <div className="text-[11px] text-[#666666] truncate max-w-[200px]">
                          {l.quantidade || ""}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-[#666666]">
                        {l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR") : "N/D"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
