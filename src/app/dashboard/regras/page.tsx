"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegrasPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    setLoading(true);
    const { data } = await supabase.from("business_rules").select("*").order("rule_key");
    if (data) setRules(data);
    setLoading(false);
  }

  async function updateRuleConfig(id: string, newConfig: any) {
    const { error } = await supabase
      .from("business_rules")
      .update({ config: newConfig, updated_at: new Date().toISOString() })
      .eq("id", id);
      
    if (error) {
      setMsg("❌ Erro ao salvar: " + error.message);
    } else {
      setMsg("✅ Regra atualizada com sucesso!");
      setTimeout(() => setMsg(""), 3000);
      loadRules();
    }
  }

  const handleConfigChange = (id: string, field: string, value: any, currentConfig: any) => {
    const updatedConfig = { ...currentConfig, [field]: value };
    // Se for array (ex: exclusions), tratamos o split
    if (field === 'exclusions' && typeof value === 'string') {
      updatedConfig[field] = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    // Números
    if (['max_m2', 'max_pcs_2x1', 'max_pcs_3x1', 'max_m_lineares'].includes(field)) {
      updatedConfig[field] = Number(value);
    }
    
    // Atualiza localmente antes de salvar
    setRules(rules.map(r => r.id === id ? { ...r, config: updatedConfig } : r));
  };

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[var(--theme-bg)] text-[var(--theme-fg)] overflow-y-auto scrollbar-hide">
      <header className="mb-10">
        <h2 className="text-4xl font-black tracking-tighter text-[var(--theme-fg)]">Regras de Negócio</h2>
        <p className="text-gray-500 mt-1 font-medium italic">Configure os limites e exceções da Permetal Express e Metalgrade Express</p>
      </header>

      {msg && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--theme-card)] border border-[var(--theme-border)] text-xs font-bold flex items-center gap-2">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-[hsl(var(--tenant-primary))] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-[var(--theme-fg)] uppercase tracking-tighter">{rule.rule_key.replace('_', ' ')}</h3>
                  <p className="text-xs text-gray-500">{rule.description}</p>
                </div>
                <button 
                  onClick={() => updateRuleConfig(rule.id, rule.config)}
                  className="bg-[hsl(var(--tenant-primary))] text-black text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:scale-105 transition-transform"
                >
                  Salvar Alterações
                </button>
              </div>

              <div className="space-y-6">
                {rule.rule_key === 'express_permetal' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-600 uppercase mb-2">Máximo m²</label>
                        <input 
                          type="number" 
                          value={rule.config.max_m2} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_m2', e.target.value, rule.config)}
                          className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-fg)] rounded-xl p-3 text-sm focus:border-[hsl(var(--tenant-primary))] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-600 uppercase mb-2">Peças 2x1m</label>
                        <input 
                          type="number" 
                          value={rule.config.max_pcs_2x1} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_pcs_2x1', e.target.value, rule.config)}
                          className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-fg)] rounded-xl p-3 text-sm focus:border-[hsl(var(--tenant-primary))] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-600 uppercase mb-2">Peças 3x1m</label>
                        <input 
                          type="number" 
                          value={rule.config.max_pcs_3x1} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_pcs_3x1', e.target.value, rule.config)}
                          className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-fg)] rounded-xl p-3 text-sm focus:border-[hsl(var(--tenant-primary))] outline-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase mb-2">Máximo Metros Lineares</label>
                    <input 
                      type="number" 
                      value={rule.config.max_m_lineares} 
                      onChange={(e) => handleConfigChange(rule.id, 'max_m_lineares', e.target.value, rule.config)}
                      className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-fg)] rounded-xl p-3 text-sm focus:border-[hsl(var(--tenant-primary))] outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-2">Exclusões (separadas por vírgula)</label>
                  <textarea 
                    value={rule.config.exclusions?.join(', ')} 
                    onChange={(e) => handleConfigChange(rule.id, 'exclusions', e.target.value, rule.config)}
                    placeholder="Ex: belinox, antiofuscante, degraus"
                    className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] text-[var(--theme-fg)] rounded-xl p-3 text-sm focus:border-[hsl(var(--tenant-primary))] outline-none h-24"
                  ></textarea>
                  <p className="text-[9px] text-gray-600 mt-2 font-bold uppercase tracking-widest italic">
                    * Produtos que contenham estes termos no nome não serão elegíveis para Express.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
