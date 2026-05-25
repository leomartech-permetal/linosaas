"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CAMPOS_DISPONIVEIS = [
  { value: "nome_cliente", label: "Nome do Cliente" },
  { value: "empresa", label: "Nome da Empresa" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail Corporativo" },
  { value: "quantidade", label: "Quantidade / Metragem" },
  { value: "espessura", label: "Espessura da Chapa" },
  { value: "ec", label: "Espaçamento entre Centros (EC)" },
  { value: "dimensoes", label: "Dimensões da Chapa" },
  { value: "material", label: "Material (Aço Carbono, Inox, etc.)" },
  { value: "acabamento", label: "Acabamento / Pintura" },
];

export default function RegrasPage() {
  const [activeTab, setActiveTab] = useState<"express" | "qualificacao">("express");
  const [rules, setRules] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [rulesRes, productsRes] = await Promise.all([
        supabase.from("business_rules").select("*").order("rule_key"),
        supabase.from("products").select("*, brands(name)").order("name"),
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (productsRes.data) {
        // Inicializa o qualification_schema padrão se estiver nulo
        const processedProducts = productsRes.data.map((p: any) => {
          if (!p.qualification_schema) {
            p.qualification_schema = {
              obrigatorias: ["nome_cliente", "empresa", "email", "quantidade"],
              opcionais: [],
              rag_document_name: ""
            };
          }
          return p;
        });
        setProducts(processedProducts);
      }

      // Carregar RAG docs via API
      const res = await fetch("/api/rag");
      if (res.ok) {
        const data = await res.json();
        setRagDocs(data);
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  // Salvar Regras Express
  async function updateRuleConfig(id: string, newConfig: any) {
    const { error } = await supabase
      .from("business_rules")
      .update({ config: newConfig, updated_at: new Date().toISOString() })
      .eq("id", id);
      
    if (error) {
      flash("❌ Erro ao salvar: " + error.message);
    } else {
      flash("✅ Regra Express atualizada!");
      loadAllData();
    }
  }

  // Salvar Schema de Qualificação do Produto
  async function updateProductSchema(productId: string, schema: any) {
    const { error } = await supabase
      .from("products")
      .update({ qualification_schema: schema })
      .eq("id", productId);

    if (error) {
      flash("❌ Erro ao salvar: " + error.message);
    } else {
      flash("✅ Schema de qualificação salvo!");
      loadAllData();
    }
  }

  const handleConfigChange = (id: string, field: string, value: any, currentConfig: any) => {
    const updatedConfig = { ...currentConfig, [field]: value };
    if (field === 'exclusions' && typeof value === 'string') {
      updatedConfig[field] = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (['max_m2', 'max_pcs_2x1', 'max_pcs_3x1', 'max_m_lineares'].includes(field)) {
      updatedConfig[field] = Number(value);
    }
    setRules(rules.map(r => r.id === id ? { ...r, config: updatedConfig } : r));
  };

  // Funções do Schema
  const toggleObrigatoria = (prodId: string, campo: string, schema: any) => {
    let obrigatorias = [...schema.obrigatorias];
    if (obrigatorias.includes(campo)) {
      obrigatorias = obrigatorias.filter(c => c !== campo);
    } else {
      obrigatorias.push(campo);
      // Remove do opcional se estivesse lá
      schema.opcionais = (schema.opcionais || []).filter((opt: any) => opt.campo !== campo);
    }
    const newSchema = { ...schema, obrigatorias };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
  };

  const handleOpcionalChange = (prodId: string, idx: number, field: string, value: any, schema: any) => {
    const opcionais = [...(schema.opcionais || [])];
    opcionais[idx] = { ...opcionais[idx], [field]: value };
    if (field === 'max_tentativas') {
      opcionais[idx][field] = Number(value);
    }
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
  };

  const addOpcional = (prodId: string, schema: any) => {
    const opcionais = [...(schema.opcionais || [])];
    // Acha um campo que ainda não é obrigatório nem opcional
    const jaUsados = new Set([...schema.obrigatorias, ...opcionais.map(o => o.campo)]);
    const disponivel = CAMPOS_DISPONIVEIS.find(c => !jaUsados.has(c.value));
    if (!disponivel) return;

    opcionais.push({ campo: disponivel.value, max_tentativas: 2 });
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
  };

  const removeOpcional = (prodId: string, idx: number, schema: any) => {
    const opcionais = (schema.opcionais || []).filter((_: any, i: number) => i !== idx);
    const newSchema = { ...schema, opcionais };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
  };

  const handleRagChange = (prodId: string, value: string, schema: any) => {
    const newSchema = { ...schema, rag_document_name: value };
    setProducts(products.map(p => p.id === prodId ? { ...p, qualification_schema: newSchema } : p));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.brands?.name || "").toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 w-full h-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Regras de Negócio & Qualificação</h2>
          <p className="text-[var(--text-secondary)] mt-1">Configure regras de roteamento e defina variáveis obrigatórias e opcionais para cada produto.</p>
        </div>
      </header>

      {msg && (
        <div className="mb-6 p-4 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 shadow-sm animate-fade-in">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container-clean mb-6">
        <button
          onClick={() => setActiveTab("express")}
          className={`tab-item-clean ${activeTab === "express" ? "active" : ""}`}
        >
          Regras Express (Limites)
        </button>
        <button
          onClick={() => setActiveTab("qualificacao")}
          className={`tab-item-clean ${activeTab === "qualificacao" ? "active" : ""}`}
        >
          Qualificação por Produto (Schemas)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* TAB EXPRESS */}
          {activeTab === "express" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {rules.map((rule) => (
                <div key={rule.id} className="card-base">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] uppercase tracking-tight">{rule.rule_key.replace('_', ' ')}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{rule.description}</p>
                    </div>
                    <button 
                      onClick={() => updateRuleConfig(rule.id, rule.config)}
                      className="btn-primary py-2 text-xs"
                    >
                      Salvar
                    </button>
                  </div>

                  <div className="space-y-4">
                    {rule.rule_key === 'express_permetal' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Máximo m²</label>
                          <input 
                            type="number" 
                            value={rule.config.max_m2} 
                            onChange={(e) => handleConfigChange(rule.id, 'max_m2', e.target.value, rule.config)}
                            className="input-search-clean"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Peças 2x1m</label>
                          <input 
                            type="number" 
                            value={rule.config.max_pcs_2x1} 
                            onChange={(e) => handleConfigChange(rule.id, 'max_pcs_2x1', e.target.value, rule.config)}
                            className="input-search-clean"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Peças 3x1m</label>
                          <input 
                            type="number" 
                            value={rule.config.max_pcs_3x1} 
                            onChange={(e) => handleConfigChange(rule.id, 'max_pcs_3x1', e.target.value, rule.config)}
                            className="input-search-clean"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Máximo Metros Lineares</label>
                        <input 
                          type="number" 
                          value={rule.config.max_m_lineares} 
                          onChange={(e) => handleConfigChange(rule.id, 'max_m_lineares', e.target.value, rule.config)}
                          className="input-search-clean"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Exclusões (separadas por vírgula)</label>
                      <textarea 
                        value={rule.config.exclusions?.join(', ')} 
                        onChange={(e) => handleConfigChange(rule.id, 'exclusions', e.target.value, rule.config)}
                        placeholder="Ex: belinox, antiofuscante, degraus"
                        className="input-search-clean h-20 py-2"
                      ></textarea>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB QUALIFICACAO */}
          {activeTab === "qualificacao" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Esquemas de Qualificação de Leads ({products.length} produtos)</h3>
                <input 
                  type="text" 
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Pesquisar produto..."
                  className="input-search-clean w-64"
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                {filteredProducts.map((p) => {
                  const schema = p.qualification_schema;
                  return (
                    <div key={p.id} className="card-base">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-subtle)] pb-4 mb-4">
                        <div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)]">{p.name}</h4>
                          <p className="text-xs text-[var(--text-secondary)]">Marca: {p.brands?.name || 'N/A'} • Sinônimos: {(p.synonyms || []).join(', ')}</p>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="w-full md:w-64">
                            <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">Base RAG Vinculada (Catálogo)</label>
                            <select 
                              value={schema.rag_document_name || ""} 
                              onChange={(e) => handleRagChange(p.id, e.target.value, schema)}
                              className="input-search-clean py-1.5 text-xs bg-white"
                            >
                              <option value="">Nenhum Catálogo Técnico</option>
                              {ragDocs.map(doc => (
                                <option key={doc.id} value={doc.name}>{doc.name}</option>
                              ))}
                            </select>
                          </div>
                          <button 
                            onClick={() => updateProductSchema(p.id, schema)}
                            className="btn-primary py-2 text-xs"
                          >
                            Salvar Schema
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Obrigatórias */}
                        <div>
                          <h5 className="text-[11px] font-bold text-[var(--text-primary)] uppercase mb-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-error)]"></span>
                            Campos Obrigatórios
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[var(--bg-app)] p-3 rounded-md border border-[var(--border-subtle)]">
                            {CAMPOS_DISPONIVEIS.map(campo => {
                              const isChecked = schema.obrigatorias.includes(campo.value);
                              return (
                                <label key={campo.value} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-[var(--bg-surface)]">
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleObrigatoria(p.id, campo.value, schema)}
                                    className="accent-[var(--brand-accent)] w-3.5 h-3.5"
                                  />
                                  <span className={isChecked ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>
                                    {campo.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Opcionais com limite */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="text-[11px] font-bold text-[var(--text-primary)] uppercase flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]"></span>
                              Campos Opcionais (Com Limite de Perguntas)
                            </h5>
                            <button 
                              onClick={() => addOpcional(p.id, schema)}
                              className="btn-secondary py-1 px-2.5 text-[10px] h-auto"
                            >
                              + Adicionar Campo
                            </button>
                          </div>
                          
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 bg-[var(--bg-app)] p-3 rounded-md border border-[var(--border-subtle)]">
                            {(schema.opcionais || []).map((opt: any, idx: number) => {
                              const jaUsados = new Set(schema.obrigatorias);
                              return (
                                <div key={idx} className="flex gap-3 items-center bg-[var(--bg-surface)] p-2.5 rounded border border-[var(--border-subtle)]">
                                  <select
                                    value={opt.campo}
                                    onChange={(e) => handleOpcionalChange(p.id, idx, 'campo', e.target.value, schema)}
                                    className="input-search-clean py-1 text-xs bg-white flex-1"
                                  >
                                    {CAMPOS_DISPONIVEIS.filter(c => !jaUsados.has(c.value) || c.value === opt.campo).map(c => (
                                      <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1.5 w-32">
                                    <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">Tentativas:</span>
                                    <input 
                                      type="number"
                                      value={opt.max_tentativas}
                                      onChange={(e) => handleOpcionalChange(p.id, idx, 'max_tentativas', e.target.value, schema)}
                                      className="input-search-clean py-1 text-xs text-center w-12"
                                      min="1"
                                      max="5"
                                    />
                                  </div>
                                  <button 
                                    onClick={() => removeOpcional(p.id, idx, schema)}
                                    className="text-red-500 hover:text-red-700 text-xs px-2.5 font-bold"
                                    title="Remover Campo"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                            {(schema.opcionais || []).length === 0 && (
                              <p className="text-[var(--text-secondary)] text-[11px] italic text-center py-4">Nenhum campo opcional configurado.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
