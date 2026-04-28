"use client";

import { useState } from "react";

export default function SaaSPage() {
  const [salvo, setSalvo] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="p-10 w-full h-full text-white">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold shadow-black drop-shadow-md">Configurações SaaS</h2>
        <p className="text-gray-400 mt-2">Personalize a marca (White-label) e as conexões de API deste cliente.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Bloco Identidade */}
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 shadow-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center border-b border-gray-800 pb-3">
            <span className="bg-[hsl(var(--tenant-primary))] w-2 h-6 mr-3 rounded-sm inline-block"></span>
            Identidade Visual
          </h3>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome da Empresa</label>
              <input type="text" defaultValue="Grupo Permetal" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cor Primária (Hexadecimal)</label>
              <div className="flex gap-2">
                <input type="color" defaultValue="#0ecab2" className="h-10 w-10 rounded cursor-pointer bg-black border-none" />
                <input type="text" defaultValue="#0ecab2" className="flex-1 bg-black border border-gray-700 rounded p-2 text-white outline-none" />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-[hsl(var(--tenant-primary))]" />
                <span className="text-sm text-gray-300">Ativar Textura Metálica no fundo</span>
              </label>
            </div>

            <button type="submit" className="w-full bg-[hsl(var(--tenant-primary))] py-2 rounded font-bold text-black mt-4">
              Aplicar Design
            </button>
            {salvo && <p className="text-green-400 text-sm text-center mt-2">Layout atualizado!</p>}
          </form>
        </div>

        {/* Bloco Integrações */}
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 shadow-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center border-b border-gray-800 pb-3">
            <span className="bg-[hsl(var(--tenant-primary))] w-2 h-6 mr-3 rounded-sm inline-block"></span>
            Chaves de API
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Evolution API (URL da Instância)</label>
              <input type="text" placeholder="https://evolution.sua-vps.com" className="w-full bg-black border border-gray-700 rounded p-2 text-gray-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">OpenAI API Key</label>
              <input type="password" placeholder="sk-proj-..." className="w-full bg-black border border-gray-700 rounded p-2 text-gray-500 outline-none" />
            </div>
            <button className="w-full border border-gray-600 hover:bg-gray-800 py-2 rounded font-bold text-white mt-4 transition-colors">
              Salvar Credenciais
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
