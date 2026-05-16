import { useStore } from '@/stores/useStore';
import { Send, Bot, User, ChevronDown, ChevronRight, Zap, Bug, Radio, Terminal } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessageBody } from '@/components/ChatMessageBody';
import { SlashCommandMenu } from '@/components/SlashCommandMenu';
import { SLASH_COMMANDS } from '@/data/slashCommands';
import type { SlashCommand } from '@/data/slashCommands';

/** Parse pipe-separated commands: "A | B" → ["A", "B"] */
function parsePipe(raw: string): string[] {
  return raw.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
}

/** True if input starts with "/" and looks like a slash-command prefix. */
function isSlashPrefix(val: string): boolean {
  return val.startsWith('/') && !val.includes('\n');
}

export function ChatPage() {
  const {
    chatMessages, sendUserMessage, sendUserMessageStream,
    debugMode, toggleDebugMode, agents, isThinking, onboardedProduct,
    chatProgress, commandHistory, pushCommandHistory,
  } = useStore();

  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [toolPanelOpen, setToolPanelOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  // Filtered slash commands based on current input
  const filteredCommands: SlashCommand[] = isSlashPrefix(input)
    ? SLASH_COMMANDS.filter((c) => c.id.startsWith(input.split(' ')[0]))
    : [];

  useEffect(() => {
    setSlashMenuOpen(filteredCommands.length > 0);
    setSlashMenuIndex(0);
  }, [filteredCommands.length]);

  const applySlashCommand = useCallback((cmd: SlashCommand) => {
    setInput(cmd.id + ' ');
    setSlashMenuOpen(false);
    inputRef.current?.focus();
  }, []);

  const dispatchMessage = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || isThinking) return;
    pushCommandHistory(trimmed);
    setHistoryIndex(-1);

    // Handle built-in slash commands locally
    if (trimmed === '/clear') {
      useStore.getState().addChatMessage({ role: 'system', content: 'Sohbet temizlendi.' });
      setInput('');
      return;
    }
    if (trimmed === '/debug') {
      toggleDebugMode();
      setInput('');
      return;
    }
    if (trimmed === '/live') {
      setLiveMode((v) => !v);
      setInput('');
      return;
    }

    // Handle pipe chains: send sequentially
    const segments = parsePipe(trimmed);
    if (segments.length > 1) {
      const send = liveMode ? sendUserMessageStream : sendUserMessage;
      // Send first segment, then chain via a single combined message
      const combined = segments.join(' → ');
      send(combined);
    } else {
      if (liveMode) sendUserMessageStream(trimmed);
      else sendUserMessage(trimmed);
    }
    setInput('');
    inputRef.current?.focus();
  }, [isThinking, liveMode, sendUserMessage, sendUserMessageStream, toggleDebugMode, pushCommandHistory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash menu navigation
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filteredCommands.length > 0)) {
        e.preventDefault();
        applySlashCommand(filteredCommands[slashMenuIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }

    // History navigation (↑ / ↓) — only when not in slash menu
    if (e.key === 'ArrowUp' && !e.shiftKey && input === '') {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(next);
      setInput(commandHistory[next] ?? '');
      return;
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && historyIndex >= 0) {
      e.preventDefault();
      const prev = historyIndex - 1;
      setHistoryIndex(prev);
      setInput(prev < 0 ? '' : commandHistory[prev] ?? '');
      return;
    }

    // Shift+Enter → newline (natural multi-line)
    if (e.key === 'Enter' && e.shiftKey) return;

    // Enter → send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dispatchMessage(input);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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

  // Tool output events — includes both direct tool calls and nested sub-agent events
  const toolEvents = chatProgress.filter((p) =>
    p.event === 'tool_called' ||
    p.event?.startsWith('subagent.')
  );

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
                Doğal dilde komut verin, sorgulayın, onaylayın
                {onboardedProduct && (
                  <span className="text-gray-400"> · Bağlam: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>
                )}
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
              <p className="text-sm text-gray-400 mb-2">Doğal dilde komut vererek e-ticaret operasyonlarınızı yönetin</p>
              <p className="text-[11px] text-gray-600 mb-6 font-mono">
                <span className="text-indigo-400">/</span> yazarak komut otomatik tamamlama · ↑↓ geçmiş · Shift+Enter yeni satır · <span className="text-emerald-400">A | B</span> zincir
              </p>
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
            const isSystem = msg.role === 'system';
            const agent = msg.agent_id ? agents.find((a) => a.agent_id === msg.agent_id) : null;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[10px] text-gray-500 bg-gray-800 px-3 py-1 rounded-full">{msg.content}</span>
                </div>
              );
            }

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

      {/* Tool Output Panel — collapsible terminal-style stream */}
      {toolEvents.length > 0 && (
        <div className="shrink-0 border-t border-gray-800 bg-gray-950">
          <button
            onClick={() => setToolPanelOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-6 py-2 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Terminal size={11} />
            <span>Araç çıktısı — {toolEvents.length} çağrı</span>
            <ChevronDown size={10} className={`ml-auto transition-transform ${toolPanelOpen ? '' : '-rotate-90'}`} />
          </button>
          {toolPanelOpen && (
            <div className="px-6 pb-3 max-h-32 overflow-y-auto font-mono">
              {toolEvents.map((ev) => {
                const isSubagent = ev.event?.startsWith('subagent.');
                const subEvent = isSubagent ? ev.event?.replace('subagent.', '') : null;
                const ts = new Date(ev.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                if (isSubagent) return (
                  <div key={ev.ts} className="text-[10px] leading-5 pl-3 border-l border-purple-800/60">
                    <span className="text-gray-600">{ts}</span>
                    {' '}<span className="text-purple-400">↪ alt-ajan</span>
                    {' '}<span className="text-purple-300">{ev.agent_id ?? '?'}</span>
                    {' '}<span className="text-gray-500">{subEvent}</span>
                    {ev.tool_id ? <><span className="text-gray-600"> → </span><span className="text-purple-200">{ev.tool_id}</span></> : null}
                    {(ev as Record<string, unknown>).summary ? <span className="text-gray-500 ml-1 italic">{String((ev as Record<string, unknown>).summary).slice(0, 80)}</span> : null}
                  </div>
                );
                return (
                  <div key={ev.ts} className="text-[10px] text-emerald-400 leading-5">
                    <span className="text-gray-600">{ts}</span>
                    {' '}<span className="text-indigo-400">{ev.agent_id ?? 'agent'}</span>
                    {' → '}<span className="text-emerald-300">{ev.tool_id ?? '?'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {/* Terminal Input */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="max-w-4xl mx-auto relative flex gap-3 items-end">
          <div className="flex-1 relative">
            {slashMenuOpen && (
              <SlashCommandMenu
                commands={filteredCommands}
                activeIndex={slashMenuIndex}
                onSelect={applySlashCommand}
              />
            )}
            <div className="flex items-end gap-2 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus-within:border-indigo-500 transition-colors">
              <span className="text-gray-600 font-mono text-sm shrink-0 pb-0.5">›</span>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setHistoryIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                disabled={isThinking}
                placeholder={isThinking ? 'CEO Agent yanıt veriyor…' : "Komut yazın… (/ ile otomatik tamamlama · ↑↓ geçmiş · Shift+Enter yeni satır · A | B zincir)"}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none resize-none disabled:opacity-60 leading-5"
                style={{ minHeight: '20px', maxHeight: '160px' }}
              />
            </div>
            <p className="text-[9px] text-gray-700 mt-1 pl-1 font-mono">
              Enter: gönder · Shift+Enter: yeni satır · ↑↓: geçmiş · /: komutlar · A | B: zincir
            </p>
          </div>
          <button
            onClick={() => dispatchMessage(input)}
            disabled={!input.trim() || isThinking}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mb-5"
          >
            <Send size={16} /> Gönder
          </button>
        </div>
      </div>
    </div>
  );
}
