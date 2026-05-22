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
    <div className="p-6 h-full flex flex-col bg-[#FAFAFA]">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#171717] mb-1">Editor de Fluxos Lino</h1>
          <p className="text-[#666666] text-sm">
            Visualize a arquitetura de roteamento e decisão da IA.
          </p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nome, Telefone ou ID do Lead" 
            className="w-72 bg-[#FFFFFF] text-[#171717] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#A1A1AA] transition-all"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            onClick={handleSearch}
            className="bg-[#FFFFFF] border border-[#D4D4D8] text-[#171717] px-4 py-2 rounded-md hover:bg-[#F1F5F9] transition-all text-sm font-medium">
            Rastrear Fluxo
          </button>
          <button className="bg-[#000000] text-white px-4 py-2 rounded-md hover:bg-[#333333] transition-all text-sm font-medium">
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
