import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/stores/useStore';
import type { OnboardedProduct } from '@/types';
import {
  FLEET, PHASES,
  type FleetActivator, type FleetGroup,
} from '@/components/onboarding/data';
import {
  Phase1Product, Phase2Market, Phase3Directives, Phase4Initialize,
} from '@/components/onboarding/phases';
import {
  IcArrowLeft, IcArrowRight, IcCheck, IcDot, IcSpark,
} from '@/components/onboarding/icons';
import { ONBOARDING_CSS } from '@/components/onboarding/styles';

type Draft = Partial<OnboardedProduct>;

/* Inject design-system fonts + CSS once. */
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap';
const STYLE_ID = 'onboarding-boot-styles';
const FONT_ID = 'onboarding-boot-fonts';

function useOnboardingAssets() {
  useEffect(() => {
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement('link');
      link.id = FONT_ID;
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = ONBOARDING_CSS;
      document.head.appendChild(style);
    }
  }, []);
}

/* ─── menubar ───────────────────────────────────────────────────── */
function TopMenubar({ phase, fleetArmed }: { phase: number; fleetArmed: number }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const ss = String(time.getSeconds()).padStart(2, '0');

  return (
    <div className="ob-menubar">
      <div className="ob-menubar__brand" data-testid="ticosclaw-brand">
        <img className="ob-menubar__mark" src="/ticosclaw-icon.png" alt="" aria-hidden="true" />
        TICOSCLAW
        <span className="ob-menubar__sep" />
        <span className="ob-menubar__path">os // onboarding.boot</span>
      </div>
      <div className="ob-menubar__spacer" />
      <div className="ob-menubar__items">
        <div className="ob-menubar__item">
          <span className="ob-menubar__lbl">PHASE</span>
          <span className="ob-menubar__val">{String(phase).padStart(2, '0')}/04</span>
        </div>
        <div className="ob-menubar__item">
          <span className="ob-menubar__lbl">FLEET</span>
          <span className="ob-menubar__val">{fleetArmed}/22</span>
        </div>
        <div className="ob-menubar__item ob-menubar__item--md-hide">
          <span className="ob-menubar__lbl">TOOLS</span>
          <span className="ob-menubar__val">89</span>
        </div>
        <div className="ob-menubar__item ob-menubar__item--md-hide">
          <span className="ob-menubar__lbl">RT</span>
          <span className="ob-menubar__val">0.42ms</span>
        </div>
        <div className="ob-menubar__item">
          <span className="ob-menubar__dot" />
          <span className="ob-menubar__val">{hh}:{mm}<span className="ob-menubar__mute">:{ss}</span></span>
        </div>
      </div>
    </div>
  );
}

/* ─── phase rail (left) ────────────────────────────────────────── */
function PhaseRail({
  phase, setPhase, completed,
}: {
  phase: number;
  setPhase: (n: number) => void;
  completed: number[];
}) {
  return (
    <aside className="ob-rail">
      <div className="ob-rail__head">
        <div className="ob-rail__eyebrow">// boot phases</div>
        <div className="ob-rail__title">Sequence</div>
      </div>

      <ol className="ob-rail__list">
        {PHASES.map((p) => {
          const isActive = p.n === phase;
          const isDone = completed.includes(p.n);
          const canJump = isDone || isActive;
          return (
            <li
              key={p.n}
              className={`ob-rail__step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${canJump ? 'is-jumpable' : ''}`}
              onClick={() => { if (canJump) setPhase(p.n); }}
            >
              <div className="ob-rail__step-track">
                <div className="ob-rail__step-num">
                  {isDone ? <IcCheck size={14} /> : String(p.n).padStart(2, '0')}
                </div>
                {p.n < PHASES.length && <div className="ob-rail__step-line" />}
              </div>
              <div className="ob-rail__step-body">
                <div className="ob-rail__step-code">{p.code}</div>
                <div className="ob-rail__step-title">{p.title}</div>
                <div className="ob-rail__step-sub">{p.subtitle}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="ob-rail__foot">
        <div className="ob-rail__ascii">{`╔══════════════╗
║ boot.ready   ║
║ awaiting cfg ║
╚══════════════╝`}</div>
      </div>
    </aside>
  );
}

/* ─── agent fleet (right) ──────────────────────────────────────── */
type AgentStatus = 'armed' | 'calibrating' | 'dormant';

function AgentFleet({
  statusMap, armedCount,
}: {
  statusMap: Record<string, AgentStatus>;
  armedCount: number;
}) {
  const groups: FleetGroup[] = ['CORE', 'OPS', 'GROWTH', 'INTEL'];
  return (
    <aside className="ob-fleet">
      <div className="ob-fleet__head">
        <div>
          <div className="ob-fleet__eyebrow">// agent fleet</div>
          <div className="ob-fleet__title">Roster</div>
        </div>
        <div className="ob-fleet__counter">
          <span className="ob-fleet__counter-val">{armedCount}</span>
          <span className="ob-fleet__counter-div">/</span>
          <span className="ob-fleet__counter-tot">{FLEET.length}</span>
        </div>
      </div>

      <div className="ob-fleet__progress">
        <div
          className="ob-fleet__progress-fill"
          style={{ width: `${(armedCount / FLEET.length) * 100}%` }}
        />
        <div className="ob-fleet__progress-grid">
          {FLEET.map((_, i) => <span key={i} />)}
        </div>
      </div>

      <div className="ob-fleet__list">
        {groups.map((g) => {
          const members = FLEET.filter((a) => a.group === g);
          const armed = members.filter((a) => statusMap[a.id] === 'armed').length;
          return (
            <div key={g} className="ob-fleet__group">
              <div className="ob-fleet__group-head">
                <span>{g}</span>
                <span className="ob-fleet__group-count">{armed}/{members.length}</span>
              </div>
              {members.map((a) => {
                const status = statusMap[a.id] || 'dormant';
                const label = status === 'armed' ? 'ARMED' : status === 'calibrating' ? 'CALIB' : 'DORM';
                return (
                  <div key={a.id} className={`ob-fleet__row is-${status}`}>
                    <span className={`ob-fleet__dot is-${status}`} />
                    <span className="ob-fleet__name">{a.name}</span>
                    <span className="ob-fleet__status">{label}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/* ─── process strip (bottom) ───────────────────────────────────── */
function ProcessStrip({
  phase, draft, canAdvance, missing,
}: {
  phase: number;
  draft: Draft;
  canAdvance: boolean;
  missing: string[];
}) {
  const filled: string[] = [
    draft.product_name ? 'name' : '',
    draft.category ? 'cat' : '',
    draft.stage ? 'stage' : '',
    draft.target_market ? 'mkt' : '',
    (draft.channels?.length || 0) > 0 ? 'chan' : '',
    draft.monthly_budget_band ? 'bud' : '',
    (draft.priorities?.length || 0) > 0 ? 'prio' : '',
  ].filter(Boolean);
  const pct = (filled.length / 7) * 100;

  return (
    <div className="ob-procstrip">
      <div className="ob-procstrip__group">
        <span className="ob-procstrip__lbl">CONFIG</span>
        <span className="ob-procstrip__val">{filled.length}/7</span>
        <div className="ob-procstrip__bar">
          <div className="ob-procstrip__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="ob-procstrip__group ob-procstrip__group--center">
        {filled.length > 0 ? (
          <span className="ob-procstrip__chips">
            {filled.map((f) => <span key={f} className="ob-procstrip__chip">{f}</span>)}
          </span>
        ) : (
          <span className="ob-procstrip__mute">awaiting input ...</span>
        )}
      </div>
      <div className="ob-procstrip__group ob-procstrip__group--right">
        {!canAdvance && missing.length > 0 && (
          <span className="ob-procstrip__warn">
            <IcDot size={8} /> missing: {missing.join(' · ')}
          </span>
        )}
        <span className="ob-procstrip__lbl">ETA</span>
        <span className="ob-procstrip__val">{(60 - Math.floor(pct * 0.5))}s</span>
        <span className="ob-procstrip__lbl">PHASE</span>
        <span className="ob-procstrip__val ob-procstrip__val--acid">{String(phase).padStart(2, '0')} / 04</span>
      </div>
    </div>
  );
}

/* ─── phase enter animation wrapper ────────────────────────────── */
function PhaseInner({ phase, children }: { phase: number; children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [phase]);
  return (
    <div className={`ob-main__inner ${entered ? 'is-entering' : 'is-pre'}`} key={phase}>
      {children}
    </div>
  );
}

/* ─── launched overlay ─────────────────────────────────────────── */
function LaunchedOverlay() {
  return (
    <div className="ob-launched">
      <div className="ob-launched__box">
        <div className="ob-launched__mark"><IcSpark size={28} /></div>
        <div className="ob-launched__title">fleet.deployed</div>
        <div className="ob-launched__sub">22 ajan çalışıyor. CEO Agent ilk 60 saniyeni hazırlıyor.</div>
      </div>
    </div>
  );
}

/* ─── main page ────────────────────────────────────────────────── */
export function OnboardingPageFull() {
  useOnboardingAssets();

  const storePhase = useStore((s) => s.onboardingStep);
  const draft = useStore((s) => s.onboardingDraft) as Draft;
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const updateOnboardingDraft = useStore((s) => s.updateOnboardingDraft);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const agentCount = useStore((s) => (s.agents || []).length);
  const toolCount = useStore((s) => (s.tools || []).length);

  /* The store can persist values 1..5 from the legacy flow; clamp into 1..4. */
  const phase = Math.min(4, Math.max(1, storePhase || 1));
  const [launched, setLaunched] = useState(false);

  const setPhase = (n: number) => setOnboardingStep(Math.min(4, Math.max(1, n)));
  const update = (patch: Draft) => updateOnboardingDraft(patch);

  /* Derive agent status from draft. */
  const statusMap = useMemo(() => {
    const m: Record<string, AgentStatus> = {};
    for (const a of FLEET) {
      const reqs = a.activates;
      const isSet = (k: FleetActivator) => {
        const v = draft[k];
        if (Array.isArray(v)) return v.length > 0;
        return !!v;
      };
      const fulfilled = reqs.every(isSet);
      const partial = reqs.some(isSet);
      m[a.id] = fulfilled ? 'armed' : (partial ? 'calibrating' : 'dormant');
    }
    return m;
  }, [draft]);

  const armedCount = useMemo(
    () => Object.values(statusMap).filter((s) => s === 'armed').length,
    [statusMap],
  );

  /* Validation per phase. */
  const canAdvance = (() => {
    if (phase === 1) return !!(draft.product_name && draft.category && draft.stage);
    if (phase === 2) return !!(draft.target_market && draft.monthly_budget_band && (draft.channels?.length || 0) > 0);
    if (phase === 3) return (draft.priorities?.length || 0) > 0;
    return true;
  })();

  const missing = (() => {
    if (canAdvance) return [] as string[];
    const m: string[] = [];
    if (phase === 1) {
      if (!draft.product_name) m.push('product_name');
      if (!draft.category) m.push('category');
      if (!draft.stage) m.push('stage');
    }
    if (phase === 2) {
      if (!draft.target_market) m.push('target_market');
      if ((draft.channels?.length || 0) === 0) m.push('channels');
      if (!draft.monthly_budget_band) m.push('budget');
    }
    if (phase === 3) {
      if ((draft.priorities?.length || 0) === 0) m.push('priorities');
    }
    return m;
  })();

  const completed = useMemo(() => {
    const c: number[] = [];
    if (draft.product_name && draft.category && draft.stage) c.push(1);
    if (draft.target_market && draft.monthly_budget_band && (draft.channels?.length || 0) > 0) c.push(2);
    if ((draft.priorities?.length || 0) > 0) c.push(3);
    return c;
  }, [draft]);

  /* ⌘/Ctrl+Enter to advance. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canAdvance && phase < 4) setPhase(phase + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdvance, phase]);

  const handleLaunch = () => {
    setLaunched(true);
    /* small beat so the user actually sees fleet.deployed before navigating */
    setTimeout(() => completeOnboarding(), 700);
  };

  const renderPhase = () => {
    if (phase === 1) return <Phase1Product draft={draft} update={update} />;
    if (phase === 2) return <Phase2Market draft={draft} update={update} />;
    if (phase === 3) return <Phase3Directives draft={draft} update={update} />;
    return (
      <Phase4Initialize
        draft={draft}
        agentCount={agentCount || FLEET.length}
        toolCount={toolCount || 89}
        onLaunch={handleLaunch}
      />
    );
  };

  return (
    <div className="ob-root ob-root--acid ob-root--comfortable has-scanlines">
      <TopMenubar phase={phase} fleetArmed={armedCount} />

      <div className="ob-frame">
        <PhaseRail phase={phase} setPhase={setPhase} completed={completed} />

        <main className="ob-main">
          <div className="ob-main__scroll">
            <PhaseInner phase={phase}>{renderPhase()}</PhaseInner>
          </div>

          {phase < 4 && (
            <div className="ob-nav">
              <button
                className="ob-nav__btn ob-nav__btn--back"
                disabled={phase === 1}
                onClick={() => setPhase(phase - 1)}
              >
                <IcArrowLeft size={14} /> back
              </button>
              <div className="ob-nav__center">
                <span className="ob-nav__hint">
                  {canAdvance
                    ? <>press <kbd>⌘</kbd> <kbd>↵</kbd> or click</>
                    : <>missing :: <span className="ob-nav__missing">{missing.join(' · ')}</span></>}
                </span>
              </div>
              <button
                className="ob-nav__btn ob-nav__btn--next"
                disabled={!canAdvance}
                onClick={() => setPhase(phase + 1)}
              >
                continue <IcArrowRight size={14} />
              </button>
            </div>
          )}
        </main>

        <AgentFleet statusMap={statusMap} armedCount={armedCount} />
      </div>

      <ProcessStrip phase={phase} draft={draft} canAdvance={canAdvance} missing={missing} />

      {launched && <LaunchedOverlay />}
    </div>
  );
}
