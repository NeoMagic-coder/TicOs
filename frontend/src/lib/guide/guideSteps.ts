export type GuideStep = {
  id: string;
  title: string;
  message: string;
  speech: string;
  page?: string;
  tip?: string;
};

/** Adım adım uygulama turu — her adım konuşarak anlatılır. */
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Hoş geldin!',
    message:
      'Merhaba! Ben **Ticü**, mağaza asistanın. Birlikte TicOSClaw\'ı adım adım keşfedeceğiz. İstediğin zaman bana sesli komut da verebilirsin: "sonraki", "göster", "tekrar".',
    speech:
      'Merhaba! Ben Ticü, mağaza asistanın. Birlikte TicOSClaw\'ı adım adım keşfedeceğiz. Hazır mısın? Sesli komutlar da çalışır: sonraki, göster, tekrar.',
    tip: 'Mikrofon düğmesine basıp konuşabilirsin.',
  },
  {
    id: 'tabs',
    title: 'Alt menü',
    message:
      'En altta **iki sekme** var:\n• **Tüm özellikler** — ana sayfa, tüm ekranlar\n• **Soru Sor** — yardım ve sorular',
    speech:
      'En altta iki sekme var. Tüm özellikler ana sayfa — mağaza, ürünler, ajanlar ve daha fazlası. Soru Sor sekmesinden yardım alabilirsiniz.',
    page: 'dashboard',
  },
  {
    id: 'chat',
    title: 'Soru Sor',
    message:
      'Buraya **Türkçe** yazıp **Gönder**\'e bas. Örneğin: "Bugün ne yapmalım?" veya "Stok durumum nasıl?" Yapay zeka cevap verir ve gerekirse iş başlatır.',
    speech:
      'Soru Sor sekmesinde Türkçe yazıp Gönder\'e basın. Örneğin: Bugün ne yapmalım? veya Stok durumum nasıl? Yapay zeka cevap verir.',
    page: 'supervisor',
    tip: 'Örnek sorulara dokunarak da başlayabilirsin.',
  },
  {
    id: 'home',
    title: 'Tüm özellikler',
    message:
      '**Tüm özellikler** ana sayfa — mağaza, ürünler, siparişler ve diğer araçlar burada listelenir. İstediğin kutuya dokunarak o ekrana geç.',
    speech:
      'Tüm özellikler ana sayfa. Mağaza adınızı görürsünüz ve Ürünler, Siparişler gibi kutulara dokunarak ilgili sayfaya gidebilirsiniz.',
    page: 'dashboard',
  },
  {
    id: 'products',
    title: 'Ürünler',
    message:
      'Ürün listesinde **stok** ve **fiyat** görünür. Arama kutusuyla ürün bulabilirsin. Envanter bağlı değilse **Mağazayı envantere bağla** düğmesini kullan.',
    speech:
      'Ürünler sayfasında stok ve fiyat görünür. Arama ile ürün bulabilirsiniz. Envanter bağlı değilse Mağazayı envantere bağla düğmesini kullanın.',
    page: 'tic_products',
    tip: 'Stok düşükse Soru Sor\'dan "stok uyarıları" yaz.',
  },
  {
    id: 'orders',
    title: 'Siparişler',
    message:
      'Sipariş kartlarında **Bekleyen** filtresi var. Bekleyen siparişte **Siparişi onayla** düğmesi çıkar — tek tıkla onaylarsın.',
    speech:
      'Siparişler sayfasında Tümü ve Bekleyen filtreleri var. Bekleyen siparişte Siparişi onayla düğmesiyle tek tıkla onay verebilirsiniz.',
    page: 'tic_orders',
    tip: 'Bekleyen sipariş varsa önce buraya bak.',
  },
  {
    id: 'integrations',
    title: 'Bağlantılar',
    message:
      'Trendyol, Shopify gibi kanalları **Bağla** veya **Yenile** ile yönetirsin. Bağlantı olmadan stok ve sipariş senkronu sınırlı kalır.',
    speech:
      'Bağlantılar sayfasında Trendyol ve Shopify gibi kanalları Bağla veya Yenile ile yönetirsiniz. Bağlantı olmadan senkron sınırlı kalır.',
    page: 'integrations',
    tip: 'İlk kurulumda en az bir kanal bağla.',
  },
  {
    id: 'all-features',
    title: 'Diğer özellikler',
    message:
      'Ana sayfada **Diğer özellikler** bölümünden ajanlar, fiyat analizi, otonomi ve detaylı panele gidebilirsin. Hiçbir özellik silinmedi.',
    speech:
      'Ana sayfadaki Diğer özellikler bölümünden ajanlar, fiyat analizi, otonomi ve detaylı panele gidebilirsiniz.',
    page: 'dashboard',
    tip: 'Gelişmiş ekranlardan Ana sayfaya dön ile geri gel.',
  },
  {
    id: 'done',
    title: 'Hazırsın!',
    message:
      'Tur bitti! **Soru Sor**\'dan her zaman yardım alabilirsin. Ben burada kalacağım — önerilerimi dinleyebilir, turu **yeniden başlatabilirsin**.',
    speech:
      'Tur tamamlandı! Soru Sor sekmesinden her zaman yardım alabilirsiniz. Ben burada kalıyorum ve öneriler sunmaya devam edeceğim.',
    page: 'dashboard',
    tip: 'Sorun olursa Ticü\'ye "tekrar" de veya düğmeye bas.',
  },
];

export const GUIDE_STEP_COUNT = GUIDE_STEPS.length;
