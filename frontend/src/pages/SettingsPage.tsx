import { useState } from 'react';
import { Settings, User, Bell, Key, Shield, Cpu, Save, CheckCircle } from 'lucide-react';
import { useStore } from '@/stores/useStore';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const onboardedProduct = useStore((s) => s.onboardedProduct);

  const tabs = [
    { id: 'general', label: 'Genel', icon: Settings },
    { id: 'users', label: 'Kullanıcılar', icon: User },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Güvenlik', icon: Shield },
    { id: 'llm', label: 'LLM Provider', icon: Cpu },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} className="text-indigo-400" /> Ayarlar
        </h1>
        <p className="text-sm text-gray-500">
          Platform yapılandırması
          {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === id ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeTab === 'general' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Organizasyon Ayarları</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Şirket Adı</label>
                  <input defaultValue="MarkaXYZ" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Varsayılan Para Birimi</label>
                  <select defaultValue="TRY" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                    <option value="TRY">TRY — Türk Lirası</option>
                    <option value="USD">USD — Amerikan Doları</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Zaman Dilimi</label>
                  <select defaultValue="Europe/Istanbul" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                    <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Varsayılan Dil</label>
                  <select defaultValue="tr" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                    <option value="tr">Türkçe</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Kullanıcı Yönetimi</h3>
              <div className="space-y-2">
                {[
                  { name: 'Ahmet Yılmaz', email: 'ahmet@markaxy.com', role: 'Admin' },
                  { name: 'Zeynep Kaya', email: 'zeynep@markaxy.com', role: 'Manager' },
                  { name: 'Can Demir', email: 'can@markaxy.com', role: 'Viewer' },
                ].map((user) => (
                  <div key={user.email} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                      {user.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      user.role === 'Admin' ? 'bg-red-500/20 text-red-400' :
                      user.role === 'Manager' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{user.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">LLM Provider Ayarları</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Birincil Provider</label>
                  <select defaultValue="openai" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic (Claude 3.5)</option>
                    <option value="gemini">Google (Gemini 2.0)</option>
                    <option value="local">Local Model</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                  <input type="password" defaultValue="sk-****" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Varsayılan Model</label>
                  <input defaultValue="gpt-4o" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max Tokens</label>
                  <input type="number" defaultValue="4096" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Bildirim Tercihleri</h3>
              <div className="space-y-3">
                {[
                  { label: 'Yeni onay talebi', desc: 'Ajan onay istediğinde bildirim', default: true },
                  { label: 'Görev tamamlandı', desc: 'Bir görev başarıyla tamamlandığında', default: true },
                  { label: 'Escalation', desc: 'Bir ajan görevi yükselttiğinde', default: true },
                  { label: 'Stok uyarısı', desc: 'Kritik stok seviyesine ulaşıldığında', default: true },
                  { label: 'Hata bildirimi', desc: 'Tool veya ajan hatası oluştuğunda', default: false },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                    <div>
                      <p className="text-sm text-white">{n.label}</p>
                      <p className="text-xs text-gray-500">{n.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">API Key Yönetimi</h3>
              <p className="text-xs text-gray-500">Entegrasyon API anahtarları güvenli şekilde saklanır</p>
              <div className="space-y-2">
                {['Shopify', 'Trendyol', 'Hepsiburada', 'Sahibinden', 'Dolap', 'Meta Ads', 'Google Ads', 'GA4'].map((key) => (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                    <Key size={14} className="text-gray-500" />
                    <span className="text-sm text-white flex-1">{key}</span>
                    <span className="text-xs text-green-400">Yapılandırıldı</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Güvenlik Ayarları</h3>
              <div className="space-y-3">
                {[
                  { label: 'PII Maskeleme', desc: 'Müşteri verilerini loglardan maskele', default: true },
                  { label: 'Audit Log', desc: 'Tüm aksiyonları kaydet', default: true },
                  { label: 'Rate Limiting', desc: 'API çağrılarını sınırlandır', default: true },
                  { label: 'Prompt Injection Koruması', desc: 'Zararlı prompt girişlerini engelle', default: true },
                  { label: 'Tool Sandbox', desc: 'Tool çağrılarını izole ortamda çalıştır', default: true },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                    <div>
                      <p className="text-sm text-white">{n.label}</p>
                      <p className="text-xs text-gray-500">{n.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">
              {saved ? <><CheckCircle size={16} /> Kaydedildi!</> : <><Save size={16} /> Kaydet</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
