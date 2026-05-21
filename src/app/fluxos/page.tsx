import FlowVisualizer from '../components/FlowVisualizer';

export default function FluxosPage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Editor de Fluxos Lino</h1>
          <p className="text-slate-400">
            Visualize a arquitetura de roteamento e decisão da IA.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md transition text-sm">
            Modo Debug
          </button>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition text-sm font-medium">
            Publicar Fluxo
          </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-[600px]">
        <FlowVisualizer />
      </div>
    </div>
  );
}
