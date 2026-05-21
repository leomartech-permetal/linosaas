"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';

// Sidebar component
function LogSidebar({ log, onClose }: { log: any, onClose: () => void }) {
  if (!log) return null;
  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-[#0f172a] border-l border-slate-700 shadow-2xl z-50 flex flex-col text-white">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#1e293b]">
        <h3 className="font-bold">Detalhes do Log / Erro</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto text-sm">
        <div className="mb-4">
          <span className="text-slate-400 block text-xs">Módulo</span>
          <span className="font-mono bg-slate-800 px-2 py-1 rounded">{log.module || 'N/A'}</span>
        </div>
        <div className="mb-4">
          <span className="text-slate-400 block text-xs">Ação</span>
          <span className="font-bold">{log.action || 'N/A'}</span>
        </div>
        <div className="mb-4">
          <span className="text-slate-400 block text-xs">Nível</span>
          <span className={`font-bold uppercase ${log.level === 'error' ? 'text-red-400' : 'text-green-400'}`}>{log.level || 'info'}</span>
        </div>
        <div className="mb-4">
          <span className="text-slate-400 block text-xs">Data/Hora</span>
          <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
        </div>
        <div className="mt-6">
          <span className="text-slate-400 block text-xs mb-2">Motivo Técnico (Payload JSON)</span>
          <pre className="bg-slate-900 p-3 rounded overflow-x-auto text-xs text-green-300">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function FlowVisualizer({ leadId }: { leadId?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Guarda estado base para resetar visual
  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const [baseEdges, setBaseEdges] = useState<Edge[]>([]);

  useEffect(() => {
    async function fetchAndBuildGraph() {
      try {
        setLoading(true);
        const [
          { data: segments },
          { data: products },
          { data: regions }
        ] = await Promise.all([
          supabase.from('segments').select('*'),
          supabase.from('products').select('id, name, brand_id'),
          supabase.from('regions').select('id, name, ddd_codes')
        ]);

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        newNodes.push({
          id: 'root',
          position: { x: 400, y: 50 },
          data: { label: 'Webhook (Evolution API)' },
          type: 'input',
          style: { background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold' }
        });

        newNodes.push({
          id: 'router',
          position: { x: 400, y: 150 },
          data: { label: 'Roteador Dinâmico' },
          style: { background: '#334155', color: 'white', border: '1px solid #475569' }
        });
        newEdges.push({ id: 'e-root-router', source: 'root', target: 'router', animated: true });

        // Camada 1: Segmentos (Esquerda) e Regiões (Direita)
        newNodes.push({
          id: 'group-segments',
          position: { x: 200, y: 250 },
          data: { label: 'Segmentos' },
          style: { background: 'transparent', border: '1px dashed #64748b', width: 250, height: 50 + (segments?.length || 0) * 80 }
        });
        newEdges.push({ id: 'e-router-gseg', source: 'router', target: 'group-segments' });

        segments?.forEach((seg: any, index: number) => {
          const id = `seg-${seg.id}`;
          newNodes.push({
            id,
            position: { x: 225, y: 300 + (index * 80) },
            data: { label: `Segmento: ${seg.name}` },
            style: { background: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8' }
          });
          newEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true });
        });

        newNodes.push({
          id: 'group-regions',
          position: { x: 550, y: 250 },
          data: { label: 'Regiões (DDD)' },
          style: { background: 'transparent', border: '1px dashed #64748b', width: 250, height: 50 + (regions?.length || 0) * 80 }
        });
        newEdges.push({ id: 'e-router-greg', source: 'router', target: 'group-regions' });

        regions?.forEach((reg: any, index: number) => {
          const id = `reg-${reg.id}`;
          newNodes.push({
            id,
            position: { x: 575, y: 300 + (index * 80) },
            data: { label: `${reg.name} (${reg.ddd_codes?.length || 0} DDDs)` },
            style: { background: '#0f172a', color: '#a78bfa', border: '1px solid #a78bfa' }
          });
          newEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true });
        });

        // Camada 2: Produtos
        newNodes.push({
          id: 'products-hub',
          position: { x: 400, y: Math.max((segments?.length || 0), (regions?.length || 0)) * 80 + 350 },
          data: { label: 'Identificação de Produto (IA)' },
          style: { background: '#4c1d95', color: 'white', border: 'none', fontWeight: 'bold' }
        });
        
        segments?.forEach((seg: any) => {
          newEdges.push({ id: `e-seg-${seg.id}-ai`, source: `seg-${seg.id}`, target: 'products-hub' });
        });
        regions?.forEach((reg: any) => {
          newEdges.push({ id: `e-reg-${reg.id}-ai`, source: `reg-${reg.id}`, target: 'products-hub' });
        });

        setBaseNodes(newNodes);
        setBaseEdges(newEdges);
        setNodes(newNodes);
        setEdges(newEdges);
      } catch (error) {
        console.error("Erro ao carregar grafo do banco:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAndBuildGraph();
  }, [setNodes, setEdges]);

  // Função para aplicar os logs ao grafo
  useEffect(() => {
    if (!leadId) {
      setNodes(baseNodes);
      setEdges(baseEdges);
      return;
    }

    async function fetchLogs() {
      let finalLeadId = leadId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId.trim());

      if (!isUUID) {
        // Tenta buscar por telefone primeiro (removendo caracteres não numéricos, se houver, ou usando ilike)
        const cleanPhone = leadId.replace(/[^0-9]/g, '');
        let leads;
        if (cleanPhone.length > 5) {
          const res = await supabase.from('leads').select('id').ilike('phone', `%${cleanPhone}%`).limit(1);
          leads = res.data;
        }
        
        if (leads && leads.length > 0) {
          finalLeadId = leads[0].id;
        } else {
          // Tenta por nome
          const resName = await supabase.from('leads').select('id').ilike('name', `%${leadId.trim()}%`).limit(1);
          if (resName.data && resName.data.length > 0) {
            finalLeadId = resName.data[0].id;
          } else {
            alert("Lead não encontrado com esse Telefone ou Nome.");
            setNodes(baseNodes);
            setEdges(baseEdges);
            return;
          }
        }
      }

      const { data: logs } = await supabase
        .from('debug_logs')
        .select('*')
        .eq('lead_id', finalLeadId)
        .order('created_at', { ascending: true });

      if (!logs || logs.length === 0) {
        alert("Nenhum log encontrado para este Lead ID.");
        setNodes(baseNodes);
        setEdges(baseEdges);
        return;
      }

      let activeNodes = new Set<string>(['root']);
      let activeEdges = new Set<string>();
      let errorNodes = new Map<string, any>(); // nodeId -> log
      let nodeLogs = new Map<string, any>(); // nodeId -> log

      logs.forEach(log => {
        const strLog = JSON.stringify(log).toLowerCase();
        
        if (strLog.includes('webhook') || strLog.includes('receive')) {
          nodeLogs.set('root', log);
        }
        
        if (strLog.includes('rout') || strLog.includes('rule')) {
          activeNodes.add('router');
          activeEdges.add('e-root-router');
          nodeLogs.set('router', log);
        }

        if (log.level === 'error') {
           errorNodes.set('router', log);
        }

        baseNodes.forEach(n => {
           if (n.id.startsWith('seg-') || n.id.startsWith('reg-')) {
             const realId = n.id.replace('seg-', '').replace('reg-', '');
             if (strLog.includes(realId.toLowerCase())) {
               activeNodes.add(n.id);
               activeEdges.add(`e-router-${n.id}`);
               nodeLogs.set(n.id, log);
               if (log.level === 'error') errorNodes.set(n.id, log);
             }
           }
        });
      });

      const updatedNodes = baseNodes.map(n => {
        const isError = errorNodes.has(n.id);
        const isActive = activeNodes.has(n.id) || isError;
        
        let newStyle = { ...n.style };
        
        if (isError) {
          newStyle = { ...newStyle, background: '#7f1d1d', border: '2px solid #ef4444', color: 'white' }; // Vermelho
        } else if (isActive) {
          newStyle = { ...newStyle, border: '2px solid #22c55e' }; // Verde
        } else if (n.id !== 'group-segments' && n.id !== 'group-regions') {
          newStyle = { ...newStyle, opacity: 0.3 }; // Desfocado
        }

        return { ...n, style: newStyle, data: { ...n.data, log: nodeLogs.get(n.id) || errorNodes.get(n.id) } };
      });

      const updatedEdges = baseEdges.map(e => {
        const isActive = activeEdges.has(e.id);
        return {
          ...e,
          animated: isActive,
          style: isActive ? { stroke: '#22c55e', strokeWidth: 3 } : { opacity: 0.1 },
          markerEnd: isActive ? { type: MarkerType.ArrowClosed, color: '#22c55e' } : undefined
        };
      });

      setNodes(updatedNodes);
      setEdges(updatedEdges);
    }

    fetchLogs();
  }, [leadId, baseNodes, baseEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((event: any, node: Node) => {
    if (node.data?.log) {
      setSelectedLog(node.data.log);
    }
  }, []);

  if (loading) {
    return <div className="w-full h-[80vh] flex items-center justify-center text-white">Carregando arquitetura do banco...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} className="rounded-lg border border-slate-700 overflow-hidden shadow-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        colorMode="dark"
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      
      {selectedLog && (
        <LogSidebar log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
