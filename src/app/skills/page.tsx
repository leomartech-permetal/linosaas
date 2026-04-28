"use client";

import { useState } from "react";

export default function SkillsPage() {
  const [prompt, setPrompt] = useState("Você é Lino, um vendedor técnico especialista em chapas perfuradas e painéis arquitetônicos. Responda de forma direta e pergunte se precisa de instalação.");
  const [salvo, setSalvo] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="p-10 w-full h-full text-white">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold shadow-black drop-shadow-md">Skills da Inteligência Artificial</h2>
        <p className="text-gray-400 mt-2">Treine o cérebro do Lino. Defina o tom de voz e o comportamento de vendas.</p>
      </header>

      <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 shadow-xl max-w-3xl">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <span className="bg-[hsl(var(--tenant-primary))] w-2 h-6 mr-3 rounded-sm inline-block"></span>
          Prompt Mestre (Comportamento Geral)
        </h3>
        
        <form onSubmit={handleSave}>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className="w-full bg-black border border-gray-700 rounded p-4 text-white text-sm focus:border-[hsl(var(--tenant-primary))] outline-none mb-4"
            placeholder="Digite as instruções para a IA..."
          />
          <div className="flex items-center gap-4">
            <button type="submit" className="bg-[hsl(var(--tenant-primary))] px-6 py-3 rounded font-bold hover:opacity-90 transition-opacity text-black shadow-[0_0_15px_hsl(var(--tenant-primary)/0.3)]">
              Salvar Comportamento
            </button>
            {salvo && <span className="text-green-400 font-bold">✔️ Salvo com sucesso!</span>}
          </div>
        </form>

        <div className="mt-10 border-t border-gray-800 pt-6">
          <h4 className="text-lg font-bold text-gray-300 mb-2">Habilidades Específicas (Skills)</h4>
          <p className="text-sm text-gray-500 mb-4">Módulos de conhecimento técnico separados por produto (Ex: Piso Gradeado, Fachada Brise).</p>
          
          <div className="bg-black p-4 rounded border border-gray-800 text-gray-400 text-sm flex justify-center items-center h-24 border-dashed">
            + Adicionar nova Skill de Produto
          </div>
        </div>
      </div>
    </div>
  );
}
