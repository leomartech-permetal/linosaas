import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface LeadDrawerProps {
  selectedLead: any | null;
  onClose: () => void;
  onUpdateLead: (field: string, value: any) => void;
  onDeleteLead: (id: string) => void;
}

export default function LeadDrawer({ selectedLead, onClose, onUpdateLead, onDeleteLead }: LeadDrawerProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const inputCls = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all shadow-sm";
  const labelCls = "text-[11px] font-semibold text-neutral-600 mb-1 block uppercase tracking-wide";

  useEffect(() => {
    async function fetchSellers() {
      const { data } = await supabase.from("admin_users").select("id, name, whatsapp_number, role");
      if (data) setAdminUsers(data);
    }
    fetchSellers();
  }, []);

  useEffect(() => {
    if (selectedLead && selectedLead.id !== formData.id) {
      setFormData({ ...selectedLead });
      loadHistory(selectedLead.id);
    }
  }, [selectedLead]);

  useEffect(() => {
    if (history.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  async function loadHistory(leadId: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/interactions?lead_id=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data || []);
        setLoadingHistory(false);
        return;
      }
    } catch (e) {
      console.error("[LeadDrawer] Erro ao carregar histórico via API:", e);
    }

    // Fallback supabase client
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (data) setHistory(data);
    setLoadingHistory(false);
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fields = [
        'name', 'cargo', 'empresa', 'cnpj', 'email_corporativo', 
        'produto', 'quantidade', 'cidade_empresa', 'especificacao',
        'status', 'tracking_code', 'totvs_order_id', 'closed_value', 'sales_notes',
        'current_owner_id'
      ];
      for (const field of fields) {
        if (formData[field] !== undefined && formData[field] !== selectedLead[field]) {
          await onUpdateLead(field, formData[field]);
        }
      }
    } catch (e) {
      console.error("[LeadDrawer] Erro ao salvar alterações:", e);
    }
    setIsSaving(false);
  };

  const handleMarkAsClosedWon = async () => {
    const updated = { ...formData, status: 'CLOSED_WON' };
    setFormData(updated);
    await onUpdateLead('status', 'CLOSED_WON');
  };

  if (!selectedLead) return null;

  const currentSeller = adminUsers.find(u => u.id === (formData.current_owner_id || selectedLead.current_owner_id));
  const rawPhone = (selectedLead.whatsapp_number || '').replace(/\D/g, '');

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-[2px] flex justify-end transition-opacity animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-neutral-200 text-neutral-800 animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header da Gaveta */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="text-neutral-500 hover:text-black p-1.5 rounded-full hover:bg-neutral-200 transition-colors"
              title="Fechar painel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-neutral-900 leading-tight">
                  {formData.name || selectedLead.name || "Lead Sem Nome"}
                </h3>
                {formData.tracking_code && (
                  <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold border border-emerald-300">
                    {formData.tracking_code}
                  </span>
                )}
              </div>
              {rawPhone && (
                <a 
                  href={`https://wa.me/${rawPhone}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-mono mt-0.5 font-medium"
                >
                  <span>+{rawPhone}</span>
                  <span className="text-[10px]">↗</span>
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => onUpdateLead('bot_active', !selectedLead.bot_active)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border shadow-sm ${
                selectedLead.bot_active 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                  : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
              }`}
            >
              {selectedLead.bot_active ? '● Bot Ativo' : '⏸ Bot Pausado'}
            </button>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-xs">
          
          {/* Seção 1: Status do Pipeline */}
          <section className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 space-y-2">
            <label className={labelCls}>Status do Pipeline Comercial</label>
            <select 
              value={formData.status || 'SDR_QUALIFICATION'} 
              onChange={(e) => {
                const newStatus = e.target.value;
                setFormData({ ...formData, status: newStatus });
                onUpdateLead('status', newStatus);
              }} 
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 text-xs font-bold text-neutral-900 outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 shadow-sm"
            >
              <option value="SDR_QUALIFICATION">🔄 Em Qualificação SDR</option>
              <option value="WAITING_SELLER">⏳ Aguardando Vendedor</option>
              <option value="IN_NEGOTIATION">💬 Em Negociação Comercial</option>
              <option value="CLOSED_WON">🏆 Venda Fechada (TOTVS)</option>
              <option value="POS_VENDA">📦 Suporte / Pós-Venda</option>
              <option value="OTHER_DEPARTMENT">🏢 Outro Setor (RH/Compras/Financeiro)</option>
              <option value="CANCELED">❌ Cancelado / Perdido</option>
            </select>
          </section>

          {/* Seção 2: Qualificação Cadastral */}
          <section className="bg-neutral-50/70 p-5 rounded-xl border border-neutral-200/80 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
              <h5 className="text-[11px] text-neutral-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>👤</span> Qualificação Cadastral B2B
              </h5>
              <span className="text-[10px] text-neutral-500 font-medium">Dados do Contato & Empresa</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Nome do Contato</label>
                <input 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  className={inputCls} 
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Cargo / Função</label>
                <input 
                  value={formData.cargo || ''} 
                  onChange={(e) => setFormData({...formData, cargo: e.target.value})} 
                  className={inputCls} 
                  placeholder="Ex: Comprador / Engenheiro"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Empresa</label>
                <input 
                  value={formData.empresa || formData.company || ''} 
                  onChange={(e) => setFormData({...formData, empresa: e.target.value, company: e.target.value})} 
                  className={inputCls} 
                  placeholder="Razão Social ou Nome Fantasia"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>CNPJ / CPF</label>
                <input 
                  value={formData.cnpj || ''} 
                  onChange={(e) => setFormData({...formData, cnpj: e.target.value})} 
                  className={inputCls} 
                  placeholder="00.000.000/0000-00 ou PF"
                />
              </div>

              <div className="col-span-2">
                <label className={labelCls}>E-mail Corporativo</label>
                <input 
                  value={formData.email_corporativo || ''} 
                  onChange={(e) => setFormData({...formData, email_corporativo: e.target.value})} 
                  className={inputCls} 
                  placeholder="contato@empresa.com.br"
                />
              </div>
            </div>
          </section>

          {/* Seção 3: Demanda & Especificações Técnicas */}
          <section className="bg-neutral-50/70 p-5 rounded-xl border border-neutral-200/80 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
              <h5 className="text-[11px] text-neutral-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>📦</span> Demanda Comercial & Produto
              </h5>
              <span className="text-[10px] text-neutral-500 font-medium">Especificação Técnica</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Produto Solicitado</label>
                <input 
                  value={formData.produto || formData.detected_product || ''} 
                  onChange={(e) => setFormData({...formData, produto: e.target.value, detected_product: e.target.value})} 
                  className={`${inputCls} font-bold text-neutral-900 bg-white`}
                  placeholder="Ex: Gradil Stadium, Tela Expandida..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Quantidade / Metragem</label>
                  <input 
                    value={formData.quantidade || ''} 
                    onChange={(e) => setFormData({...formData, quantidade: e.target.value})} 
                    className={inputCls} 
                    placeholder="Ex: 50 m², 10 peças, 400 ml"
                  />
                </div>

                <div>
                  <label className={labelCls}>Cidade / UF</label>
                  <input 
                    value={formData.cidade_empresa || ''} 
                    onChange={(e) => setFormData({...formData, cidade_empresa: e.target.value})} 
                    className={inputCls} 
                    placeholder="Ex: São Paulo / SP"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Especificação Técnica Detalhada</label>
                <textarea 
                  rows={3} 
                  value={formData.especificacao || ''} 
                  onChange={(e) => setFormData({...formData, especificacao: e.target.value})} 
                  className="w-full bg-white border border-neutral-300 rounded-lg p-3 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all resize-none shadow-sm leading-relaxed" 
                  placeholder="Dimensões, malha, espessura, arames, pilares, acabamento..."
                />
              </div>
            </div>
          </section>

          {/* Seção 4: Atribuição & Notificação do Vendedor */}
          <section className="bg-neutral-50/70 p-5 rounded-xl border border-neutral-200/80 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
              <h5 className="text-[11px] text-neutral-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>🎯</span> Roteamento & Vendedor
              </h5>
              {currentSeller && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Atribuído
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm space-y-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider block">
                  Vendedor Responsável
                </label>
                <select
                  value={formData.current_owner_id || ''}
                  onChange={(e) => {
                    const newOwnerId = e.target.value || null;
                    setFormData({ ...formData, current_owner_id: newOwnerId });
                    onUpdateLead('current_owner_id', newOwnerId);
                  }}
                  className="w-full bg-transparent font-bold text-xs text-neutral-900 outline-none cursor-pointer"
                >
                  <option value="">— Sem Vendedor —</option>
                  {adminUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.whatsapp_number ? `(${u.whatsapp_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm space-y-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider block">
                  Notificado Em
                </label>
                <div className="text-xs font-bold text-neutral-800 font-mono pt-0.5">
                  {selectedLead.sent_to_seller_at ? new Date(selectedLead.sent_to_seller_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : (
                    <span className="text-neutral-400 font-normal italic">Aguardando envio</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Seção 5: Fechamento Manual & TOTVS Protheus */}
          <section className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm">💼</span>
                <h5 className="text-[11px] text-emerald-950 font-bold uppercase tracking-wider">
                  Fechamento Manual • TOTVS Protheus
                </h5>
              </div>
              {formData.status === 'CLOSED_WON' ? (
                <span className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-0.5 rounded uppercase shadow-sm">
                  Venda Concluída
                </span>
              ) : (
                <button 
                  type="button" 
                  onClick={handleMarkAsClosedWon}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-3 py-1 rounded-md transition-colors shadow-sm"
                >
                  ✓ Mover para Venda Fechada
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-emerald-900 uppercase font-bold">Nº Pedido / NF Protheus</label>
                <input 
                  placeholder="Ex: PED-108422 ou NF-4590"
                  value={formData.totvs_order_id || formData.order_id || ''} 
                  onChange={(e) => setFormData({...formData, totvs_order_id: e.target.value})} 
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 font-mono font-bold outline-none focus:border-emerald-600 shadow-sm" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-emerald-900 uppercase font-bold">Valor Fechado (R$)</label>
                <input 
                  placeholder="Ex: 15.400,00"
                  value={formData.closed_value || ''} 
                  onChange={(e) => setFormData({...formData, closed_value: e.target.value})} 
                  className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 font-mono font-bold outline-none focus:border-emerald-600 shadow-sm" 
                />
              </div>
            </div>
          </section>

          {/* Seção 6: Contexto da Conversa / Histórico WhatsApp */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="text-[11px] text-neutral-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>💬</span> Contexto da Conversa (WhatsApp)
              </h5>
              <span className="text-[10px] text-neutral-500 font-mono">
                {history.length} {history.length === 1 ? 'mensagem' : 'mensagens'}
              </span>
            </div>

            <div className="space-y-3 bg-neutral-100/80 p-4 rounded-xl border border-neutral-200 max-h-72 overflow-y-auto scrollbar-thin">
              {loadingHistory ? (
                <p className="text-xs text-neutral-500 text-center py-6 animate-pulse">Carregando histórico do WhatsApp...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6 italic">Nenhuma interação registrada.</p>
              ) : (
                history.map((msg, idx) => {
                  const isLead = msg.sender_type === 'lead' || msg.sender_type === 'user';
                  const isPostSale = msg.sender_type === 'post_sale_ai';
                  const isSupport = msg.sender_type === 'support_ai';

                  return (
                    <div key={idx} className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[9px] font-bold uppercase text-neutral-500">
                          {isLead ? (formData.name || 'Cliente') : isPostSale ? 'Lino Pós-Venda' : isSupport ? 'Lino Suporte' : 'Lino SDR'}
                        </span>
                        <span className="text-[8px] text-neutral-400 font-mono">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div 
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs shadow-sm leading-relaxed whitespace-pre-wrap ${
                          isLead 
                            ? 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-none' 
                            : 'bg-emerald-600 text-white font-medium rounded-br-none'
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
          </section>

        </div>

        {/* Footer com Ações */}
        <div className="p-4 sm:px-6 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onClose} 
              className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            >
              Fechar
            </button>
            <button 
              type="button"
              onClick={() => onDeleteLead(selectedLead.id)}
              className="px-3 py-2 border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              Excluir Lead
            </button>
          </div>

          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 max-w-[200px] px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar Alterações</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
