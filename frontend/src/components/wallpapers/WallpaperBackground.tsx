import { useWallpaperStore } from '@/stores/useWallpaperStore';
import { ShaderCanvas } from './ShaderCanvas';

/** Fixed OS wallpaper layer — reacts to mouse globally, clicks through to UI. */
export function WallpaperBackground() {
  const activeId = useWallpaperStore((s) => s.activeId);
  if (!activeId) return null;

  return (
    <div className="wallpaper-bg" aria-hidden="true">
      <ShaderCanvas
        shaderId={activeId}
        className="wallpaper-bg__canvas"
        interactiveTarget="document"
        dprCap={1.5}
      />
    </div>
  );
}
