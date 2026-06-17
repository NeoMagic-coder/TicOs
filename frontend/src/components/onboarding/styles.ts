/* Onboarding boot-sequence design system styles.
   Loaded once via a <style> element to keep everything in-file. */

export const ONBOARDING_CSS = `
.ob-root {
  --bg-0: #08090C;
  --bg-1: #0D0F13;
  --bg-2: #14171D;
  --bg-3: #1A1E26;
  --bg-inset: #050608;

  --border-faint: rgba(255, 255, 255, 0.045);
  --border:       rgba(255, 255, 255, 0.075);
  --border-strong:rgba(255, 255, 255, 0.14);

  --fg-1: #ECEFF4;
  --fg-2: #B8BFCC;
  --fg-3: #7C8497;
  --fg-4: #4A5060;

  --acid:        #C7FF3D;
  --acid-soft:   rgba(199, 255, 61, 0.12);
  --acid-deep:   #97C621;
  --amber:       #FFB13D;
  --amber-soft:  rgba(255, 177, 61, 0.12);
  --rose:        #FF5C7A;
  --rose-soft:   rgba(255, 92, 122, 0.12);
  --violet:      #9B7BFF;
  --violet-soft: rgba(155, 123, 255, 0.13);
  --cyan:        #6BD4FF;
  --cyan-soft:   rgba(107, 212, 255, 0.12);

  --font-sans: 'Geist', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-serif: 'Instrument Serif', 'Times New Roman', serif;

  --r-1: 2px; --r-2: 4px; --r-3: 6px; --r-4: 8px; --r-5: 12px;

  --menubar-h: 108px;
  --procstrip-h: 32px;
  --rail-w: 240px;
  --fleet-w: 304px;

  --accent: var(--acid);
  --accent-soft: var(--acid-soft);
  --accent-deep: var(--acid-deep);
  --accent-rgb: 199,255,61;

  --ease: cubic-bezier(0.4, 0, 0.2, 1);
}

.ob-root * { box-sizing: border-box; }
.ob-root button { background: none; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0; }
.ob-root input, .ob-root textarea { font: inherit; color: inherit; background: none; border: none; outline: none; }
.ob-root textarea { resize: none; }
.ob-root ::selection { background: var(--accent-soft); color: var(--accent); }
.ob-root em { font-style: italic; }
.ob-root kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg-2);
}
.ob-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.ob-root ::-webkit-scrollbar-track { background: transparent; }
.ob-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 4px; }
.ob-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

.ob-root {
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  background:
    radial-gradient(ellipse 1200px 600px at 15% 0%, rgba(199,255,61,0.03), transparent 70%),
    radial-gradient(ellipse 900px 600px at 100% 100%, rgba(155,123,255,0.025), transparent 70%),
    var(--bg-0);
  color: var(--fg-1);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.005em;
  overflow: hidden;
}
.ob-root--acid   { --accent: #C7FF3D; --accent-soft: rgba(199,255,61,0.12); --accent-deep: #97C621; --accent-rgb: 199,255,61; }
.ob-root--amber  { --accent: #FFB13D; --accent-soft: rgba(255,177,61,0.13); --accent-deep: #D08820; --accent-rgb: 255,177,61; }
.ob-root--violet { --accent: #9B7BFF; --accent-soft: rgba(155,123,255,0.14); --accent-deep: #6E54CC; --accent-rgb: 155,123,255; }
.ob-root--cyan   { --accent: #6BD4FF; --accent-soft: rgba(107,212,255,0.13); --accent-deep: #2DA8DB; --accent-rgb: 107,212,255; }

.ob-root.has-scanlines::after {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    180deg,
    transparent 0px,
    transparent 2px,
    rgba(255,255,255,0.012) 2px,
    rgba(255,255,255,0.012) 3px
  );
  mix-blend-mode: screen;
  z-index: 60;
}

.ob-menubar {
  height: var(--menubar-h);
  flex: none;
  display: flex; align-items: center;
  padding: 0 14px;
  background: rgba(13, 15, 19, 0.85);
  backdrop-filter: blur(20px) saturate(140%);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-2);
  z-index: 50;
  position: relative;
}
.ob-menubar__brand { display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: 0.04em; color: var(--fg-1); }
.ob-menubar__mark {
  width: 100px; height: 100px;
  border-radius: 25px;
  object-fit: cover;
}
.ob-menubar__sep { width: 1px; height: 12px; background: var(--border); margin: 0 8px; }
.ob-menubar__path { color: var(--fg-3); font-weight: 400; }
.ob-menubar__spacer { flex: 1; }
.ob-menubar__items { display: flex; align-items: center; gap: 18px; }
.ob-menubar__item { display: flex; align-items: center; gap: 6px; }
.ob-menubar__lbl { color: var(--fg-3); text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; }
.ob-menubar__val { color: var(--fg-1); font-variant-numeric: tabular-nums; }
.ob-menubar__mute { color: var(--fg-3); }
.ob-menubar__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  animation: ob-pulse 1.8s ease-out infinite;
}
@media (max-width: 1280px) {
  .ob-menubar__item--md-hide { display: none; }
}

.ob-frame {
  flex: 1;
  display: grid;
  grid-template-columns: var(--rail-w) 1fr var(--fleet-w);
  min-height: 0;
}

.ob-rail {
  background: var(--bg-1);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ob-rail__head { padding: 18px 18px 10px; border-bottom: 1px solid var(--border-faint); }
.ob-rail__eyebrow { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); letter-spacing: 0.1em; }
.ob-rail__title { font-size: 18px; font-weight: 500; letter-spacing: -0.02em; margin-top: 2px; }

.ob-rail__list {
  list-style: none; margin: 0; padding: 14px 18px;
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column;
}
.ob-rail__step {
  display: flex; gap: 12px;
  padding-bottom: 22px;
  position: relative;
}
.ob-rail__step.is-jumpable { cursor: pointer; }
.ob-rail__step-track {
  display: flex; flex-direction: column; align-items: center;
  flex: none; width: 32px;
}
.ob-rail__step-num {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--bg-2);
  display: grid; place-items: center;
  font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  color: var(--fg-3);
  position: relative;
  transition: all 0.2s var(--ease);
}
.ob-rail__step-line {
  flex: 1; width: 1px;
  background: linear-gradient(180deg, var(--border) 0%, var(--border-faint) 100%);
  margin: 6px 0 -4px;
  min-height: 16px;
}
.ob-rail__step-body { flex: 1; padding-top: 4px; min-width: 0; }
.ob-rail__step-code {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-3); letter-spacing: 0.12em;
}
.ob-rail__step-title { font-size: 14px; font-weight: 500; color: var(--fg-2); letter-spacing: -0.01em; margin-top: 1px; }
.ob-rail__step-sub { font-size: 11px; color: var(--fg-4); margin-top: 2px; font-family: var(--font-mono); }

.ob-rail__step.is-active .ob-rail__step-num {
  background: var(--accent);
  border-color: var(--accent);
  color: #0A0B0E;
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.ob-rail__step.is-active .ob-rail__step-title { color: var(--fg-1); }
.ob-rail__step.is-active .ob-rail__step-code { color: var(--accent); }

.ob-rail__step.is-done .ob-rail__step-num {
  background: transparent;
  border-color: var(--accent);
  color: var(--accent);
}
.ob-rail__step.is-done .ob-rail__step-line { background: var(--accent); opacity: 0.4; }
.ob-rail__step.is-done .ob-rail__step-title { color: var(--fg-2); }

.ob-rail__foot {
  padding: 14px 18px;
  border-top: 1px solid var(--border-faint);
}
.ob-rail__ascii {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-4);
  white-space: pre;
  line-height: 1.4;
}

.ob-main {
  display: flex; flex-direction: column;
  min-width: 0;
  min-height: 0;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.008) 0%, transparent 30%),
    var(--bg-0);
  position: relative;
}
.ob-main__scroll {
  flex: 1;
  overflow-y: auto;
}
.ob-main__inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 36px 40px 20px;
  transition: opacity 0.28s var(--ease), transform 0.28s var(--ease);
}
.ob-main__inner.is-pre { opacity: 0; transform: translateY(6px); }
.ob-main__inner.is-entering { opacity: 1; transform: translateY(0); }

.ob-phase__head { margin-bottom: 28px; }
.ob-phase__eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--accent);
  margin-bottom: 6px;
  display: flex; align-items: center;
}
.ob-blink {
  display: inline-block;
  animation: ob-blink 1s steps(2) infinite;
  color: var(--accent);
}
@keyframes ob-blink { 50% { opacity: 0; } }

.ob-phase__title {
  font-size: 46px;
  font-weight: 400;
  letter-spacing: -0.035em;
  line-height: 1;
  margin: 0;
  color: var(--fg-1);
}
.ob-phase__title em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  color: var(--accent);
  font-size: 1.05em;
  letter-spacing: -0.025em;
}
.ob-phase__sub {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--fg-3);
  max-width: 56ch;
}
.ob-phase__sub strong { color: var(--fg-1); font-weight: 500; }

.ob-fieldlabel {
  display: flex; align-items: baseline; gap: 8px;
  margin: 22px 0 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-3);
  letter-spacing: 0.04em;
}
.ob-fieldlabel__code { color: var(--accent); font-weight: 600; }
.ob-fieldlabel__text {
  color: var(--fg-2);
  text-transform: lowercase;
  font-size: 12px;
  letter-spacing: -0.005em;
}
.ob-fieldlabel__hint {
  margin-left: auto;
  font-size: 10px;
  color: var(--fg-4);
}
.ob-fieldlabel__status--info {
  margin-left: auto;
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.ob-divider {
  margin: 28px 0 18px;
  display: flex; align-items: center;
  gap: 12px;
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4);
  letter-spacing: 0.12em;
}
.ob-divider::before, .ob-divider::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--border) 50%, transparent);
}

.ob-input {
  display: flex; align-items: center;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  padding: 0 12px;
  transition: border-color 0.15s var(--ease);
  position: relative;
}
.ob-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.ob-input__caret {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 14px;
  margin-right: 8px;
  user-select: none;
}
.ob-input input, .ob-input textarea {
  flex: 1; width: 100%;
  padding: 12px 0;
  font-size: 14px;
  color: var(--fg-1);
}
.ob-input--large input { font-size: 22px; padding: 16px 0; letter-spacing: -0.02em; font-weight: 500; }
.ob-input--large .ob-input__caret { font-size: 22px; }
.ob-input--area { padding: 4px 12px; }
.ob-input--area textarea { padding: 12px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.6; color: var(--fg-2); }
.ob-input input::placeholder, .ob-input textarea::placeholder { color: var(--fg-4); }

.ob-refurl { display: flex; gap: 8px; align-items: stretch; }
.ob-refurl__input { flex: 1 1 auto; min-width: 0; }
.ob-refurl__btn {
  flex: 0 0 auto;
  background: var(--bg-1);
  border: 1px solid var(--accent);
  border-radius: var(--r-3);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0 16px;
  cursor: pointer;
  transition: all 0.15s var(--ease);
  white-space: nowrap;
}
.ob-refurl__btn:hover:not(:disabled) { background: var(--accent); color: var(--bg-0); }
.ob-refurl__btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ob-grid { display: grid; gap: 8px; }
.ob-grid--cat { grid-template-columns: repeat(4, 1fr); }
.ob-grid--3 { grid-template-columns: repeat(3, 1fr); }

.ob-tile {
  position: relative;
  text-align: left;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  padding: 12px 12px;
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg-2);
  transition: all 0.15s var(--ease);
}
.ob-tile:hover { border-color: var(--border-strong); color: var(--fg-1); }
.ob-tile.is-selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--fg-1);
}
.ob-tile__icon { color: var(--fg-3); display: flex; }
.ob-tile.is-selected .ob-tile__icon { color: var(--accent); }
.ob-tile__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-tile__check {
  width: 16px; height: 16px;
  display: grid; place-items: center;
  background: var(--accent); color: #0A0B0E;
  border-radius: 50%;
}

.ob-tile--cat { padding: 12px 10px; }
.ob-tile--cat .ob-tile__label { font-size: 12px; }

.ob-tile--market {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 16px;
  min-height: 140px;
}
.ob-tile__head {
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4); letter-spacing: 0.12em;
}
.ob-tile.is-selected .ob-tile__head .ob-tile__code { color: var(--accent); }
.ob-tile__bigicon { margin: 14px 0 6px; color: var(--fg-3); }
.ob-tile.is-selected .ob-tile__bigicon { color: var(--accent); }
.ob-tile--market .ob-tile__label {
  font-family: var(--font-sans); font-size: 18px; font-weight: 500;
  color: var(--fg-1); letter-spacing: -0.015em;
}
.ob-tile__desc {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4); margin-top: 4px;
  letter-spacing: 0.02em;
}

.ob-stages { display: flex; flex-direction: column; gap: 8px; }
.ob-stagecard {
  display: flex; gap: 14px;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  text-align: left;
  transition: all 0.15s var(--ease);
  position: relative;
}
.ob-stagecard:hover { border-color: var(--border-strong); }
.ob-stagecard.is-selected {
  border-color: var(--accent);
  background:
    linear-gradient(90deg, var(--accent-soft) 0%, transparent 50%),
    var(--bg-1);
}
.ob-stagecard.is-selected::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 2px; background: var(--accent);
}
.ob-stagecard__icon {
  flex: none;
  width: 44px; height: 44px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  display: grid; place-items: center;
  color: var(--fg-3);
}
.ob-stagecard.is-selected .ob-stagecard__icon {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.ob-stagecard__body { flex: 1; min-width: 0; }
.ob-stagecard__row { display: flex; align-items: center; gap: 8px; }
.ob-stagecard__code {
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
  color: var(--fg-3);
}
.ob-stagecard.is-selected .ob-stagecard__code { color: var(--accent); }
.ob-stagecard__label {
  font-size: 14px; font-weight: 500; color: var(--fg-1);
  margin-top: 2px; letter-spacing: -0.01em;
}
.ob-stagecard__hint {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-3); margin-top: 2px;
}
.ob-stagecard__lights { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.ob-stagecard__light {
  font-family: var(--font-mono); font-size: 9px;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--fg-4);
  background: var(--bg-2);
  border: 1px solid var(--border-faint);
  padding: 2px 6px; border-radius: 2px;
}
.ob-stagecard__light.is-on {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.3);
  background: var(--accent-soft);
}

.ob-channels { display: flex; flex-wrap: wrap; gap: 6px; }
.ob-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 100px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-2);
  transition: all 0.15s var(--ease);
}
.ob-chip:hover { border-color: var(--border-strong); color: var(--fg-1); }
.ob-chip.is-selected {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.ob-chip__icon { display: flex; opacity: 0.7; }
.ob-chip.is-selected .ob-chip__icon { opacity: 1; }

.ob-budgets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.ob-budget {
  position: relative;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  padding: 14px;
  text-align: left;
  display: grid;
  grid-template-rows: auto auto auto auto auto;
  gap: 4px;
  transition: all 0.15s var(--ease);
}
.ob-budget:hover { border-color: var(--border-strong); }
.ob-budget.is-selected { border-color: var(--accent); background: var(--accent-soft); }
.ob-budget__index { font-family: var(--font-mono); font-size: 10px; color: var(--fg-4); letter-spacing: 0.12em; }
.ob-budget.is-selected .ob-budget__index { color: var(--accent); }
.ob-budget__icon { margin: 2px 0 4px; color: var(--fg-3); }
.ob-budget.is-selected .ob-budget__icon { color: var(--accent); }
.ob-budget__code { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); letter-spacing: 0.12em; }
.ob-budget__label {
  font-family: var(--font-sans);
  font-size: 14px; font-weight: 500;
  color: var(--fg-1); letter-spacing: -0.01em;
}
.ob-budget__label small { font-size: 11px; color: var(--fg-4); margin-left: 2px; font-weight: 400; }
.ob-budget__desc { font-family: var(--font-mono); font-size: 10px; color: var(--fg-4); letter-spacing: 0.02em; }
.ob-budget__watts {
  position: absolute; top: 14px; right: 14px;
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4);
  padding: 1px 5px;
  background: var(--bg-2);
  border: 1px solid var(--border-faint);
  border-radius: 2px;
}
.ob-budget.is-selected .ob-budget__watts {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.3);
  background: var(--accent-soft);
}

.ob-directives {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 8px;
}
.ob-directive {
  position: relative;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-4);
  padding: 18px 20px;
  text-align: left;
  display: flex; flex-direction: column;
  gap: 4px;
  overflow: hidden;
  transition: all 0.15s var(--ease);
}
.ob-directive:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.ob-directive__head { display: flex; align-items: center; justify-content: space-between; }
.ob-directive__rank {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-4);
  letter-spacing: 0.06em;
  font-weight: 600;
}
.ob-directive__code {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4); letter-spacing: 0.12em;
}
.ob-directive__icon { margin: 14px 0 6px; color: var(--fg-3); transition: color 0.2s var(--ease); }
.ob-directive__label {
  font-size: 22px; font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--fg-1);
}
.ob-directive__desc { font-family: var(--font-mono); font-size: 11px; color: var(--fg-4); margin-top: 2px; }
.ob-directive__bar { margin-top: 14px; height: 2px; background: var(--border); border-radius: 1px; overflow: hidden; }
.ob-directive__bar-fill { height: 100%; background: var(--accent); transition: width 0.3s var(--ease); }

.ob-directive--amber.is-selected  { border-color: var(--amber);  background: var(--amber-soft); }
.ob-directive--amber.is-selected  .ob-directive__icon,
.ob-directive--amber.is-selected  .ob-directive__rank,
.ob-directive--amber.is-selected  .ob-directive__code { color: var(--amber); }
.ob-directive--amber.is-selected  .ob-directive__bar-fill { background: var(--amber); }

.ob-directive--violet.is-selected { border-color: var(--violet); background: var(--violet-soft); }
.ob-directive--violet.is-selected .ob-directive__icon,
.ob-directive--violet.is-selected .ob-directive__rank,
.ob-directive--violet.is-selected .ob-directive__code { color: var(--violet); }
.ob-directive--violet.is-selected .ob-directive__bar-fill { background: var(--violet); }

.ob-directive--cyan.is-selected   { border-color: var(--cyan);   background: var(--cyan-soft); }
.ob-directive--cyan.is-selected   .ob-directive__icon,
.ob-directive--cyan.is-selected   .ob-directive__rank,
.ob-directive--cyan.is-selected   .ob-directive__code { color: var(--cyan); }
.ob-directive--cyan.is-selected   .ob-directive__bar-fill { background: var(--cyan); }

.ob-directive--acid.is-selected   { border-color: var(--accent); background: var(--accent-soft); }
.ob-directive--acid.is-selected   .ob-directive__icon,
.ob-directive--acid.is-selected   .ob-directive__rank,
.ob-directive--acid.is-selected   .ob-directive__code { color: var(--accent); }
.ob-directive--acid.is-selected   .ob-directive__bar-fill { background: var(--accent); }

.ob-note {
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--r-2);
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-2);
  letter-spacing: 0.02em;
}
.ob-note__icon { color: var(--accent); }

.ob-phase--init .ob-main__inner { max-width: 900px; }

.ob-init-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 14px;
  margin-top: 8px;
}
@media (max-width: 1100px) {
  .ob-init-grid { grid-template-columns: 1fr; }
}

.ob-init-config {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  padding: 16px 18px;
}
.ob-init-config__title {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-4); letter-spacing: 0.12em;
  margin-bottom: 12px;
}
.ob-init-dl {
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  font-family: var(--font-mono); font-size: 12px;
}
.ob-init-dl dt {
  color: var(--fg-4);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding-top: 3px;
}
.ob-init-dl dd {
  margin: 0;
  color: var(--fg-1);
  font-size: 12px;
  display: flex; flex-wrap: wrap; gap: 4px;
}
.ob-init-dl dd em { color: var(--fg-4); }
.ob-init-mute { color: var(--fg-4); margin-left: 4px; }
.ob-init-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--fg-2);
}
.ob-init-prio {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; letter-spacing: 0.08em;
  padding: 2px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 2px;
}
.ob-init-prio__rank { color: var(--fg-3); font-weight: 600; }
.ob-init-prio--acid   { color: var(--acid);   border-color: rgba(199,255,61,0.3);   background: var(--acid-soft); }
.ob-init-prio--amber  { color: var(--amber);  border-color: rgba(255,177,61,0.3);   background: var(--amber-soft); }
.ob-init-prio--violet { color: var(--violet); border-color: rgba(155,123,255,0.3);  background: var(--violet-soft); }
.ob-init-prio--cyan   { color: var(--cyan);   border-color: rgba(107,212,255,0.3);  background: var(--cyan-soft); }

.ob-terminal {
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  overflow: hidden;
  display: flex; flex-direction: column;
}
.ob-terminal__bar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-3);
}
.ob-terminal__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--bg-3);
}
.ob-terminal__dot:nth-child(1) { background: var(--rose); }
.ob-terminal__dot:nth-child(2) { background: var(--amber); }
.ob-terminal__dot:nth-child(3) { background: var(--accent); }
.ob-terminal__title { margin-left: 8px; }
.ob-terminal__count { margin-left: auto; letter-spacing: 0.08em; }
.ob-terminal__body {
  padding: 14px 14px 16px;
  font-family: var(--font-mono); font-size: 12px;
  color: var(--fg-2);
  min-height: 280px;
  line-height: 1.7;
}
.ob-terminal__line { animation: ob-fade-in 0.2s var(--ease) both; }
@keyframes ob-fade-in { from { opacity: 0; } to { opacity: 1; } }
.ob-terminal__cursor {
  color: var(--accent);
  animation: ob-blink 0.9s steps(2) infinite;
}

.ob-launchbar {
  margin-top: 14px;
  padding: 14px 18px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-3);
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  transition: all 0.2s var(--ease);
}
.ob-launchbar.is-ready {
  border-color: var(--accent);
  background:
    linear-gradient(90deg, var(--accent-soft) 0%, transparent 60%),
    var(--bg-1);
}
.ob-launchbar__status { display: flex; align-items: center; gap: 12px; }
.ob-launchbar__dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 8px var(--amber);
  animation: ob-pulse 1.4s ease-out infinite;
}
.ob-launchbar__dot.is-ready {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.ob-launchbar__text { display: flex; flex-direction: column; }
.ob-launchbar__text strong { font-size: 14px; font-weight: 500; color: var(--fg-1); }
.ob-launchbar__text span { font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }
.ob-launchbar__btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: var(--accent);
  color: #0A0B0E;
  border-radius: var(--r-2);
  font-family: var(--font-mono);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.08em;
  transition: all 0.15s var(--ease);
}
.ob-launchbar__btn:disabled {
  background: var(--bg-2);
  color: var(--fg-4);
  cursor: not-allowed;
}
.ob-launchbar__btn:not(:disabled):hover {
  background: #D8FF55;
  transform: translateY(-1px);
  box-shadow: 0 4px 20px var(--accent-soft);
}

.ob-nav {
  flex: none;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 40px;
  border-top: 1px solid var(--border-faint);
  background: rgba(13,15,19,0.6);
  backdrop-filter: blur(10px);
  max-width: 760px; margin: 0 auto; width: 100%;
}
.ob-nav__btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-2);
  font-family: var(--font-mono); font-size: 12px;
  color: var(--fg-2);
  background: var(--bg-2);
  transition: all 0.15s var(--ease);
}
.ob-nav__btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--fg-1); }
.ob-nav__btn:disabled { opacity: 0.3; cursor: not-allowed; }
.ob-nav__btn--next {
  background: var(--accent);
  color: #0A0B0E;
  border-color: var(--accent);
  font-weight: 600;
  padding: 8px 18px;
}
.ob-nav__btn--next:hover:not(:disabled) { background: #D8FF55; }
.ob-nav__btn--next:disabled { background: var(--bg-2); color: var(--fg-4); border-color: var(--border); }
.ob-nav__center {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-3);
  letter-spacing: 0.02em;
}
.ob-nav__hint kbd { margin: 0 1px; }
.ob-nav__missing { color: var(--rose); }

.ob-fleet {
  background: var(--bg-1);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ob-fleet__head {
  padding: 18px 18px 12px;
  border-bottom: 1px solid var(--border-faint);
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 8px;
}
.ob-fleet__head > div:first-child { min-width: 0; flex: 1; }
.ob-fleet__eyebrow { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); letter-spacing: 0.1em; }
.ob-fleet__title { font-size: 18px; font-weight: 500; letter-spacing: -0.02em; margin-top: 2px; }
.ob-fleet__counter {
  font-family: var(--font-mono);
  display: flex; align-items: baseline; gap: 1px;
  font-variant-numeric: tabular-nums;
}
.ob-fleet__counter-val { font-size: 24px; color: var(--accent); font-weight: 600; letter-spacing: -0.02em; }
.ob-fleet__counter-div { color: var(--fg-4); font-size: 16px; }
.ob-fleet__counter-tot { color: var(--fg-3); font-size: 14px; }

.ob-fleet__progress {
  position: relative;
  height: 18px;
  margin: 12px 18px 0;
  background: var(--bg-inset);
  border: 1px solid var(--border-faint);
  border-radius: 2px;
  overflow: hidden;
}
.ob-fleet__progress-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: var(--accent);
  transition: width 0.5s var(--ease);
  box-shadow: 0 0 12px var(--accent);
}
.ob-fleet__progress-grid {
  position: absolute; inset: 0;
  display: grid;
  grid-template-columns: repeat(22, 1fr);
  pointer-events: none;
}
.ob-fleet__progress-grid span { border-right: 1px solid rgba(0,0,0,0.4); }
.ob-fleet__progress-grid span:last-child { border: none; }

.ob-fleet__list {
  flex: 1; overflow-y: auto;
  padding: 16px 12px 16px;
}
.ob-fleet__group { margin-bottom: 14px; }
.ob-fleet__group-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 6px 6px;
  font-family: var(--font-mono); font-size: 10px;
  color: var(--fg-3); letter-spacing: 0.12em;
  border-bottom: 1px solid var(--border-faint);
  margin-bottom: 4px;
}
.ob-fleet__group-count { color: var(--fg-4); }

.ob-fleet__row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 6px;
  font-family: var(--font-mono); font-size: 11px;
  border-radius: var(--r-2);
  transition: background 0.15s var(--ease);
}
.ob-fleet__row.is-armed { color: var(--fg-1); }
.ob-fleet__row.is-armed:hover { background: var(--bg-2); }
.ob-fleet__row.is-calibrating { color: var(--amber); }
.ob-fleet__row.is-dormant { color: var(--fg-4); }

.ob-fleet__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-4); }
.ob-fleet__dot.is-armed {
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.6);
  animation: ob-pulse 1.8s ease-out infinite;
}
.ob-fleet__dot.is-calibrating {
  background: var(--amber);
  animation: ob-blink 0.9s steps(2) infinite;
}

.ob-fleet__name { flex: 1; font-size: 11px; }
.ob-fleet__status { font-size: 9px; letter-spacing: 0.1em; color: var(--fg-4); }
.ob-fleet__row.is-armed .ob-fleet__status { color: var(--accent); }
.ob-fleet__row.is-calibrating .ob-fleet__status { color: var(--amber); }

@keyframes ob-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.55); }
  100% { box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0); }
}

.ob-procstrip {
  height: var(--procstrip-h);
  flex: none;
  display: flex; align-items: center;
  padding: 0 14px;
  gap: 18px;
  background: rgba(13,15,19,0.92);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-3);
  z-index: 40;
}
.ob-procstrip__group { display: flex; align-items: center; gap: 8px; }
.ob-procstrip__group--center { flex: 1; min-width: 0; overflow: hidden; }
.ob-procstrip__group--right { gap: 12px; flex: none; }
.ob-procstrip__group--right > * { flex: none; }
.ob-procstrip__lbl { text-transform: uppercase; letter-spacing: 0.12em; color: var(--fg-4); }
.ob-procstrip__val { color: var(--fg-1); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.ob-procstrip__val--acid { color: var(--accent); }
.ob-procstrip__bar { width: 80px; height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
.ob-procstrip__bar-fill { height: 100%; background: var(--accent); transition: width 0.4s var(--ease); }
.ob-procstrip__chips { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
.ob-procstrip__chip {
  padding: 2px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-faint);
  border-radius: 2px;
  color: var(--accent);
  letter-spacing: 0.06em;
}
.ob-procstrip__mute { color: var(--fg-4); font-style: italic; }
.ob-procstrip__warn {
  color: var(--rose);
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px;
  background: var(--rose-soft);
  border: 1px solid rgba(255,92,122,0.3);
  border-radius: 2px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  max-width: 360px;
}

.ob-launched {
  position: fixed; inset: 0;
  background: rgba(5,6,8,0.85);
  backdrop-filter: blur(12px);
  display: grid; place-items: center;
  z-index: 200;
  animation: ob-fade-in 0.3s var(--ease);
}
.ob-launched__box {
  background: var(--bg-1);
  border: 1px solid var(--accent);
  border-radius: var(--r-4);
  padding: 36px 48px;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 6px var(--accent-soft);
  max-width: 420px;
}
.ob-launched__mark {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: grid; place-items: center;
  margin: 0 auto 16px;
}
.ob-launched__title {
  font-family: var(--font-mono);
  font-size: 22px; font-weight: 600;
  color: var(--accent);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.ob-launched__sub {
  color: var(--fg-3); font-size: 13px; margin-bottom: 18px;
  max-width: 30ch; margin-left: auto; margin-right: auto;
}
.ob-launched__btn {
  font-family: var(--font-mono); font-size: 11px;
  padding: 8px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-2);
  color: var(--fg-2);
  letter-spacing: 0.06em;
}
.ob-launched__btn:hover { color: var(--fg-1); border-color: var(--accent); }

@media (max-width: 1340px) {
  .ob-root { --fleet-w: 268px; }
}
@media (max-width: 1180px) {
  .ob-root { --rail-w: 200px; --fleet-w: 240px; }
  .ob-phase__title { font-size: 38px; }
}
`;
