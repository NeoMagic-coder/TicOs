import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  activeBrandId: string | null;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setActiveBrandId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      activeBrandId: null,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setActiveBrandId: (id) => set({ activeBrandId: id }),
    }),
    { name: "ticosclaw-ui" },
  ),
);
