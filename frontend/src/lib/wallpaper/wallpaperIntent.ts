import type { WallpaperId } from '@/components/wallpapers/types';

/** Türkçe / İngilizce metinden duvar kağıdı kimliği çıkar. */
export const WALLPAPER_TEXT_ALIASES: Record<string, WallpaperId> = {
  'neural-grid': 'neural-grid',
  'neural grid': 'neural-grid',
  neural: 'neural-grid',
  ızgara: 'neural-grid',
  izgara: 'neural-grid',
  'plasma-void': 'plasma-void',
  plazma: 'plasma-void',
  plasma: 'plasma-void',
  void: 'plasma-void',
  'particle-swarm': 'particle-swarm',
  parçacık: 'particle-swarm',
  parcacik: 'particle-swarm',
  swarm: 'particle-swarm',
  'hex-lattice': 'hex-lattice',
  altıgen: 'hex-lattice',
  altigen: 'hex-lattice',
  hex: 'hex-lattice',
  'aurora-flow': 'aurora-flow',
  aurora: 'aurora-flow',
  akış: 'aurora-flow',
  akis: 'aurora-flow',
};

export function matchWallpaperId(text: string): WallpaperId | null {
  const t = text.toLowerCase().trim();
  const sorted = Object.entries(WALLPAPER_TEXT_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, id] of sorted) {
    if (t.includes(alias)) return id;
  }
  return null;
}

export function isWallpaperCommand(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('duvar') ||
    t.includes('wallpaper') ||
    t.includes('arka plan') ||
    t.includes('arkaplan')
  );
}
