import { useStore } from '@/stores/useStore';
import { Bot, User, MessageSquare, X, Sparkles, Zap, Minimize2, History, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChatMessageBody } from './ChatMessageBody';
import { getPageDef } from '@/lib/navigation/hubs';

/** Page-aware quick prompts that change based on the current view. */
function quickPromptsFor(page: string, productName?: string): string[] {
  const p = productName ?? 'ürünüm';
  const map: Record<string, string[]> = {
    dashboard: [
      `${p} için bugün ne yapmalıyım?`,
      'Bekleyen tüm onayları onayla',
      'Tüm entegrasyonları senkronize et',
      'Kritik uyarıları özetle',
    ],
    brand: [
      'Marka kimliğini yeniden üret',
      'Yeni slogan önerileri ver',
      `${p} için 3 yeni isim öner`,
      'Hedef persona güncellemesi yap',
    ],
    pricing: [
      'Fiyat analizini yeniden üret',
      'Marjı %20 artırırsam satış nasıl etkilenir?',
      'Kanal bazlı kârlılık raporu',
      'Rakip fiyatlarla karşılaştırma yap',
    ],
    growth: [
      'Tüm deneyleri hepsini başlat',
      'En etkili 3 büyüme kanalı hangisi?',
      'Yeni deney fikri öner',
      'Dönüşüm oranını artıracak 3 öneri ver',
    ],
    reviews: [
      'Tüm olumsuz yorumlara yanıt taslakları hazırla',
      '5 yıldızlı yorumları öne çıkar',
      'En çok tekrar eden şikayeti tespit et',
      'Yorum yanıt şablonu oluştur',
    ],
    influencers: [
      'Influencerlara teklif gönder',
      'Mikro-influencer listesi çıkar',
      'En uygun influencer kim?',
      'Kampanya ROI hesapla',
    ],
    email_flows: [
      'Tüm e-posta akışlarını hepsini yayına al',
      'Welcome serisi için A/B önerisi',
      'Terk edilmiş sepet akışı kur',
      'E-posta segmentasyon önerisi ver',
    ],
    agents: [
      'Hangi ajan en yoğun?',
      'Bugün kaç görev tamamlandı?',
      'Yeni ajan önerisi ver',
      'Tüm ajanları sıralı çalıştır',
    ],
    tasks: [
      'Bekleyen görevleri özetle',
      'En kritik 3 görev hangisi?',
      'Başarısız görevleri yeniden dene',
      'Bugün tamamlanan görev sayısı kaç?',
    ],
    approvals: [
      'Bekleyen tüm onayları onayla',
      'Yüksek riskli onayları açıkla',
      'Reddedilen onayların nedenleri neler?',
      'Bu onayın etkisini tahmin et',
    ],
    tools: [
      `Hangi araçları mock'tan live'a geçirmeliyim?`,
      'En çok kullanılan 5 araç hangisi?',
      'Başarısız tool çağrılarını göster',
      'Shopify entegrasyonunu test et',
    ],
    knowledge: [
      'Boş kategorileri tespit et',
      'Yeni doküman önerisi',
      'Marka kural kitabını güncelle',
      'Ürün SSS sayfası taslağı hazırla',
    ],
    analytics: [
      'Bu haftanın trend grafiğini özetle',
      'Anomalileri göster',
      'Hangi kanaldan en yüksek ROAS geliyor?',
      'LTV projeksiyonu ver',
    ],
    integrations: [
      'Tüm entegrasyonları senkronize et',
      'Eksik entegrasyon hangisi?',
      'Shopify bağlantısını test et',
      'GA4 bağlantı durumunu kontrol et',
    ],
    audit: [
      'Son 24 saatte kritik olay var mı?',
      'En pahalı tool çağrıları hangisi?',
      'Başarısız tool çağrılarını listele',
      'LLM maliyet özetini çıkar',
    ],
    settings: [
      'Mevcut ayar profilimi özetle',
      'Otonom karar eşiklerini göster',
      'Hangi ajanlar aktif, hangileri pasif?',
      'Bütçe limitlerini güncelle',
    ],
    autonomy: [
      'Otonom karar sayfasını aç',
      'Aktif müzakereleri göster',
      'Fiyat politikasını özetle',
      'Influencer ücret teklifini hazırla',
    ],
    scheduler: [
      'Bugün çalışacak otomasyonları listele',
      'Başarısız görevleri yeniden planla',
      'Haftalık rapor otomasyonu kur',
      'Yeni fiyat takip görevi oluştur',
    ],
    chat: [
      `${p} için bu hafta satışları nasıl artırabilirim?`,
      'Stok ve fiyat anomalilerini göster',
      'Onaylar sayfasına git',
      'Rakip analizi yap',
    ],
  };
  return (map[page] ?? map.dashboard).slice(0, 4);
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

  const hideOnChatPage = currentPage === 'chat' || currentPage === 'supervisor';

  useEffect(() => {
    if (supervisorDockOpen && !minimized) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [supervisorDockOpen, minimized, chatMessages, isThinking]);

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

  const pageLabel = getPageDef(currentPage)?.label ?? currentPage;
  const prompts = quickPromptsFor(currentPage, onboardedProduct?.product_name);
  const recent = chatMessages.slice(-10);
  const contextLine = [
    pageLabel,
    onboardedProduct?.product_name,
  ].filter(Boolean).join(' · ');

  if (!supervisorDockOpen) {
    return (
      <button
        type="button"
        onClick={() => setSupervisorDockOpen(true)}
        className="supervisor-dock-fab"
        title="Supervisor (Ctrl+K)"
        aria-label="Supervisor dock'u aç"
      >
        <span className="supervisor-dock-fab__icon">
          <span className="supervisor-dock-fab__pulse" aria-hidden="true" />
          <Sparkles size={15} />
        </span>
        <span className="supervisor-dock-fab__label">Supervisor</span>
        <kbd className="supervisor-dock-fab__kbd">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className={`supervisor-dock ${minimized ? 'supervisor-dock--minimized' : ''}`}
      role="dialog"
      aria-label="Supervisor dock"
    >
      <header className="supervisor-dock__header">
        <div className="supervisor-dock__identity">
          <div className="supervisor-dock__avatar">
            <Bot size={14} />
          </div>
          <div className="supervisor-dock__meta">
            <div className="supervisor-dock__title-row">
              <span className="supervisor-dock__title">Supervisor</span>
              <span className="tab__pill tab__pill--live mono">LIVE</span>
            </div>
            <div className="supervisor-dock__subtitle" title={contextLine}>
              {contextLine || 'Komut paleti'}
            </div>
          </div>
        </div>
        <div className="supervisor-dock__controls">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="supervisor-dock__ctrl"
            title={minimized ? 'Genişlet' : 'Küçült'}
            aria-label={minimized ? 'Genişlet' : 'Küçült'}
          >
            <Minimize2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setSupervisorDockOpen(false)}
            className="supervisor-dock__ctrl"
            title="Kapat (Esc)"
            aria-label="Kapat"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {!minimized && (
        <div className="supervisor-dock__body">
          <div className="supervisor-dock__messages">
            {recent.length === 0 && (
              <div className="supervisor-dock__empty">
                <div className="supervisor-dock__empty-icon">
                  <MessageSquare size={18} />
                </div>
                <p>Doğal dilde komut ver — Supervisor tüm modülleri yönetebilir.</p>
              </div>
            )}

            {recent.map((msg) => {
              const isUser = msg.role === 'user';
              const agent = msg.agent_id ? agents.find((a) => a.agent_id === msg.agent_id) : null;
              return (
                <div
                  key={msg.id}
                  className={`supervisor-dock__row ${isUser ? 'supervisor-dock__row--user' : ''}`}
                >
                  {!isUser && (
                    <div className="supervisor-dock__bubble-avatar supervisor-dock__bubble-avatar--agent">
                      {agent ? (
                        <span>{agent.icon}</span>
                      ) : (
                        <Bot size={12} />
                      )}
                    </div>
                  )}
                  <div
                    className={`supervisor-dock__bubble ${
                      isUser ? 'supervisor-dock__bubble--user' : 'supervisor-dock__bubble--agent'
                    }`}
                  >
                    {!isUser && agent && (
                      <div className="supervisor-dock__agent-name">{agent.name}</div>
                    )}
                    <ChatMessageBody
                      content={msg.content}
                      textClassName="whitespace-pre-wrap"
                      imgClassName="supervisor-dock__bubble-img"
                    />
                    {msg.tools_used && msg.tools_used.length > 0 && (
                      <div className="supervisor-dock__tools">
                        {msg.tools_used.slice(0, 3).map((t) => (
                          <span key={t} className="supervisor-dock__tool-tag">
                            <Zap size={8} />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isUser && (
                    <div className="supervisor-dock__bubble-avatar">
                      <User size={12} />
                    </div>
                  )}
                </div>
              );
            })}

            {isThinking && (
              <div className="supervisor-dock__row">
                <div className="supervisor-dock__bubble-avatar supervisor-dock__bubble-avatar--agent">
                  <Bot size={12} />
                </div>
                <div className="supervisor-dock__bubble supervisor-dock__bubble--agent">
                  <span className="supervisor-dock__typing" aria-label="Yanıt yazılıyor">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {(recentCommands.length > 0 || prompts.length > 0) && (
            <div className="supervisor-dock__chips">
              {recentCommands.length > 0 && (
                <>
                  <div className="supervisor-dock__chips-label">
                    <History size={10} />
                    Son komutlar
                  </div>
                  <div className="supervisor-dock__chip-scroll">
                    {recentCommands.slice(0, 4).map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => sendUserMessage(cmd)}
                        disabled={isThinking}
                        className="supervisor-dock__chip supervisor-dock__chip--recent"
                        title={cmd}
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="supervisor-dock__chips-label">Hızlı komutlar</div>
              <div className="supervisor-dock__chip-scroll">
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendUserMessage(p)}
                    disabled={isThinking}
                    className="supervisor-dock__chip"
                    title={p}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="supervisor-dock__footer">
            <div className="supervisor-dock__input-row">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isThinking}
                placeholder={
                  isThinking ? 'Supervisor yanıt veriyor…' : 'Komut veya soru…'
                }
                className="supervisor-dock__input"
                aria-label="Supervisor mesajı"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="supervisor-dock__send"
                title="Gönder"
                aria-label="Gönder"
              >
                <Send size={14} />
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
