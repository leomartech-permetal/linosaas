"use client";

import { useState } from "react";
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
        { status: "Poor", condition: "<50", color: "#E5484D", state: "No data available" },
        { status: "Needs Improvement", condition: "50 - 90", color: "#F5A623", state: "No data available" },
        { status: "Great", condition: ">90", color: "#10B981", state: "No data available" }
      ]
    },
    geography_panel: {
      title: "Countries",
      map_visualization: { type: "SVG World Map Minimalist Light Gray" },
      legend_sidebar: [
        { status: "Poor", range: "<50", color: "#E5484D" },
        { status: "Needs Improvement", range: "50 - 90", color: "#F5A623" },
        { status: "Great", range: ">90", color: "#10B981", state: "No data available" }
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
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState("Visitors");
  const [speedSubTab, setSpeedSubTab] = useState("Routes");

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const tabs = [
    { label: "Overview", count: null },
    { label: "Deployments", count: null },
    { label: "Analytics", count: null },
    { label: "Speed Insights", count: null },
    { label: "Workflows", count: null },
    { label: "Project Settings", count: null }
  ];

  return (
    <div className="w-full min-h-full bg-white text-[var(--text-primary)] font-sans antialiased selection:bg-black selection:text-white">
      
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 h-14 border-b border-[var(--border)] bg-white/80 backdrop-blur-md px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--text-primary)]" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-[var(--border-strong)]">/</span>
          
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors font-medium">
              {TOP_NAVBAR.breadcrumbs[0].label}
            </span>
            <span className="text-[var(--border-strong)]">/</span>
            <span className="text-[var(--text-primary)] font-semibold flex items-center gap-1 cursor-pointer">
              {TOP_NAVBAR.breadcrumbs[1].label}
              <ChevronRight className="w-3 h-3 rotate-90 text-[var(--text-soft)]" />
            </span>
          </div>

          <span className="ml-2 text-[10px] bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-strong)] px-2 py-0.5 rounded font-mono font-medium tracking-wider">
            {TOP_NAVBAR.project_status_badge.text}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1">
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded transition-colors cursor-pointer">Feedback</button>
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded transition-colors cursor-pointer">Changelog</button>
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded transition-colors cursor-pointer">Help</button>
            <button className="text-xs text-[var(--text-primary)] px-2 py-1 rounded font-semibold cursor-pointer">Docs</button>
          </div>
          
          <div className="h-4 w-px bg-[var(--border)]"></div>

          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded hover:bg-[var(--surface-muted)] transition-all cursor-pointer">
            <Bell className="w-4 h-4" />
          </button>

          <div className="w-6 h-6 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
            LC
          </div>
        </div>
      </header>

      {/* 2. PROJECT OVERVIEW HEADER */}
      <section className="bg-white border-b border-[var(--border)] pt-8">
        <div className="max-w-[1128px] mx-auto px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-black flex items-center justify-center text-white font-black text-[9px]">
              ▲
            </div>
            <a 
              href={`https://${PROJECT_OVERVIEW_HEADER.deployment_domain.url}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm font-semibold hover:underline flex items-center gap-1 text-[var(--text-primary)]"
            >
              {PROJECT_OVERVIEW_HEADER.deployment_domain.url}
              <ExternalLink className="w-3 h-3 text-[var(--text-soft)]" />
            </a>
            
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              {PROJECT_OVERVIEW_HEADER.deployment_domain.status}
            </span>
            <span className="text-xs text-[var(--text-soft)]">
              {PROJECT_OVERVIEW_HEADER.deployment_domain.time_ago}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="h-9 px-3 text-xs font-semibold bg-white border border-[var(--border-strong)] rounded-md hover:bg-[var(--surface-muted)] transition-colors text-[var(--text-primary)] cursor-pointer">
              {PROJECT_OVERVIEW_HEADER.action_buttons[0].text}
            </button>
            <button 
              disabled={PROJECT_OVERVIEW_HEADER.action_buttons[1].disabled}
              className="h-9 px-3 text-xs font-semibold bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-soft)] rounded-md cursor-not-allowed"
            >
              {PROJECT_OVERVIEW_HEADER.action_buttons[1].text}
            </button>
            <button className="p-2 border border-[var(--border-strong)] rounded-md hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. MAIN HORIZONTAL TABS */}
        <div>
          <div className="max-w-[1128px] mx-auto px-8">
            <nav className="flex gap-6 -mb-px">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.label;
                return (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(tab.label)}
                    className={`py-3 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                      isActive 
                        ? "border-black text-[var(--text-primary)] font-semibold" 
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
      <main className="max-w-[1128px] mx-auto px-8 py-10">
        
        {/* ABA: OVERVIEW */}
        {activeTab === "Overview" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Grid 2 Colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              
              {/* Esquerda: Usage (40%) */}
              <div className="lg:col-span-4 border border-[var(--border)] rounded bg-white p-6 flex flex-col justify-between transition-colors duration-200">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{OVERVIEW_DASHBOARD.layout_grid.left_column_usage.title}</h3>
                      <p className="text-[10px] text-[var(--text-soft)] font-medium font-mono uppercase tracking-wider">{OVERVIEW_DASHBOARD.layout_grid.left_column_usage.timeframe}</p>
                    </div>
                    <button className="text-xs font-semibold border border-[var(--border-strong)] px-2.5 py-1 rounded bg-white hover:bg-[var(--surface-muted)] transition-colors text-[var(--text-primary)] cursor-pointer">
                      {OVERVIEW_DASHBOARD.layout_grid.left_column_usage.action}
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    {OVERVIEW_DASHBOARD.layout_grid.left_column_usage.metrics.map((item, idx) => {
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
                            <span className="text-[var(--text-secondary)] font-medium">{item.name}</span>
                            <span className="font-mono text-[var(--text-primary)]">{item.used} / {item.limit}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--surface-muted)] rounded-full overflow-hidden">
                            <div className="h-full bg-black rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="pt-6 border-t border-[var(--border)] mt-6 flex justify-between text-[10px] text-[var(--text-soft)] font-mono uppercase tracking-wider">
                  <span>Resets in 12 days</span>
                  <a href="#" className="hover:underline flex items-center gap-0.5 text-[var(--text-primary)]">
                    View Invoice <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Direita: Projects (60%) */}
              <div className="lg:col-span-6 space-y-4">
                {OVERVIEW_DASHBOARD.layout_grid.right_column_projects.cards.map((project, idx) => (
                  <div 
                    key={idx}
                    className="border border-[var(--border)] rounded bg-white p-6 hover:border-[var(--text-primary)] transition-all duration-150 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-black flex items-center justify-center text-white font-black text-[9px] rounded">
                            ▲
                          </div>
                          <span className="font-bold text-base text-[var(--text-primary)]">{project.name}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] font-mono">{project.domain}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono border border-[var(--border)] px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                          {project.git_repo}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ready"></span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border)] mt-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <GitBranch className="w-3.5 h-3.5 text-[var(--text-soft)] flex-shrink-0" />
                        <span className="font-mono text-[10px] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">main</span>
                        <span className="truncate italic text-[11px] font-medium text-[var(--text-primary)]">&quot;{project.latest_commit}&quot;</span>
                      </div>
                      <span className="text-[10px] font-mono whitespace-nowrap text-[var(--text-soft)]">{project.time_meta}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom Row: Alerts */}
            <div className="border border-[var(--border)] rounded bg-white p-8 text-center space-y-4">
              <div className="mx-auto w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center border border-[var(--border)]">
                <CheckCircle2 className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.headline}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.subline}
                </p>
              </div>
              <button className="button-primary text-xs cursor-pointer">
                {OVERVIEW_DASHBOARD.layout_grid.bottom_row_alerts.button}
              </button>
            </div>
          </div>
        )}

        {/* ABA: DEPLOYMENTS */}
        {activeTab === "Deployments" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filters Bar */}
            <div className="border border-[var(--border)] rounded bg-white p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <select className="bg-white border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-[var(--text-primary)]">
                  <option>{DEPLOYMENTS_LIST.filters.date_range}</option>
                </select>
                <select className="bg-white border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-[var(--text-primary)]">
                  <option>{DEPLOYMENTS_LIST.filters.automation_filter}</option>
                </select>
                <select className="bg-white border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-[var(--text-primary)]">
                  <option>{DEPLOYMENTS_LIST.filters.environment_filter}</option>
                </select>
                <select className="bg-white border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-[var(--text-primary)]">
                  <option>{DEPLOYMENTS_LIST.filters.repository_filter}</option>
                </select>
                <select className="bg-white border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-medium text-[var(--text-primary)]">
                  <option>{DEPLOYMENTS_LIST.filters.branch_filter}</option>
                </select>
              </div>
              
              <div>
                <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] border border-[var(--border)] px-2.5 py-1 rounded">
                  {DEPLOYMENTS_LIST.filters.status_badge.text}
                </span>
              </div>
            </div>

            {/* List Feed */}
            <div className="border border-[var(--border)] rounded bg-white overflow-hidden">
              <div className="divide-y divide-[var(--border)]">
                {DEPLOYMENTS_LIST.table_rows.map((row) => (
                  <div key={row.id} className="p-4 flex items-center justify-between hover:bg-[var(--surface-muted)] transition-colors duration-100">
                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                      <div className="w-16 flex-shrink-0">
                        {row.status === "Ready" ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider font-mono">
                            Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider font-mono">
                            Error
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-[var(--text-primary)] hover:underline cursor-pointer">{row.commit}</span>
                          {row.is_current && (
                            <span className="text-[9px] font-bold text-[var(--link)] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Current
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-soft)] font-mono">
                          <GitBranch className="w-3 h-3 text-[var(--text-soft)]" />
                          <span className="text-[var(--text-secondary)] font-semibold">{row.branch}</span>
                          <span>•</span>
                          <span>{row.id}</span>
                          <span>•</span>
                          <span>{row.author_time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-soft)]">
                      <span>{row.duration_ago}</span>
                      <ChevronRight className="w-4 h-4 text-[var(--border-strong)]" />
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
            <div className="border border-[var(--border)] rounded bg-white p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-xl">
                <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)]">{WEB_ANALYTICS.hero_banner.title}</h1>
                <p className="description">
                  {WEB_ANALYTICS.hero_banner.description}
                </p>
              </div>
              
              <div className="flex items-center gap-4 flex-shrink-0">
                <a href="#" className="link hover:underline flex items-center gap-0.5 text-xs font-semibold">
                  {WEB_ANALYTICS.hero_banner.link} <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <button className="button-primary text-xs cursor-pointer">
                  {WEB_ANALYTICS.hero_banner.cta_button}
                </button>
              </div>
            </div>

            {/* Feature lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WEB_ANALYTICS.feature_carousel.map((feat, idx) => (
                <div key={idx} className="card p-6 bg-[var(--surface-muted)]">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--text-soft)] mb-2">{feat.title}</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>

            {/* Gráfico minimalista de alto contraste */}
            <div className="chart-card">
              <div className="chart-tabs">
                {WEB_ANALYTICS.chart_section.tabs.map((tab) => {
                  const isTabActive = analyticsTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setAnalyticsTab(tab)}
                      className={`chart-tab ${isTabActive ? "active" : ""}`}
                    >
                      <span className="text-[10px] text-[var(--text-soft)] uppercase tracking-wider">
                        {tab === "Visitors" ? "Unique Visitors" : tab === "Page Views" ? "Total Page Views" : "Average Bounce Rate"}
                      </span>
                      <span className="text-[24px] font-bold text-[var(--text-primary)] tracking-tight">
                        {tab === "Visitors" ? "14,230" : tab === "Page Views" ? "38,591" : "42.1%"}
                      </span>
                    </button>
                  );
                })}
                <div className="flex items-center justify-end px-6 border-r-0">
                  <span className="text-[10px] font-bold text-[var(--text-soft)] font-mono uppercase tracking-wider bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 rounded">
                    {WEB_ANALYTICS.chart_section.badge}
                  </span>
                </div>
              </div>

              {/* Área útil do gráfico */}
              <div className="chart-area bg-white relative flex flex-col justify-between">
                <div className="relative flex-1 w-full flex items-end">
                  {/* Marcadores Y */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[11px] text-[var(--text-soft)] font-mono pr-4 border-r border-[var(--border)] py-1 bg-white z-10">
                    {WEB_ANALYTICS.chart_section.y_axis_ticks.slice().reverse().map(tick => (
                      <span key={tick}>{tick}</span>
                    ))}
                    <span>0</span>
                  </div>

                  {/* SVG minimalista sem gradientes fortes, focado em linhas cinzas */}
                  <div className="flex-1 h-full pl-16 relative">
                    <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                      <div className="border-b border-[var(--chart-grid)] w-full"></div>
                      <div className="border-b border-[var(--chart-grid)] w-full"></div>
                      <div className="border-b border-[var(--chart-grid)] w-full"></div>
                      <div className="border-b border-[var(--chart-grid)] w-full"></div>
                    </div>

                    <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                      <path 
                        d="M0 200 C 60 150, 120 180, 180 100 C 240 30, 300 130, 360 60 C 420 30, 480 150, 540 80 C 570 40, 590 20, 600 0" 
                        fill="none" 
                        stroke="var(--chart-line)" 
                        strokeWidth="2" 
                      />
                    </svg>
                  </div>
                </div>

                {/* Marcadores X */}
                <div className="pl-16 flex justify-between text-[11px] text-[var(--text-soft)] font-mono mt-4 pt-2 border-t border-[var(--border)]">
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
              <a href={SPEED_INSIGHTS.top_links.external_link.url} className="link flex items-center gap-1 text-xs font-semibold">
                {SPEED_INSIGHTS.top_links.external_link.text} <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              
              {/* Sidebar Metrics stack (30%) */}
              <div className="lg:col-span-3 space-y-4">
                {SPEED_INSIGHTS.layout_grid.sidebar_metrics_stack.map((item, idx) => (
                  <div key={idx} className="card p-4 space-y-3">
                    <h4 className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wide uppercase">{item.metric_name}</h4>
                    <div className="h-1.5 w-full bg-[var(--surface-muted)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--border-strong)] w-1/3 rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-soft)] font-mono">
                      <span>Good</span>
                      <span>No Data</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Panel (70%) */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* Main Analytics Panel */}
                <div className="chart-card">
                  <div className="border-b border-[var(--border)] px-6 py-4 flex justify-between items-center bg-[var(--surface-muted)]">
                    <div className="flex items-center gap-1.5">
                      {SPEED_INSIGHTS.layout_grid.main_analytics_panel.tabs.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSpeedSubTab(tab)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                            speedSubTab === tab 
                              ? "bg-white text-[var(--text-primary)] border border-[var(--border)]" 
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase font-mono">
                      {SPEED_INSIGHTS.layout_grid.main_analytics_panel.metric_header}
                    </span>
                  </div>

                  {/* Performance columns status */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                    {SPEED_INSIGHTS.layout_grid.main_analytics_panel.performance_columns.map((col, idx) => (
                      <div key={idx} className="border border-[var(--border)] rounded p-4 space-y-2 text-center bg-[var(--surface-muted)]">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }}></span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">{col.status}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-soft)] font-mono">{col.condition}</p>
                        <p className="text-xs text-[var(--text-muted)] italic pt-2">{col.state}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geography Map Panel */}
                <div className="card p-6 space-y-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{SPEED_INSIGHTS.layout_grid.geography_panel.title}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
                    {/* SVG map minimal */}
                    <div className="md:col-span-6 h-40 flex items-center justify-center border border-[var(--border)] rounded p-4 bg-[var(--surface-muted)]">
                      <svg className="w-full h-full opacity-40 text-[var(--border-strong)]" viewBox="0 0 400 200" fill="none" stroke="currentColor" strokeWidth="1">
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
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: leg.color }}></span>
                            <span className="text-[var(--text-secondary)] font-medium">{leg.status}</span>
                          </div>
                          <span className="font-mono text-[var(--text-soft)]">{leg.range}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-soft)] italic">
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
                  <span className="text-[10px] font-bold text-[var(--text-soft)] uppercase tracking-widest font-mono bg-[var(--surface-muted)] border border-[var(--border)] px-2.5 py-1 rounded">
                    Workflow Platform
                  </span>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.title}
                  </h2>
                  <ul className="space-y-3">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                        <span className="w-1 h-1 bg-black rounded-full mt-2 flex-shrink-0"></span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button className="button-primary text-xs cursor-pointer">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.buttons[0].text}
                  </button>
                  <button className="border border-[var(--border-strong)] bg-white text-[var(--text-primary)] font-semibold px-4 py-2 rounded-md text-xs hover:bg-[var(--surface-muted)] transition-all cursor-pointer">
                    {WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.left_content.buttons[1].text}
                  </button>
                </div>
              </div>

              {/* Right Code Preview */}
              <div className="border border-[var(--border)] rounded bg-zinc-950 text-zinc-100 overflow-hidden font-mono text-[11px] h-80 flex flex-col">
                <div className="border-b border-zinc-800 px-4 py-2.5 bg-zinc-900 flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">{WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.right_code_preview.file_name}</span>
                  <button 
                    onClick={() => handleCopy(WORKFLOWS_ONBOARDING.layout_grid.row_1_hero.right_code_preview.code_content.join("\n"), "code")}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
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
                <div key={idx} className="card p-6 justify-between min-h-[160px]">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--text-soft)] font-mono tracking-widest uppercase">Step {idx + 1}</span>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{step.step_title}</h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{step.description}</p>
                  </div>

                  <div className="bg-[var(--surface-muted)] p-3 rounded border border-[var(--border)] font-mono text-[11px] flex justify-between items-center text-[var(--text-primary)] mt-4">
                    <span className="select-all">{step.terminal_command}</span>
                    <button 
                      onClick={() => handleCopy(step.terminal_command, `step-${idx}`)}
                      className="p-1 hover:bg-[#eaeaea] rounded transition-colors text-[var(--text-soft)] hover:text-[var(--text-primary)] cursor-pointer"
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
            <div className="mx-auto w-12 h-12 bg-white border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-soft)]">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Configurações do Projeto</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                As configurações detalhadas de deploys, variáveis de ambiente, domínios e tokens estão disponíveis nas telas correspondentes do menu principal.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab("Overview")}
              className="button-primary text-xs cursor-pointer"
            >
              Voltar ao Overview
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
