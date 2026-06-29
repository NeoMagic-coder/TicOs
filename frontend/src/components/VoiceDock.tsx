// VoiceDock — microphone button that streams audio to `/ws/voice`.
//
// Pipeline:
//   1. User taps the mic. We open a WebSocket to the backend and start
//      capturing 16 kHz PCM via MediaRecorder.
//   2. Audio chunks are forwarded as binary frames.
//   3. On stop, we send {"event":"end"}. Backend transcribes via Gemini
//      Live, runs Turkish intent detection, dispatches to TicOSClaw, and
//      sends back transcript + result events.
//   4. We surface results via the existing toast stack.
//
// Mock fallback: when the backend has no GEMINI_API_KEY it can't transcribe
// audio, so we also send a {"event":"text", text: "..."} envelope built from
// the browser's webkitSpeechRecognition (if available). This keeps the dev
// loop working without a key.

import { useEffect, useRef, useState } from 'react';
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

export default function VoiceDock() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    return () => stop(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (status !== 'idle') return;
    setStatus('connecting');
    setTranscript('');

    try {
      const ws = new WebSocket(wsUrl());
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: ServerEvent | null = null;
        try { msg = JSON.parse(ev.data) as ServerEvent; } catch { return; }
        if (!msg) return;
        switch (msg.event) {
          case 'transcript':
            setTranscript(msg.text);
            break;
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
        if (status !== 'idle') setStatus('idle');
      };

      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error('ws_open_failed')), { once: true });
      });
      ws.send(JSON.stringify({ event: 'start' }));

      // ── Audio capture (best-effort; ignored by backend in mock mode). ──
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buf = await e.data.arrayBuffer();
        ws.send(buf);
      };
      rec.start(250);

      // ── Mock fallback: ride the browser's SpeechRecognition for transcript ──
      const SR: any =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
        recog.onerror = () => { /* ignore — backend may still transcribe */ };
        recogRef.current = recog;
        try { recog.start(); } catch { /* already started */ }
      }

      setStatus('recording');
    } catch (err: any) {
      pushToast({ kind: 'error', title: 'Mikrofon açılamadı', body: err?.message });
      stop(true);
    }
  }

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
      // Server will send 'result' then we close from there; close after a delay
      // anyway so the socket doesn't dangle.
      setTimeout(() => { try { ws.close(); } catch {} }, 8000);
    } else {
      wsRef.current = null;
      if (!silent) setStatus('idle');
    }
  }

  const recording = status === 'recording';
  const busy = status === 'connecting' || status === 'processing';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={recording ? () => stop() : start}
        disabled={busy}
        aria-pressed={recording}
        aria-label={recording ? 'Sesli komutu durdur' : 'Sesli komutu başlat'}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          border: `2px solid ${recording ? 'var(--rose)' : 'var(--cyan)'}`,
          background: recording ? 'var(--rose-soft)' : 'var(--bg-1)',
          color: recording ? 'var(--rose)' : 'var(--cyan)',
          fontSize: 20,
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          transition: 'transform 0.1s ease',
        }}
      >
        {busy ? '…' : '🎙'}
      </button>
      {transcript && (
        <div
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--bg-3)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--fg-2)',
            maxWidth: 320,
          }}
        >
          "{transcript}"
        </div>
      )}
    </div>
  );
}
