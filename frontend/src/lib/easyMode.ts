/** Ultra-basit arayüz — varsayılan açık. */
export const EASY_MODE = true;

/** Sadece 2 sekme — Tüm özellikler ana sayfa, Soru Sor yardım için. */
export const EASY_NAV_ITEMS = [
  { id: 'dashboard', page: 'dashboard', label: 'Tüm özellikler', icon: 'grid' },
  { id: 'supervisor', page: 'supervisor', label: 'Soru Sor', icon: 'zap' },
] as const;

/** Önerilen aksiyonları otomatik uygula (düşük risk / onay gerektirmeyen). */
export const AUTO_EXECUTE_ACTIONS = true;
