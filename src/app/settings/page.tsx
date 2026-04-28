"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [newTeam, setNewTeam] = useState("");
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editTeamName, setEditTeamName] = useState("");

  const [userForm, setUserForm] = useState({ name: "", whatsapp_number: "", team_id: "", role: "seller" });
  const [editingUser, setEditingUser] = useState<any>(null);

  const [ruleForm, setRuleForm] = useState({ team_id: "", region: "", priority: 1, assigned_user_id: "" });

  // Feedback
  const [msg, setMsg] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [t, u, r] = await Promise.all([
      supabase.from("teams").select("*").order("created_at"),
      supabase.from("users").select("*").order("created_at"),
      supabase.from("routing_rules").select("*").order("priority"),
    ]);
    if (t.data) setTeams(t.data);
    if (u.data) setUsers(u.data);
    if (r.data) setRules(r.data);
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  // === EQUIPES ===
  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeam.trim()) return;
    const { error } = await supabase.from("teams").insert([{ name: newTeam }]);
    if (error) { flash("Erro: " + error.message); return; }
    setNewTeam("");
    flash("✔ Equipe criada!");
    loadAll();
  }

  async function saveTeamEdit() {
    if (!editingTeam || !editTeamName.trim()) return;
    await supabase.from("teams").update({ name: editTeamName }).eq("id", editingTeam.id);
    setEditingTeam(null);
    flash("✔ Equipe renomeada!");
    loadAll();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta equipe?")) return;
    await supabase.from("teams").delete().eq("id", id);
    flash("✔ Equipe excluída!");
    loadAll();
  }

  // === VENDEDORES ===
  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name || !userForm.whatsapp_number) return;
    const payload: any = { name: userForm.name, whatsapp_number: userForm.whatsapp_number, role: userForm.role };
    if (userForm.team_id) payload.team_id = userForm.team_id;

    if (editingUser) {
      await supabase.from("users").update(payload).eq("id", editingUser.id);
      setEditingUser(null);
      flash("✔ Vendedor atualizado!");
    } else {
      const { error } = await supabase.from("users").insert([payload]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Vendedor cadastrado!");
    }
    setUserForm({ name: "", whatsapp_number: "", team_id: "", role: "seller" });
    loadAll();
  }

  function startEditUser(u: any) {
    setEditingUser(u);
    setUserForm({ name: u.name, whatsapp_number: u.whatsapp_number, team_id: u.team_id || "", role: u.role });
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir este vendedor?")) return;
    await supabase.from("users").delete().eq("id", id);
    flash("✔ Vendedor excluído!");
    loadAll();
  }

  // === REGRAS ===
  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.team_id) return;
    const payload: any = { team_id: ruleForm.team_id, region: ruleForm.region, priority: ruleForm.priority };
    if (ruleForm.assigned_user_id) payload.assigned_user_id = ruleForm.assigned_user_id;
    const { error } = await supabase.from("routing_rules").insert([payload]);
    if (error) { flash("Erro: " + error.message); return; }
    setRuleForm({ team_id: "", region: "", priority: 1, assigned_user_id: "" });
    flash("✔ Regra criada!");
    loadAll();
  }

  async function deleteRule(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await supabase.from("routing_rules").delete().eq("id", id);
    flash("✔ Regra excluída!");
    loadAll();
  }

  function getTeamName(id: string) { return teams.find((t) => t.id === id)?.name || "—"; }
  function getUserName(id: string) { return users.find((u) => u.id === id)?.name || "—"; }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Regras Comerciais</h2>
        <p className="text-gray-400 mt-2">Gerencie equipes, vendedores e regras de roteamento da IA.</p>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm">{msg}</div>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* EQUIPES */}
          <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-800">
            <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-blue-500 w-2 h-5 mr-2 rounded-sm"></span>Equipes</h3>
            <form onSubmit={addTeam} className="flex gap-2 mb-4">
              <input type="text" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Nome da equipe" className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-blue-500" />
              <button type="submit" className="bg-blue-600 px-3 py-2 rounded text-sm font-bold hover:bg-blue-700">+</button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {teams.map((t) => (
                <div key={t.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center group">
                  {editingTeam?.id === t.id ? (
                    <div className="flex gap-2 flex-1">
                      <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} className="flex-1 bg-gray-900 border border-gray-600 rounded p-1 text-sm text-white outline-none" autoFocus />
                      <button onClick={saveTeamEdit} className="text-xs bg-green-800 px-2 rounded text-green-300">Salvar</button>
                      <button onClick={() => setEditingTeam(null)} className="text-xs bg-gray-800 px-2 rounded">X</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-sm">{t.name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTeam(t); setEditTeamName(t.name); }} className="text-[10px] bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                        <button onClick={() => deleteTeam(t.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">X</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {teams.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Nenhuma equipe</p>}
            </div>
          </div>

          {/* VENDEDORES */}
          <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-800">
            <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-green-500 w-2 h-5 mr-2 rounded-sm"></span>Vendedores</h3>
            <form onSubmit={addUser} className="space-y-2 mb-4">
              <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nome do vendedor" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
              <input type="text" value={userForm.whatsapp_number} onChange={(e) => setUserForm({ ...userForm, whatsapp_number: e.target.value })} placeholder="WhatsApp (5511...)" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
              <select value={userForm.team_id} onChange={(e) => setUserForm({ ...userForm, team_id: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                <option value="">Sem equipe</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                <option value="seller">Vendedor</option>
                <option value="manager">Gestor</option>
              </select>
              <button type="submit" className="w-full bg-green-700 py-2 rounded text-sm font-bold hover:bg-green-800">{editingUser ? "Atualizar Vendedor" : "Cadastrar Vendedor"}</button>
              {editingUser && <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: "", whatsapp_number: "", team_id: "", role: "seller" }); }} className="w-full border border-gray-700 py-2 rounded text-sm hover:bg-gray-800">Cancelar edição</button>}
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center group">
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-[10px] text-gray-500">{u.whatsapp_number} • {getTeamName(u.team_id)} • {u.role}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditUser(u)} className="text-[10px] bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    <button onClick={() => deleteUser(u.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">X</button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Nenhum vendedor</p>}
            </div>
          </div>

          {/* REGRAS DE ROTEAMENTO */}
          <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-800">
            <h3 className="text-lg font-bold mb-4 flex items-center"><span className="bg-purple-500 w-2 h-5 mr-2 rounded-sm"></span>Regras de Roteamento</h3>
            <form onSubmit={addRule} className="space-y-2 mb-4">
              <select value={ruleForm.team_id} onChange={(e) => setRuleForm({ ...ruleForm, team_id: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required>
                <option value="">Selecionar equipe *</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="text" value={ruleForm.region} onChange={(e) => setRuleForm({ ...ruleForm, region: e.target.value })} placeholder="Região (ex: Sul, Sudeste)" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
              <input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 1 })} placeholder="Prioridade (1=alta)" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" min={1} />
              <select value={ruleForm.assigned_user_id} onChange={(e) => setRuleForm({ ...ruleForm, assigned_user_id: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                <option value="">Vendedor responsável (opcional)</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button type="submit" className="w-full bg-purple-700 py-2 rounded text-sm font-bold hover:bg-purple-800">Criar Regra</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {rules.map((r) => (
                <div key={r.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center group">
                  <div>
                    <p className="font-medium text-sm">{getTeamName(r.team_id)}</p>
                    <p className="text-[10px] text-gray-500">Região: {r.region || "Todas"} • Prioridade: {r.priority} • Vendedor: {getUserName(r.assigned_user_id)}</p>
                  </div>
                  <button onClick={() => deleteRule(r.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900 opacity-0 group-hover:opacity-100 transition-opacity">X</button>
                </div>
              ))}
              {rules.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Nenhuma regra</p>}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
