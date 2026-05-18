// Toast notification stack for backend / SSE / autonomy failures.
// Decoupled from useStore so the existing store doesn't grow another
// 1600-line slice. Other modules push via `pushToast(...)`; the
// <ToastStack /> component is rendered once near the root.
//
// Triggered by:
//   - sendUserMessage catch blocks (backend offline, gemini failed)
//   - sendUserMessageStream SSE errors / abnormal close
//   - approve/reject API failures
//   - autonomy.policy_breach with risk=high (could be wired later)

import { create } from 'zustand';
import { useEffect } from 'react';

export type ToastKind = 'info' | 'warn' | 'error' | 'success';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  ts: number;
  ttl_ms?: number; // auto-dismiss after this
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'ts'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `toast_${Math.random().toString(36).slice(2, 9)}`;
    const ts = Date.now();
    set((s) => ({ toasts: [...s.toasts, { ...t, id, ts }] }));
    // Cap stack at 5 to avoid flood.
    set((s) => ({ toasts: s.toasts.slice(-5) }));
    // Auto-dismiss
    const ttl = t.ttl_ms ?? (t.kind === 'error' ? 8000 : 4000);
    setTimeout(() => get().dismiss(id), ttl);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Convenience: callable from non-React code (e.g. inside zustand actions).
export const pushToast = (t: Omit<Toast, 'id' | 'ts'>) => useToastStore.getState().push(t);

const KIND_META: Record<ToastKind, { color: string; soft: string; icon: string }> = {
  info:    { color: 'var(--cyan)',   soft: 'var(--cyan-soft)',   icon: 'ℹ' },
  warn:    { color: 'var(--amber)',  soft: 'var(--amber-soft)',  icon: '⚠' },
  error:   { color: 'var(--rose)',   soft: 'var(--rose-soft)',   icon: '✕' },
  success: { color: 'var(--acid)',   soft: 'var(--acid-soft)',   icon: '✓' },
};

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  // Keyboard dismiss: Esc clears the newest.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        dismiss(toasts[toasts.length - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 56,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => {
        const m = KIND_META[t.kind];
        return (
          <div
            key={t.id}
            data-testid={`toast-${t.kind}`}
            onClick={() => dismiss(t.id)}
            style={{
              background: 'var(--bg-1)',
              border: `1px solid ${m.color}`,
              borderLeft: `3px solid ${m.color}`,
              borderRadius: 6,
              padding: '10px 14px',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              animation: 'aos-toast-in 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: t.body ? 4 : 0 }}>
              <span style={{ color: m.color, fontWeight: 600 }}>{m.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{t.title}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }} className="mono">
                {new Date(t.ts).toLocaleTimeString('tr-TR', { hour12: false })}
              </span>
            </div>
            {t.body && (
              <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.4 }}>{t.body}</div>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes aos-toast-in {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
