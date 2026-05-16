import { useStore } from '@/stores/useStore';
import { Send, Bot, User, MessageSquare, X, Sparkles, Zap, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChatMessageBody } from './ChatMessageBody';

/** Page-aware quick prompts that change based on the current view. */
function quickPromptsFor(page: string, productName?: string): string[] {
  const p = productName ?? 'ürünüm';
  const map: Record<string, string[]> = {
    dashboard: [
      `${p} için bugün ne yapmalıyım?`,
      'Bekleyen tüm onayları onayla',
      'Tüm entegrasyonları senkronize et',
    ],
    brand: [
      'Marka kimliğini yeniden üret',
      'Yeni slogan önerileri ver',
      `${p} için 3 yeni isim öner`,
    ],
    pricing: [
      'Fiyat analizini yeniden üret',
      'Marjı %20 artırırsam satış nasıl etkilenir?',
      'Kanal bazlı kârlılık raporu',
    ],
    growth: ['Tüm deneyleri başlat', 'En etkili 3 büyüme kanalı', 'Yeni deney fikri öner'],
    reviews: ['Olumsuz yorumlara yanıt taslakları hazırla', '5 yıldızlı yorumları öne çıkar'],
    influencers: ['Mikro-influencer listesi çıkar', 'Hangi influencerlara teklif gönderelim?'],
    email_flows: ['Tüm e-posta akışlarını yayına al', 'Welcome serisi için A/B önerisi'],
    agents: ['Hangi ajan en yoğun?', 'Yeni ajan önerisi ver'],
    tasks: ['Bekleyen görevleri özetle', 'En kritik 3 görev hangisi?'],
    approvals: ['Bekleyen tüm onayları onayla', 'Yüksek riskli onayları açıkla'],
    tools: ['Hangi araçları mock\'tan live\'a geçirmeliyim?'],
    knowledge: ['Boş kategorileri tespit et', 'Yeni doküman önerisi'],
    analytics: ['Bu haftanın trend grafiğini özetle', 'Anomalileri göster'],
    integrations: ['Tüm entegrasyonları senkronize et', 'Eksik entegrasyon hangisi?'],
    audit: ['Son 24 saatte kritik olay var mı?'],
    settings: ['Mevcut ayar profilimi özetle'],
    chat: [`${p} için bu hafta satışları nasıl artırabilirim?`, 'Stok ve fiyat anomalilerini göster'],
  };
  return map[page] ?? map.dashboard;
}

/** Floating Supervisor chat dock — pinned to every page via Layout. */
export function SupervisorChatDock() {
  const {
    chatMessages,
    isThinking,
    sendUserMessage,
    supervisorDockOpen,
    toggleSupervisorDock,
    setSupervisorDockOpen,
    currentPage,
    onboardedProduct,
    agents,
  } = useStore();

  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide dock on the dedicated chat page (it already has a full-page chat).
  const hideOnChatPage = currentPage === 'chat';

  useEffect(() => {
    if (supervisorDockOpen && !minimized) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [supervisorDockOpen, minimized, chatMessages, isThinking]);

  // Keyboard shortcut: Ctrl/Cmd + K toggles the dock from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSupervisorDock();
      }
      if (e.key === 'Escape' && supervisorDockOpen) {
        setSupervisorDockOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSupervisorDock, setSupervisorDockOpen, supervisorDockOpen]);

  if (hideOnChatPage) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    sendUserMessage(text);
    setInput('');
  };

  const prompts = quickPromptsFor(currentPage, onboardedProduct?.product_name);
  const recent = chatMessages.slice(-12);

  if (!supervisorDockOpen) {
    return (
      <button
        onClick={() => setSupervisorDockOpen(true)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 pl-3 pr-4 py-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-2xl shadow-indigo-600/40 border border-indigo-400/30 transition-all"
        title="Supervisor (Ctrl+K)"
      >
        <span className="relative flex">
          <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60 animate-ping" />
          <Sparkles size={18} className="relative text-white" />
        </span>
        <span className="text-xs font-semibold text-white">Supervisor</span>
        <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 rounded bg-black/30 text-[10px] text-indigo-100 border border-white/10">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden transition-all duration-200 ${
        minimized
          ? 'bottom-6 right-6 w-72 h-14'
          : 'bottom-6 right-6 w-[420px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)]'
      }`}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border-b border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Bot size={14} className="text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white truncate">Supervisor</div>
            <div className="text-[9px] text-indigo-300 truncate">
              {currentPage} {onboardedProduct ? `· ${onboardedProduct.product_name}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title={minimized ? 'Aç' : 'Küçült'}
          >
            <Minimize2 size={12} />
          </button>
          <button
            onClick={() => setSupervisorDockOpen(false)}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="Kapat (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {recent.length === 0 && (
              <div className="text-center py-6">
                <MessageSquare size={28} className="mx-auto text-indigo-500/60 mb-2" />
                <p className="text-[11px] text-gray-400 mb-3">
                  Doğal dilde komut ver — Supervisor tüm sayfaları yönetebilir.
                </p>
              </div>
            )}

            {recent.map((msg) => {
              const isUser = msg.role === 'user';
              const agent = msg.agent_id ? agents.find((a) => a.agent_id === msg.agent_id) : null;
              return (
                <div key={msg.id} className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
                  {!isUser && (
                    <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      {agent ? (
                        <span className="text-[11px]">{agent.icon}</span>
                      ) : (
                        <Bot size={12} className="text-indigo-300" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed break-words ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'
                    }`}
                  >
                    {!isUser && agent && (
                      <div className="text-[9px] font-medium text-indigo-300 mb-0.5">{agent.name}</div>
                    )}
                    <ChatMessageBody
                      content={msg.content}
                      textClassName="text-[11px] whitespace-pre-wrap leading-relaxed"
                      imgClassName="rounded-lg border border-gray-700 max-w-[220px] mt-1"
                    />
                    {msg.tools_used && msg.tools_used.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.tools_used.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] bg-gray-900/70 text-gray-400 border border-gray-700"
                          >
                            <Zap size={7} />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isUser && (
                    <div className="w-6 h-6 rounded-md bg-gray-700 flex items-center justify-center shrink-0">
                      <User size={12} className="text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}

            {isThinking && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-indigo-300" />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl rounded-tl-sm px-2.5 py-1.5">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                      style={{ animationDelay: '300ms' }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts — page-aware */}
          <div className="shrink-0 px-3 pb-1.5 flex flex-wrap gap-1">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => sendUserMessage(p)}
                disabled={isThinking}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-[9px] text-gray-400 hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="shrink-0 p-2.5 border-t border-gray-800 bg-gray-950/60">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isThinking}
                placeholder={
                  isThinking
                    ? 'Supervisor yanıt veriyor…'
                    : 'Komut ver veya soru sor… (ör. "Onaylar sayfasına git")'
                }
                className="flex-1 px-2.5 py-2 bg-gray-800 border border-gray-700 rounded-lg text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                title="Gönder"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
