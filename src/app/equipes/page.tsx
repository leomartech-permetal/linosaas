"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EquipesPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    supervisor_name: "",
    supervisor_phone: "",
    supervisor_email: "",
  });

  // Vincular vendedor à equipe
  const [assigningTeam, setAssigningTeam] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  // Follow-ups recentes
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [showMonitor, setShowMonitor] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [teamsRes, usersRes, fuRes] = await Promise.all([
      supabase.from("teams").select("*").order("created_at"),
      supabase.from("admin_users").select("*").order("name"),
      supabase.from("lead_follow_ups").select("*, leads(name, whatsapp_number)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (fuRes.data) setFollowUps(fuRes.data);
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 4000); }

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;

    if (editing) {
      const { error } = await supabase.from("teams").update({
        name: form.name,
        supervisor_name: form.supervisor_name,
        supervisor_phone: form.supervisor_phone,
        supervisor_email: form.supervisor_email,
      }).eq("id", editing.id);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Equipe atualizada!");
      setEditing(null);
    } else {
      const { error } = await supabase.from("teams").insert([{
        name: form.name,
        supervisor_name: form.supervisor_name,
        supervisor_phone: form.supervisor_phone,
        supervisor_email: form.supervisor_email,
      }]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Equipe criada!");
    }
    setForm({ name: "", supervisor_name: "", supervisor_phone: "", supervisor_email: "" });
    setShowForm(false);
    loadAll();
  }

  function startEdit(team: any) {
    setEditing(team);
    setForm({
      name: team.name,
      supervisor_name: team.supervisor_name || "",
      supervisor_phone: team.supervisor_phone || "",
      supervisor_email: team.supervisor_email || "",
    });
    setShowForm(true);
  }

  async function deleteTeam(id: string) {
    if (!confirm("Excluir esta equipe? Os vendedores serão desvinculados.")) return;
    await supabase.from("admin_users").update({ team_id: null }).eq("team_id", id);
    await supabase.from("teams").delete().eq("id", id);
    flash("✔ Equipe excluída!");
    loadAll();
  }

  async function assignUserToTeam(userId: string, teamId: string) {
    await supabase.from("admin_users").update({ team_id: teamId }).eq("id", userId);
    flash("✔ Vendedor vinculado à equipe!");
    setAssigningTeam(null);
    setSelectedUser("");
    loadAll();
  }

  async function removeUserFromTeam(userId: string) {
    await supabase.from("admin_users").update({ team_id: null }).eq("id", userId);
    flash("Vendedor desvinculado da equipe.");
    loadAll();
  }

  function getTeamMembers(teamId: string) {
    return users.filter(u => u.team_id === teamId);
  }

  function getSellerName(id: string) {
    return users.find(u => u.id === id)?.name || "—";
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      PENDING: { label: "Pendente", color: "#f59e0b" },
      NOTIFIED: { label: "Notificado", color: "#3b82f6" },
      RESOLVED: { label: "Resolvido", color: "#10b981" },
      ESCALATED: { label: "Escalado", color: "#ef4444" },
      CLIENT_RETURNED: { label: "Cliente Retornou", color: "#8b5cf6" },
    };
    const s = map[status] || { label: status, color: "#6b7280" };
    return <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: s.color + "22", color: s.color }}>{s.label}</span>;
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Equipes & Supervisores</h2>
        <p className="text-gray-400 mt-2">Gerencie equipes, vincule vendedores e configure o supervisor de cada equipe.</p>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm font-bold">{msg}</div>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="space-y-8">

          {/* EQUIPES */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center"><span className="bg-[hsl(var(--tenant-primary))] w-2 h-5 mr-2 rounded-sm"></span>Equipes ({teams.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Cada equipe tem um supervisor que é notificado quando leads não são atendidos a tempo.</p>
              </div>
              <button onClick={() => { setEditing(null); setForm({ name: "", supervisor_name: "", supervisor_phone: "", supervisor_email: "" }); setShowForm(true); }} className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold text-black hover:opacity-90">+ Nova Equipe</button>
            </div>

            {/* Form */}
            {showForm && (
              <div className="bg-black p-5 rounded-lg border border-gray-700 mb-4">
                <h4 className="font-bold text-sm mb-3">{editing ? "Editar Equipe" : "Nova Equipe"}</h4>
                <form onSubmit={saveTeam} className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Nome da Equipe *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Construção, PSA Permetal, Express" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Nome do Supervisor</label>
                      <input type="text" value={form.supervisor_name} onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })} placeholder="João Silva" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">WhatsApp do Supervisor *</label>
                      <input type="text" value={form.supervisor_phone} onChange={(e) => setForm({ ...form, supervisor_phone: e.target.value })} placeholder="5511999999999" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">E-mail do Supervisor</label>
                      <input type="email" value={form.supervisor_email} onChange={(e) => setForm({ ...form, supervisor_email: e.target.value })} placeholder="supervisor@empresa.com" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">{editing ? "Atualizar" : "Criar Equipe"}</button>
                    <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 border border-gray-700 py-2 rounded hover:bg-gray-800">Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de equipes */}
            <div className="space-y-3">
              {teams.map(team => {
                const members = getTeamMembers(team.id);
                return (
                  <div key={team.id} className="bg-black p-4 rounded-lg border border-gray-800">
                    {/* Header da equipe */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          🏢 {team.name}
                          <span className="text-[10px] text-gray-500">({members.length} {members.length === 1 ? 'membro' : 'membros'})</span>
                        </h4>
                        {team.supervisor_name && (
                          <p className="text-[10px] text-yellow-400 mt-1">
                            👤 Supervisor: {team.supervisor_name} • 📱 {team.supervisor_phone || "—"} • ✉️ {team.supervisor_email || "—"}
                          </p>
                        )}
                        {!team.supervisor_name && (
                          <p className="text-[10px] text-red-400 mt-1">⚠️ Sem supervisor configurado</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setAssigningTeam(assigningTeam === team.id ? null : team.id)} className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-1 rounded hover:bg-blue-900">+ Membro</button>
                        <button onClick={() => startEdit(team)} className="text-[10px] bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                        <button onClick={() => deleteTeam(team.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">Excluir</button>
                      </div>
                    </div>

                    {/* Vincular vendedor */}
                    {assigningTeam === team.id && (
                      <div className="mt-3 flex gap-2 items-center bg-gray-900 p-2 rounded">
                        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-1.5 text-white text-xs outline-none">
                          <option value="">Selecione um vendedor...</option>
                          {users.filter(u => !u.team_id || u.team_id !== team.id).map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                          ))}
                        </select>
                        <button onClick={() => selectedUser && assignUserToTeam(selectedUser, team.id)} className="bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-blue-800" disabled={!selectedUser}>Vincular</button>
                      </div>
                    )}

                    {/* Membros da equipe */}
                    {members.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {members.map(m => (
                          <div key={m.id} className="flex justify-between items-center bg-gray-900/50 px-3 py-1.5 rounded text-xs">
                            <span>
                              {m.role === 'vendedor' ? '🛒' : m.role === 'gestor' ? '📊' : '⚡'} {m.name}
                              <span className="text-gray-500 ml-2">{m.email}</span>
                            </span>
                            <button onClick={() => removeUserFromTeam(m.id)} className="text-red-400 hover:text-red-300 text-[10px]">✕ Remover</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {teams.length === 0 && !showForm && (
                <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-600 text-sm">
                  Nenhuma equipe cadastrada. Clique em &quot;+ Nova Equipe&quot; acima.
                </div>
              )}
            </div>
          </div>

          {/* MONITOR DE FOLLOW-UPS */}
          <div className="bg-[#1a1a1a] p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center"><span className="bg-orange-500 w-2 h-5 mr-2 rounded-sm"></span>Monitor Lino Suporte</h3>
                <p className="text-xs text-gray-500 mt-1">Histórico de notificações e escalações de leads não atendidos.</p>
              </div>
              <button onClick={() => setShowMonitor(!showMonitor)} className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded">
                {showMonitor ? "Ocultar" : "Mostrar"} Histórico
              </button>
            </div>

            {showMonitor && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {followUps.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-6">Nenhum follow-up registrado ainda.</p>
                ) : (
                  followUps.map(fu => (
                    <div key={fu.id} className="bg-black p-3 rounded border border-gray-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-gray-400">Lead:</span>{" "}
                        <span className="text-white font-bold">{fu.leads?.name || "—"}</span>
                        <span className="text-gray-500 ml-2">{fu.leads?.whatsapp_number}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-gray-400">Vendedor:</span>{" "}
                        <span className="text-white">{getSellerName(fu.assigned_user_id)}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-gray-400">Tentativa:</span>{" "}
                        <span className="text-yellow-400 font-bold">#{fu.attempt_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(fu.status)}
                        <span className="text-gray-600 text-[10px]">{new Date(fu.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
