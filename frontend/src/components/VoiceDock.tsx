// VoiceMicButton — compact mic control for the unified assistant bar.
// Full pipeline: WebSocket → Gemini Live / browser SpeechRecognition fallback.

import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { pushToast } from './AOS/Toast';

type Status = 'idle' | 'connecting' | 'recording' | 'processing';

type ServerEvent =
  | { event: 'ready' }
  | { event: 'transcript'; text: string }
  | { event: 'intent'; intent: string; params?: Record<string, unknown> }
  | { event: 'result'; status: 'ok' | 'escalated'; summary?: string }
  | { event: 'error'; message: string };

function wsUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000';
  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws/voice';
  return u.toString();
}

export function VoiceMicButton({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => () => stop(true), []);

  function stop(silent = false) {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    try { recogRef.current?.stop(); } catch {}
    recogRef.current = null;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ event: 'end' })); } catch {}
      if (!silent) setStatus('processing');
      setTimeout(() => { try { ws.close(); } catch {} }, 8000);
    } else {
      wsRef.current = null;
      if (!silent) setStatus('idle');
    }
  }

  async function start() {
    if (status !== 'idle') return;
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl());
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: ServerEvent | null = null;
        try { msg = JSON.parse(ev.data) as ServerEvent; } catch { return; }
        if (!msg) return;
        switch (msg.event) {
          case 'intent':
            pushToast({ kind: 'info', title: 'Komut algılandı', body: msg.intent });
            break;
          case 'result':
            setStatus('idle');
            if (msg.status === 'ok') {
              pushToast({ kind: 'success', title: 'İşlem başarılı', body: msg.summary || '' });
            } else {
              pushToast({ kind: 'warn', title: 'Onay gerekiyor', body: msg.summary || '' });
            }
            break;
          case 'error':
            setStatus('idle');
            pushToast({ kind: 'error', title: 'Ses komutu hatası', body: msg.message });
            break;
        }
      };

      ws.onerror = () => {
        pushToast({ kind: 'error', title: 'WebSocket bağlanamadı' });
        stop(true);
      };
      ws.onclose = () => {
        wsRef.current = null;
        setStatus((s) => (s === 'processing' ? s : 'idle'));
      };

      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error('ws_open_failed')), { once: true });
      });
      ws.send(JSON.stringify({ event: 'start' }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(await e.data.arrayBuffer());
      };
      rec.start(250);

      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const recog = new SR();
        recog.lang = 'tr-TR';
        recog.continuous = false;
        recog.interimResults = false;
        recog.onresult = (e: any) => {
          const text = e.results?.[0]?.[0]?.transcript || '';
          if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'text', text }));
          }
        };
        recogRef.current = recog;
        try { recog.start(); } catch {}
      }

      setStatus('recording');
    } catch (err: any) {
      pushToast({ kind: 'error', title: 'Mikrofon açılamadı', body: err?.message });
      stop(true);
    }
  }

  const recording = status === 'recording';
  const busy = status === 'connecting' || status === 'processing';

  return (
    <button
      type="button"
      className={`assistant-bar__mic ${recording ? 'assistant-bar__mic--recording' : ''} ${className}`.trim()}
      onClick={recording ? () => stop() : start}
      disabled={busy}
      aria-pressed={recording}
      aria-label={recording ? 'Sesli komutu durdur' : 'Sesli komut'}
      title={recording ? 'Durdur' : 'Sesli komut'}
    >
      {busy ? <span className="assistant-bar__mic-dots">…</span> : <Mic size={18} />}
    </button>
  );
}

/** @deprecated Use VoiceMicButton inside AssistantBar */
export default function VoiceDock() {
  return null;
}
