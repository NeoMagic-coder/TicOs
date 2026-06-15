import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Volume2, VolumeX, ChevronRight, MapPin, RotateCcw, Minimize2 } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { useGuideStore } from '@/stores/useGuideStore';
import { GUIDE_STEPS, GUIDE_STEP_COUNT } from '@/lib/guide/guideSteps';
import {
  speakTurkish,
  stopSpeaking,
  isSpeechSupported,
  primeSpeechVoices,
  isSpeaking,
} from '@/lib/guide/speak';
import { buildContextSuggestions } from '@/lib/guide/suggestions';

function renderMessage(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.includes('\n')) {
      return part.split('\n').map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 ? <br /> : null}
        </span>
      ));
    }
    return <span key={i}>{part}</span>;
  });
}

const VOICE_COMMANDS: Record<string, string> = {
  sonraki: 'next',
  devam: 'next',
  ileri: 'next',
  göster: 'show',
  git: 'show',
  tekrar: 'repeat',
  dinle: 'repeat',
  kapat: 'minimize',
  dur: 'stop',
};

export function GuideAssistant() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const approvals = useStore((s) => s.approvals);
  const brandIdentity = useStore((s) => s.brandIdentity);
  const integrationStatus = useStore((s) => s.integrationStatus);
  const dashboard = useStore((s) => s.dashboard);
  const onboardedProduct = useStore((s) => s.onboardedProduct);

  const stepIndex = useGuideStore((s) => s.stepIndex);
  const tourComplete = useGuideStore((s) => s.tourComplete);
  const minimized = useGuideStore((s) => s.minimized);
  const voiceEnabled = useGuideStore((s) => s.voiceEnabled);
  const advance = useGuideStore((s) => s.advance);
  const resetTour = useGuideStore((s) => s.resetTour);
  const setMinimized = useGuideStore((s) => s.setMinimized);
  const setVoiceEnabled = useGuideStore((s) => s.setVoiceEnabled);

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const spokeForStepRef = useRef<number | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  const step = GUIDE_STEPS[stepIndex] ?? GUIDE_STEPS[0];
  const progressPct = Math.round(((stepIndex + 1) / GUIDE_STEP_COUNT) * 100);

  const suggestions = useMemo(
    () =>
      buildContextSuggestions({
        approvals,
        brandIdentity,
        integrationStatus,
        dashboard,
        onboardedProduct,
      }),
    [approvals, brandIdentity, integrationStatus, dashboard, onboardedProduct],
  );

  const speakStep = useCallback(
    (text: string) => {
      if (!voiceEnabled) return;
      stopSpeaking();
      void speakTurkish(text, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    },
    [voiceEnabled],
  );

  const navigateTo = useCallback(
    (page?: string) => {
      if (page) setCurrentPage(page);
    },
    [setCurrentPage],
  );

  const showCurrentStep = useCallback(() => {
    if (step.page) navigateTo(step.page);
  }, [step, navigateTo]);

  const handleNext = useCallback(() => {
    if (tourComplete || stepIndex >= GUIDE_STEP_COUNT - 1) {
      useGuideStore.getState().completeTour();
      speakStep(GUIDE_STEPS[GUIDE_STEP_COUNT - 1].speech);
      return;
    }
    advance();
  }, [advance, tourComplete, stepIndex, speakStep]);

  const handleRepeat = useCallback(() => {
    speakStep(step.speech);
  }, [step.speech, speakStep]);

  const runVoiceCommand = useCallback(
    (raw: string) => {
      const token = raw.trim().toLowerCase().replace(/[.!,?]/g, '');
      const action = VOICE_COMMANDS[token];
      if (!action) {
        speakStep('Anladım. Sonraki, göster veya tekrar diyebilirsiniz.');
        return;
      }
      switch (action) {
        case 'next':
          handleNext();
          break;
        case 'show':
          showCurrentStep();
          speakStep(step.page ? 'Sayfayı açıyorum.' : 'Bu adımda açılacak sayfa yok, sonraki ile devam edin.');
          break;
        case 'repeat':
          handleRepeat();
          break;
        case 'minimize':
          stopSpeaking();
          setMinimized(true);
          break;
        case 'stop':
          stopSpeaking();
          setSpeaking(false);
          break;
      }
    },
    [handleNext, showCurrentStep, handleRepeat, step.page, speakStep, setMinimized],
  );

  const startListening = useCallback(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) {
      speakStep('Bu tarayıcıda sesli komut desteklenmiyor. Düğmeleri kullanabilirsiniz.');
      return;
    }
    try {
      stopSpeaking();
      const recog = new SR();
      recog.lang = 'tr-TR';
      recog.interimResults = false;
      recog.continuous = false;
      recog.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results?.[0]?.[0]?.transcript || '';
        if (text) runVoiceCommand(text);
      };
      recog.onend = () => setListening(false);
      recog.onerror = () => setListening(false);
      recogRef.current = recog;
      recog.start();
      setListening(true);
      speakStep('Dinliyorum… Sonraki, göster veya tekrar deyin.');
    } catch {
      setListening(false);
    }
  }, [runVoiceCommand, speakStep]);

  useEffect(() => {
    if (minimized) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Element;
      if (!el.closest('.guide-assistant__card')) {
        stopSpeaking();
        setMinimized(true);
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDoc), 120);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [minimized, setMinimized]);

  useEffect(() => {
    primeSpeechVoices();
    return () => stopSpeaking();
  }, []);

  // Yeni adımda otomatik konuş (yalnızca panel açıkken).
  useEffect(() => {
    if (minimized || !voiceEnabled) return;
    if (spokeForStepRef.current === stepIndex) return;
    spokeForStepRef.current = stepIndex;
    const t = window.setTimeout(() => speakStep(step.speech), 400);
    return () => clearTimeout(t);
  }, [stepIndex, step.speech, minimized, voiceEnabled, speakStep]);

  const applySuggestion = (s: { page?: string; speech: string; label: string }) => {
    const ack = useStore.getState().tryExecuteFromText(s.label);
    if (ack) {
      speakStep(ack);
      return;
    }
    const ack2 = useStore.getState().tryExecuteFromText(s.speech);
    if (ack2) {
      speakStep(ack2);
      return;
    }
    speakStep(s.speech);
    if (s.page) navigateTo(s.page);
  };

  if (minimized) {
    return (
      <button
        type="button"
        className="guide-assistant-fab"
        onClick={() => setMinimized(false)}
        aria-label="Ticü asistanını aç"
      >
        <span className="guide-assistant-fab__icon" aria-hidden="true">
          <img src="/ticosclaw-icon.png" alt="" className="guide-assistant-fab__img" />
          <span className="guide-assistant-fab__pulse" />
        </span>
        <span className="guide-assistant-fab__label">Rehber</span>
      </button>
    );
  }

  return (
    <aside className="guide-assistant" aria-label="Ticü rehber asistan">
      <div className="guide-assistant__card">
        <header className="guide-assistant__head">
          <div className="guide-assistant__avatar-wrap">
            <img src="/ticosclaw-icon.png" alt="" className="guide-assistant__avatar" />
            {(speaking || isSpeaking()) && <span className="guide-assistant__speaking-ring" aria-hidden="true" />}
          </div>
          <div className="guide-assistant__meta">
            <strong className="guide-assistant__name">Ticü</strong>
            <span className="guide-assistant__role">Mağaza rehberi</span>
          </div>
          <div className="guide-assistant__head-actions">
            <button
              type="button"
              className="guide-assistant__icon-btn"
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (!next) stopSpeaking();
              }}
              aria-label={voiceEnabled ? 'Sesi kapat' : 'Sesi aç'}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              className="guide-assistant__icon-btn"
              onClick={() => {
                stopSpeaking();
                setMinimized(true);
              }}
              aria-label="Kapat"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </header>

        {!tourComplete ? (
          <div className="guide-assistant__scroll">
            <div className="guide-assistant__progress" aria-hidden="true">
              <div className="guide-assistant__progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="guide-assistant__step-label">
              Adım {stepIndex + 1} / {GUIDE_STEP_COUNT} — {step.title}
            </p>
            <div className="guide-assistant__bubble">{renderMessage(step.message)}</div>
          </div>
        ) : (
          <div className="guide-assistant__scroll">
            <p className="guide-assistant__step-label">Öneriler</p>
            <div className="guide-assistant__bubble guide-assistant__bubble--done">
              Tur tamamlandı! Önerilere dokun veya Soru Sor sekmesinden yaz.
            </div>
            <div className="guide-assistant__chips">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="guide-assistant__chip"
                  onClick={() => applySuggestion(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className="guide-assistant__actions">
          {!tourComplete && step.page && (
            <button type="button" className="guide-assistant__btn guide-assistant__btn--ghost" onClick={showCurrentStep}>
              <MapPin size={14} />
              Göster
            </button>
          )}
          <button type="button" className="guide-assistant__btn guide-assistant__btn--ghost" onClick={handleRepeat}>
            <RotateCcw size={14} />
            Tekrar
          </button>
          {isSpeechSupported() && (
            <button
              type="button"
              className={`guide-assistant__btn guide-assistant__btn--ghost ${listening ? 'guide-assistant__btn--listen' : ''}`}
              onClick={startListening}
              aria-pressed={listening}
            >
              <Mic size={14} />
              {listening ? 'Dinliyor…' : 'Konuş'}
            </button>
          )}
          {!tourComplete ? (
            <button type="button" className="guide-assistant__btn guide-assistant__btn--primary" onClick={handleNext}>
              Sonraki
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="guide-assistant__btn guide-assistant__btn--primary"
              onClick={() => {
                resetTour();
                spokeForStepRef.current = null;
              }}
            >
              Turu yeniden başlat
            </button>
          )}
        </footer>
      </div>
    </aside>
  );
}
