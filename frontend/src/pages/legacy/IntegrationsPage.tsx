import { useStore } from '@/stores/useStore';
import { Plug, CheckCircle, XCircle, AlertCircle, RefreshCw, Plus } from 'lucide-react';

export function IntegrationsPage() {
  const { integrations, syncIntegration, connectIntegration, onboardedProduct, quickAsk } = useStore();
  const productChannels = new Set(onboardedProduct?.channels ?? []);

  const availablePlatforms = [
    { platform: 'WooCommerce', icon: '🛒', description: 'WordPress WooCommerce mağazanızı bağlayın' },
    { platform: 'N11', icon: '🔵', description: 'N11 pazaryeri entegrasyonu' },
    { platform: 'GittiGidiyor', icon: '🟤', description: 'GittiGidiyor pazaryeri entegrasyonu' },
    { platform: 'Etsy', icon: '🟧', description: 'Etsy global pazaryeri entegrasyonu' },
    { platform: 'Sahibinden', icon: '🟡', description: 'Sahibinden.com ilan ve mağaza entegrasyonu' },
    { platform: 'Dolap', icon: '👗', description: 'Dolap (Trendyol) ikinci el moda pazaryeri' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug size={24} className="text-indigo-400" /> Entegrasyonlar
          </h1>
          <p className="text-sm text-gray-500">
            Bağlı kanallar ve platformlar
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span> · Hedef kanallar: <span className="text-gray-300">{onboardedProduct.channels.join(', ') || '—'}</span></span>}
          </p>
        </div>
        {onboardedProduct && (
          <button
            onClick={() => quickAsk(`Store Setup Agent: ${onboardedProduct.product_name} için ${onboardedProduct.channels.join(', ')} kanallarındaki eksik entegrasyonları tespit et ve açılış sırasını listele. Her kanal için gerekli adımları, evrakları ve tahmini süreyi belirt.`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300"
          >
            Kanal Açılış Planı İste
          </button>
        )}
      </div>

      {/* Connected */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">
          Bağlı Kanallar
          <span className="ml-2 text-[10px] font-mono text-gray-500">
            {integrations.filter((i) => i.status === 'connected').length}/{integrations.length}
          </span>
        </h2>
        {integrations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-5 text-sm text-gray-400">
            Backend'den entegrasyon listesi alınamadı.
          </div>
        ) : integrations.filter((i) => i.status === 'connected').length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-5 text-sm text-gray-400 mb-4">
            Henüz canlı bağlı kanal yok — aşağıdaki kartlarda `notes` alanı hangi env değişkenlerinin gerektiğini gösteriyor.
            {onboardedProduct && onboardedProduct.channels?.length > 0 && (
              <> Hedef kanallar (<span className="text-gray-200">{onboardedProduct.channels.join(', ')}</span>) için <button onClick={() => quickAsk(`${onboardedProduct.product_name} için ${onboardedProduct.channels.join(', ')} kanallarının açılış sırasını ver.`)} className="underline text-yellow-300 hover:text-yellow-200">Kanal Açılış Planı İste</button>.</>
            )}
          </div>
        ) : null}
        {integrations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((int) => (
            <div key={int.id} className={`bg-gray-900 border rounded-xl p-5 ${
              productChannels.has(int.platform) ? 'ring-1 ring-yellow-500/30 ' : ''
            }${
              int.status === 'connected' ? 'border-green-500/20' :
              int.status === 'error' ? 'border-red-500/20' : 'border-gray-800'
            }`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl">{int.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{int.platform}</h3>
                    {int.status === 'connected' ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400">
                        <CheckCircle size={10} /> Bağlı
                      </span>
                    ) : int.status === 'error' ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                        <AlertCircle size={10} /> Hata
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/20 text-gray-400">
                        <XCircle size={10} /> Bağlı Değil
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {int.store_name}
                    {(int as any).mode && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
                          (int as any).mode === 'live' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' :
                          (int as any).mode === 'stub' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' :
                          'bg-gray-700/40 text-gray-300 border border-gray-600'
                        }`}
                      >{(int as any).mode}</span>
                    )}
                  </p>
                  {(int as any).notes && (
                    <p className="text-[10px] text-gray-500 mt-1 italic">{(int as any).notes}</p>
                  )}
                  {int.last_sync && (
                    <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                      <RefreshCw size={9} /> Son senkronizasyon: {new Date(int.last_sync).toLocaleString('tr-TR')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => syncIntegration(int.id)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1">
                    <RefreshCw size={12} /> Sync
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Available */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Eklenebilir Kanallar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availablePlatforms.map((p) => (
            <div key={p.platform} className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-5 hover:border-indigo-500/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-3xl">{p.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{p.platform}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </div>
                <button onClick={() => connectIntegration(p.platform, p.icon)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-medium text-white transition-colors flex items-center gap-1">
                  <Plus size={12} /> Bağla
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
