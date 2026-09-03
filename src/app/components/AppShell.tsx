"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  Kanban,
  BarChart3,
  Settings,
  Search,
  LogOut,
  AlertTriangle,
} from "lucide-react";

const IS_TEST_MODE = process.env.NEXT_PUBLIC_LINO_RUNTIME_MODE !== "production";

// As 5 áreas principais da nova arquitetura de navegação
const mainNavigation = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/atendimentos", label: "Atendimentos", icon: MessageSquareText },
  { href: "/oportunidades", label: "Oportunidades", icon: Kanban },
  { href: "/dashboard", label: "Relatórios", icon: BarChart3 },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  const [companyName, setCompanyName] = useState("Lino");

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("crm-theme");

    async function loadConfig() {
      const { data } = await supabase
        .from("tenant_config")
        .select("company_name")
        .limit(1)
        .single();
      if (data?.company_name) setCompanyName(data.company_name);
    }
    loadConfig();
  }, [pathname]);

  if (isLogin) {
    return <div className="min-h-screen bg-[#fafafa]">{children}</div>;
  }

  return (
    <div className="flex h-screen w-full bg-[#fafafa] text-[#111111] overflow-hidden font-sans antialiased selection:bg-neutral-200">
      {/* ── BANNER MODO DE TESTE ────────────────────────────────────────── */}
      {IS_TEST_MODE && (
        <div className="fixed top-0 left-0 right-0 z-50 h-7 bg-amber-500 text-black text-[11px] font-semibold tracking-wider flex items-center justify-center gap-2 shadow-xs select-none">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>
            AMBIENTE DE TESTE — Saída física restrita a{" "}
            <code className="bg-black/15 px-1.5 py-0.5 rounded font-mono text-[10px]">
              5516991415319
            </code>
          </span>
        </div>
      )}

      {/* ── SIDEBAR (232px) ────────────────────────────────────────────── */}
      <aside
        className={`w-[232px] flex-shrink-0 border-r border-[#eaeaea] bg-white flex flex-col justify-between z-20 ${
          IS_TEST_MODE ? "pt-7" : ""
        }`}
      >
        <div className="p-3.5 flex flex-col gap-3">
          {/* Logo / Header Lino */}
          <div className="flex items-center justify-between px-1.5 py-1 mb-1">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[#111111] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                ▲
              </div>
              <span className="font-semibold text-sm tracking-tight text-[#111111]">
                {companyName}
              </span>
            </a>
            <span className="text-[10px] font-medium text-[#666666] bg-[#f5f5f5] px-1.5 py-0.5 rounded border border-[#eaeaea]">
              v4.1
            </span>
          </div>

          {/* Busca Global ⌘K */}
          <button
            type="button"
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[#666666] bg-[#fafafa] border border-[#eaeaea] rounded-md hover:border-[#999999] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#888888]" />
              <span>Buscar...</span>
            </div>
            <kbd className="text-[10px] font-mono text-[#888888] bg-white border border-[#eaeaea] px-1.5 py-0.5 rounded shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Navegação Principal (4 itens superiores) */}
          <nav className="flex flex-col gap-0.5 pt-1">
            {mainNavigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-[#f5f5f5] text-[#111111] font-semibold"
                      : "text-[#666666] hover:bg-[#fafafa] hover:text-[#111111]"
                  }`}
                >
                  <Icon className="w-4 h-4 text-current flex-shrink-0" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Rodapé: Configurações + Perfil (5º item de navegação) */}
        <div className="p-3 border-t border-[#eaeaea] flex flex-col gap-1 bg-white">
          <a
            href="/settings"
            className={`flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-[#f5f5f5] text-[#111111] font-semibold"
                : "text-[#666666] hover:bg-[#fafafa] hover:text-[#111111]"
            }`}
          >
            <Settings className="w-4 h-4 text-current flex-shrink-0" />
            <span>Configurações</span>
          </a>

          <div className="pt-2 mt-1 border-t border-[#f0f0f0] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-[#111111] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                P
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#111111] truncate leading-tight">
                  Coordenação
                </p>
                <p className="text-[10px] text-[#666666] truncate">Permetal</p>
              </div>
            </div>
            <a
              href="/api/logout"
              title="Encerrar sessão"
              className="p-1 rounded text-[#666666] hover:text-[#111111] hover:bg-[#f5f5f5] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL ────────────────────────────────────────────── */}
      <main
        className={`flex-1 h-screen overflow-y-auto bg-[#fafafa] ${
          IS_TEST_MODE ? "pt-7" : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
