import { useStore } from '@/stores/useStore';
import { selectPendingApprovalCount, selectLiveToolCount, selectMockToolCount, selectFailedTaskCount } from '@/stores/selectors';
import {
  LayoutDashboard, Users, ListTodo, CheckCircle, Wrench,
  BookOpen, BarChart3, MessageSquare, Plug, Settings,
  ChevronLeft, FileText, Menu, Rocket, Star, Mic2, Palette, Mail, DollarSign, RotateCcw, Brain, Calendar
} from 'lucide-react';

type NavItem = { id: string; label: string; icon: any };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'GENEL',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'ÜRÜN OS',
    items: [
      { id: 'brand', label: 'Marka', icon: Palette },
      { id: 'pricing', label: 'Fiyat & Finans', icon: DollarSign },
      { id: 'email_flows', label: 'E-posta Akışları', icon: Mail },
    ],
  },
  {
    label: 'BÜYÜME',
    items: [
      { id: 'growth', label: 'Büyüme', icon: Rocket },
      { id: 'reviews', label: 'Yorumlar', icon: Star },
      { id: 'influencers', label: 'Influencers', icon: Mic2 },
    ],
  },
  {
    label: 'OTONOMİ KATMANI',
    items: [
      { id: 'autonomy', label: 'Otonom Karar & Müzakere', icon: Brain },
    ],
  },
  {
    label: 'AJAN ALTYAPISI',
    items: [
      { id: 'agents', label: 'Agent Office', icon: Users },
      { id: 'tasks', label: 'Görevler', icon: ListTodo },
      { id: 'approvals', label: 'Onaylar', icon: CheckCircle },
      { id: 'scheduler', label: 'Zamanlayıcı', icon: Calendar },
      { id: 'tools', label: 'Araçlar', icon: Wrench },
      { id: 'knowledge', label: 'Bilgi', icon: BookOpen },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'analytics', label: 'Analitik', icon: BarChart3 },
      { id: 'integrations', label: 'Entegrasyonlar', icon: Plug },
      { id: 'audit', label: 'Audit', icon: FileText },
      { id: 'settings', label: 'Ayarlar', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, toggleSidebar, onboardedProduct, resetOnboarding, agents, tools } = useStore();
  const pendingCount = useStore(selectPendingApprovalCount);
  const liveCount = useStore(selectLiveToolCount);
  const mockCount = useStore(selectMockToolCount);
  const failedTaskCount = useStore(selectFailedTaskCount);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-800 z-40 transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-16'}`}>
      <div className="flex items-center h-16 px-4 border-b border-gray-800 shrink-0">
        {sidebarOpen ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl">⚡</span>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-yellow-400 truncate tracking-wider">OneProduct</h1>
              <p className="text-[10px] text-gray-500 truncate">Hermes · OpenClaw</p>
            </div>
          </div>
        ) : (
          <span className="text-xl mx-auto">⚡</span>
        )}
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white shrink-0">
          {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Active product chip */}
      {sidebarOpen && onboardedProduct && (
        <button onClick={() => setCurrentPage('brand')} className="mx-3 mt-3 mb-1 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 flex items-center gap-2 text-left">
          <span className="text-xl">{onboardedProduct.image_url}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Aktif Ürün</div>
            <div className="text-[11px] font-semibold text-gray-100 truncate">{onboardedProduct.product_name}</div>
          </div>
        </button>
      )}

      <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {sidebarOpen && <div className="text-[9px] font-bold text-gray-600 tracking-widest px-3 mb-1.5 mt-1">{group.label}</div>}
            <div className="space-y-0.5">
              {group.items.map(({ id, label, icon: Icon }) => {
                const isActive = currentPage === id;
                const badge = id === 'approvals' ? pendingCount : id === 'tasks' ? failedTaskCount : null;
                const badgeTone = id === 'tasks' && failedTaskCount > 0 ? 'bg-red-600' : 'bg-red-500';
                return (
                  <button key={id} onClick={() => setCurrentPage(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-yellow-500/10 text-yellow-300 border-l-2 border-yellow-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    title={!sidebarOpen ? label : undefined}>
                    <Icon size={16} className="shrink-0" />
                    {sidebarOpen && <span className="flex-1 text-left truncate">{label}</span>}
                    {sidebarOpen && badge != null && badge > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${badgeTone}`}
                        title={id === 'tasks' ? `${badge} başarısız görev` : undefined}
                      >{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="p-3 border-t border-gray-800 shrink-0">
          <button
            onClick={() => {
              if (window.confirm('Tüm onboarding verisi (marka kimliği, ekonomi, progress) silinecek. Emin misin?')) {
                resetOnboarding();
              }
            }}
            className="w-full text-[10px] text-gray-500 hover:text-yellow-400 flex items-center justify-center gap-1 py-1 mb-2"
          >
            <RotateCcw size={10} /> Yeniden Onboard
          </button>
          <p className="text-[10px] text-gray-600 text-center">Hermes · {agents.length} Agents · {tools.length} Tools</p>
          <button
            onClick={() => setCurrentPage('tools')}
            className="mt-1.5 w-full flex items-center justify-center gap-2 text-[10px] text-gray-500 hover:text-white"
            title="Tool dashboard'a git"
          >
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {liveCount} live</span>
            <span className="text-gray-700">·</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {mockCount} mock</span>
          </button>
        </div>
      )}
    </aside>
  );
}
