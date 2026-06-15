export const WALLPAPER_IDS = [
  'neural-grid',
  'plasma-void',
  'particle-swarm',
  'hex-lattice',
  'aurora-flow',
] as const;

export type WallpaperId = (typeof WALLPAPER_IDS)[number];

export interface WallpaperMeta {
  id: WallpaperId;
  name: string;
  description: string;
  hint: string;
}

export const WALLPAPER_CATALOG: WallpaperMeta[] = [
  {
    id: 'neural-grid',
    name: 'Neural Grid',
    description: 'Perspektif ızgara — fareyi çeker, tıklama dalga halkası yayar.',
    hint: 'Fare · tıkla',
  },
  {
    id: 'plasma-void',
    name: 'Plasma Void',
    description: 'Derin uzay plazması — imleç ısı kaynağı gibi renkleri kaydırır.',
    hint: 'Fare · sürükle',
  },
  {
    id: 'particle-swarm',
    name: 'Particle Swarm',
    description: 'Binlerce parçacık imlece akar; tıklama patlaması.',
    hint: 'Fare · tık patlama',
  },
  {
    id: 'hex-lattice',
    name: 'Hex Lattice',
    description: 'Altıgen hücreler imleç yakınında parlar; tık nabız.',
    hint: 'Fare · tık nabız',
  },
  {
    id: 'aurora-flow',
    name: 'Aurora Flow',
    description: 'Aurora şeritleri fare hareketine ve tıklamalara akar.',
    hint: 'Fare · tık dalga',
  },
];

export const WALLPAPER_STORAGE_KEY = 'ticosclaw-wallpaper';

export function isWallpaperId(v: string): v is WallpaperId {
  return (WALLPAPER_IDS as readonly string[]).includes(v);
}

export function readStoredWallpaper(): WallpaperId | null {
  try {
    const v = localStorage.getItem(WALLPAPER_STORAGE_KEY);
    return v && isWallpaperId(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeWallpaper(id: WallpaperId | null) {
  try {
    if (id) localStorage.setItem(WALLPAPER_STORAGE_KEY, id);
    else localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
