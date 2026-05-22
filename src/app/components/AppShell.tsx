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
      { href: "/saas-dashboard", label: "Dashboard Vercel", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> },
      { href: "/dashboard/logs", label: "Logs do Sistema", icon: (color: string) => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> },
    ]
  }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
    const saved = localStorage.getItem("crm-theme") as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem("crm-theme", nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

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
    <div className={`flex h-screen w-full transition-colors duration-200 ${theme === 'dark' ? 'dark bg-black text-white' : 'bg-white text-black'}`} style={{ 
      "--tenant-primary": primaryHSL,
      "--font-heading": (config as any).font_heading || 'Roboto Condensed',
      "--font-body": (config as any).font_body || 'Assistant'
    } as any}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=${((config as any).font_heading || 'Roboto Condensed').replace(/ /g, '+')}&family=${((config as any).font_body || 'Assistant').replace(/ /g, '+')}&display=swap');
        
        h1, h2, h3, h4, h5, h6, .font-heading {
          font-family: var(--font-heading), sans-serif !important;
        }
        body, p, span, div, .font-body {
          font-family: var(--font-body), sans-serif;
        }
      `}</style>
      {/* Sidebar Premium */}
      <aside className="w-64 flex flex-col bg-[var(--theme-sidebar)] border-r border-[var(--theme-border)] z-50 transition-colors duration-200">
        <div className="p-6">
          <a href="/dashboard" className="flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity">
            {config.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black" style={{ backgroundColor: config.primary_color }}>
                P
              </div>
            )}
            {!config.logo_url && (
              <span className={`font-black tracking-tighter text-xl ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{config.company_name}</span>
            )}
          </a>
          <p className={`text-[9px] uppercase font-black tracking-widest leading-none ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{config.company_subtitle}</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto scrollbar-hide">
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <h4 className="px-3 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">{group.title}</h4>
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group ${
                      isActive 
                        ? (theme === 'dark' ? "bg-white/5 text-white shadow-lg" : "bg-black/5 text-black shadow-sm") 
                        : (theme === 'dark' ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-600 hover:text-gray-900 hover:bg-black/5")
                    }`}
                  >
                    <span className={`${isActive ? "text-[hsl(var(--tenant-primary))]" : (theme === 'dark' ? "text-gray-600 group-hover:text-gray-400" : "text-gray-400 group-hover:text-gray-600")}`}>
                      {item.icon(config.primary_color)}
                    </span>
                    <span className="font-medium">{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[hsl(var(--tenant-primary))] shadow-[0_0_10px_hsl(var(--tenant-primary))]"></div>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--theme-border)] bg-[var(--theme-sidebar)] transition-colors duration-200">
          <button 
            onClick={toggleTheme} 
            className={`flex items-center justify-center gap-2 w-full py-2 mb-3 text-[10px] font-black uppercase transition-all duration-200 border rounded-lg ${
              theme === 'dark' 
                ? 'text-white border-white/20 bg-white/5 hover:bg-white/10' 
                : 'text-black border-black/10 bg-black/5 hover:bg-black/10'
            }`}
          >
            {theme === 'dark' ? '☀️ Visão (Clara)' : '🌙 Visão (Black)'}
          </button>
          
          <div className={`p-3 rounded-xl flex items-center gap-3 mb-4 transition-colors duration-200 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-700'}`}>AD</div>
            <div className="overflow-hidden">
              <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Administrador</p>
              <p className="text-[10px] text-gray-500 truncate">Permetal SaaS</p>
            </div>
          </div>
          <a href="/api/logout" className={`flex items-center justify-center gap-2 w-full py-2 text-[10px] font-black uppercase transition-colors border rounded-lg ${
            theme === 'dark'
              ? 'text-gray-500 hover:text-red-400 border-gray-800/50 hover:border-red-400/30'
              : 'text-gray-600 hover:text-red-600 border-gray-200 hover:border-red-600/30'
          }`}>
            Encerrar Sessão
          </a>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 relative h-full overflow-hidden flex flex-col bg-[var(--theme-bg)] transition-colors duration-200">
        <div className="flex-1 overflow-y-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
