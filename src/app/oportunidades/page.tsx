"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Table as TableIcon,
  Kanban as KanbanIcon,
  Plus,
  RefreshCw,
  Clock,
  User,
  Building,
  CheckCircle2,
  X,
  Phone,
  DollarSign,
  AlertTriangle,
  Globe,
  Compass,
  Copy,
  Check,
  Tag,
  ExternalLink,
} from "lucide-react";

const STAGES = [
  { key: "SDR_QUALIFICATION", label: "Em qualificação", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "WAITING_SELLER", label: "Aguardando vendedor", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "IN_NEGOTIATION", label: "Em negociação", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "CLOSED_WON", label: "Venda ganha", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "CLOSED_LOST", label: "Venda perdida", color: "bg-neutral-100 text-neutral-600 border-neutral-200" },
];

export default function OportunidadesPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Novo Lead
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    whatsapp_number: "",
    company: "",
    origin: "Direto",
  });
  const [creatingLead, setCreatingLead] = useState(false);

  // Modal / Raio-X de Atribuição de Campanha por Código LINO
  const [showAttributionModal, setShowAttributionModal] = useState(false);
  const [attributionSearchCode, setAttributionSearchCode] = useState("");
  const [attributionLoading, setAttributionLoading] = useState(false);
  const [attributionData, setAttributionData] = useState<any>(null);
  const [attributionError, setAttributionError] = useState("");

  // Formulário de fechamento Protheus dentro da Atribuição
  const [protheusOrder, setProtheusOrder] = useState("");
  const [protheusValue, setProtheusValue] = useState("");
  const [savingProtheus, setSavingProtheus] = useState(false);

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
      console.error("[Oportunidades] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyCode = (e: React.MouseEvent, code: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Buscar dados de atribuição por código
  const handleSearchAttribution = async (codeToSearch?: string) => {
    const code = (codeToSearch || attributionSearchCode).trim();
    if (!code) return;

    setAttributionLoading(true);
    setAttributionError("");
    setAttributionData(null);

    try {
      const res = await fetch(`/api/tracking/attribution?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          setAttributionData(data);
        } else {
          setAttributionError("Nenhum registro encontrado para este código.");
        }
      } else {
        setAttributionError("Código não localizado na base de cliques ou leads.");
      }
    } catch (err: any) {
      setAttributionError("Erro ao consultar serviço de atribuição.");
    } finally {
      setAttributionLoading(false);
    }
  };

  const handleOpenAttributionForLead = (lead: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const code = lead.tracking_code || `LINO.${lead.id.slice(0, 6).toUpperCase()}`;
    setAttributionSearchCode(code);
    setShowAttributionModal(true);
    handleSearchAttribution(code);
  };

  const handleSaveProtheusSale = async () => {
    if (!attributionData?.lead?.id) return;
    setSavingProtheus(true);

    try {
      const numVal = parseFloat(protheusValue.replace(/[^\d.,]/g, "").replace(",", "."));
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: attributionData.lead.id,
          status: "CLOSED_WON",
          observacao: protheusOrder ? `Pedido Protheus: ${protheusOrder}` : undefined,
          valor: isNaN(numVal) ? undefined : numVal,
        }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === attributionData.lead.id
              ? { ...l, status: "CLOSED_WON", valor: isNaN(numVal) ? l.valor : numVal }
              : l
          )
        );
        setShowAttributionModal(false);
        setProtheusOrder("");
        setProtheusValue("");
      }
    } catch (err) {
      console.error("Erro ao registrar venda Protheus:", err);
    } finally {
      setSavingProtheus(false);
    }
  };

  const filteredOportunidades = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.whatsapp_number && lead.whatsapp_number.includes(q)) ||
        (lead.tracking_code && lead.tracking_code.toLowerCase().includes(q)) ||
        (lead.produto && lead.produto.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (stageFilter !== "ALL" && lead.status !== stageFilter) return false;

      return true;
    });
  }, [leads, searchQuery, stageFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.whatsapp_number.trim()) return;

    setCreatingLead(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeadForm),
      });

      if (res.ok) {
        const created = await res.json();
        setLeads((prev) => [created, ...prev]);
        setShowNewLeadModal(false);
        setNewLeadForm({ name: "", whatsapp_number: "", company: "", origin: "Direto" });
      }
    } catch (err) {
      console.error("Erro ao criar lead:", err);
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <div className="flex flex-col p-6 max-w-[1500px] mx-auto gap-5 min-h-full">
      {/* ── TOPO DA PÁGINA ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#eaeaea]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Oportunidades
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Pipeline comercial • {filteredOportunidades.length} oportunidades registradas
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Botão Raio-X de Atribuição por Código LINO / Protheus */}
          <button
            onClick={() => {
              setAttributionSearchCode("");
              setAttributionData(null);
              setAttributionError("");
              setShowAttributionModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-[#eaeaea] text-[#111111] hover:border-[#111111] transition-colors shadow-2xs"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>Consultar Código / Campanha</span>
          </button>

          {/* Seletor Tabela / Kanban */}
          <div className="flex items-center p-0.5 rounded-md bg-[#f0f0f0] border border-[#eaeaea]">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === "table" ? "bg-white text-[#111111] shadow-2xs" : "text-[#666666] hover:text-[#111111]"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === "kanban" ? "bg-white text-[#111111] shadow-2xs" : "text-[#666666] hover:text-[#111111]"
              }`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <button
            onClick={() => setShowNewLeadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#111111] text-white hover:bg-black transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo lead</span>
          </button>
        </div>
      </div>

      {/* ── BARRA DE BUSCA E FILTROS ÚNICA ────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Buscar código LINO, cliente, empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-white border border-[#eaeaea] text-[#111111] outline-none focus:border-[#111111] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => setStageFilter("ALL")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              stageFilter === "ALL" ? "bg-[#111111] text-white" : "bg-white border border-[#eaeaea] text-[#666666] hover:text-[#111111]"
            }`}
          >
            Todas as etapas
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(s.key)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                stageFilter === s.key ? "bg-[#111111] text-white" : "bg-white border border-[#eaeaea] text-[#666666] hover:text-[#111111]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── VISÃO PADRÃO: TABELA DE OPORTUNIDADES ──────────────────── */}
      {viewMode === "table" && (
        <div className="bg-white rounded-lg border border-[#eaeaea] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#eaeaea] bg-[#fafafa] text-[#666666] font-medium">
                  <th className="py-2.5 px-4 font-semibold">Código LINO</th>
                  <th className="py-2.5 px-4 font-semibold">Cliente / Empresa</th>
                  <th className="py-2.5 px-4 font-semibold">Produto / Demanda</th>
                  <th className="py-2.5 px-4 font-semibold">Etapa</th>
                  <th className="py-2.5 px-4 font-semibold">Responsável</th>
                  <th className="py-2.5 px-4 font-semibold">Origem / Canal</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#888888]">
                      Carregando oportunidades...
                    </td>
                  </tr>
                ) : filteredOportunidades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#888888]">
                      Nenhuma oportunidade encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredOportunidades.map((lead) => {
                    const owner = adminUsers.find((u) => u.id === lead.current_owner_id);
                    const stage = STAGES.find((s) => s.key === lead.status) || { label: lead.status || "Novo", color: "bg-neutral-100 text-neutral-700" };
                    const code = lead.tracking_code || `LINO.${lead.id.slice(0, 6).toUpperCase()}`;

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => (window.location.href = `/atendimentos?leadId=${lead.id}`)}
                        className="hover:bg-[#fafafa] cursor-pointer transition-colors"
                      >
                        {/* Código LINO com Cópia e Botão de Atribuição */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              onClick={(e) => handleOpenAttributionForLead(lead, e)}
                              className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                              title="Ver Raio-X de Atribuição e Campanha"
                            >
                              {code}
                            </span>
                            <button
                              onClick={(e) => handleCopyCode(e, code, lead.id)}
                              className="p-1 text-[#888888] hover:text-[#111111] transition-colors"
                              title="Copiar código"
                            >
                              {copiedId === lead.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#111111]">{lead.name || "Sem nome"}</div>
                          <div className="text-[11px] text-[#666666] truncate max-w-[180px]">
                            {lead.company || lead.empresa || lead.whatsapp_number}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-[#111111] truncate max-w-[180px]">
                            {lead.detected_product || lead.produto || "Não especificado"}
                          </div>
                          <div className="text-[11px] text-[#666666]">
                            {lead.quantidade ? `Qtd: ${lead.quantidade}` : "Especificação pendente"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stage.color}`}>
                            {stage.label}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-[#111111] font-medium">
                            {owner?.name || "Não atribuído"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-[11px] text-[#444444] bg-[#f5f5f5] px-2 py-0.5 rounded border border-[#eaeaea]">
                            {lead.context_source || "Direto / Orgânico"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => handleOpenAttributionForLead(lead, e)}
                            className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                          >
                            Ver Origem →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VISÃO KANBAN COM CÓDIGO LINO ───────────────────────────── */}
      {viewMode === "kanban" && (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1100px]">
            {STAGES.map((stage) => {
              const stageLeads = filteredOportunidades.filter((l) => l.status === stage.key);

              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[260px] bg-[#f5f5f5] rounded-lg p-3 flex flex-col border border-[#eaeaea]"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#eaeaea]">
                    <span className="text-xs font-semibold text-[#111111]">{stage.label}</span>
                    <span className="text-[10px] font-bold text-[#666666] bg-white px-1.5 py-0.5 rounded border border-[#eaeaea]">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                    {stageLeads.map((lead) => {
                      const code = lead.tracking_code || `LINO.${lead.id.slice(0, 6).toUpperCase()}`;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => (window.location.href = `/atendimentos?leadId=${lead.id}`)}
                          className="p-3 bg-white rounded-md border border-[#eaeaea] hover:border-[#999999] cursor-pointer shadow-2xs transition-all flex flex-col gap-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              onClick={(e) => handleOpenAttributionForLead(lead, e)}
                              className="font-mono text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                              title="Ver Raio-X de Atribuição"
                            >
                              {code}
                            </span>
                            {lead.sla_breached && (
                              <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" title="SLA Violado" />
                            )}
                          </div>

                          <div className="font-semibold text-xs text-[#111111] truncate">
                            {lead.name || "Cliente"}
                          </div>

                          <p className="text-[11px] text-[#666666] truncate">
                            {lead.company || lead.empresa || lead.whatsapp_number}
                          </p>

                          <div className="pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-[10px] text-[#888888]">
                            <span>{lead.detected_product || lead.produto || "Produto"}</span>
                            <span className="text-blue-600 font-medium">
                              {lead.context_source || "Direto"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL RAIO-X DE ATRIBUIÇÃO & CONSULTA PROTHEUS ────────── */}
      {showAttributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg border border-[#eaeaea] shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-5 text-xs max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-[#eaeaea]">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-base text-[#111111]">
                    Rastreabilidade de Vendas & Atribuição de Campanha
                  </h3>
                  <p className="text-[11px] text-[#666666]">
                    Consulte o código LINO do cliente para identificar a origem exata (anúncio, campanha e página)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAttributionModal(false)}
                className="p-1 rounded text-[#888888] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Campo de Busca por Código LINO */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                <input
                  type="text"
                  placeholder="Digite ou cole o código (ex: LINO.ABC123 ou ABC123)..."
                  value={attributionSearchCode}
                  onChange={(e) => setAttributionSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchAttribution()}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-md border border-[#eaeaea] bg-[#fafafa] text-[#111111] outline-none focus:border-[#111111] transition-colors"
                />
              </div>
              <button
                onClick={() => handleSearchAttribution()}
                disabled={attributionLoading || !attributionSearchCode.trim()}
                className="px-4 py-2 rounded-md bg-[#111111] text-white font-semibold hover:bg-black disabled:opacity-50 transition-colors"
              >
                {attributionLoading ? "Consultando..." : "Localizar Origem"}
              </button>
            </div>

            {attributionError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                {attributionError}
              </div>
            )}

            {/* Resultado da Atribuição */}
            {attributionData && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                {/* 1. Card de Origem & Campanha */}
                <div className="p-4 rounded-lg bg-[#fafafa] border border-[#eaeaea] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Campanha & Canal de Entrada
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#111111]">
                      {attributionData.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#666666] block">Origem / Canal</span>
                      <span className="font-bold text-[#111111]">
                        {attributionData.campaign?.origem || "Site Permetal"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#666666] block">Campanha (utm_campaign)</span>
                      <span className="font-semibold text-[#111111] truncate block">
                        {attributionData.campaign?.utm_campaign || "Orgânico / Geral"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#666666] block">Mídia (utm_medium)</span>
                      <span className="font-semibold text-[#111111]">
                        {attributionData.campaign?.utm_medium || "cpc"}
                      </span>
                    </div>

                    {attributionData.campaign?.utm_term && (
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#666666] block">Termo de Busca (Palavra-chave)</span>
                        <span className="font-medium text-[#111111] bg-white p-1.5 rounded border border-[#eaeaea] block">
                          {attributionData.campaign.utm_term}
                        </span>
                      </div>
                    )}

                    {attributionData.campaign?.page_title && (
                      <div className="col-span-3">
                        <span className="text-[10px] text-[#666666] block">Página que Navegou Antes de Chamar no WhatsApp</span>
                        <div className="font-medium text-[#111111] bg-white p-2 rounded border border-[#eaeaea] break-all">
                          <strong>{attributionData.campaign.page_title}</strong>
                          <span className="text-[#666666] block text-[11px] mt-0.5">
                            {attributionData.campaign.url || attributionData.campaign.page_path}
                          </span>
                        </div>
                      </div>
                    )}

                    {attributionData.campaign?.gclid && (
                      <div className="col-span-3">
                        <span className="text-[10px] text-[#666666] block">Google Click ID (GCLID)</span>
                        <span className="font-mono text-[10px] text-[#666666] truncate block">
                          {attributionData.campaign.gclid}
                        </span>
                      </div>
                    )}

                    {attributionData.campaign?.clicked_at && (
                      <div className="col-span-3 text-[11px] text-[#888888] pt-1 border-t border-[#eaeaea]">
                        Data/Hora do Clique: {new Date(attributionData.campaign.clicked_at).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Card do Lead no CRM */}
                {attributionData.lead && (
                  <div className="p-4 rounded-lg bg-white border border-[#eaeaea] flex flex-col gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                      Dados do Comprador / Oportunidade
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#666666] block text-[10px]">Nome do Contato</span>
                        <span className="font-bold text-[#111111]">{attributionData.lead.name || "N/D"}</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block text-[10px]">Empresa / Razão Social</span>
                        <span className="font-bold text-[#111111]">{attributionData.lead.company || "N/D"}</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block text-[10px]">CNPJ</span>
                        <span className="font-mono text-[#111111]">{attributionData.lead.cnpj || "Não cadastrado"}</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block text-[10px]">WhatsApp</span>
                        <span className="font-mono text-[#111111]">{attributionData.lead.whatsapp_number}</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block text-[10px]">Consultor Responsável</span>
                        <span className="font-medium text-[#111111]">
                          {attributionData.lead.seller?.name || "Não atribuído"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#666666] block text-[10px]">Etapa Atual</span>
                        <span className="font-semibold text-blue-700">{attributionData.lead.status}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Fechamento de Venda no Protheus */}
                {attributionData.lead && (
                  <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200/80 flex flex-col gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Registrar Venda Concluída no Protheus
                    </span>
                    <p className="text-[11px] text-emerald-800">
                      Vincule o pedido faturado no ERP ao lead para fechar a oportunidade e comprovar o ROI da campanha.
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[#555555] block mb-1 font-medium">Nº Pedido / Orçamento Protheus</label>
                        <input
                          type="text"
                          placeholder="Ex: PED-109482"
                          value={protheusOrder}
                          onChange={(e) => setProtheusOrder(e.target.value)}
                          className="w-full p-2 rounded border border-[#eaeaea] bg-white text-[#111111] outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="text-[#555555] block mb-1 font-medium">Valor Faturado (R$)</label>
                        <input
                          type="text"
                          placeholder="Ex: 15400,00"
                          value={protheusValue}
                          onChange={(e) => setProtheusValue(e.target.value)}
                          className="w-full p-2 rounded border border-[#eaeaea] bg-white text-[#111111] outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveProtheusSale}
                      disabled={savingProtheus}
                      className="self-end px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 text-xs mt-1"
                    >
                      {savingProtheus ? "Registrando..." : "Confirmar Venda Ganha no CRM"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CURTO NOVO LEAD ───────────────────────────────────── */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg border border-[#eaeaea] shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaeaea]">
              <h3 className="font-bold text-sm text-[#111111]">Novo lead</h3>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="p-1 rounded text-[#888888] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="flex flex-col gap-3">
              <div>
                <label className="text-[#666666] block mb-1">Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do contato"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111] outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="text-[#666666] block mb-1">WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5511999999999"
                  value={newLeadForm.whatsapp_number}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, whatsapp_number: e.target.value })}
                  className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111] outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="text-[#666666] block mb-1">Empresa (opcional)</label>
                <input
                  type="text"
                  placeholder="Razão social ou fantasia"
                  value={newLeadForm.company}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                  className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111] outline-none focus:border-[#111111]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaeaea]">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="px-3 py-1.5 rounded border border-[#eaeaea] text-[#666666] hover:bg-[#fafafa]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="px-3.5 py-1.5 rounded bg-[#111111] text-white font-semibold hover:bg-black disabled:opacity-50"
                >
                  {creatingLead ? "Criando..." : "Criar lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
