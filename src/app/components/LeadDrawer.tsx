"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Clock,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  PhoneCall,
  FileText,
  Ticket,
  Send,
  MessageSquare,
  Activity,
  FileSpreadsheet,
  Globe,
  Compass,
  Copy,
  Check,
  Tag,
} from "lucide-react";

interface LeadDrawerProps {
  selectedLead: any | null;
  onClose: () => void;
  onUpdateLead: (field: string, value: any) => void;
  onDeleteLead: (id: string) => void;
}

export default function LeadDrawer({
  selectedLead,
  onClose,
  onUpdateLead,
  onDeleteLead,
}: LeadDrawerProps) {
  const [activeTab, setActiveTab] = useState<"resumo" | "conversa" | "dados" | "atividade">("resumo");
  const [history, setHistory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [attribution, setAttribution] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSellers() {
      try {
        const res = await fetch("/api/admin-users");
        if (res.ok) {
          const data = await res.json();
          setAdminUsers(data || []);
        }
      } catch (e) {
        console.error("[LeadDrawer] Erro ao carregar sellers:", e);
      }
    }
    fetchSellers();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      setFormData({ ...selectedLead });
      loadInteractionsAndEvents(selectedLead.id);
    }
  }, [selectedLead]);

  useEffect(() => {
    if (activeTab === "conversa") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, activeTab]);

  async function loadInteractionsAndEvents(leadId: string) {
    setLoadingHistory(true);
    try {
      const [resInteractions, resAttr] = await Promise.all([
        fetch(`/api/interactions?lead_id=${leadId}`),
        fetch(`/api/tracking/attribution?lead_id=${leadId}`),
      ]);

      if (resInteractions.ok) {
        const data = await resInteractions.json();
        setHistory(data || []);
      }

      if (resAttr.ok) {
        const attrData = await resAttr.json();
        if (attrData.found) setAttribution(attrData);
        else setAttribution(null);
      }
    } catch (e) {
      console.error("[LeadDrawer] Erro ao carregar dados:", e);
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Ação atômica via PATCH único
  const handleSaveAll = async () => {
    if (!formData.id) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updated = await res.json();
        Object.entries(updated).forEach(([k, v]) => onUpdateLead(k, v));
      }
    } catch (e) {
      console.error("[LeadDrawer] Erro ao salvar lead:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = async (action: string, payload?: any) => {
    if (!formData.id) return;
    if (action === "TOGGLE_BOT") {
      const newBotState = !formData.bot_active;
      setFormData((prev: any) => ({ ...prev, bot_active: newBotState }));
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formData.id, bot_active: newBotState }),
      });
      onUpdateLead("bot_active", newBotState);
    } else if (action === "CHANGE_STATUS") {
      setFormData((prev: any) => ({ ...prev, status: payload }));
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formData.id, status: payload }),
      });
      onUpdateLead("status", payload);
    }
  };

  if (!selectedLead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-2xs transition-all">
      <div
        className="w-full max-w-[760px] h-full bg-white shadow-2xl flex flex-col border-l border-[#eaeaea] text-[#111111] animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER FIXO ────────────────────────────────────────── */}
        <header className="px-6 py-4 border-b border-[#eaeaea] flex items-center justify-between bg-white flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#f5f5f5] text-[#111111] border border-[#eaeaea]">
                {formData.tracking_code || `LINO.${formData.id?.slice(0, 6).toUpperCase()}`}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  formData.status === "WAITING_SELLER"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : formData.status === "IN_NEGOTIATION"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : formData.status === "CLOSED_WON"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-neutral-100 text-neutral-800 border-neutral-200"
                }`}
              >
                {formData.status || "NOVO"}
              </span>
              {formData.sla_breached && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> SLA VIOLADO
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#111111] truncate">
              {formData.name || "Cliente sem nome"}
            </h2>
            <p className="text-xs text-[#666666] truncate">
              {formData.company || formData.empresa || "Empresa não informada"} • {formData.whatsapp_number}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuickAction("TOGGLE_BOT")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                formData.bot_active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
            >
              {formData.bot_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{formData.bot_active ? "Pausar Lino" : "Retomar Lino"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[#f5f5f5] text-[#666666] hover:text-[#111111] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── BARRA DE ABAS ───────────────────────────────────────── */}
        <div className="flex items-center gap-6 px-6 border-b border-[#eaeaea] bg-white text-xs font-medium flex-shrink-0">
          {[
            { key: "resumo", label: "Resumo & Ações", icon: CheckCircle2 },
            { key: "conversa", label: "Conversa & Timeline", icon: MessageSquare },
            { key: "dados", label: "Dados Cadastrais", icon: FileText },
            { key: "atividade", label: "Eventos de SLA", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                  isActive
                    ? "border-[#111111] text-[#111111] font-semibold"
                    : "border-transparent text-[#666666] hover:text-[#111111]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── CONTEÚDO DAS ABAS ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
          {activeTab === "resumo" && (
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">
              {/* Próxima Ação Prioritária */}
              <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-xs">
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider block mb-1">
                  Próxima Ação Recomendada
                </span>
                <p className="text-sm font-semibold text-[#111111]">
                  {formData.status === "WAITING_SELLER"
                    ? "Consultor deve realizar primeiro contato por WhatsApp ou ligação."
                    : formData.status === "IN_NEGOTIATION"
                    ? "Aguardando envio ou aprovação de orçamento técnico."
                    : formData.status === "SDR_QUALIFICATION"
                    ? "Lino conduzindo qualificação de demanda e especificação."
                    : "Atendimento concluído ou em etapa posterior."}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#eaeaea]">
                  <button
                    onClick={() => handleQuickAction("CHANGE_STATUS", "IN_NEGOTIATION")}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#111111] text-white hover:bg-black transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Registrar Contato
                  </button>
                  <button
                    onClick={() => handleQuickAction("CHANGE_STATUS", "CLOSED_WON")}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Venda Fechada
                  </button>
                </div>
              </div>

              {/* Origem e Atribuição de Campanha / Rastreabilidade */}
              <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                      Origem & Atribuição de Campanha
                    </h3>
                  </div>
                  {formData.tracking_code && (
                    <button
                      onClick={() => handleCopyCode(formData.tracking_code)}
                      className="flex items-center gap-1 text-[11px] font-mono font-medium text-[#666666] hover:text-[#111111] bg-[#f5f5f5] px-2 py-0.5 rounded border border-[#eaeaea] transition-colors"
                      title="Copiar código de rastreamento"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{formData.tracking_code}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[#666666] block text-[11px]">Canal / Origem</span>
                    <span className="font-semibold text-[#111111]">
                      {attribution?.campaign?.origem || formData.context_source || "Direto / Orgânico"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[11px]">Campanha (UTM)</span>
                    <span className="font-semibold text-[#111111] truncate block">
                      {attribution?.campaign?.utm_campaign || "Geral / Site"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[11px]">Mídia (Medium)</span>
                    <span className="font-semibold text-[#111111]">
                      {attribution?.campaign?.utm_medium || "cpc / link"}
                    </span>
                  </div>
                  {attribution?.campaign?.utm_term && (
                    <div className="col-span-2">
                      <span className="text-[#666666] block text-[11px]">Termo de Busca</span>
                      <span className="font-medium text-[#111111] bg-blue-50/60 px-2 py-0.5 rounded border border-blue-200/50 block">
                        {attribution.campaign.utm_term}
                      </span>
                    </div>
                  )}
                  {attribution?.campaign?.page_title && (
                    <div className="col-span-3">
                      <span className="text-[#666666] block text-[11px]">Página Navegada no Site</span>
                      <span className="text-[#222222] font-medium truncate block">
                        {attribution.campaign.page_title}
                      </span>
                    </div>
                  )}
                  {attribution?.campaign?.clicked_at && (
                    <div className="col-span-3 text-[11px] text-[#888888] pt-1 border-t border-[#f0f0f0]">
                      Horário do clique: {new Date(attribution.campaign.clicked_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Especificação Técnica e Demanda */}
              <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-xs flex flex-col gap-3">
                <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Especificação Técnica e Demanda
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#666666] block">Produto</span>
                    <span className="font-semibold text-[#111111]">
                      {formData.detected_product || formData.produto || "Não especificado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#666666] block">Quantidade / Medida</span>
                    <span className="font-semibold text-[#111111]">
                      {formData.quantidade || "Não informada"}
                    </span>
                  </div>
                </div>
                {formData.especificacao && (
                  <div className="p-3 rounded bg-[#f5f5f5] text-xs font-mono text-[#222222] border border-[#eaeaea]">
                    {formData.especificacao}
                  </div>
                )}
                {formData.observacao && (
                  <p className="text-xs text-[#555555] bg-amber-50/50 p-2.5 rounded border border-amber-200/60">
                    <strong className="text-amber-900">Resumo da Aplicação:</strong> {formData.observacao}
                  </p>
                )}
              </div>

              {/* Atribuição de Vendedor */}
              <div className="p-4 rounded-lg bg-white border border-[#eaeaea] shadow-xs flex flex-col gap-3">
                <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Responsável Comercial
                </h3>
                <select
                  value={formData.current_owner_id || ""}
                  onChange={(e) => setFormData({ ...formData, current_owner_id: e.target.value || null })}
                  className="w-full text-xs p-2.5 rounded-md border border-[#eaeaea] bg-white text-[#111111] outline-none focus:border-[#111111]"
                >
                  <option value="">Sem vendedor atribuído</option>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role || "Consultor"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === "conversa" && (
            <div className="flex flex-col h-full bg-white rounded-lg border border-[#eaeaea] overflow-hidden shadow-xs">
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                {loadingHistory ? (
                  <p className="text-xs text-[#888888] text-center my-auto">Carregando histórico...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-[#888888] text-center my-auto">Nenhuma interação registrada.</p>
                ) : (
                  history.map((msg, idx) => {
                    const isClient = msg.sender_type === "lead" || msg.sender_type === "CUSTOMER" || msg.sender_type === "user";
                    const isSystem = msg.sender_type === "SYSTEM";

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[80%] ${
                          isClient ? "self-start items-start" : isSystem ? "self-center items-center" : "self-end items-end"
                        }`}
                      >
                        <span className="text-[10px] text-[#888888] mb-0.5 px-1">
                          {isClient ? formData.name || "Cliente" : isSystem ? "Sistema" : "Lino Assistente"}
                        </span>
                        <div
                          className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                            isClient
                              ? "bg-[#f5f5f5] text-[#111111] border border-[#eaeaea]"
                              : isSystem
                              ? "bg-amber-50 text-amber-900 border border-amber-200 text-center"
                              : "bg-[#111111] text-white"
                          }`}
                        >
                          {msg.message_content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>
            </div>
          )}

          {activeTab === "dados" && (
            <div className="bg-white p-5 rounded-lg border border-[#eaeaea] shadow-xs flex flex-col gap-4 max-w-2xl mx-auto">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                Cadastro do Lead
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#666666] block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111]"
                  />
                </div>
                <div>
                  <label className="text-[#666666] block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp_number || ""}
                    disabled
                    className="w-full p-2 border border-[#eaeaea] rounded bg-[#f5f5f5] text-[#666666]"
                  />
                </div>
                <div>
                  <label className="text-[#666666] block mb-1">Empresa</label>
                  <input
                    type="text"
                    value={formData.company || formData.empresa || ""}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value, empresa: e.target.value })}
                    className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111]"
                  />
                </div>
                <div>
                  <label className="text-[#666666] block mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj || ""}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111]"
                  />
                </div>
                <div>
                  <label className="text-[#666666] block mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    value={formData.email_corporativo || ""}
                    onChange={(e) => setFormData({ ...formData, email_corporativo: e.target.value })}
                    className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111]"
                  />
                </div>
                <div>
                  <label className="text-[#666666] block mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={formData.cidade_empresa || ""}
                    onChange={(e) => setFormData({ ...formData, cidade_empresa: e.target.value })}
                    className="w-full p-2 border border-[#eaeaea] rounded bg-white text-[#111111]"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="self-end px-4 py-2 text-xs font-semibold rounded bg-[#111111] text-white hover:bg-black transition-colors disabled:opacity-50 mt-2"
              >
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}

          {activeTab === "atividade" && (
            <div className="bg-white p-5 rounded-lg border border-[#eaeaea] shadow-xs max-w-2xl mx-auto flex flex-col gap-4">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                Auditoria e Linha do Tempo
              </h3>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-start gap-3 p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                  <Clock className="w-4 h-4 text-[#888888] mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#111111]">Criado em:</span>{" "}
                    <span className="text-[#666666]">{formData.created_at ? new Date(formData.created_at).toLocaleString('pt-BR') : 'N/D'}</span>
                  </div>
                </div>
                {formData.qualified_at && (
                  <div className="flex items-start gap-3 p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#111111]">Qualificado em:</span>{" "}
                      <span className="text-[#666666]">{new Date(formData.qualified_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                )}
                {formData.sent_to_seller_at && (
                  <div className="flex items-start gap-3 p-3 rounded bg-[#fafafa] border border-[#eaeaea]">
                    <PhoneCall className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#111111]">Encaminhado ao vendedor:</span>{" "}
                      <span className="text-[#666666]">{new Date(formData.sent_to_seller_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
