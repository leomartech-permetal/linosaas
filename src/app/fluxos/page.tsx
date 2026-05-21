"use client";

import { useState } from 'react';
import FlowVisualizer from '../components/FlowVisualizer';

export default function FluxosPage() {
  const [searchInput, setSearchInput] = useState('');
  const [leadId, setLeadId] = useState('');

  const handleSearch = () => {
    setLeadId(searchInput);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Editor de Fluxos Lino</h1>
          <p className="text-slate-400">
            Visualize a arquitetura de roteamento e decisão da IA.
          </p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nome, Telefone ou ID do Lead" 
            className="w-72 bg-slate-800 text-white border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            onClick={handleSearch}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md transition text-sm">
            Rastrear Fluxo
          </button>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition text-sm font-medium">
            Publicar Regras
          </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-[600px] relative">
        <FlowVisualizer leadId={leadId} />
      </div>
    </div>
  );
}
