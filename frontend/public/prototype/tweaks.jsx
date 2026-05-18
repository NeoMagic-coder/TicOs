/* global React, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle, TweakSlider */
// ============================================================
// AGENT.OS — Tweaks
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#C7FF3D",
  "density": "comfortable",
  "showProcessStrip": true,
  "showMenubar": true,
  "agentGrid": "cards"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  '#C7FF3D',  // acid lime (default)
  '#FFB13D',  // amber
  '#9B7BFF',  // violet
  '#6BD4FF',  // cyan
  '#FF5C7A',  // rose
];

const AOSTweaks = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks to root CSS variables
  React.useEffect(() => {
    document.documentElement.style.setProperty('--acid', t.accent);
    document.documentElement.style.setProperty('--acid-soft', t.accent + '22');
    document.documentElement.style.setProperty('--border-accent', t.accent + '4D');

    if (t.density === 'compact') {
      document.documentElement.style.setProperty('--fs-13', '12px');
      document.documentElement.style.setProperty('--fs-12', '11px');
    } else if (t.density === 'spacious') {
      document.documentElement.style.setProperty('--fs-13', '14px');
      document.documentElement.style.setProperty('--fs-12', '13px');
    } else {
      document.documentElement.style.setProperty('--fs-13', '13px');
      document.documentElement.style.setProperty('--fs-12', '12px');
    }

    document.documentElement.style.setProperty('--procstrip-h', t.showProcessStrip ? '36px' : '0px');
    document.documentElement.style.setProperty('--menubar-h',   t.showMenubar     ? '30px' : '0px');

    const procEl = document.querySelector('.procstrip');
    if (procEl) procEl.style.display = t.showProcessStrip ? 'flex' : 'none';
    const menuEl = document.querySelector('.menubar');
    if (menuEl) menuEl.style.display = t.showMenubar ? 'flex' : 'none';
  }, [t]);

  return (
    <TweaksPanel title="AGENT.OS Tweaks">
      <TweakSection title="Aksan rengi">
        <TweakColor
          label="Accent"
          options={ACCENT_OPTIONS}
          value={t.accent}
          onChange={(v) => setTweak('accent', v)}
        />
      </TweakSection>

      <TweakSection title="Yoğunluk">
        <TweakRadio
          label="Density"
          options={[
            { label: 'Compact',     value: 'compact' },
            { label: 'Comfortable', value: 'comfortable' },
            { label: 'Spacious',    value: 'spacious' },
          ]}
          value={t.density}
          onChange={(v) => setTweak('density', v)}
        />
      </TweakSection>

      <TweakSection title="OS şeritleri">
        <TweakToggle
          label="Top menubar"
          value={t.showMenubar}
          onChange={(v) => setTweak('showMenubar', v)}
        />
        <TweakToggle
          label="Process strip"
          value={t.showProcessStrip}
          onChange={(v) => setTweak('showProcessStrip', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
};

window.AOSTweaks = AOSTweaks;
