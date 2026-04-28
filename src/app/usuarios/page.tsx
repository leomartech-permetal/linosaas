"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ROLES: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "#ef4444" },
  gestor: { label: "Gestor", color: "#f59e0b" },
  vendedor: { label: "Vendedor", color: "#3b82f6" },
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendedor" });

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from("admin_users").select("*").order("created_at");
    if (data) setUsers(data);
    setLoading(false);
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;

    if (editing) {
      const payload: any = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      await supabase.from("admin_users").update(payload).eq("id", editing.id);
      setEditing(null);
      flash("✔ Usuário atualizado!");
    } else {
      if (!form.password) { flash("Senha é obrigatória para novos usuários"); return; }
      const { error } = await supabase.from("admin_users").insert([{ name: form.name, email: form.email, password: form.password, role: form.role }]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("✔ Usuário criado!");
    }
    setForm({ name: "", email: "", password: "", role: "vendedor" });
    setShowForm(false);
    loadUsers();
  }

  function startEdit(u: any) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setShowForm(true);
  }

  async function toggleActive(u: any) {
    await supabase.from("admin_users").update({ active: !u.active }).eq("id", u.id);
    flash(u.active ? "Usuário desativado" : "✔ Usuário ativado!");
    loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    await supabase.from("admin_users").delete().eq("id", id);
    flash("✔ Usuário excluído!");
    loadUsers();
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-white overflow-y-auto">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-3xl font-bold">Gestão de Usuários</h2>
        <p className="text-gray-400 mt-2">Controle quem pode acessar o sistema e suas permissões.</p>
      </header>

      {msg && <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-6 text-sm">{msg}</div>}

      {/* Tabela de Permissões */}
      <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-800 mb-8 max-w-3xl">
        <h3 className="text-sm font-bold text-gray-400 mb-3">Tabela de Permissões por Perfil</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2">Perfil</th>
                <th className="pb-2">Dashboard</th>
                <th className="pb-2">Pipeline</th>
                <th className="pb-2">Regras</th>
                <th className="pb-2">Skills</th>
                <th className="pb-2">Config</th>
                <th className="pb-2">Usuários</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/50"><td className="py-2 text-red-400 font-bold">Admin</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td></tr>
              <tr className="border-b border-gray-800/50"><td className="py-2 text-yellow-400 font-bold">Gestor</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">❌</td><td className="text-center">❌</td></tr>
              <tr><td className="py-2 text-blue-400 font-bold">Vendedor</td><td className="text-center">❌</td><td className="text-center">✅</td><td className="text-center">❌</td><td className="text-center">❌</td><td className="text-center">❌</td><td className="text-center">❌</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Botão + Lista */}
      <div className="max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Usuários Cadastrados ({users.length})</h3>
          <button
            onClick={() => { setEditing(null); setForm({ name: "", email: "", password: "", role: "vendedor" }); setShowForm(true); }}
            className="bg-[hsl(var(--tenant-primary))] px-4 py-2 rounded text-sm font-bold text-black hover:opacity-90"
          >
            + Novo Usuário
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-[#1a1a1a] p-5 rounded-lg border border-gray-700 mb-6">
            <h4 className="font-bold mb-4">{editing ? "Editar Usuário" : "Novo Usuário"}</h4>
            <form onSubmit={saveUser} className="space-y-3">
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" required />
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Nova senha (deixe vazio para manter)" : "Senha *"} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm outline-none">
                <option value="admin">Administrador</option>
                <option value="gestor">Gestor</option>
                <option value="vendedor">Vendedor</option>
              </select>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-[hsl(var(--tenant-primary))] text-black font-bold py-2 rounded hover:opacity-90">{editing ? "Atualizar" : "Criar Usuário"}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 border border-gray-700 py-2 rounded hover:bg-gray-800">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        {loading ? <p className="text-gray-500">Carregando...</p> : (
          <div className="space-y-3">
            {users.map((u) => {
              const role = ROLES[u.role] || ROLES.vendedor;
              return (
                <div key={u.id} className={`bg-[#1a1a1a] p-4 rounded-lg border border-gray-800 flex justify-between items-center group ${!u.active ? "opacity-50" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm">{u.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: role.color + "22", color: role.color }}>{role.label}</span>
                      {!u.active && <span className="text-[10px] text-red-400">(inativo)</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{u.email}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleActive(u)} className={`text-[10px] px-2 py-1 rounded ${u.active ? "bg-yellow-900/50 text-yellow-400" : "bg-green-900/50 text-green-400"}`}>
                      {u.active ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => startEdit(u)} className="text-[10px] bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    <button onClick={() => deleteUser(u.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded hover:bg-red-900">X</button>
                  </div>
                </div>
              );
            })}
            {users.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Nenhum usuário cadastrado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
