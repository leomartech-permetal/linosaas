export default function Dashboard() {
  // Simulação de configuração de tela vinda do SaaS
  const pageConfig = {
    tituloPrincipal: "Pipeline Comercial",
    subtitulo: "Gestão de leads da equipe",
    textoBotaoNovo: "+ Novo Lead"
  };

  return (
    <div className="p-10 w-full h-full">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white shadow-black drop-shadow-md">{pageConfig.tituloPrincipal}</h2>
          <p className="text-gray-300 mt-1">{pageConfig.subtitulo}</p>
        </div>
        <button className="btn-dynamic">
          {pageConfig.textoBotaoNovo}
        </button>
      </header>

      {/* Quadro Kanban (Fundo Branco Clean) */}
      <div className="card-clean h-[70vh] flex gap-6 overflow-x-auto bg-white/95 backdrop-blur-md">
        
        <div className="w-80 flex-shrink-0 bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex justify-between">
            SDR Qualificando <span className="bg-gray-200 text-gray-700 px-2 rounded-full text-sm">3</span>
          </h3>
          
          <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200 mb-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="badge-dynamic">Construção</span>
            </div>
            <h4 className="font-bold text-gray-900">Construtora JAP</h4>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">"Gostaria de um orçamento para fachada..."</p>
          </div>
        </div>

      </div>
    </div>
  );
}
