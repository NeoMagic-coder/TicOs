import { useStore } from '@/stores/useStore';
import { Sidebar } from './Sidebar';
import { ProductContextBar } from './ProductContextBar';
import { SupervisorChatDock } from './SupervisorChatDock';

export function Layout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <ProductContextBar />
        {children}
      </main>
      <SupervisorChatDock />
    </div>
  );
}
