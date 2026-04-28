import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lino CRM - Grupo Permetal",
  description: "Plataforma de gestão de leads inteligente",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Simulação de configuração do Tenant (futuramente puxar do banco)
  const tenantConfig = {
    nome: "LINO CRM",
    subtitulo: "Grupo Permetal",
    corPrimaria: "184 75% 35%",
    usarTexturaFundo: true,
    corFundo: "0 0% 5%",
  };

  const menuItems = [
    { href: "/dashboard", label: "📊 Dashboard" },
    { href: "/", label: "📋 Pipeline de Leads" },
    { href: "/settings", label: "⚙️ Regras Comerciais" },
    { href: "/skills", label: "🧠 Skills da IA" },
    { href: "/usuarios", label: "👥 Usuários" },
    { href: "/saas", label: "🎨 Configurações SaaS" },
  ];

  return (
    <html lang="pt-BR">
      <body>
        <div
          className="flex min-h-screen"
          style={{
            "--tenant-primary": tenantConfig.corPrimaria,
            "--tenant-bg": tenantConfig.corFundo,
          } as React.CSSProperties}
        >
          {/* Sidebar */}
          <aside className="w-56 min-h-screen bg-[#0a0a0a] border-r border-gray-800 flex flex-col flex-shrink-0">
            <div className="p-5 border-b border-gray-800">
              <h1 className="text-xl font-bold text-white tracking-widest">
                {tenantConfig.nome.split(" ")[0]}
                <span className="text-[hsl(var(--tenant-primary))]"> {tenantConfig.nome.split(" ").slice(1).join(" ") || "CRM"}</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{tenantConfig.subtitulo}</p>
            </div>

            <nav className="flex-1 px-3 mt-4 space-y-1">
              {menuItems.map((item) => (
                <a key={item.href} href={item.href} className="flex items-center px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[hsl(var(--tenant-primary)/0.1)] rounded-md transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-gray-800">
              <a href="/api/logout" className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-red-400 transition-colors">
                🚪 Sair do Sistema
              </a>
            </div>
          </aside>

          {/* Conteúdo Principal */}
          <main className="flex-1 bg-[hsl(var(--tenant-bg))] relative overflow-hidden">
            {tenantConfig.usarTexturaFundo && (
              <div className="absolute inset-0 bg-texture opacity-20 pointer-events-none mix-blend-overlay"></div>
            )}
            <div className="relative z-10 h-full">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
