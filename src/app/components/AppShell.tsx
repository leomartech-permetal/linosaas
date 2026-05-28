"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    title: "Plataforma Lino",
    items: [
      { href: "/", label: "Leads & Funil", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg> },
      { href: "/dashboard", label: "Central de Métricas", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg> },
      { href: "/settings", label: "Configurações Globais", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> }
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
      <main className={pathname === "/" ? "flex-1 h-screen overflow-hidden relative bg-white" : "main-content"}>
        {children}
      </main>
    </div>
  );
}
