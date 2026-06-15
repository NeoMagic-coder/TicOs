let speaking = false;
let utterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  speaking = false;
  utterance = null;
}

export function isSpeaking(): boolean {
  return speaking;
}

/** Türkçe metin oku. Promise bitince resolve eder. */
export function speakTurkish(
  text: string,
  opts?: { rate?: number; onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  if (!isSpeechSupported() || !text.trim()) {
    opts?.onEnd?.();
    return Promise.resolve();
  }

  stopSpeaking();

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    u.rate = opts?.rate ?? 0.95;
    u.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const trVoice = voices.find((v) => v.lang.startsWith('tr'));
    if (trVoice) u.voice = trVoice;

    u.onstart = () => {
      speaking = true;
      opts?.onStart?.();
    };
    u.onend = () => {
      speaking = false;
      utterance = null;
      opts?.onEnd?.();
      resolve();
    };
    u.onerror = () => {
      speaking = false;
      utterance = null;
      opts?.onEnd?.();
      resolve();
    };

    utterance = u;
    window.speechSynthesis.speak(u);
  });
}

/** Chrome bazen voices geç yükler — ilk açılışta tetikle. */
export function primeSpeechVoices(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
