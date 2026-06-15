import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { ShaderCanvas } from '@/components/wallpapers/ShaderCanvas';
import { WALLPAPER_CATALOG, type WallpaperId } from '@/components/wallpapers/types';
import { useWallpaperStore } from '@/stores/useWallpaperStore';

export default function WallpapersPage() {
  const active = useWallpaperStore((s) => s.activeId);
  const setWallpaper = useWallpaperStore((s) => s.setWallpaper);
  const [preview, setPreview] = useState<WallpaperId | null>(null);

  const apply = (id: WallpaperId) => {
    setWallpaper(id);
  };

  const clear = () => {
    setWallpaper(null);
  };

  if (preview) {
    const meta = WALLPAPER_CATALOG.find((w) => w.id === preview)!;
    return (
      <div className="wallpapers wallpapers--fullscreen">
        <ShaderCanvas shaderId={preview} className="wallpapers__shader-full" interactiveTarget="self" />
        <div className="wallpapers__overlay">
          <button type="button" className="wallpapers__back" onClick={() => setPreview(null)}>
            ← Galeri
          </button>
          <div className="wallpapers__preview-meta">
            <h2>{meta.name}</h2>
            <p>{meta.description}</p>
            <span className="wallpapers__hint">{meta.hint}</span>
          </div>
          <div className="wallpapers__preview-actions">
            <button type="button" className="btn btn--primary" onClick={() => { apply(preview); setPreview(null); }}>
              <Check size={14} /> Duvar kağıdı olarak ayarla
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallpapers">
      <header className="wallpapers__header">
        <div className="wallpapers__title-row">
          <Sparkles size={22} className="wallpapers__title-icon" />
          <div>
            <h1 className="page__title">Shader Duvar Kağıtları</h1>
            <p className="page__sub">
              Beş etkileşimli arka plan — fareyi takip eder, tıklamaya tepki verir. Tam ekranda oyna, sonra OS arka planına ayarla.
            </p>
          </div>
        </div>
        {active && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
            <X size={14} /> Arka planı kaldır
          </button>
        )}
      </header>

      <div className="wallpapers__grid">
        {WALLPAPER_CATALOG.map((w) => {
          const isActive = active === w.id;
          return (
            <article key={w.id} className={`wallpapers__card ${isActive ? 'wallpapers__card--active' : ''}`}>
              <button
                type="button"
                className="wallpapers__preview-btn"
                onClick={() => setPreview(w.id)}
                aria-label={`${w.name} tam ekran önizleme`}
              >
                <ShaderCanvas shaderId={w.id} className="wallpapers__shader-thumb" dprCap={1} />
                <span className="wallpapers__play-hint">Tıkla · oyna</span>
              </button>
              <div className="wallpapers__card-body">
                <div className="wallpapers__card-head">
                  <h3>{w.name}</h3>
                  {isActive && <span className="wallpapers__badge">Aktif</span>}
                </div>
                <p>{w.description}</p>
                <div className="wallpapers__card-actions">
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => apply(w.id)}>
                    {isActive ? 'Seçili' : 'Ayarla'}
                  </button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPreview(w.id)}>
                    Tam ekran
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
