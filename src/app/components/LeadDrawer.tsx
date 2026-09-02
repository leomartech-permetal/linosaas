import { useEffect, useState } from "react";
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

  const inputCls = "w-full bg-white border border-[var(--border-light)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-all";

  useEffect(() => {
    async function fetchSellers() {
      const { data } = await supabase.from("admin_users").select("id, name, whatsapp_number");
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

  async function loadHistory(leadId: string) {
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (data) setHistory(data);
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fields = [
        'name', 'cargo', 'empresa', 'cnpj', 'email_corporativo', 
        'produto', 'quantidade', 'cidade_empresa', 'especificacao',
        'status', 'tracking_code', 'totvs_order_id', 'closed_value', 'sales_notes'
      ];
      for (const field of fields) {
        if (formData[field] !== undefined && formData[field] !== selectedLead[field]) {
          await onUpdateLead(field, formData[field]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
  };

  const handleMarkAsClosedWon = async () => {
    const updated = { ...formData, status: 'CLOSED_WON' };
    setFormData(updated);
    await onUpdateLead('status', 'CLOSED_WON');
  };

  if (!selectedLead) return null;

  return (
    <div className="fixed top-0 right-0 h-screen w-[480px] bg-white border-l border-[var(--border-light)] transition-transform duration-300 transform z-50 flex flex-col translate-x-0 text-[var(--text-primary)] shadow-2xl">
      <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-sidebar)]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-black cursor-pointer p-1 rounded hover:bg-neutral-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <div>
            <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">Perfil do Contato</h3>
            {formData.tracking_code && (
              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                {formData.tracking_code}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onUpdateLead('bot_active', !selectedLead.bot_active)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${selectedLead.bot_active ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-light)]' : 'bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] border-[var(--status-critical-border)]'}`}
          >
            {selectedLead.bot_active ? 'Bot Ativo' : 'Bot Pausado'}
          </button>
        </div>
      </div>
 
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide text-xs">
        
        {/* Seção 0: Fechamento Manual & TOTVS Protheus */}
        <section className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm">💼</span>
              <h5 className="text-[11px] text-emerald-900 font-bold uppercase tracking-wider">Fechamento Manual • TOTVS Protheus</h5>
            </div>
            {formData.status === 'CLOSED_WON' ? (
              <span className="bg-emerald-600 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase">Venda Concluída</span>
            ) : (
              <button 
                type="button" 
                onClick={handleMarkAsClosedWon}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-colors shadow-sm"
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
                className="w-full bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-neutral-900 font-mono font-bold outline-none focus:border-emerald-600" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-emerald-900 uppercase font-bold">Valor Fechado (R$)</label>
              <input 
                placeholder="Ex: 15.400,00"
                value={formData.closed_value || ''} 
                onChange={(e) => setFormData({...formData, closed_value: e.target.value})} 
                className="w-full bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-neutral-900 font-mono font-bold outline-none focus:border-emerald-600" 
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-emerald-900 uppercase font-bold">Código LINO (Rastreio)</label>
              <input 
                placeholder="Ex: LINO.A8B3C1"
                value={formData.tracking_code || ''} 
                onChange={(e) => setFormData({...formData, tracking_code: e.target.value.toUpperCase()})} 
                className="w-full bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-neutral-900 font-mono font-bold outline-none focus:border-emerald-600 uppercase" 
              />
            </div>
          </div>
        </section>

        {/* Seção 1: Status do Lead */}
        <section className="space-y-2">
          <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Status do Pipeline</label>
          <select 
            value={formData.status || 'SDR_QUALIFICATION'} 
            onChange={(e) => {
              const newStatus = e.target.value;
              setFormData({ ...formData, status: newStatus });
              onUpdateLead('status', newStatus);
            }} 
            className="w-full bg-white border border-[var(--border-light)] rounded-md px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-black"
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

        {/* Seção 2: Perfil Profissional */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Qualificação Cadastral</h5>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Nome</label>
              <input value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Cargo</label>
              <input value={formData.cargo || ''} onChange={(e) => setFormData({...formData, cargo: e.target.value})} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Empresa</label>
              <input value={formData.empresa || formData.company || ''} onChange={(e) => setFormData({...formData, empresa: e.target.value})} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">CNPJ</label>
              <input value={formData.cnpj || ''} onChange={(e) => setFormData({...formData, cnpj: e.target.value})} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">E-mail Corporativo</label>
              <input value={formData.email_corporativo || ''} onChange={(e) => setFormData({...formData, email_corporativo: e.target.value})} className={inputCls} />
            </div>
          </div>
        </section>
 
        {/* Seção 3: Interesse Técnico */}
        <section className="space-y-4">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Demanda & Produto</h5>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Produto Solicitado</label>
              <input value={formData.produto || formData.detected_product || ''} onChange={(e) => setFormData({...formData, produto: e.target.value})} className="input-search-clean w-full h-9 px-3 font-bold text-[var(--text-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Quantidade / Metragem</label>
                <input value={formData.quantidade || ''} onChange={(e) => setFormData({...formData, quantidade: e.target.value})} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Cidade/UF</label>
                <input value={formData.cidade_empresa || formData.detected_city || ''} onChange={(e) => setFormData({...formData, cidade_empresa: e.target.value})} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Especificação Técnica Detalhada</label>
              <textarea rows={2} value={formData.especificacao || ''} onChange={(e) => setFormData({...formData, especificacao: e.target.value})} className="w-full bg-white border border-[var(--border-light)] rounded p-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-all resize-none" />
            </div>
          </div>
        </section>
 
        {/* Seção 4: Atribuição de Vendedor */}
        <section className="space-y-3">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Atribuição & Vendedor</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-sidebar)] p-3 rounded border border-[var(--border-light)] space-y-1">
              <label className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Vendedor Atribuído</label>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                {(() => {
                  const s = adminUsers.find(u => u.id === selectedLead.current_owner_id);
                  return s ? s.name : '—';
                })()}
              </div>
            </div>
 
            <div className="bg-[var(--bg-sidebar)] p-3 rounded border border-[var(--border-light)] space-y-1">
              <label className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Notificado Em</label>
              <div className="text-xs font-bold text-[var(--text-primary)] font-mono">
                {selectedLead.sent_to_seller_at ? new Date(selectedLead.sent_to_seller_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '—'}
              </div>
            </div>
          </div>
        </section>
 
        {/* Seção 4: Histórico de Conversa */}
        <section className="space-y-4">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Contexto da Conversa</h5>
          <div className="space-y-3 bg-[var(--bg-sidebar)] p-4 rounded border border-[var(--border-light)] max-h-[250px] overflow-y-auto scrollbar-hide">
            {history.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4 italic">Nenhuma interação registrada.</p>
            ) : history.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender_type === 'lead' ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[85%] p-3 rounded text-xs border ${msg.sender_type === 'lead' ? 'bg-white border-[var(--border-light)] text-[var(--text-secondary)] rounded-bl-none shadow-sm' : 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-light)] rounded-br-none'}`}>
                  {msg.message_content}
                </div>
                <span className="text-[8px] text-[var(--text-muted)] mt-1 uppercase font-mono">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
 
      <div className="p-6 bg-[var(--bg-sidebar)] border-t border-[var(--border-light)] flex gap-2">
        <button onClick={onClose} className="btn-secondary px-4 text-xs font-bold">
          Fechar
        </button>
        <button 
          onClick={() => onDeleteLead(selectedLead.id)}
          className="btn-secondary px-3 border border-[var(--border-light)] hover:border-[var(--status-critical-border)] hover:bg-[var(--status-critical-bg)] text-red-600 font-bold text-xs"
        >
          Excluir
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex-1 text-xs font-bold"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
