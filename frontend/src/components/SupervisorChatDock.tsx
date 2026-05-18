import { useStore } from '@/stores/useStore';
import { Send, Bot, User, MessageSquare, X, Sparkles, Zap, Minimize2, History } from 'lucide-react';
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
      'Kritik uyarıları özetle',
      'Günlük gelir hedefime ne kadar kaldı?',
    ],
    brand: [
      'Marka kimliğini yeniden üret',
      'Yeni slogan önerileri ver',
      `${p} için 3 yeni isim öner`,
      'Hedef persona güncellemesi yap',
      `${p} için renk paleti alternatifi üret`,
    ],
    pricing: [
      'Fiyat analizini yeniden üret',
      'Marjı %20 artırırsam satış nasıl etkilenir?',
      'Kanal bazlı kârlılık raporu',
      'Rakip fiyatlarla karşılaştırma yap',
      'Dinamik fiyat politikası öner',
    ],
    growth: [
      'Tüm deneyleri hepsini başlat',
      'En etkili 3 büyüme kanalı hangisi?',
      'Yeni deney fikri öner',
      'Dönüşüm oranını artıracak 3 öneri ver',
      'A/B test sonuçlarını özetle',
    ],
    reviews: [
      'Tüm olumsuz yorumlara yanıt taslakları hazırla',
      '5 yıldızlı yorumları öne çıkar',
      'Ortalama puanı düşüren yorumları analiz et',
      'En çok tekrar eden şikayeti tespit et',
      'Yorum yanıt şablonu oluştur',
    ],
    influencers: [
      'Influencerlara teklif gönder',
      'Mikro-influencer listesi çıkar',
      'En uygun influencer kim?',
      'Influencer sözleşme taslağı hazırla',
      'Kampanya ROI hesapla',
    ],
    email_flows: [
      'Tüm e-posta akışlarını hepsini yayına al',
      'Welcome serisi için A/B önerisi',
      'En düşük açılma oranlı akışı analiz et',
      'Terk edilmiş sepet akışı kur',
      'E-posta segmentasyon önerisi ver',
    ],
    agents: [
      'Hangi ajan en yoğun?',
      'Bugün kaç görev tamamlandı?',
      'Yeni ajan önerisi ver',
      'En düşük başarı oranlı ajan hangisi?',
      'Tüm ajanları sıralı çalıştır',
    ],
    tasks: [
      'Bekleyen görevleri özetle',
      'En kritik 3 görev hangisi?',
      'Başarısız görevleri yeniden dene',
      'Bugün tamamlanan görev sayısı kaç?',
      'Yeni görev oluştur',
    ],
    approvals: [
      'Bekleyen tüm onayları onayla',
      'Yüksek riskli onayları açıkla',
      'Reddedilen onayların nedenleri neler?',
      'Onay bekleme süresini analiz et',
      'Bu onayın etkisini tahmin et',
    ],
    tools: [
      `Hangi araçları mock'tan live'a geçirmeliyim?`,
      'En çok kullanılan 5 araç hangisi?',
      'Başarısız tool çağrılarını göster',
      'Tool maliyetlerini özetle',
      'Shopify entegrasyonunu test et',
    ],
    knowledge: [
      'Boş kategorileri tespit et',
      'Yeni doküman önerisi',
      'Marka kural kitabını güncelle',
      'Rakip analizi dokümanı oluştur',
      'Ürün SSS sayfası taslağı hazırla',
    ],
    analytics: [
      'Bu haftanın trend grafiğini özetle',
      'Anomalileri göster',
      'Hangi kanaldan en yüksek ROAS geliyor?',
      'Müşteri edinme maliyeti hesapla',
      'LTV projeksiyonu ver',
    ],
    integrations: [
      'Tüm entegrasyonları senkronize et',
      'Eksik entegrasyon hangisi?',
      'Shopify bağlantısını test et',
      'Trendyol entegrasyonunu kur',
      'GA4 bağlantı durumunu kontrol et',
    ],
    audit: [
      'Son 24 saatte kritik olay var mı?',
      'En pahalı tool çağrıları hangisi?',
      'Başarısız tool çağrılarını listele',
      'LLM maliyet özetini çıkar',
      'Audit sayfasına git',
    ],
    settings: [
      'Mevcut ayar profilimi özetle',
      'Otonom karar eşiklerini göster',
      'Hangi ajanlar aktif, hangileri pasif?',
      'Bütçe limitlerini güncelle',
      'Ayarlar sayfasını göster',
    ],
    autonomy: [
      'Otonom karar sayfasını aç',
      'Aktif müzakereleri göster',
      'Fiyat politikasını özetle',
      'Kargo anlaşması müzakeresi başlat',
      'Influencer ücret teklifini hazırla',
    ],
    scheduler: [
      'Bugün çalışacak otomasyonları listele',
      'Başarısız görevleri yeniden planla',
      'Haftalık rapor otomasyonu kur',
      'Zamanlayıcı durumunu özetle',
      'Yeni fiyat takip görevi oluştur',
    ],
    chat: [
      `${p} için bu hafta satışları nasıl artırabilirim?`,
      'Stok ve fiyat anomalilerini göster',
      'Onaylar sayfasına git',
      'Büyüme sayfasını aç',
      'Rakip analizi yap',
    ],
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
    recentCommands,
  } = useStore();

  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide dock on the dedicated chat page (it already has a full-page chat).
  const hideOnChatPage = currentPage === 'chat' || currentPage === 'supervisor';

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
        <span className="text-xs font-semibold text-white">Supervisor Dock</span>
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

          {/* Recent commands — sent by user */}
          {recentCommands.length > 0 && (
            <div className="shrink-0 px-3 pb-1">
              <div className="flex items-center gap-1 mb-1">
                <History size={9} className="text-gray-600" />
                <span className="text-[8px] text-gray-600 uppercase tracking-widest">Son komutlar</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {recentCommands.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => sendUserMessage(cmd)}
                    disabled={isThinking}
                    className="px-2 py-1 bg-indigo-950/60 border border-indigo-800/50 rounded-md text-[9px] text-indigo-300 hover:text-white hover:border-indigo-500/70 transition-colors disabled:opacity-50 max-w-[180px] truncate"
                    title={cmd}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

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
