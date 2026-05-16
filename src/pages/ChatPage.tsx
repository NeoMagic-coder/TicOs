import { useStore } from '@/stores/useStore';
import { Send, Bot, User, ChevronDown, ChevronRight, Zap, Bug, Radio } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { ChatMessageBody } from '@/components/ChatMessageBody';

export function ChatPage() {
  const { chatMessages, sendUserMessage, sendUserMessageStream, debugMode, toggleDebugMode, agents, isThinking, onboardedProduct, chatProgress } = useStore();
  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    if (liveMode) sendUserMessageStream(input.trim());
    else sendUserMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const productName = onboardedProduct?.product_name;
  const quickActions = productName
    ? [
        `${productName} için bu hafta satışları nasıl artırabilirim?`,
        `${productName} stok ve fiyat anomalilerini göster`,
        `${productName} için müşteri mesajlarına yanıt taslakları hazırla`,
        `${productName} listinglerimi ${onboardedProduct?.channels?.[0] ?? 'pazaryeri'} için optimize et`,
        `${productName} için günlük performans raporu oluştur`,
      ]
    : [
        'Bu hafta satışları nasıl artırabilirim?',
        'Stok bitecek ürünleri göster',
        'Müşteri mesajlarına cevap hazırla',
        'Trendyol listinglerimi optimize et',
        'Günlük performans raporu oluştur',
      ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
              <Bot size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Supervisor Chat</h1>
              <p className="text-[11px] text-gray-500">
                Doğal dilde görev verin, sorgulayın, onaylayın
                {onboardedProduct && <span className="text-gray-400"> · Bağlam: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                liveMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              title="SSE ile canlı ajan/tool progress'i göster"
            >
              <Radio size={14} /> {liveMode ? 'Canlı Açık' : 'Canlı Kapalı'}
            </button>
            <button
              onClick={toggleDebugMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                debugMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Bug size={14} /> {debugMode ? 'Debug Açık' : 'Debug Kapalı'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">👔</div>
              <h2 className="text-lg font-bold text-white mb-2">Supervisor'a hoş geldiniz</h2>
              <p className="text-sm text-gray-400 mb-6">Doğal dilde komut vererek e-ticaret operasyonlarınızı yönetin</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => sendUserMessage(action)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-300 hover:text-white hover:border-indigo-500/50 transition-all"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => {
            const isUser = msg.role === 'user';
            const agent = msg.agent_id ? agents.find((a) => a.agent_id === msg.agent_id) : null;

            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0 mt-1">
                    {agent ? <span className="text-sm">{agent.icon}</span> : <Bot size={16} className="text-indigo-400" />}
                  </div>
                )}

                <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700'
                  }`}>
                    {!isUser && agent && (
                      <p className="text-[10px] font-medium text-indigo-400 mb-1">{agent.name}</p>
                    )}
                    <ChatMessageBody content={msg.content} />
                  </div>

                  {/* Debug: thinking */}
                  {debugMode && msg.thinking && (
                    <div className="mt-1">
                      <button
                        onClick={() => setExpandedThinking(expandedThinking === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300"
                      >
                        {expandedThinking === msg.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        Düşünce süreci
                      </button>
                      {expandedThinking === msg.id && (
                        <div className="mt-1 p-2 rounded-lg bg-gray-900 border border-gray-700 text-[11px] text-gray-400 italic">
                          {msg.thinking}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tools used */}
                  {msg.tools_used && msg.tools_used.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.tools_used.map((tool) => (
                        <span key={tool} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-gray-800 text-gray-400 border border-gray-700">
                          <Zap size={8} /> {tool}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-600 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} className="text-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
          {isThinking && (
            <div className="flex gap-3 max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-indigo-400" />
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span>CEO Agent düşünüyor…</span>
                </div>
                {chatProgress.length > 0 && (
                  <div className="mt-2 space-y-1" data-testid="chat-progress">
                    {chatProgress.slice(-6).map((p) => (
                      <div key={p.ts} className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" /> {p.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {chatMessages.length > 0 && (
        <div className="shrink-0 px-6 pb-2">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-1.5">
            {quickActions.slice(0, 3).map((action) => (
              <button
                key={action}
                onClick={() => sendUserMessage(action)}
                className="px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[10px] text-gray-400 hover:text-white hover:border-indigo-500/50 transition-all"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isThinking}
            placeholder={isThinking ? 'CEO Agent yanıt veriyor…' : "Supervisor'a mesaj yazın... (ör: Bu ürün neden satmıyor?)"}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Send size={16} /> Gönder
          </button>
        </div>
      </div>
    </div>
  );
}
