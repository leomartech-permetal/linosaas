"use client";

import { useState, useEffect } from "react";
import { 
  Search, Grid, List, Shield, Activity, GitBranch, 
  CheckCircle2, ChevronRight, Play, Copy, 
  Check, ArrowUpRight, Lock, Globe, Cpu, 
  Database, Key, Terminal, ShieldAlert,
  HelpCircle, Layers, Settings2, Sliders
} from "lucide-react";

// Mock Data
const projects = [
  { name: "linosaas", url: "linosaas.vercel.app", repo: "permetal/linosaas", branch: "main", commit: "feat: add 'Outros Contatos' tab and fix pipeline duplication bug", time: "Just now", status: "ready" },
  { name: "lino-crm-api", url: "lino-crm-api.vercel.app", repo: "permetal/lino-crm-api", branch: "main", commit: "fix: update evolution webhook response handler", time: "2h ago", status: "ready" },
  { name: "permetal-landing", url: "permetal.com.br", repo: "permetal/landing", branch: "production", commit: "chore: release v1.4.0", time: "1d ago", status: "ready" },
];

const deployments = [
  { id: "dep-1", status: "error", timer: "27s", branch: "main", commit: "feat: integrate OpenAI custom assistant variables", author: "leomartech", time: "46m ago", hash: "9a2f1b7" },
  { id: "dep-2", status: "ready", timer: "44s", branch: "main", commit: "feat: add 'Outros Contatos' tab and fix pipeline duplication bug", author: "leomartech", time: "1h ago", hash: "8c3b4e2", current: true },
  { id: "dep-3", status: "ready", timer: "39s", branch: "dev", commit: "test: mock connection to evolution instance payload", author: "danielsales", time: "4h ago", hash: "4d7e9f1" },
  { id: "dep-4", status: "ready", timer: "51s", branch: "main", commit: "refactor: simplify supabase real-time listener handlers", author: "leomartech", time: "1d ago", hash: "e2a5c8b" },
  { id: "dep-5", status: "error", timer: "12s", branch: "hotfix-auth", commit: "fix: bypass middleware JWT validation on dev endpoint", author: "danielsales", time: "2d ago", hash: "a7b3d2c" },
];

const topIPs = [
  { ip: "187.32.144.98", country: "BR", flag: "🇧🇷", requests: "12.4K", percentage: "41.2%" },
  { ip: "104.244.42.1", country: "US", flag: "🇺🇸", requests: "8.1K", percentage: "26.9%" },
  { ip: "82.102.23.45", country: "GB", flag: "🇬🇧", requests: "3.2K", percentage: "10.6%" },
  { ip: "194.154.20.9", country: "DE", flag: "🇩🇪", requests: "1.9K", percentage: "6.3%" },
  { ip: "210.14.99.122", country: "JP", flag: "🇯🇵", requests: "1.2K", percentage: "3.9%" },
];

const requestPaths = [
  { path: "/api/v1/webhooks/evolution", requests: "18.3K", status: "200 OK" },
  { path: "/api/v1/leads/route", requests: "9.2K", status: "200 OK" },
  { path: "/dashboard/sdr", requests: "2.1K", status: "304 Not Modified" },
  { path: "/login", requests: "1.5K", status: "200 OK" },
  { path: "/api/test/clear-history", requests: "432", status: "401 Unauthorized" },
];

export default function SaaSLayout() {
  const [activeTab, setActiveTab] = useState("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutStyle, setLayoutStyle] = useState<"grid" | "list">("grid");
  const [isCopied, setIsCopied] = useState(false);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"visitors" | "views" | "bounce">("visitors");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);

  // Copy command helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Run mock workflow helper
  const runMockWorkflow = () => {
    if (isRunningWorkflow) return;
    setIsRunningWorkflow(true);
    setTerminalOutput(["$ npx lino-agent run workflow.ts", "⚡ Initializing execution context...", "⚙️ Reading configurations from env variables...", "🔍 Checking Active Instances... [Found 3 active]"]);
    
    setTimeout(() => {
      setTerminalOutput(prev => [...prev, "🤖 Connecting to OpenAI assistant API...", "📊 Matching lead rule conditions...", "✅ Lead 'João Silva' qualified as HIGH priority"]);
    }, 1000);

    setTimeout(() => {
      setTerminalOutput(prev => [...prev, "📥 Forwarding data to Evolution Instance perm_sp...", "🔔 Seller notified via WhatsApp successfully!", "✨ Workflow finished in 184ms with status: SUCCESS"]);
      setIsRunningWorkflow(false);
    }, 2200);
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-[#111111] dark:text-[#ffffff] font-sans antialiased overflow-hidden">
      
      {/* SIDEBAR INTERNA (Vercel Estilo) */}
      <aside className="w-64 flex flex-col bg-[#fafafa] dark:bg-[#050505] border-r border-[#e5e5e5] dark:border-[#262626] h-full flex-shrink-0">
        
        {/* Workspace Dropdown */}
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#262626]">
          <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors duration-150">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-5 h-5 rounded bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-[10px]">
                ▲
              </div>
              <span className="text-xs font-semibold truncate">leonardodptomktp...</span>
              <span className="text-[9px] px-1 bg-black/10 dark:bg-white/10 rounded text-gray-500 font-mono">Hobby</span>
            </div>
          </div>
          
          <select className="mt-3 w-full bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-2 py-1 text-xs outline-none cursor-pointer">
            <option value="linosaas">linosaas</option>
            <option value="lino-crm-api">lino-crm-api</option>
            <option value="permetal-landing">permetal-landing</option>
          </select>
        </div>

        {/* Global Search */}
        <div className="px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626]">
          <div className="relative flex items-center bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-2.5 py-1">
            <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent text-xs w-full outline-none placeholder-gray-400"
            />
            <span className="text-[9px] px-1 border border-gray-300 dark:border-gray-700 rounded text-gray-400 font-mono">F</span>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          <div>
            <h4 className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Main</h4>
            <div className="space-y-0.5">
              {[
                { id: "projects", label: "Projects", icon: Layers },
                { id: "deployments", label: "Deployments", icon: GitBranch },
                { id: "logs", label: "Logs", icon: Terminal },
                { id: "analytics", label: "Analytics", icon: Activity },
                { id: "speed", label: "Speed Insights", icon: Cpu }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded text-xs transition-all duration-150 ${
                      isActive 
                        ? "bg-black/5 dark:bg-white/10 text-black dark:text-white font-semibold" 
                        : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-black dark:text-white" : "text-gray-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Infrastructure</h4>
            <div className="space-y-0.5">
              {[
                { id: "observability", label: "Observability", icon: ShieldAlert },
                { id: "firewall", label: "Firewall", icon: Shield },
                { id: "cdn", label: "CDN", icon: Globe },
                { id: "env", label: "Environment Variables", icon: Key },
                { id: "domains", label: "Domains", icon: Globe },
                { id: "integrations", label: "Integrations", icon: Layers },
                { id: "storage", label: "Storage", icon: Database },
                { id: "flags", label: "Flags", icon: Sliders },
                { id: "workflows", label: "Workflows", icon: Settings2 }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded text-xs transition-all duration-150 ${
                      isActive 
                        ? "bg-black/5 dark:bg-white/10 text-black dark:text-white font-semibold" 
                        : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-black dark:text-white" : "text-gray-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-[#e5e5e5] dark:border-[#262626] text-[10px] text-gray-400">
          <p>Lino SaaS Design System</p>
          <p className="mt-0.5 font-mono text-[9px]">v1.0.0-beta</p>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL DO DASHBOARD */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        
        {/* Main Header */}
        <header className="h-12 border-b border-[#e5e5e5] dark:border-[#262626] px-6 flex justify-between items-center bg-white dark:bg-black z-20 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 hover:text-gray-600 cursor-pointer">leonardodptomktp</span>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="text-gray-400 hover:text-gray-600 cursor-pointer">linosaas</span>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="font-semibold capitalize text-black dark:text-white">{activeTab}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              All systems operational
            </span>
          </div>
        </header>

        {/* Dynamic Screens Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#ffffff] dark:bg-[#000000]">
          
          {/* SCREEN 1: Overview Dashboard View */}
          {activeTab === "projects" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              
              {/* Top Search Input & Actions */}
              <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search Projects..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded-md pl-10 pr-4 py-2 text-xs outline-none focus:border-black dark:focus:border-white transition-colors duration-150 text-[#111] dark:text-white"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-md p-1 flex bg-white dark:bg-[#0d0d0d]">
                    <button 
                      onClick={() => setLayoutStyle("grid")}
                      className={`p-1.5 rounded transition-all duration-150 ${layoutStyle === "grid" ? "bg-black/5 dark:bg-white/10" : ""}`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setLayoutStyle("list")}
                      className={`p-1.5 rounded transition-all duration-150 ${layoutStyle === "list" ? "bg-black/5 dark:bg-white/10" : ""}`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <button className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                    Add New...
                  </button>
                </div>
              </div>

              {/* Layout Content */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                
                {/* Left Usage Card (40% width) */}
                <div className="lg:col-span-4 border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">Usage - Last 30 days</h3>
                      <button className="text-[10px] font-bold border border-black/10 dark:border-white/10 px-2 py-1 rounded bg-[#fafafa] dark:bg-[#151515] hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                        Upgrade
                      </button>
                    </div>
                    
                    <div className="space-y-5">
                      {[
                        { label: "Fluid Active CPU", current: "1.4 GHz", limit: "4.0 GHz", percentage: 35 },
                        { label: "Fast Origin Transfer", current: "42.8 GB", limit: "100 GB", percentage: 42 },
                        { label: "Edge Requests", current: "2.8M", limit: "10M", percentage: 28 },
                        { label: "Fluid Provisioned Memory", current: "512 MB", limit: "2.0 GB", percentage: 25 },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-gray-500">{item.current} / {item.limit}</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-black dark:bg-white rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-[#e5e5e5] dark:border-[#262626] mt-6 flex justify-between text-[10px] text-gray-400">
                    <span>Billing cycle resets in 12 days</span>
                    <a href="#" className="hover:underline flex items-center gap-0.5">View Invoice <ArrowUpRight className="w-2.5 h-2.5" /></a>
                  </div>
                </div>

                {/* Right Projects Card (60% width) */}
                <div className="lg:col-span-6 space-y-4">
                  {projects.filter(p => p.name.includes(searchQuery)).map((p, idx) => (
                    <div 
                      key={idx}
                      className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 hover:border-black/30 dark:hover:border-white/30 cursor-pointer transition-all duration-150"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-[8px]">
                              ▲
                            </div>
                            <span className="font-bold text-sm">{p.name}</span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{p.url}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <span className="text-[10px] border border-[#e5e5e5] dark:border-[#262626] px-2 py-0.5 rounded-full font-medium bg-[#fafafa] dark:bg-[#111]">
                            {p.repo}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-green-500 mt-2"></span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[#e5e5e5] dark:border-[#262626] mt-4 flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center gap-2 overflow-hidden pr-4">
                          <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-[10px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500">{p.branch}</span>
                          <span className="truncate italic text-[11px]">&quot;{p.commit}&quot;</span>
                        </div>
                        <span className="text-[10px] flex-shrink-0">{p.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Bottom Section: Alerts center */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-8 text-center space-y-4">
                <div className="mx-auto w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Alerts & Anomalies</h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">No anomalous activities detected on linosaas domain routes. Normal traffic loads and secure edge behavior.</p>
                </div>
                <button className="bg-black dark:bg-white text-white dark:text-black font-bold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                  Upgrade to Pro
                </button>
              </div>

            </div>
          )}

          {/* SCREEN 2: Deployments Timeline Grid */}
          {activeTab === "deployments" && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              {/* Horizontal Filters Bar */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>Select Date Range</option>
                    <option>Last 24 hours</option>
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                  </select>
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>All Automations</option>
                    <option>GitHub Actions</option>
                    <option>Manual Deployment</option>
                  </select>
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>All Environments</option>
                    <option>Production</option>
                    <option>Preview</option>
                    <option>Development</option>
                  </select>
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>All Repositories</option>
                    <option>permetal/linosaas</option>
                    <option>permetal/lino-crm-api</option>
                  </select>
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>All Branches</option>
                    <option>main</option>
                    <option>dev</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded">
                    Status 5/6
                  </span>
                </div>
              </div>

              {/* Chronological Data Feed List */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
                <div className="divide-y divide-[#e5e5e5] dark:divide-[#262626]">
                  {deployments.map((d) => (
                    <div key={d.id} className="p-4 flex items-center justify-between hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors duration-100">
                      <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                        {/* Status tag */}
                        <div className="w-16 flex-shrink-0">
                          {d.status === "ready" ? (
                            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 uppercase">
                              Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase">
                              Error
                            </span>
                          )}
                        </div>

                        {/* Git Branch & telemetry info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs hover:underline cursor-pointer">{d.commit}</span>
                            {d.current && (
                              <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                            <GitBranch className="w-3 h-3 text-gray-400" />
                            <span>{d.branch}</span>
                            <span>•</span>
                            <span>{d.hash}</span>
                            <span>•</span>
                            <span>{d.time} by {d.author}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right metadata */}
                      <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                        <span>{d.timer}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* SCREEN 3: Web Analytics & Spline Chart View */}
          {activeTab === "analytics" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              
              {/* Hero Setup Section */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <h2 className="text-2xl font-black tracking-tight">Web Analytics</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Track visitor metrics, edge executions, and user behaviour in real-time. Understand geographical loads and optimize performance down to milliseconds.
                  </p>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                  <a href="#" className="text-xs text-gray-500 hover:text-black dark:hover:text-white hover:underline flex items-center gap-0.5">
                    Limits & Pricing <ArrowUpRight className="w-3 h-3" />
                  </a>
                  <button className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                    Enable Web Analytics
                  </button>
                </div>
              </div>

              {/* Horizontal Feature Carousel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Real-time Insights</h4>
                      <p className="text-xs text-gray-500">Monitor traffic logs as they hit our global edge nodes.</p>
                    </div>
                    <Activity className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold pt-2">
                    <span className="text-green-500">Active now</span>
                    <button className="p-1 border border-black/10 dark:border-white/10 rounded bg-[#fafafa] dark:bg-[#111]">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Deeper Insights</h4>
                      <p className="text-xs text-gray-500">Identify top request paths, referral URLs, and devices.</p>
                    </div>
                    <Layers className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold pt-2">
                    <span className="text-gray-400">Not configured</span>
                    <button className="p-1 border border-black/10 dark:border-white/10 rounded bg-[#fafafa] dark:bg-[#111]">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Interactive Chart Panel */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
                
                {/* Chart Header Tabs */}
                <div className="border-b border-[#e5e5e5] dark:border-[#262626] px-6 py-4 flex justify-between items-center bg-[#fafafa] dark:bg-[#0d0d0d]">
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-md border border-[#e5e5e5] dark:border-[#262626]">
                    {[
                      { id: "visitors", label: "Visitors" },
                      { id: "views", label: "Page Views" },
                      { id: "bounce", label: "Bounce Rate" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setAnalyticsSubTab(tab.id as any)}
                        className={`px-3 py-1 rounded text-xs transition-all duration-150 ${
                          analyticsSubTab === tab.id 
                            ? "bg-white dark:bg-[#1a1a1a] text-black dark:text-white font-semibold shadow-sm" 
                            : "text-gray-500 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10px] font-semibold text-gray-400 font-mono uppercase bg-[#e5e5e5] dark:bg-[#1f1f1f] px-2 py-0.5 rounded">
                    Demo Data
                  </span>
                </div>

                {/* SVG Spline Area Chart */}
                <div className="p-6">
                  <div className="relative h-64 w-full flex items-end">
                    
                    {/* Left Ticks (5K, 10K, 15K) */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-gray-400 font-mono pr-4 border-r border-[#e5e5e5] dark:border-[#262626] py-2 z-10 bg-white dark:bg-[#0a0a0a]">
                      <span>15K</span>
                      <span>10K</span>
                      <span>5K</span>
                      <span>0</span>
                    </div>

                    {/* Chart area */}
                    <div className="flex-1 h-full pl-12 relative">
                      
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
                        <div className="border-b border-black/[0.04] dark:border-white/[0.04] w-full h-0"></div>
                        <div className="border-b border-black/[0.04] dark:border-white/[0.04] w-full h-0"></div>
                        <div className="border-b border-black/[0.04] dark:border-white/[0.04] w-full h-0"></div>
                        <div className="border-b border-black/[0.04] dark:border-white/[0.04] w-full h-0"></div>
                      </div>

                      {/* The spline area path */}
                      <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(0,0,0,0.15)" className="dark:stop-color-white/20" />
                            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                          </linearGradient>
                        </defs>
                        {/* Area path */}
                        <path 
                          d="M0 240 C 60 180, 100 220, 150 120 C 200 40, 250 160, 300 80 C 350 40, 400 180, 450 100 C 500 40, 550 20, 600 0 L 600 240 Z" 
                          fill="url(#chartGrad)" 
                        />
                        {/* Line path */}
                        <path 
                          d="M0 240 C 60 180, 100 220, 150 120 C 200 40, 250 160, 300 80 C 350 40, 400 180, 450 100 C 500 40, 550 20, 600 0" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          className="text-black dark:text-white"
                        />
                      </svg>

                      {/* Interactive dots */}
                      <div className="absolute top-[120px] left-[25%] group cursor-pointer pointer-events-auto">
                        <div className="w-3 h-3 bg-black dark:bg-white border-2 border-white dark:border-black rounded-full shadow absolute -translate-x-1.5 -translate-y-1.5"></div>
                        <div className="hidden group-hover:block absolute bg-black dark:bg-white text-white dark:text-black p-2 rounded text-[10px] font-mono shadow-lg -translate-x-1/2 -translate-y-12 whitespace-nowrap z-50">
                          <p className="font-bold">12.1K visitors</p>
                          <p className="text-[8px] text-gray-400">12:00 PM</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Horizontal Ticks (Time) */}
                  <div className="pl-12 flex justify-between text-[10px] text-gray-400 font-mono mt-4">
                    <span>08:00 AM</span>
                    <span>10:00 AM</span>
                    <span>12:00 PM</span>
                    <span>02:00 PM</span>
                    <span>04:00 PM</span>
                    <span>06:00 PM</span>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* SCREEN 4: Firewall Traffic Analytics */}
          {activeTab === "firewall" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              
              {/* Top Toolbar */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">Firewall Monitor</h3>
                  <select className="bg-white dark:bg-[#0d0d0d] border border-[#e5e5e5] dark:border-[#262626] rounded px-3 py-1.5 text-xs outline-none cursor-pointer">
                    <option>Past Hour</option>
                    <option>Past 24 Hours</option>
                    <option>Past 7 Days</option>
                  </select>
                </div>
                
                <div className="flex gap-2">
                  {["Allowed", "Denied", "Challenged", "Logged", "Rate Limited"].map((flag, idx) => (
                    <span 
                      key={idx}
                      className="text-[9px] font-mono px-2 py-0.5 border border-[#e5e5e5] dark:border-[#262626] rounded-full bg-[#fafafa] dark:bg-[#111] flex items-center gap-1.5"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        flag === "Allowed" ? "bg-green-500" :
                        flag === "Denied" ? "bg-red-500" :
                        flag === "Challenged" ? "bg-yellow-500" :
                        flag === "Logged" ? "bg-blue-500" : "bg-purple-500"
                      }`}></span>
                      {flag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Firewall line-chart */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 h-48 flex items-end">
                <div className="w-full h-full relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-gray-500 w-full"></div>
                    <div className="border-b border-gray-500 w-full"></div>
                    <div className="border-b border-gray-500 w-full"></div>
                  </div>
                  
                  {/* Traffic Multi-line representation */}
                  <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                    {/* Allowed path */}
                    <path d="M0 120 Q 150 40, 300 80 T 600 20" fill="none" stroke="#22c55e" strokeWidth="2" />
                    {/* Denied path */}
                    <path d="M0 148 Q 150 145, 300 130 T 600 140" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                    {/* Rate Limited */}
                    <path d="M0 140 Q 150 120, 300 145 T 600 148" fill="none" stroke="#a855f7" strokeWidth="1" />
                  </svg>
                </div>
              </div>

              {/* Bottom Tabular Grids */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Top IPs */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-[#262626] bg-[#fafafa] dark:bg-[#0d0d0d] font-bold text-xs uppercase tracking-wider text-gray-500">
                    Top IPs
                  </div>
                  <div className="divide-y divide-[#e5e5e5] dark:divide-[#262626]">
                    {topIPs.map((item, idx) => (
                      <div key={idx} className="px-6 py-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.flag}</span>
                          <span className="font-mono font-semibold">{item.ip}</span>
                        </div>
                        <div className="flex gap-4 font-mono text-gray-500">
                          <span>{item.requests} reqs</span>
                          <span className="font-bold text-[#111] dark:text-white">{item.percentage}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Request Paths */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-[#262626] bg-[#fafafa] dark:bg-[#0d0d0d] font-bold text-xs uppercase tracking-wider text-gray-500">
                    Top Request Paths
                  </div>
                  <div className="divide-y divide-[#e5e5e5] dark:divide-[#262626]">
                    {requestPaths.map((item, idx) => (
                      <div key={idx} className="px-6 py-3 flex justify-between items-center text-xs">
                        <span className="font-mono text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{item.path}</span>
                        <div className="flex gap-4 font-mono">
                          <span className="text-gray-400">{item.requests} reqs</span>
                          <span className="text-green-500 font-bold">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SCREEN 5: Observability & Middleware Layout */}
          {activeTab === "observability" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              
              {/* Full-width upgrade banner message block */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-gradient-to-r from-red-500/10 to-transparent p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-red-500">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-red-500 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Professional Observability Stack Required
                  </h3>
                  <p className="text-xs text-gray-400 max-w-xl">
                    Get detailed runtime execution traces, function stack traces, and cold start analytics. Unlock middleware Observability and keep log payloads up to 30 days.
                  </p>
                </div>
                
                <button className="bg-black dark:bg-white text-white dark:text-black font-black px-6 py-2.5 rounded-lg text-xs hover:opacity-90 transition-opacity flex-shrink-0">
                  Upgrade to Enterprise
                </button>
              </div>

              {/* Grid with active chart and locked overlay chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Active Invocations Timeline */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Edge Function Invocations</h4>
                  <div className="h-48 flex items-end">
                    {/* Tiny Area Chart */}
                    <div className="w-full h-full relative">
                      <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                          </linearGradient>
                        </defs>
                        <path d="M0 150 Q 150 60, 300 110 T 600 10 L 600 150 Z" fill="url(#invGrad)" />
                        <path d="M0 150 Q 150 60, 300 110 T 600 10" fill="none" stroke="#3b82f6" strokeWidth="2" />
                      </svg>
                      <div className="absolute top-2 right-2 text-[10px] font-mono text-gray-400 bg-white/80 dark:bg-black/80 px-2 py-0.5 rounded border border-[#e5e5e5] dark:border-[#262626]">
                        Peak: 12.8 ms / req
                      </div>
                    </div>
                  </div>
                </div>

                {/* Locked Duration Chart with Glassmorphism overlay */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] p-6 relative overflow-hidden h-64 flex flex-col justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Execution Durations</h4>
                  
                  {/* Blurry Background Chart representation */}
                  <div className="flex-1 flex items-end opacity-20 pointer-events-none mt-4">
                    <div className="w-full h-32 bg-gray-300 dark:bg-gray-800 rounded animate-pulse"></div>
                  </div>

                  {/* Glassmorphism Locked Overlay */}
                  <div className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center border border-black/10 dark:border-white/10">
                      <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold">Trace Metrics Locked</h5>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 max-w-xs">Available under the Enterprise observability plan. Track database latency and custom middleware timings.</p>
                    </div>
                    <button className="bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-md">
                      Upgrade to Pro
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SCREEN 6: Workflows Layout */}
          {activeTab === "workflows" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Side: Developer steps */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Developer Guide</span>
                    <h2 className="text-xl font-black">Configure Workflows</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Deploy programmable state-machines triggered by lead actions. Run custom middleware scripts, call API webhooks and routes instantly.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { step: "01", title: "Install Lino Agent SDK", desc: "Run our quick installer command on your terminal to initialize configuration assets." },
                      { step: "02", title: "Write workflows.ts Schema", desc: "Define rules, conditions, and SLA escalation pipelines using strict TypeScript classes." },
                      { step: "03", title: "Deploy to Lino Edge Network", desc: "Run your build and deploy pipelines to test and execute your routing automation in production." }
                    ].map((step, idx) => (
                      <div key={idx} className="flex gap-4 items-start p-4 rounded-xl border border-[#e5e5e5] dark:border-[#262626] bg-white dark:bg-[#0a0a0a]">
                        <span className="font-mono font-bold text-gray-400 text-sm">{step.step}</span>
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs">{step.title}</h4>
                          <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Terminal copy installer */}
                  <div className="bg-black dark:bg-[#0d0d0d] text-white p-4 rounded-xl border border-gray-800 font-mono text-[11px] flex justify-between items-center">
                    <span className="text-gray-400 select-all">$ npm i -g @permetal/lino-agent-sdk</span>
                    <button 
                      onClick={() => copyToClipboard("npm i -g @permetal/lino-agent-sdk")}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Right Side: Code Runner and output panel */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden flex flex-col justify-between h-[450px]">
                  
                  {/* File tab bar */}
                  <div className="border-b border-[#e5e5e5] dark:border-[#262626] px-4 py-2 bg-[#fafafa] dark:bg-[#0d0d0d] flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      workflow.ts
                    </div>
                    <button 
                      onClick={runMockWorkflow}
                      disabled={isRunningWorkflow}
                      className="text-[10px] font-bold bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" /> {isRunningWorkflow ? "Running..." : "Run Code"}
                    </button>
                  </div>

                  {/* Code Editor Mock */}
                  <div className="flex-1 p-6 font-mono text-[11px] text-gray-500 overflow-y-auto leading-relaxed bg-[#ffffff] dark:bg-[#050505]">
                    <p><span className="text-purple-600 dark:text-purple-400">import</span> &#123; LinoWorkflow, Lead &#125; <span className="text-purple-600 dark:text-purple-400">from</span> <span className="text-green-600 dark:text-green-400">&quot;@lino/sdk&quot;</span>;</p>
                    <p className="mt-2"><span className="text-blue-600 dark:text-blue-400">export default new</span> <span className="text-yellow-600 dark:text-yellow-400">LinoWorkflow</span>(&#123;</p>
                    <p className="pl-4">name: <span className="text-green-600 dark:text-green-400">&quot;lead-qualification-sdr&quot;</span>,</p>
                    <p className="pl-4">trigger: <span className="text-green-600 dark:text-green-400">&quot;on_new_message&quot;</span>,</p>
                    <p className="pl-4">handler: <span className="text-blue-600 dark:text-blue-400">async</span> (lead: <span className="text-yellow-600 dark:text-yellow-400">Lead</span>) =&gt; &#123;</p>
                    <p className="pl-8"><span className="text-blue-600 dark:text-blue-400">const</span> isQualified = <span className="text-blue-600 dark:text-blue-400">await</span> lead.evaluateSDRRules();</p>
                    <p className="pl-8 text-gray-400">// Automatically assign and notify sales team</p>
                    <p className="pl-8"><span className="text-blue-600 dark:text-blue-400">if</span> (isQualified) &#123;</p>
                    <p className="pl-12"><span className="text-blue-600 dark:text-blue-400">await</span> lead.assignToGroup(<span className="text-green-600 dark:text-green-400">&quot;vendas_sp&quot;</span>);</p>
                    <p className="pl-12"><span className="text-blue-600 dark:text-blue-400">await</span> lead.notifySellerViaWhatsApp();</p>
                    <p className="pl-8">&#125;</p>
                    <p className="pl-4">&#125;</p>
                    <p>&#125;);</p>
                  </div>

                  {/* Terminal Output panel */}
                  <div className="h-36 border-t border-[#e5e5e5] dark:border-[#262626] bg-[#fafafa] dark:bg-[#0d0d0d] p-4 font-mono text-[10px] overflow-y-auto space-y-1 text-gray-500">
                    <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mb-1">Execution Output Console</p>
                    {terminalOutput.length === 0 ? (
                      <p className="text-gray-400 italic">Click &quot;Run Code&quot; above to simulate workflow execution...</p>
                    ) : (
                      terminalOutput.map((log, idx) => (
                        <p 
                          key={idx} 
                          className={
                            log.startsWith("✅") || log.includes("SUCCESS") ? "text-green-500" :
                            log.startsWith("$") ? "text-blue-500 font-bold" :
                            log.startsWith("⚡") ? "text-yellow-500" : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {log}
                        </p>
                      ))
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* FALLBACK TABS */}
          {activeTab !== "projects" && activeTab !== "deployments" && activeTab !== "analytics" && activeTab !== "firewall" && activeTab !== "observability" && activeTab !== "workflows" && (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-black/5 dark:bg-white/10 rounded-full flex items-center justify-center border border-[#e5e5e5] dark:border-[#262626]">
                <HelpCircle className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Template Option Loaded</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This mock panel view ({activeTab}) is rendered as a placeholder to demonstrate shell visual styles. Complete code implementation is active on specified screens.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("projects")}
                className="bg-black dark:bg-white text-white dark:text-black font-semibold text-xs px-4 py-2 rounded-md"
              >
                Go to Projects Overview
              </button>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
