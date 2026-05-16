import { useStore } from '@/stores/useStore';
import { Wrench, ToggleLeft, ToggleRight, Zap, Clock, DollarSign, ArrowLeft, Shield, Search } from 'lucide-react';
import { useState } from 'react';

export function ToolsPage() {
  const { tools, selectedToolId, setSelectedTool, toggleToolMode, agents, onboardedProduct } = useStore();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const selectedTool = tools.find((t) => t.tool_id === selectedToolId);

  if (selectedTool) {
    return <ToolDetail tool={selectedTool} agents={agents} onBack={() => setSelectedTool(null)} onToggleMode={() => toggleToolMode(selectedTool.tool_id)} />;
  }

  const categories = ['all', ...new Set(tools.map((t) => t.category))];
  const filtered = tools
    .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
    .filter((t) => search === '' || t.name.toLowerCase().includes(search.toLowerCase()) || t.tool_id.toLowerCase().includes(search.toLowerCase()));

  const totalCalls = tools.reduce((s, t) => s + t.stats.total_calls, 0);
  const totalCost = tools.reduce((s, t) => s + t.stats.total_cost_usd, 0);
  const liveCount = tools.filter((t) => t.mode === 'live').length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wrench size={24} className="text-indigo-400" /> OpenClaw Tool Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Tool Registry — {tools.length} tool kayıtlı
          {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span> · Kategori: {onboardedProduct.category}</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Toplam Tool</p>
          <p className="text-2xl font-bold text-white">{tools.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Toplam Çağrı</p>
          <p className="text-2xl font-bold text-white">{totalCalls.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Toplam Maliyet</p>
          <p className="text-2xl font-bold text-white">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Live / Mock</p>
          <p className="text-2xl font-bold text-white">{liveCount} / {tools.length - liveCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tool ara..."
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {c === 'all' ? 'Tümü' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((tool) => (
          <div
            key={tool.tool_id}
            onClick={() => setSelectedTool(tool.tool_id)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white truncate">{tool.name}</h3>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{tool.tool_id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  tool.mode === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                }`}>{tool.mode}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleToolMode(tool.tool_id); }}
                  className="text-gray-400 hover:text-white transition-colors"
                  title={`${tool.mode === 'mock' ? 'Live' : 'Mock'} moduna geç`}
                >
                  {tool.mode === 'live' ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">{tool.description}</p>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><Zap size={10} /> {tool.stats.total_calls}</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {tool.stats.avg_duration_ms}ms</span>
              <span className="flex items-center gap-1">✅ {(tool.stats.success_rate * 100).toFixed(0)}%</span>
              {tool.stats.total_cost_usd > 0 && (
                <span className="flex items-center gap-1"><DollarSign size={10} /> ${tool.stats.total_cost_usd.toFixed(3)}</span>
              )}
            </div>

            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {tool.tags.map((tag, i) => (
                <span key={`${tool.tool_id}-${tag}-${i}`} className="px-1.5 py-0.5 rounded text-[9px] bg-gray-800 text-gray-400">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolDetail({ tool, agents, onBack, onToggleMode }: {
  tool: import('@/types').ToolManifest;
  agents: import('@/types').AgentSpec[];
  onBack: () => void;
  onToggleMode: () => void;
}) {
  const authorizedAgents = agents.filter((a) => tool.allowed_agents.includes(a.agent_id));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Tüm Tool'lar
      </button>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{tool.name}</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">{tool.tool_id} v{tool.version}</p>
            <p className="text-sm text-gray-400 mt-2">{tool.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
              tool.mode === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
            }`}>{tool.mode === 'live' ? '🟢 Live' : '🟡 Mock'}</span>
            <button onClick={onToggleMode} className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors">
              {tool.mode === 'mock' ? 'Live Yap' : 'Mock Yap'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{tool.stats.total_calls}</p>
            <p className="text-[10px] text-gray-500">Toplam Çağrı</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{(tool.stats.success_rate * 100).toFixed(0)}%</p>
            <p className="text-[10px] text-gray-500">Başarı Oranı</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{tool.stats.avg_duration_ms}ms</p>
            <p className="text-[10px] text-gray-500">Ort. Süre</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">${tool.stats.total_cost_usd.toFixed(3)}</p>
            <p className="text-[10px] text-gray-500">Toplam Maliyet</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">${tool.cost_estimate.per_call_usd.toFixed(4)}</p>
            <p className="text-[10px] text-gray-500">Çağrı Maliyeti</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Config */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">⚙️ Yapılandırma</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Kategori</span><span className="text-white">{tool.category}</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Provider</span><span className="text-white">{tool.provider}</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Auth Gerekli</span><span className="text-white">{tool.auth_required ? 'Evet' : 'Hayır'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Rate Limit</span><span className="text-white">{tool.rate_limit.requests_per_minute}/dk</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Timeout</span><span className="text-white">{tool.timeout_ms}ms</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Retry</span><span className="text-white">{tool.retry.max_attempts}x ({tool.retry.backoff})</span></div>
            <div className="flex justify-between py-1.5 border-b border-gray-800"><span className="text-gray-500">Onay Gerekli</span><span className={tool.requires_approval ? 'text-orange-400' : 'text-green-400'}>{tool.requires_approval ? 'Evet' : 'Hayır'}</span></div>
            <div className="flex justify-between py-1.5"><span className="text-gray-500">Fallback</span><span className="text-white font-mono">{tool.fallback_tool_id || '—'}</span></div>
          </div>
        </div>

        {/* Authorized Agents */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Shield size={14} className="text-indigo-400" /> Yetkili Ajanlar ({authorizedAgents.length})
          </h3>
          <div className="space-y-2">
            {authorizedAgents.map((agent) => (
              <div key={agent.agent_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/50">
                <span className="text-lg">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{agent.name}</p>
                  <p className="text-[10px] text-gray-500">{agent.role}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${
                  agent.status === 'active' ? 'bg-green-400' :
                  agent.status === 'busy' ? 'bg-amber-400' : 'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schemas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">📥 Input Schema</h3>
          <pre className="text-[11px] text-gray-300 bg-gray-800 rounded-lg p-3 overflow-auto max-h-60">
            {JSON.stringify(tool.input_schema, null, 2)}
          </pre>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">📤 Output Schema</h3>
          <pre className="text-[11px] text-gray-300 bg-gray-800 rounded-lg p-3 overflow-auto max-h-60">
            {JSON.stringify(tool.output_schema, null, 2)}
          </pre>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">🏷️ Etiketler</h3>
        <div className="flex flex-wrap gap-2">
          {tool.tags.map((tag, i) => (
            <span key={`${tag}-${i}`} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-xs text-indigo-400">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
