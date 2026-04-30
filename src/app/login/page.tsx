"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Consultar admin_users diretamente do client
      const { data: user, error: dbError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .single();

      if (dbError || !user) {
        setError("E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }

      if (user.active === false) {
        setError("Usuário desativado. Contate o administrador.");
        setLoading(false);
        return;
      }

      // Salvar nos cookies via API simples
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true, user: { id: user.id, name: user.name, role: user.role, email: user.email } })
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Erro ao tentar fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--tenant-bg))] relative overflow-hidden">
      <div className="absolute inset-0 bg-texture opacity-20 pointer-events-none mix-blend-overlay"></div>
      
      <div className="bg-[#111] p-8 rounded-xl shadow-2xl border border-[hsl(var(--tenant-primary)/0.3)] z-10 w-full max-w-md backdrop-blur-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-widest mb-2">LINO <span className="text-[hsl(var(--tenant-primary))]">SDR</span></h1>
          <p className="text-gray-400 text-sm uppercase tracking-widest">E Suporte</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Usuário</label>
            <input 
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#222] border border-gray-700 rounded-md px-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--tenant-primary))] transition-colors"
              placeholder="seu@email.com" required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Senha de Acesso</label>
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#222] border border-gray-700 rounded-md px-4 py-3 text-white focus:outline-none focus:border-[hsl(var(--tenant-primary))] transition-colors"
              placeholder="••••••••" required
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary)/0.8)] text-white font-bold py-3 px-4 rounded-md transition-all shadow-lg disabled:opacity-50">
            {loading ? "Autenticando..." : "ENTRAR NO SISTEMA"}
          </button>
        </form>
      </div>
    </div>
  );
}
