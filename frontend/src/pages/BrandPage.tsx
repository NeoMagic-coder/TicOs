import { useStore } from '@/stores/useStore';
import { selectLastAgentMessage } from '@/stores/selectors';
import { Palette, Sparkles, Globe, Check, X, Loader2, AlertCircle, MessageSquare, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { extractImages } from '@/components/ChatMessageBody';
import { ChatCommandBar } from '@/components/ChatCommandBar';
import { listBackendImages, resolveBackendUrl, type BackendImage } from '@/lib/api';
import { useEffect, useState } from 'react';

export function BrandPage() {
  const product = useStore((s) => s.onboardedProduct);
  const b = useStore((s) => s.brandIdentity);
  const loading = useStore((s) => s.brandIdentityLoading);
  const error = useStore((s) => s.brandIdentityError);
  const regenerate = useStore((s) => s.regenerateBrandIdentity);
  // Pull the latest Brand Identity Agent chat reply so output produced in /chat
  // shows up here too instead of "henüz üretilmedi".
  const chatBrand = useStore(selectLastAgentMessage('brand_identity_agent'));
  const setPage = useStore((s) => s.setCurrentPage);
  const chatMessages = useStore((s) => s.chatMessages);

  const productName = product?.product_name ?? 'ürünüm';

  // Fetch all images stored in _images/ on the backend.
  const [backendImages, setBackendImages] = useState<BackendImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const refreshImages = async () => {
    setImagesLoading(true);
    const imgs = await listBackendImages();
    setBackendImages(imgs);
    setImagesLoading(false);
  };

  useEffect(() => { void refreshImages(); }, []);

  // Merge: backend file list + any image URLs found in chat messages.
  // Backend list is authoritative (persists across sessions); chat list adds
  // images produced in the current session that may not yet be flushed.
  const backendImageUrls = new Set(backendImages.map((i) => resolveBackendUrl(i.url)));

  // Combined deduplicated gallery: backend first (newest), then chat-only extras.
  const allGallery: { src: string; agent_id?: string; ts: string }[] = [
    ...backendImages.map((i) => ({
      src: resolveBackendUrl(i.url),
      ts: new Date(i.created_at * 1000).toISOString(),
    })),
    ...chatMessages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) =>
        extractImages(m.content)
          .filter((src) => !backendImageUrls.has(src))
          .map((src) => ({ src, agent_id: m.agent_id ?? undefined, ts: m.timestamp }))
      ),
  ];

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Palette size={22} className="text-pink-400" /> Marka Kimliği</h1>
          <p className="text-xs text-gray-500 mt-0.5">İsim · Ton · Hikaye · Renk · Persona · Konumlandırma — Brand Identity Agent</p>
        </div>
        <button
          onClick={() => { void regenerate(); }}
          disabled={loading || !product}
          className="px-4 py-2 bg-pink-500/20 border border-pink-500/50 text-pink-300 rounded-lg flex items-center gap-2 hover:bg-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Üretiliyor…' : b ? 'Yeniden Üret' : 'Üret'}
        </button>
      </header>

      <ChatCommandBar
        commands={[
          { label: 'Marka kimliği üret', message: 'marka kimliğini yeniden üret' },
          { label: 'Logo üret', message: `${productName} için minimalist, modern bir logo görseli üret` },
          { label: 'Ürün görseli', message: `${productName} için beyaz arka planlı profesyonel ürün fotoğrafı görseli üret` },
          { label: 'Sosyal medya banner', message: `${productName} için Instagram ve TikTok uyumlu marka banner görseli üret` },
          { label: 'Yeni isim öner', message: `${productName} için 5 yeni marka ismi öner, her biri için kısa gerekçe ver` },
          { label: 'Slogan üret', message: `${productName} için 3 özgün slogan önerisi ver` },
        ]}
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {!product && (
          <EmptyState
            title="Önce bir ürün onboard et"
            body="Marka kimliği üretmek için aktif bir ürüne ihtiyaç var. Onboarding'i tamamladıktan sonra bu sayfa yeniden açılır."
          />
        )}

        {product && !b && !loading && !error && !chatBrand && (
          <EmptyState
            title={`${product.product_name} için marka kimliği henüz üretilmedi`}
            body={`Sağ üstteki "Üret" butonuna bas — Brand Identity Agent ${product.category} kategorisindeki bu ürün için isim, slogan, palet, persona ve sosyal medya kullanıcı adı önerileri hazırlayacak.`}
          />
        )}

        {product && !b && !loading && !error && chatBrand && (
          <div className="bg-[#262422] border border-pink-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-xs text-pink-300">
              <MessageSquare size={14} /> Chat'ten gelen son üretim
              <button onClick={() => setPage('chat')} className="ml-auto text-gray-500 hover:text-pink-300 underline">Chat'te aç</button>
            </div>
            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{chatBrand.content}</div>
            <div className="mt-3 text-[10px] text-gray-500">
              Strüktüre dökmek için sağ üstteki "Üret" → ajan yapılandırılmış kimliği bu sayfaya yazar.
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-[#262422] border border-[#3a3633] rounded-2xl p-12 text-center">
            <Loader2 size={32} className="text-pink-400 animate-spin mx-auto mb-3" />
            <div className="text-sm text-gray-300">Brand Identity Agent çalışıyor…</div>
            <div className="text-xs text-gray-500 mt-1">{product?.product_name} için marka kimliği hazırlanıyor</div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-300">Üretim başarısız</div>
              <div className="text-xs text-gray-400 mt-1 break-words">{error}</div>
            </div>
          </div>
        )}

        {/* Visual gallery — all images in _images/ (persisted across sessions)
            plus any image URLs in the current session's chat history. */}
        <div className="bg-[#262422] border border-[#3a3633] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={14} className="text-pink-300" />
            <h3 className="text-sm font-semibold text-gray-200">Ajan Görselleri</h3>
            <span className="text-[10px] text-gray-500">({allGallery.length})</span>
            <button
              onClick={() => void refreshImages()}
              disabled={imagesLoading}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-[#1a1816] border border-[#3a3633] text-[10px] text-gray-400 hover:text-pink-300 hover:border-pink-500/40 transition-colors disabled:opacity-50"
              title="Görselleri yenile"
            >
              <RefreshCw size={10} className={imagesLoading ? 'animate-spin' : ''} />
              Yenile
            </button>
          </div>

          {imagesLoading && (
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Yükleniyor…
            </div>
          )}

          {!imagesLoading && allGallery.length === 0 && (
            <div className="text-[11px] text-gray-500 text-center py-4">
              Henüz görsel yok. Chat'ten "logo üret" veya "marka görseli oluştur" komutu ver.
            </div>
          )}

          {allGallery.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allGallery.map((v) => (
                <a
                  key={v.src}
                  href={v.src}
                  target="_blank"
                  rel="noreferrer"
                  className="group block bg-[#1a1816] border border-[#3a3633] rounded-lg overflow-hidden hover:border-pink-500/50 transition-colors"
                  title={new Date(v.ts).toLocaleString('tr-TR')}
                >
                  <img src={v.src} alt="ajan görseli" loading="lazy" className="w-full aspect-square object-cover" />
                  <div className="px-2 py-1.5 text-[10px] text-gray-500 truncate group-hover:text-gray-300">
                    {v.agent_id ?? 'brand_visual_generator'} · {new Date(v.ts).toLocaleTimeString('tr-TR')}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {b && (
          <>
            <div className="bg-gradient-to-br from-[#262422] via-[#2a2422] to-[#1f1c1a] border border-[#3a3633] rounded-2xl p-6">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Marka Adı</div>
              <div className="flex items-baseline gap-4 flex-wrap">
                <h2 className="text-4xl font-bold text-white tracking-tight">{b.brand_name}</h2>
                {b.tagline && <span className="text-sm text-gray-400 italic">"{b.tagline}"</span>}
              </div>
              <p className="text-xs text-gray-500 mt-2">Ürün: <span className="text-gray-300">{product?.product_name ?? '—'}</span></p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {b.positioning && (
                <Card title="Konumlandırma Cümlesi" tag="positioning">
                  <p className="text-sm text-gray-200 leading-relaxed italic">"{b.positioning}"</p>
                </Card>
              )}
              {b.story && (
                <Card title="Marka Hikayesi" tag="story">
                  <p className="text-xs text-gray-300 leading-relaxed">{b.story}</p>
                </Card>
              )}
            </div>

            {b.alternatives.length > 0 && (
              <Card title="İsim Alternatifleri" tag="naming">
                <div className="space-y-2">
                  {b.alternatives.map((a) => (
                    <div key={a.name} className="flex items-center gap-4 bg-[#1a1816] rounded-lg px-3 py-2.5">
                      <div className="w-12 text-center shrink-0">
                        <div className={`text-lg font-bold ${a.score >= 85 ? 'text-emerald-400' : a.score >= 75 ? 'text-yellow-400' : 'text-gray-400'}`}>{a.score}</div>
                        <div className="text-[8px] text-gray-600 uppercase">skor</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{a.name}</span>
                          <span className="text-[10px] text-gray-500">{a.domain}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{a.reasoning}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {b.palette.length > 0 && (
              <Card title="Renk Paleti" tag="palette">
                <div className="grid grid-cols-5 gap-3">
                  {b.palette.map((c) => (
                    <div key={c.hex + c.label} className="bg-[#1a1816] rounded-lg overflow-hidden border border-[#3a3633]">
                      <div className="h-20" style={{ backgroundColor: c.hex }} />
                      <div className="p-2.5">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{c.role}</div>
                        <div className="text-xs font-semibold text-gray-100">{c.label}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(b.voice.traits.length > 0 || b.voice.do.length > 0 || b.voice.dont.length > 0) && (
              <div className="grid grid-cols-3 gap-4">
                <Card title="Ton Özellikleri" tag="voice">
                  <div className="flex flex-wrap gap-2">
                    {b.voice.traits.map((t) => (
                      <span key={t} className="px-2.5 py-1 bg-pink-500/15 border border-pink-500/40 text-pink-300 rounded-full text-xs font-medium">{t}</span>
                    ))}
                  </div>
                </Card>
                <Card title="Yap" tag="do">
                  <ul className="space-y-1.5">
                    {b.voice.do.map((d) => (
                      <li key={d} className="text-xs text-gray-300 flex items-start gap-2"><Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />{d}</li>
                    ))}
                  </ul>
                </Card>
                <Card title="Yapma" tag="dont">
                  <ul className="space-y-1.5">
                    {b.voice.dont.map((d) => (
                      <li key={d} className="text-xs text-gray-300 flex items-start gap-2"><X size={12} className="text-red-400 shrink-0 mt-0.5" />{d}</li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            {b.personas.length > 0 && (
              <Card title="Hedef Persona" tag="persona">
                <div className="grid grid-cols-3 gap-3">
                  {b.personas.map((p) => (
                    <div key={p.name} className="bg-[#1a1816] rounded-lg p-3 border border-[#3a3633]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{p.emoji}</span>
                        <div>
                          <div className="text-sm font-bold text-white">{p.name}</div>
                          <div className="text-[10px] text-gray-500">{p.age}</div>
                        </div>
                      </div>
                      <PField label="Hedef" value={p.goal} />
                      <PField label="İtiraz" value={p.objection} />
                      <PField label="Kanal" value={p.channel} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {b.social_handles.length > 0 && (
              <Card title="Sosyal Medya Kullanıcı Adları" tag="handles">
                <div className="grid grid-cols-2 gap-2">
                  {b.social_handles.map((h) => (
                    <div key={h.platform + h.handle} className="flex items-center justify-between bg-[#1a1816] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-gray-500" />
                        <span className="text-xs text-gray-400">{h.platform}</span>
                        <span className="text-xs font-mono text-gray-200">{h.handle}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${h.available ? 'text-emerald-400' : 'text-red-400'}`}>
                        {h.available ? '✓ Müsait' : '✗ Alınmış'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-200">{title}</h3>
        <span className="text-[9px] text-gray-600 uppercase tracking-widest font-mono">{tag}</span>
      </div>
      {children}
    </div>
  );
}

function PField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[11px] mt-1.5">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[#262422] border border-dashed border-[#3a3633] rounded-2xl p-10 text-center">
      <Palette size={32} className="text-pink-400/40 mx-auto mb-3" />
      <div className="text-base font-semibold text-gray-200">{title}</div>
      <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
