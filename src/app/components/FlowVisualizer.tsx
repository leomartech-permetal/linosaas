"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
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
    <div className="absolute right-0 top-0 h-full w-96 bg-[#FFFFFF] border-l border-[#EAEAEA] shadow-dropdown z-50 flex flex-col text-[#171717]">
      <div className="p-4 border-b border-[#EAEAEA] flex justify-between items-center bg-[#FAFAFA]">
        <h3 className="font-semibold text-sm">Detalhes do Log / Erro</h3>
        <button onClick={onClose} className="text-[#666666] hover:text-[#171717] font-semibold">✕</button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto text-sm">
        <div className="mb-4">
          <span className="text-[#888888] block text-xs mb-1">Módulo</span>
          <span className="font-mono bg-[#F1F5F9] px-2 py-1 rounded border border-[#EAEAEA] text-xs text-[#171717]">{log.module || 'N/A'}</span>
        </div>
        <div className="mb-4">
          <span className="text-[#888888] block text-xs mb-1">Ação</span>
          <span className="font-semibold text-sm">{log.action || 'N/A'}</span>
        </div>
        <div className="mb-4">
          <span className="text-[#888888] block text-xs mb-1">Nível</span>
          <span className={`font-semibold text-xs uppercase ${log.level === 'error' ? 'text-[#E5484D]' : 'text-[#10B981]'}`}>{log.level || 'info'}</span>
        </div>
        <div className="mb-4">
          <span className="text-[#888888] block text-xs mb-1">Data/Hora</span>
          <span className="text-xs text-[#171717]">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
        </div>
        <div className="mt-6">
          <span className="text-[#888888] block text-xs mb-2">Motivo Técnico (Payload JSON)</span>
          <pre className="bg-[#FAFAFA] border border-[#EAEAEA] p-3 rounded overflow-x-auto text-xs text-[#0070F3] font-mono">
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

  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const [baseEdges, setBaseEdges] = useState<Edge[]>([]);

  useEffect(() => {
    // Agora os nós são fixos (representam a lógica do código)
    const initialNodes: Node[] = [
      {
        id: 'node-webhook',
        position: { x: 400, y: 50 },
        data: { label: '1. Webhook (Entrada)' },
        type: 'input',
        style: { background: '#0070F3', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'medium', fontSize: '12px' }
      },
      {
        id: 'node-debounce',
        position: { x: 400, y: 150 },
        data: { label: '2. Debounce & Multimídia' },
        style: { background: '#FFFFFF', color: '#171717', border: '1px solid #D4D4D8', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-is-lead',
        position: { x: 400, y: 250 },
        data: { 
          label: (
            <div className="text-center">
              <div className="font-semibold text-[10px] text-yellow-800">IF/ELSE</div>
              <div className="text-[12px]">É Lead ou Vendedor?</div>
            </div>
          )
        },
        style: { background: '#F5A623', color: 'white', border: 'none', borderRadius: '6px' }
      },
      {
        id: 'node-end-internal',
        position: { x: 150, y: 350 },
        data: { label: 'Ignorar (Uso Interno)' },
        type: 'output',
        style: { background: '#FAFAFA', color: '#888888', border: '1px dashed #D4D4D8', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-is-return',
        position: { x: 550, y: 350 },
        data: { 
          label: (
            <div className="text-center">
              <div className="font-semibold text-[10px] text-yellow-800">IF/ELSE</div>
              <div className="text-[12px]">Lead de Retorno?</div>
            </div>
          )
        },
        style: { background: '#F5A623', color: 'white', border: 'none', borderRadius: '6px' }
      },
      {
        id: 'node-sla',
        position: { x: 750, y: 450 },
        data: { label: 'Sistema SLA / Suporte' },
        style: { background: '#8B5CF6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-ai',
        position: { x: 350, y: 450 },
        data: { label: 'Cérebro IA (SDR/Skills)' },
        style: { background: '#000000', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-router',
        position: { x: 350, y: 550 },
        data: { label: 'Roteador Automático' },
        style: { background: '#FFFFFF', color: '#171717', border: '1px solid #D4D4D8', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-save-db',
        position: { x: 550, y: 650 },
        data: { label: 'Salvar Supabase' },
        style: { background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px' }
      },
      {
        id: 'node-evolution-out',
        position: { x: 550, y: 750 },
        data: { label: 'Disparo Evolution API' },
        type: 'output',
        style: { background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' }
      }
    ];

    const initialEdges: Edge[] = [
      { id: 'e1', source: 'node-webhook', target: 'node-debounce', animated: true },
      { id: 'e2', source: 'node-debounce', target: 'node-is-lead', animated: true },
      { id: 'e3', source: 'node-is-lead', target: 'node-end-internal', label: 'Vendedor', style: { strokeDasharray: '5,5' } },
      { id: 'e4', source: 'node-is-lead', target: 'node-is-return', label: 'Lead', animated: true },
      { id: 'e5', source: 'node-is-return', target: 'node-sla', label: 'Sim', animated: true },
      { id: 'e6', source: 'node-is-return', target: 'node-ai', label: 'Não (Novo)', animated: true },
      { id: 'e7', source: 'node-ai', target: 'node-router', animated: true },
      { id: 'e8', source: 'node-router', target: 'node-save-db', animated: true },
      { id: 'e9', source: 'node-sla', target: 'node-save-db', animated: true },
      { id: 'e10', source: 'node-save-db', target: 'node-evolution-out', animated: true }
    ];

    setBaseNodes(initialNodes);
    setBaseEdges(initialEdges);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setLoading(false);
  }, [setNodes, setEdges]);

  // Função para aplicar os logs (Modo Debug)
  useEffect(() => {
    if (!leadId) {
      setNodes(baseNodes);
      setEdges(baseEdges);
      return;
    }

    async function fetchLogs() {
      let finalLeadId = leadId;
      const safeLeadId = leadId as string;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safeLeadId.trim());

      if (!isUUID) {
        const cleanPhone = safeLeadId.replace(/[^0-9]/g, '');
        let leads;
        if (cleanPhone.length > 5) {
          const res = await supabase.from('leads').select('id').ilike('phone', `%${cleanPhone}%`).limit(1);
          leads = res.data;
        }
        
        if (leads && leads.length > 0) {
          finalLeadId = leads[0].id;
        } else {
          const resName = await supabase.from('leads').select('id').ilike('name', `%${safeLeadId.trim()}%`).limit(1);
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
        alert("Nenhum log encontrado para este Lead.");
        setNodes(baseNodes);
        setEdges(baseEdges);
        return;
      }

      let activeNodes = new Set<string>(['node-webhook']);
      let activeEdges = new Set<string>();
      let errorNodes = new Map<string, any>(); 
      let nodeLogs = new Map<string, any>(); 

      logs.forEach(log => {
        const strLog = JSON.stringify(log).toLowerCase();
        
        if (strLog.includes('webhook') || strLog.includes('receive')) {
          nodeLogs.set('node-webhook', log);
          if (log.level === 'error') errorNodes.set('node-webhook', log);
        }

        if (strLog.includes('debounce') || strLog.includes('buffer') || strLog.includes('multimidia')) {
          activeNodes.add('node-debounce');
          activeEdges.add('e1');
          nodeLogs.set('node-debounce', log);
          if (log.level === 'error') errorNodes.set('node-debounce', log);
        }

        if (strLog.includes('internal') || strLog.includes('vendedor')) {
          activeNodes.add('node-is-lead');
          activeEdges.add('e2');
          activeNodes.add('node-end-internal');
          activeEdges.add('e3');
          nodeLogs.set('node-is-lead', log);
        }

        if (strLog.includes('sdr') || strLog.includes('openai') || strLog.includes('skill')) {
          activeNodes.add('node-is-lead');
          activeNodes.add('node-is-return');
          activeNodes.add('node-ai');
          activeEdges.add('e2');
          activeEdges.add('e4');
          activeEdges.add('e6');
          nodeLogs.set('node-ai', log);
          if (log.level === 'error') errorNodes.set('node-ai', log);
        }

        if (strLog.includes('sla') || strLog.includes('support') || strLog.includes('retorno')) {
          activeNodes.add('node-is-lead');
          activeNodes.add('node-is-return');
          activeNodes.add('node-sla');
          activeEdges.add('e2');
          activeEdges.add('e4');
          activeEdges.add('e5');
          nodeLogs.set('node-sla', log);
          if (log.level === 'error') errorNodes.set('node-sla', log);
        }

        if (strLog.includes('rout') || strLog.includes('rule')) {
          activeNodes.add('node-router');
          activeEdges.add('e7');
          nodeLogs.set('node-router', log);
          if (log.level === 'error') errorNodes.set('node-router', log);
        }

        if (strLog.includes('salva') || strLog.includes('insert') || strLog.includes('update')) {
          activeNodes.add('node-save-db');
          if (activeNodes.has('node-router')) activeEdges.add('e8');
          if (activeNodes.has('node-sla')) activeEdges.add('e9');
          nodeLogs.set('node-save-db', log);
          if (log.level === 'error') errorNodes.set('node-save-db', log);
        }

        if (strLog.includes('send') || strLog.includes('whatsapp') || strLog.includes('evolution')) {
          activeNodes.add('node-save-db');
          activeNodes.add('node-evolution-out');
          activeEdges.add('e10');
          nodeLogs.set('node-evolution-out', log);
          if (log.level === 'error') errorNodes.set('node-evolution-out', log);
        }
      });

      const updatedNodes = baseNodes.map(n => {
        const isError = errorNodes.has(n.id);
        const isActive = activeNodes.has(n.id) || isError;
        
        let newStyle = { ...n.style };
        
        if (isError) {
          newStyle = { ...newStyle, background: '#7f1d1d', border: '2px solid #ef4444', color: 'white', opacity: 1 }; 
        } else if (isActive) {
          newStyle = { ...newStyle, border: '2px solid #22c55e', opacity: 1 }; 
        } else {
          newStyle = { ...newStyle, opacity: 0.15 }; 
        }

        return { ...n, style: newStyle, data: { ...n.data, log: nodeLogs.get(n.id) || errorNodes.get(n.id) } };
      });

      const updatedEdges = baseEdges.map(e => {
        const isActive = activeEdges.has(e.id);
        return {
          ...e,
          animated: isActive,
          style: isActive ? { stroke: '#22c55e', strokeWidth: 3, opacity: 1 } : { opacity: 0.05 },
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
    return <div className="w-full h-[80vh] flex items-center justify-center text-[#666666] text-sm">Carregando fluxo lógico...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} className="rounded-lg border border-[#EAEAEA] overflow-hidden bg-white shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        colorMode="light"
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#E2E8F0" />
      </ReactFlow>
      
      {selectedLog && (
        <LogSidebar log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
