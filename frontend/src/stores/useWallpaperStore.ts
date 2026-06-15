import { create } from 'zustand';
import {
  readStoredWallpaper,
  storeWallpaper as persistWallpaper,
  WALLPAPER_CATALOG,
  type WallpaperId,
} from '@/components/wallpapers/types';

type WallpaperState = {
  activeId: WallpaperId | null;
  setWallpaper: (id: WallpaperId | null) => void;
  wallpaperName: (id: WallpaperId) => string;
};

export const useWallpaperStore = create<WallpaperState>((set) => ({
  activeId: readStoredWallpaper(),
  setWallpaper: (id) => {
    persistWallpaper(id);
    set({ activeId: id });
  },
  wallpaperName: (id) => WALLPAPER_CATALOG.find((w) => w.id === id)?.name ?? id,
}));
