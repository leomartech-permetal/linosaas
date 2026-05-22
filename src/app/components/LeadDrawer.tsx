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
    <div className={`fixed top-0 right-0 h-screen w-[450px] bg-[var(--theme-bg)] border-l border-[var(--theme-border)] shadow-2xl transition-transform duration-300 transform z-50 flex flex-col translate-x-0 text-[var(--theme-fg)]`}>
      <div className="p-6 border-b border-[var(--theme-border)] flex justify-between items-center bg-[var(--theme-hover)]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-[var(--theme-muted)] hover:text-[var(--theme-fg)] cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <h3 className="font-bold text-lg">Detalhes do Lead</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onUpdateLead('bot_active', !selectedLead.bot_active)}
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${selectedLead.bot_active ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40'}`}
          >
            {selectedLead.bot_active ? '🤖 Bot Ativo' : '✋ Bot Pausado'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {/* Seção 1: Perfil Profissional */}
        <section>
          <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase tracking-[0.2em] mb-4">Qualificação Profissional</h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">Nome</label>
              <input value={selectedLead.name || ''} onChange={(e) => onUpdateLead('name', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">Cargo</label>
              <input value={selectedLead.cargo || ''} onChange={(e) => onUpdateLead('cargo', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">Empresa</label>
              <input value={selectedLead.empresa || selectedLead.company || ''} onChange={(e) => onUpdateLead('empresa', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">CNPJ</label>
              <input value={selectedLead.cnpj || ''} onChange={(e) => onUpdateLead('cnpj', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">E-mail Corporativo</label>
              <input value={selectedLead.email_corporativo || ''} onChange={(e) => onUpdateLead('email_corporativo', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
          </div>
        </section>

        {/* Seção 2: Interesse Técnico */}
        <section>
          <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase tracking-[0.2em] mb-4">Interesse de Produto</h5>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">Produto Detectado</label>
              <input value={selectedLead.produto || selectedLead.detected_product || ''} onChange={(e) => onUpdateLead('produto', e.target.value)} className="w-full bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/30 rounded px-3 py-2 text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--theme-muted)] uppercase">Quantidade</label>
                <input value={selectedLead.quantidade || ''} onChange={(e) => onUpdateLead('quantidade', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--theme-muted)] uppercase">Cidade/UF</label>
                <input value={selectedLead.cidade_empresa || selectedLead.detected_city || ''} onChange={(e) => onUpdateLead('cidade_empresa', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[var(--theme-muted)] uppercase">Especificação Detalhada</label>
              <textarea rows={3} value={selectedLead.especificacao || ''} onChange={(e) => onUpdateLead('especificacao', e.target.value)} className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded px-2 py-1.5 text-sm text-[var(--theme-fg)] outline-none focus:border-[hsl(var(--tenant-primary))]" />
            </div>
          </div>
        </section>

        {/* Seção 3: Atribuição e SLA */}
        <section>
          <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase tracking-[0.2em] mb-4">Atribuição e SLA</h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--theme-hover)] p-4 rounded-xl border border-[var(--theme-border)] space-y-1">
              <label className="text-[9px] font-black uppercase text-[var(--theme-muted)] tracking-wider">Status</label>
              <div className="text-sm font-bold text-blue-500 dark:text-blue-400">
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

            <div className="bg-[var(--theme-hover)] p-4 rounded-xl border border-[var(--theme-border)] space-y-1">
              <label className="text-[9px] font-black uppercase text-[var(--theme-muted)] tracking-wider">Intervenção (SLA)</label>
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                {selectedLead.support_attempts || 0} tentativas
              </div>
            </div>

            <div className="bg-[var(--theme-hover)] p-4 rounded-xl border border-yellow-600/40 space-y-1 shadow-[0_0_15px_rgba(202,138,4,0.05)]">
              <label className="text-[9px] font-black uppercase text-yellow-600 dark:text-yellow-500 tracking-wider">Vendedor Atribuído</label>
              <div className="text-sm font-bold text-[var(--theme-fg)]">
                {(() => {
                  const s = adminUsers.find(u => u.id === selectedLead.current_owner_id);
                  return s ? s.name : '—';
                })()}
              </div>
            </div>

            <div className="bg-[var(--theme-hover)] p-4 rounded-xl border border-[var(--theme-border)] space-y-1">
              <label className="text-[9px] font-black uppercase text-[var(--theme-muted)] tracking-wider">Notificado Em</label>
              <div className="text-sm font-bold text-[var(--theme-fg)] opacity-85">
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
        <section>
          <h5 className="text-[10px] text-[var(--theme-muted)] font-black uppercase tracking-[0.2em] mb-4">Contexto da Conversa</h5>
          <div className="space-y-3 bg-[var(--theme-hover)] p-4 rounded-lg border border-[var(--theme-border)] max-h-[300px] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-[var(--theme-muted)] text-center py-4 italic">Nenhuma interação registrada.</p>
            ) : history.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender_type === 'lead' ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-xs ${msg.sender_type === 'lead' ? 'bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-fg)] rounded-bl-none' : 'bg-[hsl(var(--tenant-primary)/0.2)] text-[hsl(var(--tenant-primary))] border border-[hsl(var(--tenant-primary)/0.3)] rounded-br-none'}`}>
                  {msg.message_content}
                </div>
                <span className="text-[8px] text-[var(--theme-muted)] mt-1 uppercase">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-6 bg-[var(--theme-hover)] border-t border-[var(--theme-border)] flex gap-4">
        <button 
          onClick={onClose}
          className="flex-1 bg-[var(--theme-fg)] text-[var(--theme-bg)] font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-all uppercase tracking-widest cursor-pointer"
        >
          FECHAR DETALHES
        </button>
        <button 
          onClick={() => onDeleteLead(selectedLead.id)}
          className="px-4 bg-red-900/20 text-red-500 border border-red-500/30 font-bold py-3 rounded-lg text-sm hover:bg-red-900/40 transition-all cursor-pointer"
          title="Excluir Lead"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  );
}
