import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OnboardedProduct } from '@/types';
import { BASE_URL, fetchProductFromUrl } from '@/lib/api';
import {
  STAGES, MARKETS, CHANNELS, CATEGORIES, BUDGETS, PRIORITIES,
  bootLines,
} from './data';
import {
  CATEGORY_ICONS, CHANNEL_ICONS, NAMED_ICONS,
  IcCheck, IcTerminal, IcArrowRight, IcSpark,
} from './icons';

type Draft = Partial<OnboardedProduct>;
type Update = (patch: Draft) => void;

interface FieldLabelProps {
  code: string;
  hint?: string;
  status?: { tone: 'info'; text: string };
  children: ReactNode;
}

function FieldLabel({ code, hint, status, children }: FieldLabelProps) {
  return (
    <div className="ob-fieldlabel">
      <span className="ob-fieldlabel__code">[{code}]</span>
      <span className="ob-fieldlabel__text">{children}</span>
      {hint && <span className="ob-fieldlabel__hint">{hint}</span>}
      {status && <span className={`ob-fieldlabel__status ob-fieldlabel__status--${status.tone}`}>{status.text}</span>}
    </div>
  );
}

interface ObInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
  maxLength?: number;
}

function ObInput({ value, onChange, placeholder, large, maxLength }: ObInputProps) {
  return (
    <div className={`ob-input ${large ? 'ob-input--large' : ''}`}>
      <span className="ob-input__caret">›</span>
      <input
        value={value}
        onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}

interface ObTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

function ObTextarea({ value, onChange, placeholder, rows = 3, maxLength }: ObTextareaProps) {
  return (
    <div className="ob-input ob-input--area">
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}

type FetchStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; confidence: number; sources: number; filled: string[] }
  | { kind: 'empty'; reason: string }
  | { kind: 'error'; message: string };

/** Referans URL input + "Bilgileri Çek" action. POSTs the URL to the backend
 *  which calls Gemini with Google Search grounding and returns structured
 *  product info — we then auto-fill any draft fields the user left blank
 *  (never overwriting their typing). */
function ReferenceUrlBlock({ draft, update }: { draft: Draft; update: Update }) {
  const [status, setStatus] = useState<FetchStatus>({ kind: 'idle' });
  const url = (draft.reference_url || '').trim();
  const isHttp = /^https?:\/\/\S+/i.test(url);
  const canFetch = isHttp && status.kind !== 'loading';

  const onFetch = async () => {
    if (!canFetch) return;
    setStatus({ kind: 'loading' });
    try {
      const data = await fetchProductFromUrl(url);
      const filled: string[] = [];
      const patch: Draft = {};
      if (data.product_name && !draft.product_name) {
        patch.product_name = data.product_name;
        filled.push('name');
      }
      if (data.product_description && !draft.product_description) {
        patch.product_description = data.product_description;
        filled.push('desc');
      }
      if (data.category && !draft.category && CATEGORIES.includes(data.category)) {
        patch.category = data.category;
        filled.push('cat');
      }
      if (Object.keys(patch).length > 0) update(patch);
      if (filled.length === 0) {
        setStatus({
          kind: 'empty',
          reason: data.degraded_reason || (data.degraded ? 'no_data' : 'already_filled'),
        });
      } else {
        setStatus({
          kind: 'ok',
          confidence: data.confidence,
          sources: data.sources.length,
          filled,
        });
      }
    } catch (e: unknown) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'fetch failed' });
    }
  };

  let statusNode: ReactNode = null;
  if (status.kind === 'loading') {
    statusNode = <span className="ob-fieldlabel__status ob-fieldlabel__status--info">fetching ... google search</span>;
  } else if (status.kind === 'ok') {
    statusNode = (
      <span className="ob-fieldlabel__status ob-fieldlabel__status--info">
        ok :: {status.filled.join(' · ')} · conf {Math.round(status.confidence * 100)}% · {status.sources} kaynak
      </span>
    );
  } else if (status.kind === 'empty') {
    statusNode = <span className="ob-fieldlabel__status ob-fieldlabel__status--info">no_new_data :: {status.reason}</span>;
  } else if (status.kind === 'error') {
    statusNode = <span className="ob-fieldlabel__status ob-fieldlabel__status--info">err :: {status.message.slice(0, 80)}</span>;
  }

  return (
    <>
      <div className="ob-fieldlabel">
        <span className="ob-fieldlabel__code">[04]</span>
        <span className="ob-fieldlabel__text">Referans URL</span>
        <span className="ob-fieldlabel__hint">opsiyonel · LLM ile çek</span>
        {statusNode}
      </div>
      <div className="ob-refurl">
        <div className="ob-refurl__input">
          <ObInput
            value={draft.reference_url || ''}
            onChange={(v) => {
              update({ reference_url: v });
              if (status.kind !== 'idle' && status.kind !== 'loading') setStatus({ kind: 'idle' });
            }}
            placeholder="https://... (ürün sayfası, rakip, pazaryeri linki)"
          />
        </div>
        <button
          type="button"
          className="ob-refurl__btn"
          disabled={!canFetch}
          onClick={onFetch}
          title={isHttp ? 'Sayfayı LLM + Google Search ile özetle' : 'Geçerli http(s) URL girin'}
        >
          {status.kind === 'loading' ? 'çekiliyor...' : 'Bilgileri Çek'}
        </button>
      </div>
    </>
  );
}

/* image upload + Gemini Vision auto-fill block (used by Phase 1) */
function ImageAnalysisBlock({ draft, update }: { draft: Draft; update: Update }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; category?: string; colors?: string[]; material?: string; degraded?: boolean }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const onFile = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    const data: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read_failed'));
      reader.readAsDataURL(file);
    });
    setPreview(data);
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch(`${BASE_URL}/api/v1/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: 'image_analysis',
          agent_id: 'market_research_agent',
          input: { image_b64: data, product_name: draft.product_name || '' },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const out = body?.output || {};
      const category: string | undefined =
        typeof out.category === 'string' && out.category.trim() ? out.category.trim() : undefined;
      const colors: string[] = Array.isArray(out.colors) ? out.colors.slice(0, 3) : [];
      const material: string | undefined =
        typeof out.material === 'string' && out.material.trim() ? out.material.trim() : undefined;

      const patch: Draft = {};
      if (category) {
        const match = CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase())
          || CATEGORIES.find((c) => category.toLowerCase().includes(c.toLowerCase()))
          || CATEGORIES.find((c) => c.toLowerCase().includes(category.toLowerCase()));
        if (match) patch.category = match;
      }
      if (Object.keys(patch).length) update(patch);
      setStatus({ kind: 'ok', category, colors, material, degraded: !!out.degraded });
    } catch (exc: any) {
      setStatus({ kind: 'error', message: exc?.message || String(exc) });
    }
  };

  return (
    <>
      <FieldLabel code="04">Ürün fotoğrafı <span style={{ opacity: 0.6 }}>(Gemini Vision otomatik kategori önerir)</span></FieldLabel>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          {status.kind === 'loading' ? 'Analiz ediliyor…' : 'Fotoğraf yükle ve analiz et'}
        </label>
        {preview && (
          <img
            src={preview}
            alt="Ürün önizleme"
            style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-faint)' }}
          />
        )}
        <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 160 }}>
          {status.kind === 'idle' && <span style={{ opacity: 0.6 }}>JPEG / PNG · ≤ 4MB</span>}
          {status.kind === 'loading' && <span>Gemini Vision çağrılıyor…</span>}
          {status.kind === 'ok' && (
            <>
              <div>kategori: <b>{status.category || '—'}</b>{status.degraded ? ' (mock)' : ''}</div>
              {status.colors && status.colors.length > 0 && <div>renkler: {status.colors.join(', ')}</div>}
              {status.material && <div>materyal: {status.material}</div>}
            </>
          )}
          {status.kind === 'error' && <span style={{ color: '#ef4444' }}>{status.message}</span>}
        </div>
      </div>
    </>
  );
}

/* PHASE 1: PRODUCT */
export function Phase1Product({ draft, update }: { draft: Draft; update: Update }) {
  return (
    <div className="ob-phase">
      <header className="ob-phase__head">
        <div className="ob-phase__eyebrow">PHASE 01 / 04 · &nbsp;<span className="ob-blink">_</span></div>
        <h1 className="ob-phase__title">Define <em>product</em>.</h1>
        <p className="ob-phase__sub">22 ajan ve 89 tool bu profili referans alacak. Yanlış yaz, yanlış kurar — net yaz.</p>
      </header>

      <FieldLabel code="01">Ürün adı</FieldLabel>
      <ObInput
        large
        value={draft.product_name || ''}
        onChange={(v) => update({ product_name: v })}
        placeholder="örn. Granit Yanmaz Tencere Seti"
      />

      <FieldLabel code="02" hint={`${(draft.product_description || '').length} / 240`}>Kısa açıklama</FieldLabel>
      <ObTextarea
        value={draft.product_description || ''}
        onChange={(v) => update({ product_description: v })}
        placeholder="hedef kitle, farklılaştırıcı, üç-cümle pitch..."
        maxLength={240}
      />

      <FieldLabel code="03">Kategori</FieldLabel>
      <div className="ob-grid ob-grid--cat">
        {CATEGORIES.map((c) => {
          const IconCmp = CATEGORY_ICONS[c];
          const sel = draft.category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => update({ category: c })}
              className={`ob-tile ob-tile--cat ${sel ? 'is-selected' : ''}`}
            >
              <span className="ob-tile__icon"><IconCmp size={20} /></span>
              <span className="ob-tile__label">{c}</span>
              {sel && <span className="ob-tile__check"><IcCheck size={11} /></span>}
            </button>
          );
        })}
      </div>

      <ImageAnalysisBlock draft={draft} update={update} />

      <ReferenceUrlBlock draft={draft} update={update} />

      <div className="ob-divider"><span>// origin</span></div>

      <FieldLabel code="05">Şu an neredesin?</FieldLabel>
      <div className="ob-stages">
        {STAGES.map((s) => {
          const IconCmp = NAMED_ICONS[s.icon];
          const sel = draft.stage === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => update({ stage: s.value })}
              className={`ob-stagecard ${sel ? 'is-selected' : ''}`}
            >
              <div className="ob-stagecard__icon"><IconCmp size={22} /></div>
              <div className="ob-stagecard__body">
                <div className="ob-stagecard__row">
                  <span className="ob-stagecard__code">{s.code}</span>
                  {sel && <IcCheck size={12} />}
                </div>
                <div className="ob-stagecard__label">{s.label}</div>
                <div className="ob-stagecard__hint">{s.hint}</div>
                <div className="ob-stagecard__lights">
                  {s.lights.map((l) => (
                    <span key={l} className={`ob-stagecard__light ${sel ? 'is-on' : ''}`}>{l}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* PHASE 2: MARKET */
export function Phase2Market({ draft, update }: { draft: Draft; update: Update }) {
  const visible = useMemo(() => {
    if (!draft.target_market || draft.target_market === 'BOTH') return CHANNELS;
    return CHANNELS.filter((c) => c.region === draft.target_market || c.region === 'BOTH');
  }, [draft.target_market]);

  return (
    <div className="ob-phase">
      <header className="ob-phase__head">
        <div className="ob-phase__eyebrow">PHASE 02 / 04 · &nbsp;<span className="ob-blink">_</span></div>
        <h1 className="ob-phase__title">Configure <em>market</em>.</h1>
        <p className="ob-phase__sub">Coğrafya · satış kanalları · aylık reklam yakıtı. Ajanlar yetkilerini buradan alır.</p>
      </header>

      <FieldLabel code="01">Hedef pazar</FieldLabel>
      <div className="ob-grid ob-grid--3">
        {MARKETS.map((m) => {
          const IconCmp = NAMED_ICONS[m.icon];
          const sel = draft.target_market === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => update({ target_market: m.value })}
              className={`ob-tile ob-tile--market ${sel ? 'is-selected' : ''}`}
            >
              <div className="ob-tile__head">
                <span className="ob-tile__code">{m.code}</span>
                {sel && <IcCheck size={12} />}
              </div>
              <div className="ob-tile__bigicon"><IconCmp size={36} /></div>
              <div className="ob-tile__label">{m.label}</div>
              <div className="ob-tile__desc">{m.desc}</div>
            </button>
          );
        })}
      </div>

      <FieldLabel
        code="02"
        hint={`${draft.channels?.length || 0} seçili · min 1`}
        status={draft.target_market && draft.target_market !== 'BOTH' ? {
          tone: 'info',
          text: `filtered :: ${draft.target_market === 'TR' ? 'turkey' : 'global'}`,
        } : undefined}
      >
        Kanal tercihi
      </FieldLabel>
      <div className="ob-channels">
        {visible.map((c) => {
          const IconCmp = CHANNEL_ICONS[c.id];
          const sel = draft.channels?.includes(c.id) || false;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                const arr = draft.channels || [];
                update({ channels: sel ? arr.filter((x) => x !== c.id) : [...arr, c.id] });
              }}
              className={`ob-chip ${sel ? 'is-selected' : ''}`}
            >
              <span className="ob-chip__icon"><IconCmp size={14} /></span>
              {c.id}
              {sel && <IcCheck size={11} />}
            </button>
          );
        })}
      </div>

      <div className="ob-divider"><span>// budget</span></div>

      <FieldLabel code="03">Aylık reklam bütçesi</FieldLabel>
      <div className="ob-budgets">
        {BUDGETS.map((b, i) => {
          const IconCmp = NAMED_ICONS[b.icon];
          const sel = draft.monthly_budget_band === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => update({ monthly_budget_band: b.id })}
              className={`ob-budget ${sel ? 'is-selected' : ''}`}
            >
              <span className="ob-budget__index">0{i + 1}</span>
              <span className="ob-budget__icon"><IconCmp size={28} /></span>
              <span className="ob-budget__code">{b.code}</span>
              <span className="ob-budget__label">{b.label}<small>{b.range}</small></span>
              <span className="ob-budget__desc">{b.desc}</span>
              <span className="ob-budget__watts">{b.watts}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* PHASE 3: DIRECTIVES */
export function Phase3Directives({ draft, update }: { draft: Draft; update: Update }) {
  const list = draft.priorities || [];
  return (
    <div className="ob-phase">
      <header className="ob-phase__head">
        <div className="ob-phase__eyebrow">PHASE 03 / 04 · &nbsp;<span className="ob-blink">_</span></div>
        <h1 className="ob-phase__title">Set <em>directives</em>.</h1>
        <p className="ob-phase__sub">Birden fazla seçilebilir. <strong>İlk seçtiğin</strong> daha yüksek ağırlık alır — sıralama önemli.</p>
      </header>

      <div className="ob-directives">
        {PRIORITIES.map((p) => {
          const IconCmp = NAMED_ICONS[p.icon];
          const idx = list.indexOf(p.id);
          const sel = idx >= 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                update({ priorities: sel ? list.filter((x) => x !== p.id) : [...list, p.id] });
              }}
              className={`ob-directive ob-directive--${p.accent} ${sel ? 'is-selected' : ''}`}
            >
              <div className="ob-directive__head">
                <span className="ob-directive__rank">
                  {sel ? `#${idx + 1}` : '—'}
                </span>
                <span className="ob-directive__code">{p.code}</span>
              </div>
              <div className="ob-directive__icon"><IconCmp size={44} /></div>
              <div className="ob-directive__label">{p.label}</div>
              <div className="ob-directive__desc">{p.desc}</div>
              <div className="ob-directive__bar">
                <div className="ob-directive__bar-fill" style={{ width: sel ? `${100 - idx * 22}%` : '0%' }} />
              </div>
            </button>
          );
        })}
      </div>

      {list.length > 1 && (
        <div className="ob-note">
          <span className="ob-note__icon"><IcTerminal size={12} /></span>
          <span>weight allocation :: {list.map((id, i) => {
            const p = PRIORITIES.find((x) => x.id === id);
            const w = Math.max(10, 100 - i * 22);
            return p ? `${p.code}=${w}%` : '';
          }).filter(Boolean).join(' · ')}</span>
        </div>
      )}
    </div>
  );
}

/* PHASE 4: INITIALIZE */
interface Phase4Props {
  draft: Draft;
  agentCount: number;
  toolCount: number;
  onLaunch: () => void;
}

export function Phase4Initialize({ draft, agentCount, toolCount, onLaunch }: Phase4Props) {
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState(false);

  const lines = useMemo(() => bootLines(draft, agentCount, toolCount), [draft, agentCount, toolCount]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const el = performance.now() - start;
      setTick(el);
      if (el < 2200) raf = requestAnimationFrame(loop);
      else setDone(true);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visibleLines = lines.filter((l) => tick >= l.t);

  const stage = STAGES.find((s) => s.value === draft.stage);
  const market = MARKETS.find((m) => m.value === draft.target_market);
  const budget = BUDGETS.find((b) => b.id === draft.monthly_budget_band);
  const priorities = (draft.priorities || []).map((id) => PRIORITIES.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="ob-phase ob-phase--init">
      <header className="ob-phase__head">
        <div className="ob-phase__eyebrow">PHASE 04 / 04 · &nbsp;BOOT SEQUENCE</div>
        <h1 className="ob-phase__title">Initialize <em>fleet</em>.</h1>
        <p className="ob-phase__sub">{agentCount} ajan + {toolCount} tool, "{draft.product_name || 'untitled'}" için kuruluyor.</p>
      </header>

      <div className="ob-init-grid">
        <div className="ob-init-config">
          <div className="ob-init-config__title">// committed config</div>
          <dl className="ob-init-dl">
            <dt>product</dt><dd>{draft.product_name || <em>—</em>}</dd>
            <dt>category</dt><dd>{draft.category || <em>—</em>}</dd>
            <dt>stage</dt><dd>{stage?.code || <em>—</em>}</dd>
            <dt>market</dt><dd>{market?.code || <em>—</em>}</dd>
            <dt>channels</dt><dd>{(draft.channels || []).map((c) => <span key={c} className="ob-init-tag">{c}</span>)}</dd>
            <dt>budget</dt><dd>{budget?.code || <em>—</em>} <small className="ob-init-mute">{budget?.label}</small></dd>
            <dt>directives</dt><dd>
              {priorities.length === 0 && <em>—</em>}
              {priorities.map((p, i) => (
                <span key={p.id} className={`ob-init-prio ob-init-prio--${p.accent}`}>
                  <span className="ob-init-prio__rank">#{i + 1}</span> {p.code}
                </span>
              ))}
            </dd>
          </dl>
        </div>

        <div className="ob-terminal">
          <div className="ob-terminal__bar">
            <span className="ob-terminal__dot" />
            <span className="ob-terminal__dot" />
            <span className="ob-terminal__dot" />
            <span className="ob-terminal__title">oneproduct@boot — /var/log/init.log</span>
            <span className="ob-terminal__count">{visibleLines.length}/{lines.length}</span>
          </div>
          <div className="ob-terminal__body">
            {visibleLines.map((l, i) => (
              <div key={i} className="ob-terminal__line">{l.line}</div>
            ))}
            {!done && <div className="ob-terminal__line ob-terminal__cursor">█</div>}
          </div>
        </div>
      </div>

      <div className={`ob-launchbar ${done ? 'is-ready' : ''}`}>
        <div className="ob-launchbar__status">
          <div className={`ob-launchbar__dot ${done ? 'is-ready' : ''}`} />
          <div className="ob-launchbar__text">
            <strong>{done ? 'fleet armed.' : 'arming fleet...'}</strong>
            <span>{done ? 'kontrolün senin elinde.' : `${visibleLines.length}/${lines.length} systems online`}</span>
          </div>
        </div>
        <button className="ob-launchbar__btn" disabled={!done} onClick={onLaunch}>
          <IcSpark size={14} />
          INITIATE LAUNCH
          <IcArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
