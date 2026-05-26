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

  const inputCls = "w-full bg-white border border-[var(--border-light)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-all";

  useEffect(() => {
    async function fetchSellers() {
      const { data } = await supabase.from("admin_users").select("id, name, whatsapp_number");
      if (data) setAdminUsers(data);
    }
    fetchSellers();
  }, []);

  useEffect(() => {
    if (selectedLead) {
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

  if (!selectedLead) return null;

  return (
    <div className="fixed top-0 right-0 h-screen w-[450px] bg-white border-l border-[var(--border-light)] transition-transform duration-300 transform z-50 flex flex-col translate-x-0 text-[var(--text-primary)]">
      <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-sidebar)]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-black cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <h3 className="font-bold text-base text-[var(--text-primary)]">Detalhes do Lead</h3>
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
        {/* Seção 1: Perfil Profissional */}
        <section className="space-y-4">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Qualificação Profissional</h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Nome</label>
              <input value={selectedLead.name || ''} onChange={(e) => onUpdateLead('name', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Cargo</label>
              <input value={selectedLead.cargo || ''} onChange={(e) => onUpdateLead('cargo', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Empresa</label>
              <input value={selectedLead.empresa || selectedLead.company || ''} onChange={(e) => onUpdateLead('empresa', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">CNPJ</label>
              <input value={selectedLead.cnpj || ''} onChange={(e) => onUpdateLead('cnpj', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">E-mail Corporativo</label>
              <input value={selectedLead.email_corporativo || ''} onChange={(e) => onUpdateLead('email_corporativo', e.target.value)} className={inputCls} />
            </div>
          </div>
        </section>
 
        {/* Seção 2: Interesse Técnico */}
        <section className="space-y-4">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Interesse de Produto</h5>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Produto Detectado</label>
              <input value={selectedLead.produto || selectedLead.detected_product || ''} onChange={(e) => onUpdateLead('produto', e.target.value)} className="input-search-clean w-full h-9 px-3 font-bold text-[var(--text-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Quantidade</label>
                <input value={selectedLead.quantidade || ''} onChange={(e) => onUpdateLead('quantidade', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Cidade/UF</label>
                <input value={selectedLead.cidade_empresa || selectedLead.detected_city || ''} onChange={(e) => onUpdateLead('cidade_empresa', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Especificação Detalhada</label>
              <textarea rows={2} value={selectedLead.especificacao || ''} onChange={(e) => onUpdateLead('especificacao', e.target.value)} className="w-full bg-white border border-[var(--border-light)] rounded p-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-all resize-none" />
            </div>
          </div>
        </section>
 
        {/* Seção 3: Atribuição e SLA */}
        <section className="space-y-4">
          <h5 className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Atribuição e SLA</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-sidebar)] p-3 rounded border border-[var(--border-light)] space-y-1">
              <label className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Status</label>
              <div className="text-xs font-bold text-[var(--text-primary)] uppercase">
                {selectedLead.status === 'SDR_QUALIFICATION' ? 'Em Qualificação' :
                 selectedLead.status === 'WAITING_SELLER' ? 'Aguardando Vendedor' :
                 selectedLead.status === 'IN_NEGOTIATION' ? 'Em Negociação' :
                 selectedLead.status === 'CLOSED_WON' ? 'Venda Fechada' :
                 selectedLead.status === 'OTHER_DEPARTMENT' ? 'Outro Setor' :
                 selectedLead.status === 'CANCELED' ? 'Cancelado' :
                 selectedLead.status === 'FINISHED' ? 'Finalizado' :
                 selectedLead.status || '—'}
              </div>
            </div>
 
            <div className="bg-[var(--bg-sidebar)] p-3 rounded border border-[var(--border-light)] space-y-1">
              <label className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Intervenção (SLA)</label>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                {selectedLead.support_attempts || 0} tentativas
              </div>
            </div>
 
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
 
      <div className="p-6 bg-[var(--bg-sidebar)] border-t border-[var(--border-light)] flex gap-4">
        <button 
          onClick={onClose}
          className="btn-primary flex-1"
        >
          FECHAR DETALHES
        </button>
        <button 
          onClick={() => onDeleteLead(selectedLead.id)}
          className="btn-secondary px-4 border border-[var(--border-light)] hover:border-[var(--status-critical-border)] hover:bg-[var(--status-critical-bg)] text-[var(--text-muted)] hover:text-[var(--status-critical-text)] flex items-center justify-center cursor-pointer transition-colors"
          title="Excluir Lead"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  );
}
