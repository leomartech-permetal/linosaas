export default function Settings() {
  return (
    <div className="p-10 w-full h-full">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white shadow-black drop-shadow-md">Regras Comerciais</h2>
          <p className="text-gray-300 mt-1">Configure o roteamento automático e gerencie vendedores</p>
        </div>
      </header>

      {/* Painel Branco Clean */}
      <div className="card-clean h-[70vh] flex flex-col bg-white/95 backdrop-blur-md overflow-y-auto">
        
        <div className="border-b border-gray-200 pb-4 mb-6 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">Rotas e Vendedores</h3>
          <button className="btn-dynamic text-sm px-4 py-1">Adicionar Regra +</button>
        </div>

        {/* Tabela de Regras */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-3 rounded-tl-md">Equipe</th>
              <th className="p-3">Marca</th>
              <th className="p-3">Região</th>
              <th className="p-3">Vendedor Atribuído</th>
              <th className="p-3 rounded-tr-md">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 divide-y divide-gray-100">
            
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="p-3 font-medium">Construção</td>
              <td className="p-3">Permetal</td>
              <td className="p-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">SP</span></td>
              <td className="p-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">J</div>
                João Silva
              </td>
              <td className="p-3 text-sm text-blue-600 hover:underline cursor-pointer">Editar</td>
            </tr>

            <tr className="hover:bg-gray-50 transition-colors">
              <td className="p-3 font-medium">Construção</td>
              <td className="p-3">PSA Permetal</td>
              <td className="p-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">* (Todas)</span></td>
              <td className="p-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">M</div>
                Maria Arquiteta
              </td>
              <td className="p-3 text-sm text-blue-600 hover:underline cursor-pointer">Editar</td>
            </tr>

            <tr className="hover:bg-gray-50 transition-colors">
              <td className="p-3 font-medium">Indústria</td>
              <td className="p-3">Metalgrade</td>
              <td className="p-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs font-mono">SUL</span></td>
              <td className="p-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">P</div>
                Pedro Henrique
              </td>
              <td className="p-3 text-sm text-blue-600 hover:underline cursor-pointer">Editar</td>
            </tr>

          </tbody>
        </table>

      </div>
    </div>
  );
}
