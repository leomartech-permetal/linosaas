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

  // Modal Novo Lead
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    whatsapp_number: "",
    company: "",
    origin: "Direto",
  });
  const [creatingLead, setCreatingLead] = useState(false);

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

  const filteredOportunidades = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.whatsapp_number && lead.whatsapp_number.includes(q)) ||
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

  const handleStageChange = async (leadId: string, newStage: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStage } : l))
    );

    try {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStage }),
      });
    } catch (err) {
      console.error("Erro ao atualizar etapa:", err);
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
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Buscar por cliente, empresa, produto..."
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
                  <th className="py-2.5 px-4 font-semibold">Cliente / Empresa</th>
                  <th className="py-2.5 px-4 font-semibold">Produto / Marca</th>
                  <th className="py-2.5 px-4 font-semibold">Etapa</th>
                  <th className="py-2.5 px-4 font-semibold">Responsável</th>
                  <th className="py-2.5 px-4 font-semibold">Última atividade</th>
                  <th className="py-2.5 px-4 font-semibold">Próxima ação</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Valor estimado</th>
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

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => (window.location.href = `/atendimentos?leadId=${lead.id}`)}
                        className="hover:bg-[#fafafa] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#111111]">{lead.name || "Sem nome"}</div>
                          <div className="text-[11px] text-[#666666] truncate max-w-[200px]">
                            {lead.company || lead.empresa || lead.whatsapp_number}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-[#111111] truncate max-w-[200px]">
                            {lead.detected_product || lead.produto || "Não especificado"}
                          </div>
                          <div className="text-[11px] text-[#666666]">
                            {lead.quantidade ? `Qtd: ${lead.quantidade}` : "Permetal"}
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

                        <td className="py-3 px-4 text-[#666666]">
                          {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString("pt-BR") : "N/D"}
                        </td>

                        <td className="py-3 px-4 font-medium text-[#333333]">
                          {lead.status === "WAITING_SELLER"
                            ? "Cobrar primeiro contato"
                            : lead.status === "IN_NEGOTIATION"
                            ? "Elaborar orçamento"
                            : lead.status === "SDR_QUALIFICATION"
                            ? "Qualificar demanda"
                            : "Acompanhar"}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-medium text-[#111111]">
                          {lead.valor ? `R$ ${lead.valor.toLocaleString("pt-BR")}` : "—"}
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

      {/* ── VISÃO KANBAN (ROLAGEM HORIZONTAL NORMAL, SEM PAN/ZOOM) ─── */}
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
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => (window.location.href = `/atendimentos?leadId=${lead.id}`)}
                        className="p-3 bg-white rounded-md border border-[#eaeaea] hover:border-[#999999] cursor-pointer shadow-2xs transition-all flex flex-col gap-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#111111] truncate max-w-[170px]">
                            {lead.name || "Cliente"}
                          </span>
                          {lead.sla_breached && (
                            <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" title="SLA Violado" />
                          )}
                        </div>

                        <p className="text-[11px] text-[#666666] truncate">
                          {lead.company || lead.empresa || lead.whatsapp_number}
                        </p>

                        <div className="pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-[10px] text-[#888888]">
                          <span>{lead.detected_product || lead.produto || "Produto"}</span>
                          <span>{lead.quantidade || ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
