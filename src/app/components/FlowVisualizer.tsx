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
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';

export default function FlowVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndBuildGraph() {
      try {
        setLoading(true);
        
        // Buscando dados reais do banco
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

        // Nó Raiz
        newNodes.push({
          id: 'root',
          position: { x: 400, y: 50 },
          data: { label: 'Webhook (Evolution API)' },
          type: 'input',
          style: { background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold' }
        });

        // Nó Intermediário: Router
        newNodes.push({
          id: 'router',
          position: { x: 400, y: 150 },
          data: { label: 'Roteador Dinâmico' },
          style: { background: '#334155', color: 'white', border: '1px solid #475569' }
        });
        newEdges.push({ id: 'e-root-router', source: 'root', target: 'router', animated: true });

        // Camada 1: Segmentos (Esquerda) e Regiões (Direita)
        let yOffset = 300;
        let xSegOffset = 100;
        let xRegOffset = 700;

        // Criar nó agrupador de segmentos
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

        // Criar nó agrupador de Regiões
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
        
        // Liga segmentos e regiões na IA
        segments?.forEach((seg: any) => {
          newEdges.push({ id: `e-seg-${seg.id}-ai`, source: `seg-${seg.id}`, target: 'products-hub' });
        });
        regions?.forEach((reg: any) => {
          newEdges.push({ id: `e-reg-${reg.id}-ai`, source: `reg-${reg.id}`, target: 'products-hub' });
        });

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

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  if (loading) {
    return <div className="w-full h-[80vh] flex items-center justify-center text-white">Carregando arquitetura do banco...</div>;
  }

  return (
    <div style={{ width: '100%', height: '80vh' }} className="rounded-lg border border-slate-700 overflow-hidden shadow-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
