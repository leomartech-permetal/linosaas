"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/dashboard", label: "📊 Dashboard" },
  { href: "/dashboard/sdr", label: "🤖 Qualificação SDR" },
  { href: "/", label: "📋 Pipeline de Leads" },
  { href: "/settings", label: "⚙️ Regras Comerciais" },
  { href: "/skills", label: "🧠 Skills da IA" },
  { href: "/equipes", label: "🏢 Equipes" },
  { href: "/usuarios", label: "👥 Usuários" },
  { href: "/saas", label: "🎨 Configurações SaaS" },
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
    async function loadConfig() {
      const { data } = await supabase.from("tenant_config").select("*").limit(1).single();
      if (data) {
        setConfig({
          company_name: data.company_name || "LINO CRM",
          company_subtitle: data.company_subtitle || "Grupo Permetal",
          primary_color: data.primary_color || "#0ecab2",
          secondary_color: data.secondary_color || "#087f71",
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
  }, [pathname]); // Recarrega ao navegar

  // Converter hex para HSL para as variáveis CSS
  function hexToHSL(hex: string): string {
    hex = hex.replace("#", "");
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

  // Gerar fundo dinâmico
  function getBgStyle(): React.CSSProperties {
    if (config.bg_type === "solid") return { backgroundColor: config.bg_color1 };
    if (config.bg_type === "gradient") return { background: `linear-gradient(135deg, ${config.bg_color1}, ${config.bg_color2})` };
    return { backgroundColor: "#0a0a0a" }; // texture
  }

  // Se for login, renderizar sem sidebar
  if (isLogin) {
    return (
      <div style={{ "--tenant-primary": primaryHSL, "--tenant-bg": "0 0% 5%" } as React.CSSProperties}>
        {children}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ "--tenant-primary": primaryHSL, "--tenant-bg": "0 0% 5%" } as React.CSSProperties}
    >
      {/* Sidebar */}
      <aside className="w-56 min-h-screen bg-[#0a0a0a] border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-800">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-10 object-contain mb-2" />
          ) : (
            <h1 className="text-xl font-bold tracking-widest" style={{ color: config.primary_color }}>
              {config.company_name}
            </h1>
          )}
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{config.company_subtitle}</p>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2.5 text-sm rounded-md transition-colors ${
                  isActive
                    ? "text-white font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
                style={isActive ? { backgroundColor: config.primary_color + "1a" } : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <a href="/api/logout" className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-red-400 transition-colors">
            🚪 Sair do Sistema
          </a>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 relative overflow-hidden" style={getBgStyle()}>
        {config.bg_type === "texture" && (
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay bg-texture"
            style={{ opacity: config.bg_opacity }}
          ></div>
        )}
        <div className="relative z-10 h-full">{children}</div>
      </main>
    </div>
  );
}
