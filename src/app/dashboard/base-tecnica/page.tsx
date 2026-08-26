"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BaseTecnicaPage() {
  const [chunks, setChunks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadChunks();
  }, []);

  async function loadChunks() {
    setLoading(true);
    // Buscamos as variantes técnicas ativas
    const { data } = await supabase
      .from("rag_chunks")
      .select("*, rag_documents(name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      setChunks(data);
    }
    setLoading(false);
  }

  const filtered = chunks.filter(c => 
    c.content.toLowerCase().includes(search.toLowerCase()) || 
    (c.metadata && JSON.stringify(c.metadata).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Base Técnica (Catálogo RAG)</h1>
      <p className="text-gray-600 mb-6">Esta tela materializa a inteligência do banco vetorial. Aqui estão todas as opções estruturadas do catálogo que o Lino usa para a filtragem progressiva (Slot Filling).</p>
      
      <div className="mb-4 flex gap-4">
        <input 
          type="text" 
          placeholder="Buscar por malha, furo, material, categoria..." 
          className="border border-gray-300 rounded px-4 py-2 w-full max-w-md focus:outline-blue-500 text-black"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={loadChunks} className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm text-gray-800 border">
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando variantes da base técnica...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Categoria (Origem)</th>
                <th className="px-4 py-3 font-medium text-gray-700">Metadados (Filtros Rígidos)</th>
                <th className="px-4 py-3 font-medium text-gray-700">Ativo para Filtro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(chunk => (
                <tr key={chunk.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">
                    <span className="font-semibold text-blue-700">{chunk.metadata?.categoria || "N/A"}</span>
                    <div className="text-xs text-gray-500 mt-1">{chunk.rag_documents?.name}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <pre className="bg-gray-100 p-2 rounded text-xs text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {JSON.stringify(chunk.metadata, null, 2)}
                    </pre>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {chunk.ativo_para_filtro ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Sim (Variante)</span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Não (Contexto)</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma variante encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
