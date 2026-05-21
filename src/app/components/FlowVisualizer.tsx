"use client";

import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 50, y: 50 }, data: { label: 'Webhook (Evolution API)' }, type: 'input' },
  { id: '2', position: { x: 50, y: 150 }, data: { label: 'Router (Decisão)' } },
  { id: '3', position: { x: -100, y: 250 }, data: { label: 'SDR (Qualificação)' } },
  { id: '4', position: { x: 200, y: 250 }, data: { label: 'Suporte (Fiscalização SLA)' } },
  { id: '5', position: { x: 50, y: 350 }, data: { label: 'API OpenAI (Gerar Resposta)' } },
  { id: '6', position: { x: 50, y: 450 }, data: { label: 'Enviar Mensagem (WhatsApp)' }, type: 'output' },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, label: 'Mensagem Recebida' },
  { id: 'e2-3', source: '2', target: '3', label: 'Lead Novo' },
  { id: 'e2-4', source: '2', target: '4', label: 'Lead Existente' },
  { id: 'e3-5', source: '3', target: '5' },
  { id: 'e4-5', source: '4', target: '5' },
  { id: 'e5-6', source: '5', target: '6', animated: true },
];

export default function FlowVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

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
