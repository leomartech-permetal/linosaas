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
          { data: regions },
          { data: rules },
          { data: teams },
          { data: users },
          { data: skills }
        ] = await Promise.all([
          supabase.from('segments').select('*'),
          supabase.from('products').select('*'),
          supabase.from('regions').select('*'),
          supabase.from('routing_rules').select('*'),
          supabase.from('teams').select('*'),
          supabase.from('admin_users').select('id, name, role, team_id'),
          supabase.from('skills').select('id, name, type')
        ]);

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // Y-Levels
        const LEVEL_IN = 50;
        const LEVEL_ROUTER = 150;
        const LEVEL_RULES = 300;
        const LEVEL_TEAMS = 450;
        const LEVEL_USERS = 600;
        const LEVEL_SKILLS = 750;
        const LEVEL_OUT = 900;

        // Maps for fast lookup
        const prodMap = new Map(products?.map(p => [p.id, p.name]));
        const segMap = new Map(segments?.map(s => [s.id, s.name]));
        const regMap = new Map(regions?.map(r => [r.id, r.name]));
        const teamMap = new Map(teams?.map(t => [t.id, t.name]));

        // 1. INPUT LAYER
        newNodes.push({
          id: 'root',
          position: { x: 500, y: LEVEL_IN },
          data: { label: 'Webhook (Evolution API)' },
          type: 'input',
          style: { background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold' }
        });

        // 2. ROUTER LAYER
        newNodes.push({
          id: 'router',
          position: { x: 500, y: LEVEL_ROUTER },
          data: { label: 'Motor de Roteamento' },
          style: { background: '#334155', color: 'white', border: '2px solid #475569' }
        });
        newEdges.push({ id: 'e-root-router', source: 'root', target: 'router', animated: true });

        // 3. RULES LAYER
        const rulesSpacing = 220;
        const rulesStartX = 500 - ((rules?.length || 1) * rulesSpacing) / 2;
        
        rules?.forEach((rule: any, idx: number) => {
          const id = `rule-${rule.id}`;
          
          // Build conditions label
          let conditions = [];
          if (rule.segment_id) conditions.push(`Seg: ${segMap.get(rule.segment_id)}`);
          if (rule.product_ids?.length) conditions.push(`${rule.product_ids.length} Produtos`);
          if (rule.region_ids?.length) conditions.push(`${rule.region_ids.length} Regiões`);
          
          newNodes.push({
            id,
            position: { x: rulesStartX + (idx * rulesSpacing), y: LEVEL_RULES },
            data: { 
              label: (
                <div className="text-xs">
                  <div className="font-bold text-sm mb-1">Regra {idx + 1}</div>
                  <div className="text-slate-300">{conditions.join(' | ') || 'Default'}</div>
                </div>
              )
            },
            style: { background: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8', width: 200 }
          });
          newEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true });
        });

        // 4. TEAMS LAYER
        const teamsSpacing = 250;
        const teamsStartX = 500 - ((teams?.length || 1) * teamsSpacing) / 2;

        teams?.forEach((team: any, idx: number) => {
          const id = `team-${team.id}`;
          newNodes.push({
            id,
            position: { x: teamsStartX + (idx * teamsSpacing), y: LEVEL_TEAMS },
            data: { label: `Equipe: ${team.name}` },
            style: { background: '#4c1d95', color: 'white', border: '1px solid #7c3aed', width: 200 }
          });

          // Connect rules to this team
          rules?.filter((r: any) => r.team_id === team.id).forEach((rule: any) => {
            newEdges.push({ id: `e-rule-${rule.id}-team-${team.id}`, source: `rule-${rule.id}`, target: id });
          });
        });

        // 5. USERS LAYER
        // Agrupar usuários por time para organizar X
        const usersSpacing = 150;
        let currentUserX = 100;

        users?.forEach((user: any) => {
          const id = `user-${user.id}`;
          newNodes.push({
            id,
            position: { x: currentUserX, y: LEVEL_USERS },
            data: { 
              label: (
                <div className="text-xs">
                  <div className="font-bold">{user.name}</div>
                  <div className="text-slate-400">{user.role}</div>
                </div>
              )
            },
            style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #64748b' }
          });

          // Connect team to user
          if (user.team_id) {
            newEdges.push({ id: `e-team-${user.team_id}-user-${user.id}`, source: `team-${user.team_id}`, target: id });
          }

          // Also connect direct assigned rules to users
          rules?.filter((r: any) => r.assigned_user_id === user.id || r.seller_ids?.includes(user.id)).forEach((rule: any) => {
            newEdges.push({ id: `e-rule-${rule.id}-user-${user.id}`, source: `rule-${rule.id}`, target: id, style: { strokeDasharray: '5,5' } });
          });

          currentUserX += usersSpacing;
        });

        // 6. SKILLS LAYER
        const skillsSpacing = 180;
        const skillsStartX = 500 - ((skills?.length || 1) * skillsSpacing) / 2;

        skills?.forEach((skill: any, idx: number) => {
          const id = `skill-${skill.id}`;
          newNodes.push({
            id,
            position: { x: skillsStartX + (idx * skillsSpacing), y: LEVEL_SKILLS },
            data: { 
              label: (
                <div className="text-xs">
                  <div className="font-bold">Cérebro IA</div>
                  <div className="text-purple-300">{skill.name}</div>
                </div>
              )
            },
            style: { background: '#2e1065', color: '#d8b4fe', border: '1px solid #9333ea' }
          });

          // Connect users to skills (assuming general connection for visuals unless specific mapping exists)
          users?.forEach((user: any) => {
             // To avoid extreme clutter, only connect lightly
             newEdges.push({ id: `e-user-${user.id}-skill-${skill.id}`, source: `user-${user.id}`, target: id, style: { stroke: '#4c1d95', opacity: 0.1 } });
          });
        });

        // 7. OUTPUT LAYER
        newNodes.push({
          id: 'whatsapp-out',
          position: { x: 500, y: LEVEL_OUT },
          data: { label: 'Envio WhatsApp / Fila Evolution' },
          type: 'output',
          style: { background: '#166534', color: 'white', border: 'none', fontWeight: 'bold' }
        });

        skills?.forEach((skill: any) => {
          newEdges.push({ id: `e-skill-${skill.id}-wa`, source: `skill-${skill.id}`, target: 'whatsapp-out', animated: true, style: { stroke: '#166534' } });
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

      let activeNodes = new Set<string>(['root']);
      let activeEdges = new Set<string>();
      let errorNodes = new Map<string, any>(); 
      let nodeLogs = new Map<string, any>(); 

      logs.forEach(log => {
        const strLog = JSON.stringify(log).toLowerCase();
        
        if (strLog.includes('webhook') || strLog.includes('receive')) {
          nodeLogs.set('root', log);
        }
        
        if (strLog.includes('rout')) {
          activeNodes.add('router');
          activeEdges.add('e-root-router');
          nodeLogs.set('router', log);
          if (log.level === 'error') errorNodes.set('router', log);
        }

        if (strLog.includes('send') || strLog.includes('whatsapp') || strLog.includes('evolution')) {
          activeNodes.add('whatsapp-out');
          nodeLogs.set('whatsapp-out', log);
          if (log.level === 'error') errorNodes.set('whatsapp-out', log);
        }

        // Mapeamento dinâmico: procura menções a IDs no log para acender nós específicos
        baseNodes.forEach(n => {
           if (n.id === 'root' || n.id === 'router' || n.id === 'whatsapp-out') return;
           
           const realId = n.id.split('-').slice(1).join('-'); // ex: user-1234-5678 -> 1234-5678
           
           if (strLog.includes(realId.toLowerCase())) {
             activeNodes.add(n.id);
             nodeLogs.set(n.id, log);
             if (log.level === 'error') {
               errorNodes.set(n.id, log);
             }

             // Encontra e acende a aresta que chega nesse nó
             baseEdges.forEach(e => {
                if (e.target === n.id && activeNodes.has(e.source)) {
                  activeEdges.add(e.id);
                }
             });
           }
        });
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
    return <div className="w-full h-[80vh] flex items-center justify-center text-white">Carregando a complexidade do sistema...</div>;
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
