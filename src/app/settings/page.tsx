"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    carregarEquipes();
  }, []);

  async function carregarEquipes() {
    setLoading(true);
    const { data, error } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    if (data) setTeams(data);
    setLoading(false);
  }

  async function handleAdicionarEquipe(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName) return;
    
    // Inserir nova equipe no banco
    const tenantId = "b9fc0e73-048a-4db5-9e4f-2d7c92b23a23"; // TODO: get from auth/context
    
    // Inserindo sem tenant_id por enquanto se o bd permitir, ou precisamos ter um default
    await supabase.from('teams').insert([{ name: newTeamName }]);
    setNewTeamName("");
    carregarEquipes();
  }

  return (
    <div className="p-10 w-full h-full text-white">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold shadow-black drop-shadow-md">Regras Comerciais</h2>
        <p className="text-gray-400 mt-2">Configure equipes e rotas de distribuição de leads da IA.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Bloco 1: Gestão de Equipes */}
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800 shadow-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center border-b border-gray-800 pb-3">
            <span className="bg-[hsl(var(--tenant-primary))] w-2 h-6 mr-3 rounded-sm inline-block"></span>
            Equipes Cadastradas (Banco Real)
          </h3>
          
          <form onSubmit={handleAdicionarEquipe} className="flex gap-2 mb-6">
            <input 
              type="text" 
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Nome da nova equipe..." 
              className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-[hsl(var(--tenant-primary))] outline-none"
            />
            <button type="submit" className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold hover:opacity-90 transition-opacity text-black">
              Adicionar
            </button>
          </form>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {loading ? <p className="text-gray-500">Buscando do banco...</p> : 
             teams.length === 0 ? <p className="text-gray-500 text-sm">Nenhuma equipe cadastrada. Tente adicionar uma acima.</p> :
             teams.map(team => (
              <div key={team.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center group hover:border-gray-600 transition-colors">
                <div>
                  <h4 className="font-bold">{team.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">Sincronizado via Supabase</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-xs bg-gray-800 px-3 py-1 rounded text-gray-300 hover:text-white mr-2">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
