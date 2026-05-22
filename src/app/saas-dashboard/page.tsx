"use client";

import { useState, useEffect } from "react";
import { 
  Search, GitBranch, CheckCircle2, ChevronRight, Play, Copy, 
  Check, ArrowUpRight, Lock, Globe, Cpu, Database, Key, 
  Terminal, ShieldAlert, HelpCircle, Layers, Settings2, Sliders,
  Bell, MoreHorizontal, Eye, EyeOff, ExternalLink, RefreshCw
} from "lucide-react";

// Mocks baseados estritamente nos JSONs fornecidos pelo usuário

const TOP_NAVBAR = {
  breadcrumbs: [
    { label: "leonardodptomktp's projects", is_dropdown: true },
    { label: "linosaas", is_dropdown: true }
  ],
  project_status_badge: { text: "Production", type: "success_pill" }
};

const PROJECT_OVERVIEW_HEADER = {
  deployment_domain: {
    url: "linosaas.vercel.app",
    redirect_icon: true,
    status: "Ready",
    time_ago: "2d ago"
  },
  action_buttons: [
    { text: "Instant Rollback", variant: "secondary_outline", disabled: false },
    { text: "Promote to Production", variant: "disabled_gray", disabled: true }
  ]
};

const OVERVIEW_DASHBOARD = {
  layout_grid: {
    left_column_usage: {
      title: "Usage",
      timeframe: "Last 30 days",
      action: "Upgrade",
      metrics: [
        { name: "Fluid Active CPU", used: "4m 28s", limit: "4h" },
        { name: "Fast Origin Transfer", used: "74,37 MB", limit: "10 GB" },
        { name: "Edge Requests", used: "4.3K", limit: "1M" },
        { name: "Fluid Provisioned Memory", used: "1.4 GB-Hrs", limit: "360 GB-Hrs" }
      ]
    },
    right_column_projects: {
      title: "Projects",
      cards: [
        {
          name: "linosaas",
          domain: "linosaas.vercel.app",
          git_repo: "leomartech-permetal/linos...",
          latest_commit: "feat: add 'Outros Contatos' tab and fix pipeline duplication bug",
          status: "Ready",
          time_meta: "Just now on main"
        }
      ]
    },
    bottom_row_alerts: {
      title: "Alerts",
      headline: "Get alerted for anomalies",
      subline: "Automatically monitor your projects for anomalies and get notified.",
      button: "Upgrade to Pro"
    }
  }
};

const DEPLOYMENTS_LIST = {
  filters: {
    date_range: "Select Date Range",
    automation_filter: "All Automations",
    environment_filter: "All Environments",
    repository_filter: "All Repositories",
    branch_filter: "All Branches",
    status_badge: { text: "Status 5/6", type: "dropdown_pill" }
  },
  table_rows: [
    {
      id: "4W6df5mW8",
      environment: "Production",
      status: "Error",
      duration_ago: "27s",
      project: "linosaas",
      branch: "main",
      commit: "9e70b37 feat: unify LeadD...",
      author_time: "46m ago by leomartech"
    },
    {
      id: "J95FBXEME",
      environment: "Production",
      status: "Ready",
      is_current: true,
      duration_ago: "44s",
      project: "linosaas",
      branch: "main",
      commit: "0873140 feat: add 'Outros ...",
      author_time: "59m ago by leomartech"
    }
  ]
};

const WEB_ANALYTICS = {
  hero_banner: {
    title: "Web Analytics",
    description: "Collect valuable insights on user behavior and site performance with detailed page view metrics.",
    cta_button: "Enable",
    link: "Limits & Pricing"
  },
  feature_carousel: [
    { title: "Real-time insights", desc: "Ensure smooth performance with real-time bandwidth analysis." },
    { title: "Deeper insights", desc: "Track whatever is relevant for your website with custom events." }
  ],
  chart_section: {
    tabs: ["Visitors", "Page Views", "Bounce Rate"],
    badge: "Demo Data",
    chart_type: "Area Spline Chart",
    y_axis_ticks: ["5K", "10K", "15K"]
  }
};

const SPEED_INSIGHTS = {
  top_links: {
    external_link: { text: "Learn more about RES", url: "#" }
  },
  layout_grid: {
    sidebar_metrics_stack: [
      { metric_name: "Cumulative Layout Shift (CLS)", has_bar_placeholder: true },
      { metric_name: "First Input Delay (FID)", has_bar_placeholder: true },
      { metric_name: "Time to First Byte (TTFB)", has_bar_placeholder: true }
    ],
    main_analytics_panel: {
      tabs: ["Routes", "Paths"],
      metric_header: "RES",
      performance_columns: [
        { status: "Poor", condition: "<50", color: "#E11D48", state: "No data available" },
        { status: "Needs Improvement", condition: "50 - 90", color: "#D97706", state: "No data available" },
        { status: "Great", condition: ">90", color: "#16A34A", state: "No data available" }
      ]
    },
    geography_panel: {
      title: "Countries",
      map_visualization: { type: "SVG World Map Minimalist Light Gray" },
      legend_sidebar: [
        { status: "Poor", range: "<50", color: "#E11D48" },
        { status: "Needs Improvement", range: "50 - 90", color: "#D97706" },
        { status: "Great", range: ">90", color: "#16A34A", state: "No data available" }
      ],
      footer_status: "No data points collected"
    }
  }
};

const WORKFLOWS_ONBOARDING = {
  layout_grid: {
    row_1_hero: {
      left_content: {
        title: "Get Started with Workflows",
        bullets: [
          "Replace hand-rolled queues and retries with durable, resumable code",
          "Sleep for seconds, hours, or days without using compute",
          "Automatic retries, state persistence, and observability built in"
        ],
        buttons: [
          { text: "Documentation", variant: "primary_black" },
          { text: "API Reference", variant: "secondary_outline" }
        ]
      },
      right_code_preview: {
        file_name: "workflow.ts",
        language: "typescript",
        has_copy_button: true,
        code_content: [
          'import { sleep } from "workflow";',
          "",
          "export async function handleUserSignup(email: string) {",
          '  "use workflow";',
          "",
          "  const user = await createUser(email);",
          "  await sendWelcomeEmail(user);",
          "",
          '  await sleep("5s");',
          "",
          "  await sendOnboardingEmail(user);",
          '  return { userId: user.id, status: "onboarded" };',
          "}"
        ]
      }
    },
    row_2_steps: [
      {
        step_title: "Install the Workflow SDK",
        description: "Add workflows to any Next.js, Vite, Astro, or Express app",
        terminal_command: "npm i workflow",
        has_copy_button: true
      },
      {
        step_title: "Create your first workflow",
        description: "Use the skill to set up your project with a workflow",
        terminal_command: "npx skills add vercel/workflow --skill workflow-init",
        has_copy_button: true
      }
    ]
  }
};

export default function SaaSLayout() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState("Visitors");
  const [speedSubTab, setSpeedSubTab] = useState("Routes");

  useEffect(() => {
    const hasDarkClass = document.documentElement.classList.contains("dark");
    setIsDarkMode(hasDarkClass);
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Mapeamento de abas para manter a rota amigável do JSON
  const tabs = [
    { label: "Overview", count: null },
    { label: "Deployments", count: null },
    { label: "Analytics", count: null },
    { label: "Speed Insights", count: null },
    { label: "Workflows", count: null },
    { label: "Project Settings", count: null }
  ];

  return (
    <div className="min-h-screen w-full bg-white dark:bg-black text-[#111111] dark:text-[#f5f5f7] font-sans antialiased selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-200">
      
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 h-14 border-b border-[#e5e5e5] dark:border-[#262626] bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 flex justify-between items-center transition-colors duration-200">
        <div className="flex items-center gap-3">
          {/* Vercel Logo */}
          <svg className="w-5 h-5 text-black dark:text-white" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-gray-300 dark:text-zinc-700">/</span>
          
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer transition-colors font-medium">
              {TOP_NAVBAR.breadcrumbs[0].label}
            </span>
            <span className="text-gray-300 dark:text-zinc-700">/</span>
            <span className="text-black dark:text-white font-semibold flex items-center gap-1 cursor-pointer">
              {TOP_NAVBAR.breadcrumbs[1].label}
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-gray-400" />
            </span>
          </div>

          <span className="ml-2 text-[10px] bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/60 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
            {TOP_NAVBAR.project_status_badge.text}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5">
            <button className="text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white px-2 py-1 rounded transition-colors">Feedback</button>
            <button className="text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white px-2 py-1 rounded transition-colors">Changelog</button>
            <button className="text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white px-2 py-1 rounded transition-colors">Help</button>
            <button className="text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white px-2 py-1 rounded transition-colors font-medium">Docs</button>
          </div>
          
          <div className="h-4 w-px bg-gray-200 dark:bg-zinc-800"></div>

          {/* Bell Notifications */}
          <button className="text-gray-400 hover:text-black dark:hover:text-white relative p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-900 transition-all">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full hidden"></span>
          </button>

          {/* Visual Inverter (Black/White) */}
          <button 
            onClick={toggleDarkMode}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 dark:border-zinc-800 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-600 dark:text-zinc-300 transition-all"
            title="Alternar Modo Black (Negativo)"
          >
            {isDarkMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Black</span>
              </>
            )}
          </button>

          {/* User Profile initials */}
          <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-zinc-300">
            LC
          </div>
        </div>
      </header>

      {/* 2. PROJECT OVERVIEW HEADER */}
      <section className="bg-white dark:bg-black transition-colors duration-200 pt-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-[10px]">
              ▲
            </div>
            <a 
              href={`https://${PROJECT_OVERVIEW_HEADER.deployment_domain.url}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm font-semibold hover:underline flex items-center gap-1 text-black dark:text-white"
            >
              {PROJECT_OVERVIEW_HEADER.deployment_domain.url}
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
              {PROJECT_OVERVIEW_HEADER.deployment_domain.status}
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              {PROJECT_OVERVIEW_HEADER.deployment_domain.time_ago}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-black dark:text-white">
              {PROJECT_OVERVIEW_HEADER.action_buttons[0].text}
            </button>
            <button 
              disabled={PROJECT_OVERVIEW_HEADER.action_buttons[1].disabled}
              className="px-3 py-1.5 text-xs font-semibold bg-[#fafafa] dark:bg-[#151515] border border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-600 rounded-md cursor-not-allowed"
            >
              {PROJECT_OVERVIEW_HEADER.action_buttons[1].text}
            </button>
            <button className="p-1.5 border border-gray-200 dark:border-zinc-800 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. MAIN HORIZONTAL TABS */}
        <div className="border-b border-[#e5e5e5] dark:border-[#262626]">
          <div className="max-w-6xl mx-auto px-6">
            <nav className="flex gap-6 -mb-px">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.label;
                return (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(tab.label)}
                    className={`py-3 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                      isActive 
                        ? "border-black dark:border-white text-black dark:text-white font-semibold" 
                        : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      {/* 4. DYNAMIC CONTENT AREA */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* ABA: OVERVIEW */}
        {activeTab === "Overview" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Grid 2 Colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              
              {/* Esquerda: Usage (40%) */}
              <div className="lg:col-span-4 border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-6 flex flex-col justify-between transition-colors duration-200">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-black dark:text-white">{OVERVIEW_DASHBOARD.layout_grid.left_column_usage.title}</h3>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium font-mono">{OVERVIEW_DASHBOARD.layout_grid.left_column_usage.timeframe}</p>
                    </div>
                    <button className="text-xs font-semibold border border-gray-200 dark:border-zinc-800 px-2.5 py-1 rounded bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-black dark:text-white">
                      {OVERVIEW_DASHBOARD.layout_grid.left_column_usage.action}
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    {OVERVIEW_DASHBOARD.layout_grid.left_column_usage.metrics.map((item, idx) => {
                      // Calcular porcentagem fictícia para renderização visual
                      const percentMap: Record<string, number> = {
                        "Fluid Active CPU": 15,
                        "Fast Origin Transfer": 8,
                        "Edge Requests": 1,
                        "Fluid Provisioned Memory": 12
                      };
                      const percentage = percentMap[item.name] || 10;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500 dark:text-zinc-400 font-medium">{item.name}</span>
                            <span className="font-mono text-gray-900 dark:text-zinc-200">{item.used} / {item.limit}</span>
                          </div>
                          <div className="h-1 w-full bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100 dark:border-zinc-900 mt-6 flex justify-between text-[11px] text-gray-400 dark:text-zinc-500 font-mono">
                  <span>Billing cycle resets in 12 days</span>
                  <a href="#" className="hover:underline flex items-center gap-0.5 text-black dark:text-white">
                    View Invoice <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Direita: Projects (60%) */}
              <div className="lg:col-span-6 space-y-4">
                {OVERVIEW_DASHBOARD.layout_grid.right_column_projects.cards.map((project, idx) => (
                  <div 
                    key={idx}
                    className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-6 hover:border-black dark:hover:border-white transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-[9px] rounded">
                            ▲
                          </div>
                          <span className="font-bold text-base text-black dark:text-white">{project.name}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{project.domain}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono border border-gray-200 dark:border-zinc-800 px-2 py-0.5 rounded bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-zinc-400">
                          {project.git_repo}
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" title="Ready"></span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-zinc-900 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-gray-500 dark:text-zinc-400">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <GitBranch className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                        <span className="font-mono text-[10px] bg-gray-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-gray-600 dark:text-zinc-400">main</span>
                        <span className="truncate italic text-[11px] font-medium text-gray-700 dark:text-zinc-300">&quot;{project.latest_commit}&quot;</span>
                      </div>
                      <span className="text-[10px] font-mono whitespace-nowrap text-gray-400">{project.time_meta}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom Row: Alerts */}
            <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-8 text-center space-y-4 transition-colors duration-200">
              <div className="mx-auto w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-gray-100 dark:border-zinc-800">
                <CheckCircle2 className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-black dark:text-white">
                  {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.headline}
                </h4>
                <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-md mx-auto">
                  {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.subline}
                </p>
              </div>
              <button className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.button}
              </button>
            </div>
          </div>
        )}

        {/* ABA: DEPLOYMENTS */}
        {activeTab === "Deployments" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filters Bar */}
            <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-200">
              <div className="flex flex-wrap items-center gap-2">
                <select className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-black dark:text-white">
                  <option>{DEPLOYMENTS_LIST.filters.date_range}</option>
                </select>
                <select className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-black dark:text-white">
                  <option>{DEPLOYMENTS_LIST.filters.automation_filter}</option>
                </select>
                <select className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-black dark:text-white">
                  <option>{DEPLOYMENTS_LIST.filters.environment_filter}</option>
                </select>
                <select className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-black dark:text-white">
                  <option>{DEPLOYMENTS_LIST.filters.repository_filter}</option>
                </select>
                <select className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-black dark:text-white">
                  <option>{DEPLOYMENTS_LIST.filters.branch_filter}</option>
                </select>
              </div>
              
              <div>
                <span className="text-[11px] font-mono font-bold text-gray-800 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 px-2.5 py-1 rounded">
                  {DEPLOYMENTS_LIST.filters.status_badge.text}
                </span>
              </div>
            </div>

            {/* List Feed */}
            <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black overflow-hidden transition-colors duration-200">
              <div className="divide-y divide-gray-100 dark:divide-zinc-900">
                {DEPLOYMENTS_LIST.table_rows.map((row) => (
                  <div key={row.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-950 transition-colors duration-150">
                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                      {/* Status badge */}
                      <div className="w-16 flex-shrink-0">
                        {row.status === "Ready" ? (
                          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-900/60 uppercase tracking-wider">
                            Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60 uppercase tracking-wider">
                            Error
                          </span>
                        )}
                      </div>

                      {/* Commit & Branch Telemetry */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-black dark:text-white hover:underline cursor-pointer">{row.commit}</span>
                          {row.is_current && (
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Current
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
                          <GitBranch className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500 dark:text-zinc-400 font-semibold">{row.branch}</span>
                          <span>•</span>
                          <span>{row.id}</span>
                          <span>•</span>
                          <span>{row.author_time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry info */}
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-400 dark:text-zinc-500">
                      <span>{row.duration_ago}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-zinc-700" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA: ANALYTICS */}
        {activeTab === "Analytics" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero banner */}
            <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors duration-200">
              <div className="space-y-2 max-w-xl">
                <h2 className="text-xl font-bold text-black dark:text-white">{WEB_ANALYTICS.hero_banner.title}</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                  {WEB_ANALYTICS.hero_banner.description}
                </p>
              </div>
              
              <div className="flex items-center gap-4 flex-shrink-0">
                <a href="#" className="text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white font-medium hover:underline flex items-center gap-0.5">
                  {WEB_ANALYTICS.hero_banner.link} <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <button className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                  {WEB_ANALYTICS.hero_banner.cta_button}
                </button>
              </div>
            </div>

            {/* Feature lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WEB_ANALYTICS.feature_carousel.map((feat, idx) => (
                <div key={idx} className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-[#fafafa] dark:bg-[#0c0c0c] p-6 space-y-2 transition-colors duration-200">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400 dark:text-zinc-500">{feat.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>

            {/* Monochromatic interactive Chart */}
            <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black overflow-hidden transition-colors duration-200">
              <div className="border-b border-gray-100 dark:border-zinc-900 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  {WEB_ANALYTICS.chart_section.tabs.map((tab) => {
                    const isTabActive = analyticsTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setAnalyticsTab(tab)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          isTabActive 
                            ? "bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white" 
                            : "text-gray-500 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 font-mono uppercase tracking-wider">
                  {WEB_ANALYTICS.chart_section.badge}
                </span>
              </div>

              {/* Graphic container */}
              <div className="p-6">
                <div className="relative h-60 w-full flex items-end">
                  {/* Y Axis markings */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-gray-400 dark:text-zinc-500 font-mono pr-4 border-r border-[#e5e5e5] dark:border-[#262626] py-1 bg-white dark:bg-black z-10">
                    {WEB_ANALYTICS.chart_section.y_axis_ticks.slice().reverse().map(tick => (
                      <span key={tick}>{tick}</span>
                    ))}
                    <span>0</span>
                  </div>

                  {/* SVG spline chart */}
                  <div className="flex-1 h-full pl-12 relative">
                    <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                      <div className="border-b border-gray-100 dark:border-zinc-900 w-full"></div>
                      <div className="border-b border-gray-100 dark:border-zinc-900 w-full"></div>
                      <div className="border-b border-gray-100 dark:border-zinc-900 w-full"></div>
                      <div className="border-b border-gray-100 dark:border-zinc-900 w-full"></div>
                    </div>

                    <svg className="w-full h-full text-black dark:text-white" viewBox="0 0 600 240" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path 
                        d="M0 240 C 60 180, 100 220, 150 120 C 200 40, 250 160, 300 80 C 350 40, 400 180, 450 100 C 500 40, 550 20, 600 0 L 600 240 Z" 
                        fill="url(#chartGrad)" 
                      />
                      <path 
                        d="M0 240 C 60 180, 100 220, 150 120 C 200 40, 250 160, 300 80 C 350 40, 400 180, 450 100 C 500 40, 550 20, 600 0" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                      />
                    </svg>
                  </div>
                </div>

                {/* X Axis markings */}
                <div className="pl-12 flex justify-between text-[10px] text-gray-400 dark:text-zinc-500 font-mono mt-4">
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

        {/* ABA: SPEED INSIGHTS */}
        {activeTab === "Speed Insights" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top link */}
            <div className="flex justify-end">
              <a href={SPEED_INSIGHTS.top_links.external_link.url} className="text-xs text-gray-500 hover:text-black dark:hover:text-white font-medium hover:underline flex items-center gap-1">
                {SPEED_INSIGHTS.top_links.external_link.text} <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              
              {/* Sidebar Metrics stack (30%) */}
              <div className="lg:col-span-3 space-y-4">
                {SPEED_INSIGHTS.layout_grid.sidebar_metrics_stack.map((item, idx) => (
                  <div key={idx} className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-4 space-y-3 transition-colors duration-200">
                    <h4 className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 tracking-wide">{item.metric_name}</h4>
                    <div className="h-2 w-full bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      {/* Bar Placeholder */}
                      <div className="h-full bg-zinc-300 dark:bg-zinc-700 w-1/3 rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>Good</span>
                      <span>No Data</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Panel (70%) */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* Main Analytics Panel */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black overflow-hidden transition-colors duration-200">
                  <div className="border-b border-gray-100 dark:border-zinc-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      {SPEED_INSIGHTS.layout_grid.main_analytics_panel.tabs.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSpeedSubTab(tab)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            speedSubTab === tab 
                              ? "bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white" 
                              : "text-gray-500 hover:text-black dark:hover:text-white"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-black dark:text-white uppercase font-mono">
                      {SPEED_INSIGHTS.layout_grid.main_analytics_panel.metric_header}
                    </span>
                  </div>

                  {/* Performance columns status */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SPEED_INSIGHTS.layout_grid.main_analytics_panel.performance_columns.map((col, idx) => (
                      <div key={idx} className="border border-gray-100 dark:border-zinc-900 rounded-lg p-4 space-y-2 text-center bg-[#fafafa] dark:bg-[#0c0c0c]">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }}></span>
                          <span className="text-xs font-bold text-black dark:text-white">{col.status}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">{col.condition}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 italic pt-2">{col.state}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geography Map Panel */}
                <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-6 space-y-6 transition-colors duration-200">
                  <h3 className="text-sm font-semibold text-black dark:text-white">{SPEED_INSIGHTS.layout_grid.geography_panel.title}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
                    {/* SVG map minimal (60%) */}
                    <div className="md:col-span-6 h-40 flex items-center justify-center border border-gray-100 dark:border-zinc-900 rounded-lg p-4">
                      <svg className="w-full h-full opacity-60 text-gray-300 dark:text-zinc-800" viewBox="0 0 400 200" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M 50,70 Q 70,50 100,70 T 150,80 T 120,120 T 70,110 Z" fill="currentColor" fillOpacity="0.2" />
                        <path d="M 180,60 Q 220,50 260,70 T 280,100 T 230,130 T 190,100 Z" fill="currentColor" fillOpacity="0.2" />
                        <path d="M 300,80 Q 320,60 350,80 T 360,110 T 310,120 Z" fill="currentColor" fillOpacity="0.2" />
                        <path d="M 120,140 Q 140,130 160,150 T 150,180 T 110,170 Z" fill="currentColor" fillOpacity="0.2" />
                      </svg>
                    </div>

                    {/* Map Legend (40%) */}
                    <div className="md:col-span-4 space-y-3 flex flex-col justify-center">
                      {SPEED_INSIGHTS.layout_grid.geography_panel.legend_sidebar.map((leg, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: leg.color }}></span>
                            <span className="text-gray-500 dark:text-zinc-400 font-medium">{leg.status}</span>
                          </div>
                          <span className="font-mono text-gray-400 dark:text-zinc-500">{leg.range}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-zinc-900 text-center text-xs text-gray-400 dark:text-zinc-500 italic">
                    {SPEED_INSIGHTS.layout_grid.geography_panel.footer_status}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ABA: WORKFLOWS */}
        {activeTab === "Workflows" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Row 1 Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Content */}
              <div className="space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-mono bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded">
                    Workflow Platform
                  </span>
                  <h2 className="text-2xl font-bold text-black dark:text-white leading-tight">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.title}
                  </h2>
                  <ul className="space-y-3">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                        <span className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full mt-1.5 flex-shrink-0"></span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 rounded-md text-xs hover:opacity-90 transition-opacity">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.buttons[0].text}
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black text-black dark:text-white font-semibold px-4 py-2 rounded-md text-xs hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.buttons[1].text}
                  </button>
                </div>
              </div>

              {/* Right Code Preview */}
              <div className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-zinc-950 text-zinc-100 overflow-hidden font-mono text-[11px] h-80 flex flex-col">
                <div className="border-b border-zinc-800 px-4 py-2.5 bg-zinc-900 flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">{WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.right_code_preview.file_name}</span>
                  <button 
                    onClick={() => handleCopy(WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.right_code_preview.code_content.join("\n"), "code")}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                    title="Copiar Código"
                  >
                    {copiedText === "code" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto leading-relaxed text-zinc-300">
                  {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.right_code_preview.code_content.map((line, idx) => (
                    <div key={idx} className="min-h-[16px] whitespace-pre">
                      <span className="text-zinc-600 inline-block w-6 select-none">{idx + 1}</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Row 2 Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {WORKFLOWS_ONBOARDING.layout_grid.row_2_steps.map((step, idx) => (
                <div key={idx} className="border border-[#e5e5e5] dark:border-[#262626] rounded-lg bg-white dark:bg-black p-6 space-y-4 flex flex-col justify-between transition-colors duration-200">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 font-mono tracking-widest uppercase">Step {idx + 1}</span>
                    <h4 className="font-bold text-sm text-black dark:text-white">{step.step_title}</h4>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{step.description}</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-zinc-950 p-3 rounded border border-gray-200 dark:border-zinc-800 font-mono text-[11px] flex justify-between items-center text-black dark:text-white">
                    <span className="select-all">{step.terminal_command}</span>
                    <button 
                      onClick={() => handleCopy(step.terminal_command, `step-${idx}`)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors text-gray-400 hover:text-black dark:hover:text-white"
                      title="Copiar Comando"
                    >
                      {copiedText === `step-${idx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ABA: PROJECT SETTINGS (FALLBACK) */}
        {activeTab === "Project Settings" && (
          <div className="max-w-md mx-auto py-16 text-center space-y-4 animate-fadeIn">
            <div className="mx-auto w-12 h-12 bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full flex items-center justify-center text-gray-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-black dark:text-white">Configurações do Projeto</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                As configurações detalhadas de deploys, variáveis de ambiente, domínios e tokens estão disponíveis nas telas correspondentes do menu principal.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab("Overview")}
              className="bg-black dark:bg-white text-white dark:text-black font-semibold text-xs px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              Voltar ao Overview
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
