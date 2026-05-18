/* global React, ReactDOM, AOSWidgets, AOSShell, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Main App entry
// ============================================================
const { useState, useEffect, useRef, useCallback } = React;
const { Menubar, Sidebar, ProcessStrip, CmdPalette } = window.AOSShell;
const { AGENTS } = window.AGENT_OS_DATA;

const PLACEHOLDER_PAGES = {
  supervisor: 'Supervisor (Chat)',
  graph:      'Görev Grafiği (DAG)',
  office:     'Agent Office',
  approvals:  'Onaylar',
  tools:      'Araçlar',
  audit:      'Audit Log',
  brand:      'Marka',
  pricing:    'Fiyat & Finans',
  growth:     'Büyüme',
  onboarding: 'Onboarding',
};

const PlaceholderPage = ({ name }) => (
  <div className="page">
    <div className="page__breadcrumb mono">HOME <span>›</span> {name.toUpperCase()}</div>
    <div className="page__header">
      <div>
        <h1 className="page__title">
          {name}
          <span className="page__title-tag">YAPIM AŞAMASINDA</span>
        </h1>
        <p className="page__sub">Bu ekran çok yakında — şu an dashboard üzerinde çalışıyoruz.</p>
      </div>
    </div>
    <div className="panel">
      <div className="panel__body">
        <pre className="term" style={{ margin: 0 }}>
{`╭─ agent.os ────────────────────────────╮
│ ${name.padEnd(38)}│
│ status: scaffold                      │
│ next: build interactions              │
╰───────────────────────────────────────╯`}
        </pre>
      </div>
    </div>
  </div>
);

const App = () => {
  const [route, setRoute] = useState('dashboard');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navigate = useCallback((id, params) => {
    setRoute(id);
  }, []);

  const runningCount = AGENTS.filter(a => a.status === 'running').length;
  const busyCount = AGENTS.filter(a => a.status === 'busy').length;

  // Page render
  const Page = window.AOSPages?.[
    route === 'dashboard' ? 'Dashboard' :
    route === 'supervisor' ? 'Supervisor' :
    route === 'graph' ? 'Graph' :
    route === 'office' ? 'Office' :
    route === 'approvals' ? 'Approvals' :
    route === 'tools' ? 'Tools' :
    route === 'audit' ? 'Audit' :
    route === 'brand' ? 'Brand' :
    route === 'pricing' ? 'Pricing' :
    route === 'growth' ? 'Growth' :
    route === 'onboarding' ? 'Onboarding' :
    'Dashboard'
  ];

  return (
    <div className="app-root">
      <Menubar
        sysClock={clock}
        runningCount={runningCount}
        busyCount={busyCount}
        budgetBurn="$0.42/h"
        confidence="0.89"
        onCmd={() => setCmdOpen(true)}
      />
      <div className="app-frame">
        <Sidebar active={route} onNavigate={navigate} />
        <main className="main" key={route}>
          {Page ? <Page navigate={navigate} /> : <PlaceholderPage name={PLACEHOLDER_PAGES[route] || route} />}
        </main>
      </div>
      <ProcessStrip agents={AGENTS} />
      <CmdPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={navigate} />
      {window.AOSTweaks && <window.AOSTweaks />}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
