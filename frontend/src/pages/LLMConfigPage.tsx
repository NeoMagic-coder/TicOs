// @ts-nocheck
// ============================================================
// AGENT.OS — Per-Agent LLM Model Selection
// One row per agent. Edit provider / model / api-key env inline,
// PUT to /agents/{id}/llm-config, then live-test with POST /test.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { useStore } from '@/stores/useStore';
import { AGENT_BY_ID } from '@/data/aos/mockData';

type Provider = {
  id: 'gemini' | 'mock';
  label: string;
  requires_base_url: boolean;
  default_base_url: string;
  default_model: string;
  default_api_key_env: string;
  suggested_models: string[];
  api_key_present: boolean;
};

type AgentLLMConfig = {
  agent_id: string;
  provider: Provider['id'];
  model: string;
  base_url: string;
  api_key_env: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  api_key_present: boolean;
  updated_at: string | null;
};

type TestResp = {
  ok: boolean;
  provider: string;
  model: string;
  text: string;
  tokens_used: number | null;
  duration_ms: number;
  error: string | null;
};

const Row = ({
  agentId,
  initial,
  providers,
  onSaved,
}: {
  agentId: string;
  initial: AgentLLMConfig;
  providers: Provider[];
  onSaved: (cfg: AgentLLMConfig) => void;
}) => {
  const a = AGENT_BY_ID?.[agentId];
  const [draft, setDraft] = useState<AgentLLMConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestResp | null>(null);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prov = providers.find((p) => p.id === draft.provider) || providers[0];

  const applyProvider = (id: Provider['id']) => {
    const p = providers.find((x) => x.id === id);
    if (!p) return;
    setDraft({
      ...draft,
      provider: id,
      model: draft.model && draft.provider === id ? draft.model : p.default_model,
      base_url: draft.provider === id ? draft.base_url : p.default_base_url,
      api_key_env: draft.provider === id ? draft.api_key_env : p.default_api_key_env,
    });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/llm-config`, {
        method: 'PUT',
        headers: backendHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          provider: draft.provider,
          model: draft.model,
          base_url: draft.base_url,
          api_key_env: draft.api_key_env,
          temperature: draft.temperature,
          max_tokens: draft.max_tokens,
          enabled: draft.enabled,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const next: AgentLLMConfig = await res.json();
      setDraft(next);
      onSaved(next);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/llm-config/test`, {
        method: 'POST',
        headers: backendHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt: 'Merhaba! Sadece "hazır" diye yanıt ver.', max_tokens: 32 }),
      });
      const body: TestResp = await res.json();
      setTest(body);
    } catch (e: any) {
      setTest({
        ok: false, provider: '?', model: '?', text: '', tokens_used: null, duration_ms: 0,
        error: String(e?.message || e),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: `1px solid ${draft.enabled ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 5,
        padding: 12,
        marginBottom: 8,
        display: 'grid',
        gridTemplateColumns: '1.1fr 2.3fr auto',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{a?.icon || '🤖'}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)' }}>{a?.name || agentId}</div>
          <div style={{ fontSize: 9, color: 'var(--fg-3)' }}>{agentId}</div>
          {draft.updated_at && (
            <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 2 }}>
              Güncel: {new Date(draft.updated_at).toLocaleString('tr-TR')}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Sağlayıcı</span>
            <select
              value={draft.provider}
              onChange={(e) => applyProvider(e.target.value as Provider['id'])}
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label}{p.api_key_present ? ' ✓' : ''}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Model</span>
            <input
              list={`models-${agentId}`}
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={prov?.default_model}
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
            />
            <datalist id={`models-${agentId}`}>
              {prov?.suggested_models.map((m) => <option key={m} value={m} />)}
            </datalist>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>API Key env</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={draft.api_key_env}
                onChange={(e) => setDraft({ ...draft, api_key_env: e.target.value })}
                placeholder={prov?.default_api_key_env || 'GEMINI_API_KEY'}
                style={{ flex: 1, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, api_key_env: 'GEMINI_API_KEY' })}
                title="GEMINI_API_KEY otomatik doldur"
                style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-2)', padding: '4px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Auto
              </button>
            </div>
          </label>
        </div>

        {prov?.requires_base_url && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Base URL</span>
            <input
              value={draft.base_url}
              onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
              placeholder={prov.default_base_url}
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
            />
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr', gap: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Sıcaklık</span>
            <input type="number" step="0.05" min="0" max="2" value={draft.temperature}
              onChange={(e) => setDraft({ ...draft, temperature: parseFloat(e.target.value) || 0 })}
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Max token</span>
            <input type="number" step="100" min="1" max="32000" value={draft.max_tokens}
              onChange={(e) => setDraft({ ...draft, max_tokens: parseInt(e.target.value, 10) || 1500 })}
              style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)' }}>
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            <span>Aktif (kapalıysa global sağlayıcı kullanılır)</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: draft.api_key_present ? '#10b981' : '#ef4444' }}>
              {draft.api_key_present ? '● Anahtar tanımlı' : '○ Anahtar yok'}
            </span>
          </label>
        </div>

        {test && (
          <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-0)', borderRadius: 3, border: `1px solid ${test.ok ? '#10b981' : '#ef4444'}` }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>
              {test.ok ? '✓ Bağlantı OK' : '✗ Test başarısız'} · {test.provider} / {test.model} · {test.duration_ms}ms
              {test.tokens_used != null && <> · {test.tokens_used} token</>}
            </div>
            {test.error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{test.error}</div>}
            {test.text && <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{test.text}</div>}
          </div>
        )}

        {err && <div style={{ fontSize: 11, color: '#ef4444' }}>{err}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: '6px 14px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 3, fontSize: 11, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button onClick={runTest} disabled={testing || !draft.enabled}
          title={!draft.enabled ? 'Test için önce Aktif yap + Kaydet' : 'Sağlayıcıya tek istek at'}
          style={{ padding: '6px 14px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 11, cursor: (testing || !draft.enabled) ? 'not-allowed' : 'pointer' }}>
          {testing ? 'Test…' : 'Bağlantıyı Test Et'}
        </button>
      </div>
    </div>
  );
};

const emptyCfg = (agentId: string): AgentLLMConfig => ({
  agent_id: agentId,
  provider: 'gemini',
  model: '',
  base_url: '',
  api_key_env: '',
  temperature: 0.7,
  max_tokens: 1500,
  enabled: false,
  api_key_present: false,
  updated_at: null,
});

const LLMConfigPage = () => {
  const agents = useStore((s: any) => s.agents);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configs, setConfigs] = useState<Record<string, AgentLLMConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, cfgRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/llm/providers`, { headers: backendHeaders() }),
        fetch(`${BASE_URL}/api/v1/agents/llm-configs`, { headers: backendHeaders() }),
      ]);
      if (!provRes.ok) throw new Error(`providers HTTP ${provRes.status}`);
      if (!cfgRes.ok) throw new Error(`configs HTTP ${cfgRes.status}`);
      const provList: Provider[] = await provRes.json();
      const cfgList: AgentLLMConfig[] = await cfgRes.json();
      setProviders(provList);
      const map: Record<string, AgentLLMConfig> = {};
      for (const c of cfgList) map[c.agent_id] = c;
      setConfigs(map);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleSaved = (cfg: AgentLLMConfig) => {
    setConfigs((prev) => ({ ...prev, [cfg.agent_id]: cfg }));
  };

  const enabledCount = Object.values(configs).filter((c) => c.enabled).length;

  const applyGeminiKeyToAll = async () => {
    const targets = agents.map((a: any) => a.id || a.agent_id);
    let ok = 0;
    let fail = 0;
    for (const id of targets) {
      const cur = configs[id] || emptyCfg(id);
      try {
        const res = await fetch(`${BASE_URL}/api/v1/agents/${id}/llm-config`, {
          method: 'PUT',
          headers: backendHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            provider: 'gemini',
            model: cur.model || 'gemini-2.5-flash',
            base_url: cur.base_url || '',
            api_key_env: 'GEMINI_API_KEY',
            temperature: cur.temperature,
            max_tokens: cur.max_tokens,
            enabled: cur.enabled,
          }),
        });
        if (res.ok) {
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }
    await refresh();
    alert(`GEMINI_API_KEY toplu uygulandı: ${ok} başarılı, ${fail} hata`);
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> LLM MODELLERİ</div>
      <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 className="page__title">Per-Agent LLM Modelleri</h1>
          <p className="page__sub">
            Her ajan için ayrı sağlayıcı + model seç. Aktif değilse global sağlayıcı kullanılır. ·
            {' '}{enabledCount}/{agents.length} ajan özel modele bağlı.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void applyGeminiKeyToAll(); }}
          title="Tüm ajanların API Key env değerini GEMINI_API_KEY yap"
          style={{ background: 'var(--accent, #10b981)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          GEMINI_API_KEY'i tümüne uygula
        </button>
      </div>

      {!loading && providers.length > 0 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel__body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
            {providers.map((p) => (
              <span key={p.id} style={{ color: p.api_key_present ? '#10b981' : 'var(--fg-3)' }}>
                {p.api_key_present ? '●' : '○'} {p.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="panel"><div className="panel__body">Yükleniyor…</div></div>}
      {error && <div className="panel"><div className="panel__body" style={{ color: 'var(--err)' }}>Hata: {error}</div></div>}

      {!loading && !error && agents.map((a: any) => {
        const id = a.id || a.agent_id;
        return (
          <Row
            key={id}
            agentId={id}
            initial={configs[id] || emptyCfg(id)}
            providers={providers}
            onSaved={handleSaved}
          />
        );
      })}
    </div>
  );
};

export default LLMConfigPage;
