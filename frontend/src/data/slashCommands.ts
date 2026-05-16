export interface SlashCommand {
  id: string;
  desc: string;
  category: 'navigation' | 'action' | 'system';
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Navigation
  { id: '/agents',    desc: 'Ajan listesini göster',            category: 'navigation' },
  { id: '/tools',     desc: 'Araç listesini göster',            category: 'navigation' },
  { id: '/tasks',     desc: 'Görev listesini göster',           category: 'navigation' },
  { id: '/approvals', desc: 'Bekleyen onayları göster',         category: 'navigation' },
  { id: '/analytics', desc: 'Analitik sayfasına git',           category: 'navigation' },
  { id: '/brand',     desc: 'Marka kimliği sayfasına git',      category: 'navigation' },
  { id: '/pricing',   desc: 'Fiyatlandırma sayfasına git',      category: 'navigation' },
  { id: '/audit',     desc: 'Denetim kayıtlarını göster',       category: 'navigation' },
  // Actions
  { id: '/approve',   desc: 'Tüm onayları kabul et',            category: 'action' },
  { id: '/reject',    desc: 'Tüm onayları reddet',              category: 'action' },
  { id: '/schedule',  desc: 'Yeni zamanlama oluştur',           category: 'action' },
  { id: '/brand regen', desc: 'Marka kimliğini yeniden üret',  category: 'action' },
  { id: '/pricing regen', desc: 'Fiyatlandırmayı yeniden üret', category: 'action' },
  // System
  { id: '/clear',     desc: 'Sohbet geçmişini temizle',         category: 'system' },
  { id: '/debug',     desc: 'Debug modunu aç/kapat',            category: 'system' },
  { id: '/live',      desc: 'Canlı akış modunu aç/kapat',       category: 'system' },
];
