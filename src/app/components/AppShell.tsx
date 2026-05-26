"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    title: "Geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg> },
      { href: "/dashboard/suporte", label: "Suporte e SLA", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> },
      { href: "/dashboard/sdr", label: "Qualificação SDR", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg> },
      { href: "/", label: "Pipeline de Leads", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg> },
    ]
  },
  {
    title: "Comercial",
    items: [
      { href: "/settings", label: "Regras de Roteamento", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg> },
      { href: "/dashboard/regras", label: "Regras de Negócio", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg> },
      { href: "/skills", label: "Cérebro IA", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> },
      { href: "/fluxos", label: "Fluxos Visuais (Beta)", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    ]
  },
  {
    title: "Configurações",
    items: [
      { href: "/usuarios", label: "Usuários", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> },
      { href: "/saas", label: "Personalização", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg> },
      { href: "/dashboard/logs", label: "Logs do Sistema", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> },
    ]
  }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  const [config, setConfig] = useState({
    company_name: "LINO CRM",
    company_subtitle: "Grupo Permetal",
    primary_color: "#0ecab2",
    secondary_color: "#087f71",
    bg_type: "texture",
    bg_color1: "#0a0a0a",
    bg_color2: "#1a1a1a",
    bg_opacity: 0.2,
    logo_url: "",
    texture_url: "",
  });

  useEffect(() => {
    // Forçar a remoção de qualquer classe dark ou vestígio
    document.documentElement.classList.remove('dark');
    localStorage.removeItem("crm-theme");
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from("tenant_config").select("*").limit(1).single();
      if (data) {
        setConfig({
          ...data,
          company_name: data.company_name || "LINO CRM",
          company_subtitle: data.company_subtitle || "Grupo Permetal",
          primary_color: data.primary_color || "#0ecab2",
          secondary_color: data.secondary_color || "#087f71",
          font_heading: data.font_heading || "Roboto Condensed",
          font_body: data.font_body || "Assistant",
          bg_type: data.bg_type || "texture",
          bg_color1: data.bg_color1 || "#0a0a0a",
          bg_color2: data.bg_color2 || "#1a1a1a",
          bg_opacity: data.bg_opacity ?? 0.2,
          logo_url: data.logo_url || "",
          texture_url: data.texture_url || "",
        });
      }
    }
    loadConfig();
  }, [pathname]);

  function hexToHSL(hex: string): string {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  const primaryHSL = hexToHSL(config.primary_color);

  if (isLogin) {
    return <div style={{ "--tenant-primary": primaryHSL } as any}>{children}</div>;
  }

  return (
    <div className="app-container" style={{ 
      "--font-heading": "Geist, Inter, sans-serif",
      "--font-body": "Geist, Inter, sans-serif"
    } as any}>
      <style jsx global>{`
        h1, h2, h3, h4, h5, h6, .font-heading {
          font-family: Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }
        body, p, span, div, .font-body, table, td, th {
          font-family: Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
      `}</style>
      
      {/* Sidebar Ultra-Limpa (Referência Vercel Style) */}
      <aside className="sidebar">
        <div className="mb-2">
          <a href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {config.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="h-6 object-contain" />
            ) : (
              <div className="w-6 h-6 rounded bg-[#111111] flex items-center justify-center text-white font-black text-xs">
                P
              </div>
            )}
            {!config.logo_url && (
              <span className="font-bold tracking-tight text-[15px] text-[var(--text-primary)]">{config.company_name}</span>
            )}
          </a>
        </div>

        {/* Campo de Busca Minimalista */}
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="search-input"
          />
          <span className="search-shortcut">F</span>
        </div>

        <nav className="flex-1 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="nav-group">
              <h4 className="nav-label">{group.title}</h4>
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? "active" : ""}`}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center text-current">
                      {item.icon(config.primary_color)}
                    </span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="pt-4 border-t border-[var(--border-light)] flex flex-col gap-3">
          <div className="p-2 rounded bg-[var(--bg-surface-muted)] flex items-center gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#eaeaea] text-[#111111]">AD</div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate text-[var(--text-primary)]">Administrador</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">Permetal SaaS</p>
            </div>
          </div>
          <a 
            href="/api/logout" 
            className="btn-secondary w-full h-8 text-xs font-medium"
          >
            Encerrar Sessão
          </a>
        </div>
      </aside>

      {/* Área de Conteúdo Principal */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
