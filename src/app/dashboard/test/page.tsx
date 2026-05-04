"use client";

import { useState } from "react";

export default function TestPage() {
  const [number, setNumber] = useState("5516991415319");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleClearHistory = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/test/clear-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: number }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ Histórico limpo com sucesso!");
      } else {
        setMessage("❌ Erro: " + (data.error || "Desconhecido"));
      }
    } catch (err) {
      setMessage("❌ Erro ao conectar com a API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 text-white">
      <h2 className="text-2xl font-bold mb-6">Ferramentas de Teste</h2>
      
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-semibold mb-4">Resetar Conversa (SDR)</h3>
        <p className="text-sm text-gray-400 mb-4">
          Use esta ferramenta para apagar todas as mensagens de um número e voltar o lead para o status de qualificação inicial.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase mb-1">Número do WhatsApp (com DDI/DDD)</label>
            <input 
              type="text" 
              value={number} 
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: 5516991415319"
              className="w-full bg-[#0a0a0a] border border-gray-800 rounded p-2 text-white outline-none focus:border-[hsl(var(--tenant-primary))]"
            />
          </div>
          
          <button 
            onClick={handleClearHistory}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded transition-colors"
          >
            {loading ? "Limpando..." : "Limpar Histórico e Resetar"}
          </button>
          
          {message && (
            <p className={`text-sm mt-2 ${message.includes("✅") ? "text-green-400" : "text-red-400"}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
