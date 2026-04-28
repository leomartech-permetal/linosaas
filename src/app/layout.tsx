import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lino CRM - Grupo Permetal",
  description: "Plataforma SaaS de Gestão de Leads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Simulação dos dados que virão do Supabase (SaaS)
  const tenantConfig = {
    nome: "Grupo Permetal",
    logoTexto: "LINO CRM",
    corPrimaria: "184 75% 35%", // Azul Petróleo (PSA)
    usarTexturaFundo: true,
    corFundo: "0 0% 5%",
    // Textos do Menu Customizáveis
    menuPipeline: "Pipeline de Leads",
    menuRegras: "Regras Comerciais",
    menuConfig: "Configurações SaaS"
  };

  return (
    <html lang="pt-BR">
      <body
        className={`flex h-screen overflow-hidden ${tenantConfig.usarTexturaFundo ? 'bg-texture-permetal' : ''}`}
        style={{
          '--tenant-primary': tenantConfig.corPrimaria,
          '--tenant-bg': tenantConfig.corFundo,
        } as React.CSSProperties}
      >
        {/* Sidebar Dinâmica e Fixa em todas as telas */}
        <aside className="w-64 bg-black/60 backdrop-blur-md border-r border-white/10 flex flex-col shadow-2xl">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-white tracking-widest">{tenantConfig.logoTexto}</h1>
            <p className="text-xs text-gray-400 mt-1 uppercase">{tenantConfig.nome}</p>
          </div>
          
          <nav className="flex-1 px-4 mt-6 space-y-2">
            <a href="/" className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-[hsl(var(--tenant-primary)/0.1)] rounded-md transition-colors">
              <span>{tenantConfig.menuPipeline}</span>
            </a>
            <a href="/settings" className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-[hsl(var(--tenant-primary)/0.1)] rounded-md transition-colors">
              <span>{tenantConfig.menuRegras}</span>
            </a>
            <a href="#" className="flex items-center px-4 py-3 text-gray-400 hover:text-white transition-colors">
              <span>{tenantConfig.menuConfig}</span>
            </a>
          </nav>
        </aside>

        {/* Conteúdo Dinâmico das Telas */}
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </body>
    </html>
  );
}
