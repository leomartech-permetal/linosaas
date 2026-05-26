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
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "" });

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
      const payload: any = { name: form.name, email: form.email, role: form.role, whatsapp_number: form.whatsapp_number };
      if (form.password) payload.password = form.password;
      await supabase.from("admin_users").update(payload).eq("id", editing.id);
      setEditing(null);
      flash("Usuário atualizado com sucesso.");
    } else {
      if (!form.password) { flash("Senha é obrigatória para novos usuários"); return; }
      const { error } = await supabase.from("admin_users").insert([{ 
        name: form.name, 
        email: form.email, 
        password: form.password, 
        role: form.role,
        whatsapp_number: form.whatsapp_number 
      }]);
      if (error) { flash("Erro: " + error.message); return; }
      flash("Usuário criado com sucesso.");
    }
    setForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "" });
    setShowForm(false);
    loadUsers();
  }

  function startEdit(u: any) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, whatsapp_number: u.whatsapp_number || "" });
    setShowForm(true);
  }

  async function toggleActive(u: any) {
    await supabase.from("admin_users").update({ active: !u.active }).eq("id", u.id);
    flash(u.active ? "Usuário desativado." : "Usuário ativado com sucesso.");
    loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    await supabase.from("admin_users").delete().eq("id", id);
    flash("Usuário excluído com sucesso.");
    loadUsers();
  }

  return (
    <div className="p-6 md:p-10 w-full h-full text-[var(--text-primary)] overflow-y-auto bg-[var(--bg-app)]">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h2 className="text-3xl font-bold text-[var(--text-primary)]">Gestão de Usuários</h2>
        <p className="text-[var(--text-secondary)] mt-2">Controle quem pode acessar o sistema e suas permissões.</p>
      </header>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6 text-sm font-medium shadow-sm animate-fade-in">
          {msg}
        </div>
      )}

      {/* Tabela de Permissões */}
      <div className="card-base mb-8 max-w-3xl">
        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Tabela de Permissões por Perfil</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                <th className="text-left pb-3 font-semibold">Perfil</th>
                <th className="pb-3 font-semibold text-center">Dashboard</th>
                <th className="pb-3 font-semibold text-center">Pipeline</th>
                <th className="pb-3 font-semibold text-center">Regras</th>
                <th className="pb-3 font-semibold text-center">Skills</th>
                <th className="pb-3 font-semibold text-center">Config</th>
                <th className="pb-3 font-semibold text-center">Usuários</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
              <tr>
                <td className="py-3 font-semibold text-[var(--text-primary)]">Admin</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-[var(--text-primary)]">Gestor</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">—</td>
                <td className="text-center py-3">—</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-[var(--text-primary)]">Vendedor</td>
                <td className="text-center py-3">—</td>
                <td className="text-center py-3">Sim</td>
                <td className="text-center py-3">—</td>
                <td className="text-center py-3">—</td>
                <td className="text-center py-3">—</td>
                <td className="text-center py-3">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Botão + Lista */}
      <div className="max-w-3xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Usuários Cadastrados ({users.length})</h3>
          <button
            onClick={() => { setEditing(null); setForm({ name: "", email: "", password: "", role: "vendedor", whatsapp_number: "" }); setShowForm(true); }}
            className="btn-primary"
          >
            + Novo Usuário
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card-base mb-6 shadow-md animate-slide-down">
            <h4 className="font-bold text-[var(--text-primary)] mb-4">{editing ? "Editar Usuário" : "Novo Usuário"}</h4>
            <form onSubmit={saveUser} className="space-y-4">
              <input 
                type="text" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder="Nome completo" 
                className="input-search-clean" 
                required 
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  placeholder="E-mail" 
                  className="input-search-clean" 
                  required 
                />
                <input 
                  type="text" 
                  value={form.whatsapp_number} 
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} 
                  placeholder="WhatsApp (5511...)" 
                  className="input-search-clean" 
                />
              </div>
              <input 
                type="password" 
                value={form.password} 
                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                placeholder={editing ? "Nova senha (deixe vazio para manter)" : "Senha *"} 
                className="input-search-clean" 
              />
              <select 
                value={form.role} 
                onChange={(e) => setForm({ ...form, role: e.target.value })} 
                className="input-search-clean bg-white"
              >
                <option value="admin">Administrador</option>
                <option value="gestor">Gestor</option>
                <option value="vendedor">Vendedor</option>
              </select>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? "Atualizar" : "Criar Usuário"}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <p className="text-[var(--text-secondary)] text-sm">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const role = ROLES[u.role] || ROLES.vendedor;
              return (
                <div key={u.id} className={`card-base p-4 flex justify-between items-center group shadow-sm hover:shadow-md transition-all ${!u.active ? "opacity-60" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{u.name}</h4>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase" style={{ background: role.color + "15", color: role.color }}>
                        {role.label}
                      </span>
                      {!u.active && <span className="text-[10px] text-red-500 font-medium">(inativo)</span>}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{u.email} • {u.whatsapp_number || "Sem WhatsApp"}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => toggleActive(u)} 
                      className={`text-[10px] px-2.5 py-1 rounded-md font-semibold border ${u.active ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"} transition-colors`}
                    >
                      {u.active ? "Desativar" : "Ativar"}
                    </button>
                    <button 
                      onClick={() => startEdit(u)} 
                      className="text-[10px] bg-white text-[var(--text-primary)] border border-[var(--border-default)] px-2.5 py-1 rounded-md font-semibold hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => deleteUser(u.id)} 
                      className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-md font-semibold hover:bg-red-100 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
            {users.length === 0 && <p className="text-[var(--text-secondary)] text-sm text-center py-8">Nenhum usuário cadastrado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
