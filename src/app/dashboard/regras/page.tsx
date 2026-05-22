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
    <div className="p-6 md:p-10 w-full h-full bg-[#FAFAFA] text-[#171717] overflow-y-auto scrollbar-hide">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-[#171717]">Regras de Negócio</h2>
        <p className="text-[#666666] mt-1">Configure os limites e exceções da Permetal Express e Metalgrade Express</p>
      </header>

      {msg && (
        <div className="mb-6 p-4 rounded-md bg-[#FFFFFF] border border-[#EAEAEA] text-xs font-semibold text-[#171717] flex items-center gap-2 shadow-sm">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#0070F3] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#171717] uppercase tracking-tight">{rule.rule_key.replace('_', ' ')}</h3>
                  <p className="text-xs text-[#666666] mt-1">{rule.description}</p>
                </div>
                <button 
                  onClick={() => updateRuleConfig(rule.id, rule.config)}
                  className="bg-[#000000] text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-[#333333] transition-colors"
                >
                  Salvar
                </button>
              </div>

              <div className="space-y-4">
                {rule.rule_key === 'express_permetal' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[#666666] uppercase">Máximo m²</label>
                        <input 
                          type="number" 
                          value={rule.config.max_m2} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_m2', e.target.value, rule.config)}
                          className="w-full bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] rounded-md px-3 py-2 text-sm focus:border-[#A1A1AA] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[#666666] uppercase">Peças 2x1m</label>
                        <input 
                          type="number" 
                          value={rule.config.max_pcs_2x1} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_pcs_2x1', e.target.value, rule.config)}
                          className="w-full bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] rounded-md px-3 py-2 text-sm focus:border-[#A1A1AA] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[#666666] uppercase">Peças 3x1m</label>
                        <input 
                          type="number" 
                          value={rule.config.max_pcs_3x1} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_pcs_3x1', e.target.value, rule.config)}
                          className="w-full bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] rounded-md px-3 py-2 text-sm focus:border-[#A1A1AA] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#666666] uppercase">Máximo Metros Lineares</label>
                    <input 
                      type="number" 
                      value={rule.config.max_m_lineares} 
                      onChange={(e) => handleConfigChange(rule.id, 'max_m_lineares', e.target.value, rule.config)}
                      className="w-full bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] rounded-md px-3 py-2 text-sm focus:border-[#A1A1AA] outline-none transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase">Exclusões (separadas por vírgula)</label>
                  <textarea 
                    value={rule.config.exclusions?.join(', ')} 
                    onChange={(e) => handleConfigChange(rule.id, 'exclusions', e.target.value, rule.config)}
                    placeholder="Ex: belinox, antiofuscante, degraus"
                    className="w-full bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] rounded-md px-3 py-2 text-sm focus:border-[#A1A1AA] outline-none h-20 transition-all"
                  ></textarea>
                  <p className="text-[10px] text-[#888888] mt-1 font-medium">
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
