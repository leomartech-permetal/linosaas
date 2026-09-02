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
      // Autenticar diretamente no servidor (contorna bloqueio de RLS no cliente)
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError("Erro ao tentar fazer login: " + err.message);
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
            <label className="block text-xs uppercase font-bold text-neutral-300 tracking-wider mb-2">Usuário / E-mail</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full !bg-[#222222] border border-neutral-700 rounded-lg px-4 py-3 !text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
              placeholder="admin@lino.com" 
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-neutral-300 tracking-wider mb-2">Senha de Acesso</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full !bg-[#222222] border border-neutral-700 rounded-lg px-4 py-3 !text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
              placeholder="••••••••" 
              required
            />
          </div>
          {error && <p className="text-red-400 text-xs font-semibold bg-red-950/40 border border-red-800/60 p-2.5 rounded text-center">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 !text-neutral-950 font-bold py-3 px-4 rounded-lg transition-all shadow-lg disabled:opacity-50 text-sm tracking-wider uppercase cursor-pointer"
          >
            {loading ? "Autenticando..." : "ENTRAR NO SISTEMA"}
          </button>
        </form>
      </div>
    </div>
  );
}
