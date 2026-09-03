"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Building,
  Send,
  Paperclip,
  Pause,
  Play,
  PhoneCall,
  FileText,
  MessageSquare,
  Lock,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Plus,
  ShieldAlert,
} from "lucide-react";

export default function AtendimentosPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros da Fila
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQueueFilter, setActiveQueueFilter] = useState<
    "todos" | "sdr" | "aguardando" | "orcamento" | "sla_critico" | "pos_venda"
  >("todos");

  // Conversa & Compositor
  const [messages, setMessages] = useState<any[]>([]);
  const [composerMode, setComposerMode] = useState<"client" | "internal">("client");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showFullData, setShowFullData] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
        const list = Array.isArray(json) ? json : json.data || [];
        setLeads(list);
        if (list.length > 0 && !selectedLeadId) {
          setSelectedLeadId(list[0].id);
        }
      }
      if (usersRes.ok) {
        const users = await usersRes.json();
        setAdminUsers(users || []);
      }
    } catch (e) {
      console.error("[Atendimentos] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }

  // Carregar histórico ao selecionar lead
  useEffect(() => {
    if (selectedLeadId) {
      carregarHistorico(selectedLeadId);
    }
  }, [selectedLeadId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function carregarHistorico(leadId: string) {
    try {
      const res = await fetch(`/api/interactions?lead_id=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (e) {
      console.error("[Atendimentos] Erro ao carregar mensagens:", e);
    }
  }

  const selectedLead = useMemo(() => {
    return leads.find((l) => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  // ── FILTRAGEM DA FILA ─────────────────────────────────────────────
  const filteredQueue = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.whatsapp_number && lead.whatsapp_number.includes(q)) ||
        (lead.tracking_code && lead.tracking_code.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (activeQueueFilter === "sdr") return lead.status === "SDR_QUALIFICATION";
      if (activeQueueFilter === "aguardando") return lead.status === "WAITING_SELLER";
      if (activeQueueFilter === "orcamento") return lead.status === "IN_NEGOTIATION";
      if (activeQueueFilter === "sla_critico") return lead.sla_breached === true;
      if (activeQueueFilter === "pos_venda") return lead.status === "POST_SALE" || lead.return_intent === "POS_VENDA";

      return true;
    });
  }, [leads, searchQuery, activeQueueFilter]);

  // ── AÇÕES RÁPIDAS DE CONTEXTO ────────────────────────────────────
  const handleQuickAction = async (action: string, payload?: any) => {
    if (!selectedLead) return;

    if (action === "TOGGLE_BOT") {
      const newBotState = !selectedLead.bot_active;
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, bot_active: newBotState } : l))
      );
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedLead.id, bot_active: newBotState }),
      });
    } else if (action === "CHANGE_STATUS") {
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, status: payload } : l))
      );
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedLead.id, status: payload }),
      });
    } else if (action === "CHANGE_OWNER") {
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, current_owner_id: payload } : l))
      );
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedLead.id, current_owner_id: payload }),
      });
    }
  };

  // Envio de mensagem ou nota interna
  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedLead || sending) return;
    setSending(true);

    const isInternal = composerMode === "internal";
    const newMsg = {
      lead_id: selectedLead.id,
      sender_type: isInternal ? "SYSTEM" : "LINO",
      message_content: isInternal ? `[NOTA INTERNA]: ${inputText}` : inputText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    try {
      await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg),
      });
    } catch (e) {
      console.error("Erro ao enviar mensagem:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#fafafa] overflow-hidden text-[#111111]">
      {/* ══════════════════════════════════════════════════════════════
          PAINEL 1: FILA DE ATENDIMENTOS (340px)
          ══════════════════════════════════════════════════════════════ */}
      <aside className="w-[340px] flex-shrink-0 border-r border-[#eaeaea] bg-white flex flex-col h-full">
        {/* Topo da Fila: Busca & Atualizar */}
        <div className="p-3 border-b border-[#eaeaea] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111111]">Atendimentos</h2>
            <button
              onClick={carregarDados}
              className="p-1 text-[#666666] hover:text-[#111111] transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              placeholder="Buscar cliente, empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#fafafa] border border-[#eaeaea] rounded-md outline-none focus:border-[#111111] transition-colors"
            />
          </div>

          {/* Visualizações salvas compactas */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5 text-[11px]">
            {[
              { id: "todos", label: "Todos" },
              { id: "sdr", label: "SDR" },
              { id: "aguardando", label: "Aguardando" },
              { id: "orcamento", label: "Orçamento" },
              { id: "sla_critico", label: "SLA Crítico" },
              { id: "pos_venda", label: "Pós-Venda" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveQueueFilter(f.id as any)}
                className={`px-2 py-0.5 rounded whitespace-nowrap font-medium transition-colors ${
                  activeQueueFilter === f.id
                    ? "bg-[#111111] text-white"
                    : "text-[#666666] hover:bg-[#f5f5f5] hover:text-[#111111]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Atendimentos */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#eaeaea]">
          {loading ? (
            <p className="text-xs text-[#888888] text-center p-6">Carregando fila...</p>
          ) : filteredQueue.length === 0 ? (
            <p className="text-xs text-[#888888] text-center p-6">Nenhum atendimento na fila.</p>
          ) : (
            filteredQueue.map((item) => {
              const isSelected = item.id === selectedLeadId;
              const owner = adminUsers.find((u) => u.id === item.current_owner_id);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedLeadId(item.id)}
                  className={`p-3 cursor-pointer transition-colors flex flex-col gap-1 text-xs ${
                    isSelected ? "bg-[#f5f5f5] border-l-2 border-[#111111]" : "hover:bg-[#fafafa]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#111111] truncate max-w-[180px]">
                      {item.name || "Cliente sem nome"}
                    </span>
                    <span className="text-[10px] text-[#888888]">
                      {item.updated_at ? new Date(item.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#666666] truncate">
                    {item.company || item.empresa || item.whatsapp_number}
                  </p>

                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-[#888888] truncate max-w-[140px]">
                      {owner ? owner.name : "Sem vendedor"}
                    </span>
                    {item.sla_breached ? (
                      <span className="font-semibold text-red-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> SLA
                      </span>
                    ) : item.status === "WAITING_SELLER" ? (
                      <span className="text-amber-700 font-medium">Aguardando</span>
                    ) : (
                      <span className="text-[#888888]">{item.status || "Ativo"}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          PAINEL 2: CONVERSA E COMPOSITOR (FLEXÍVEL)
          ══════════════════════════════════════════════════════════════ */}
      <section className="flex-1 flex flex-col h-full bg-white border-r border-[#eaeaea]">
        {selectedLead ? (
          <>
            {/* Cabeçalho Compacto do Atendimento */}
            <header className="px-5 py-3 border-b border-[#eaeaea] flex items-center justify-between bg-white flex-shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[#111111] truncate">
                    {selectedLead.name || "Cliente sem nome"}
                  </h3>
                  <span className="font-mono text-[10px] bg-[#f5f5f5] px-1.5 py-0.5 rounded text-[#666666] border border-[#eaeaea]">
                    {selectedLead.tracking_code || `LINO.${selectedLead.id.slice(0, 6).toUpperCase()}`}
                  </span>
                </div>
                <p className="text-xs text-[#666666] truncate">
                  {selectedLead.company || selectedLead.empresa || "Empresa não informada"} • {selectedLead.whatsapp_number}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickAction("TOGGLE_BOT")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    selectedLead.bot_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  {selectedLead.bot_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{selectedLead.bot_active ? "Lino ativo" : "Lino pausado"}</span>
                </button>

                <button
                  onClick={() => setContextPanelOpen(!contextPanelOpen)}
                  className="p-1.5 rounded text-[#666666] hover:text-[#111111] hover:bg-[#f5f5f5] transition-colors"
                  title={contextPanelOpen ? "Recolher contexto" : "Expandir contexto"}
                >
                  {contextPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            </header>

            {/* Timeline / Histórico da Conversa */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#fafafa] flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="text-xs text-[#888888] text-center my-auto">
                  Nenhuma mensagem registrada neste atendimento.
                </p>
              ) : (
                messages.map((m, idx) => {
                  const isCustomer = m.sender_type === "CUSTOMER" || m.sender_type === "lead" || m.sender_type === "user";
                  const isInternal = m.sender_type === "SYSTEM" || (m.message_content && m.message_content.startsWith("[NOTA INTERNA]"));

                  if (isInternal) {
                    return (
                      <div key={idx} className="self-center w-full max-w-lg my-1">
                        <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-amber-700 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider block mb-0.5 text-amber-800">
                              Nota Interna (Não visível ao cliente)
                            </span>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.message_content.replace("[NOTA INTERNA]: ", "")}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[75%] ${
                        isCustomer ? "self-start items-start" : "self-end items-end"
                      }`}
                    >
                      <span className="text-[10px] text-[#888888] mb-0.5 px-1">
                        {isCustomer ? selectedLead.name || "Cliente" : "Lino / Atendimento"}
                      </span>
                      <div
                        className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                          isCustomer
                            ? "bg-white text-[#111111] border border-[#eaeaea] shadow-2xs"
                            : "bg-[#111111] text-white shadow-2xs"
                        }`}
                      >
                        {m.message_content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Compositor com Alternância Explícita */}
            <div className="p-3 border-t border-[#eaeaea] bg-white flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposerMode("client")}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                    composerMode === "client"
                      ? "bg-[#111111] text-white"
                      : "text-[#666666] hover:bg-[#f5f5f5]"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" /> Responder cliente
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("internal")}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                    composerMode === "internal"
                      ? "bg-amber-600 text-white"
                      : "text-[#666666] hover:bg-[#f5f5f5]"
                  }`}
                >
                  <Lock className="w-3 h-3" /> Nota interna
                </button>
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    composerMode === "internal"
                      ? "Escreva uma nota interna para a equipe (não visível ao cliente)..."
                      : "Digite a resposta ao cliente (Enter para enviar)..."
                  }
                  className={`flex-1 text-xs p-2.5 rounded-md border outline-none resize-none transition-colors ${
                    composerMode === "internal"
                      ? "border-amber-300 bg-amber-50/40 focus:border-amber-600"
                      : "border-[#eaeaea] bg-[#fafafa] focus:border-[#111111]"
                  }`}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !inputText.trim()}
                  className={`px-3.5 py-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                    composerMode === "internal"
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-[#111111] text-white hover:bg-black"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[#888888]">
            Selecione um atendimento na fila ao lado.
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PAINEL 3: CONTEXTO RECOLHÍVEL (320px)
          ORDEM OBRIGATÓRIA DA ESPECIFICAÇÃO
          ══════════════════════════════════════════════════════════════ */}
      {contextPanelOpen && selectedLead && (
        <aside className="w-[320px] flex-shrink-0 border-l border-[#eaeaea] bg-white flex flex-col h-full overflow-y-auto p-4 gap-5">
          {/* 1. Próxima Ação */}
          <div className="p-3 rounded-md bg-[#fafafa] border border-[#eaeaea]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block mb-1">
              1. Próxima ação
            </span>
            <p className="text-xs font-semibold text-[#111111]">
              {selectedLead.status === "WAITING_SELLER"
                ? "Consultor deve iniciar 1º contato urgente."
                : selectedLead.status === "IN_NEGOTIATION"
                ? "Aguardando envio de proposta/orçamento."
                : selectedLead.status === "SDR_QUALIFICATION"
                ? "Coletando especificações técnicas."
                : "Acompanhamento comercial."}
            </p>
            <div className="flex flex-col gap-1.5 mt-3 pt-2.5 border-t border-[#eaeaea]">
              <button
                onClick={() => handleQuickAction("CHANGE_STATUS", "IN_NEGOTIATION")}
                className="w-full py-1.5 px-2 text-xs font-medium bg-[#111111] text-white rounded hover:bg-black transition-colors flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3 h-3" /> Registrar Contato
              </button>
              <button
                onClick={() => handleQuickAction("CHANGE_STATUS", "CLOSED_WON")}
                className="w-full py-1.5 px-2 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3 h-3" /> Marcar Venda Ganha
              </button>
            </div>
          </div>

          {/* 2. SLA e Tempo Aguardando */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
              2. SLA e Tempo
            </span>
            <div className="flex items-center justify-between p-2.5 rounded bg-[#fafafa] border border-[#eaeaea] text-xs">
              <span className="text-[#666666]">Situação de resposta</span>
              {selectedLead.sla_breached ? (
                <span className="font-semibold text-red-600 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Violado (&gt;30 min úteis)
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5" /> Em dia
                </span>
              )}
            </div>
          </div>

          {/* 3. Responsável / Equipe */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
              3. Responsável comercial
            </span>
            <select
              value={selectedLead.current_owner_id || ""}
              onChange={(e) => handleQuickAction("CHANGE_OWNER", e.target.value || null)}
              className="text-xs p-2 rounded border border-[#eaeaea] bg-white text-[#111111] outline-none focus:border-[#111111]"
            >
              <option value="">Não atribuído</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role || "Consultor"})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Cliente / Empresa */}
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
              4. Cliente e empresa
            </span>
            <div className="p-2.5 rounded bg-[#fafafa] border border-[#eaeaea] flex flex-col gap-1">
              <span className="font-semibold text-[#111111]">{selectedLead.name || "Não informado"}</span>
              <span className="text-[#666666]">{selectedLead.company || selectedLead.empresa || "Sem empresa"}</span>
              <span className="text-[#666666] font-mono">{selectedLead.whatsapp_number}</span>
            </div>
          </div>

          {/* 5. Oportunidade / Produto */}
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
              5. Oportunidade e produto
            </span>
            <div className="p-2.5 rounded bg-[#fafafa] border border-[#eaeaea] flex flex-col gap-1.5">
              <div>
                <span className="text-[10px] text-[#888888] block">Produto</span>
                <span className="font-semibold text-[#111111]">{selectedLead.detected_product || selectedLead.produto || "Pendente"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#888888] block">Quantidade</span>
                <span className="font-semibold text-[#111111]">{selectedLead.quantidade || "Não informada"}</span>
              </div>
              {selectedLead.especificacao && (
                <div>
                  <span className="text-[10px] text-[#888888] block">Especificação</span>
                  <p className="font-mono text-[11px] text-[#222222] bg-white p-1.5 rounded border border-[#eaeaea]">
                    {selectedLead.especificacao}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 6. Ver todos os dados recolhidos */}
          <div className="pt-2 border-t border-[#eaeaea]">
            <button
              onClick={() => setShowFullData(!showFullData)}
              className="text-xs text-[#666666] hover:text-[#111111] font-medium flex items-center justify-between w-full"
            >
              <span>{showFullData ? "Ocultar dados completos" : "Ver todos os dados"}</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showFullData ? "rotate-90" : ""}`} />
            </button>

            {showFullData && (
              <div className="mt-2.5 p-2.5 rounded bg-[#fafafa] border border-[#eaeaea] text-xs flex flex-col gap-2">
                <div>
                  <span className="text-[10px] text-[#888888] block">CNPJ</span>
                  <span className="font-mono text-[#111111]">{selectedLead.cnpj || "N/D"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#888888] block">E-mail</span>
                  <span className="text-[#111111]">{selectedLead.email_corporativo || "N/D"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#888888] block">Cidade / UF</span>
                  <span className="text-[#111111]">{selectedLead.cidade_empresa || "N/D"}</span>
                </div>
                {selectedLead.observacao && (
                  <div>
                    <span className="text-[10px] text-[#888888] block">Observação</span>
                    <span className="text-[#111111]">{selectedLead.observacao}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
