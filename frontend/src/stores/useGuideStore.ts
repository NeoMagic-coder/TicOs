import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GUIDE_STEP_COUNT } from '@/lib/guide/guideSteps';

type GuideStore = {
  stepIndex: number;
  tourComplete: boolean;
  minimized: boolean;
  voiceEnabled: boolean;
  advance: () => void;
  goToStep: (index: number) => void;
  resetTour: () => void;
  completeTour: () => void;
  setMinimized: (v: boolean) => void;
  setVoiceEnabled: (v: boolean) => void;
};

export const useGuideStore = create<GuideStore>()(
  persist(
    (set) => ({
      stepIndex: 0,
      tourComplete: false,
      minimized: true,
      voiceEnabled: true,
      advance: () =>
        set((s) => {
          const next = s.stepIndex + 1;
          if (next >= GUIDE_STEP_COUNT) {
            return { stepIndex: GUIDE_STEP_COUNT - 1, tourComplete: true };
          }
          return { stepIndex: next, tourComplete: false };
        }),
      goToStep: (index) =>
        set({
          stepIndex: Math.max(0, Math.min(index, GUIDE_STEP_COUNT - 1)),
          tourComplete: index >= GUIDE_STEP_COUNT - 1,
          minimized: false,
        }),
      resetTour: () =>
        set({ stepIndex: 0, tourComplete: false, minimized: false }),
      completeTour: () => set({ tourComplete: true, stepIndex: GUIDE_STEP_COUNT - 1 }),
      setMinimized: (v) => set({ minimized: v }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
    }),
    {
      name: 'ticos-guide-assistant',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        stepIndex: s.stepIndex,
        tourComplete: s.tourComplete,
        voiceEnabled: s.voiceEnabled,
        minimized: s.minimized,
      }),
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          return { ...state, minimized: true };
        }
        return state;
      },
    },
  ),
);
