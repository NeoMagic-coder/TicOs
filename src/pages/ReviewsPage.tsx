import { useState } from 'react';
import { useStore } from '@/stores/useStore';
import { selectReputationScore } from '@/stores/selectors';
import { Star, Send, MessageCircle, AlertTriangle, ThumbsUp } from 'lucide-react';
import type { ProductReview } from '@/types';

const sentimentMeta: Record<ProductReview['sentiment'], { color: string; label: string }> = {
  positive: { color: 'text-emerald-400', label: 'Olumlu' },
  neutral:  { color: 'text-yellow-400',  label: 'Nötr' },
  negative: { color: 'text-red-400',     label: 'Olumsuz' },
};

const channelEmoji: Record<string, string> = {
  Trendyol: '🟠', Hepsiburada: '🟣', 'Amazon TR': '📦', Shopify: '🛍️', Google: '🌐', Trustpilot: '⭐', Sahibinden: '🟡', Dolap: '👗',
};

export function ReviewsPage() {
  const reviews = useStore((s) => s.reviews);
  const respondToReview = useStore((s) => s.respondToReview);
  const product = useStore((s) => s.onboardedProduct);
  const quickAsk = useStore((s) => s.quickAsk);
  const reputationScore = useStore(selectReputationScore);
  const [filter, setFilter] = useState<'all' | 'negative' | 'pending'>('all');

  const visible = reviews.filter((r) => {
    if (filter === 'negative') return r.sentiment === 'negative';
    if (filter === 'pending') return !r.responded;
    return true;
  });

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / Math.max(reviews.length, 1);
  const negatives = reviews.filter((r) => r.sentiment === 'negative').length;
  const responseRate = Math.round((reviews.filter((r) => r.responded).length / Math.max(reviews.length, 1)) * 100);

  const channels = Array.from(new Set(reviews.map((r) => r.channel))).map((c) => {
    const list = reviews.filter((r) => r.channel === c);
    return { name: c, count: list.length, avg: (list.reduce((s, r) => s + r.rating, 0) / Math.max(list.length, 1)).toFixed(1) };
  });

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Star size={22} className="text-yellow-400" /> Yorumlar & İtibar</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Çok kanallı yorum yönetimi · Review & Reputation Agent
            {product && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{product.product_name}</span></span>}
          </p>
        </div>
        {product && (
          <button
            onClick={() => quickAsk(`Review & Reputation Agent: ${product.product_name} için son dönem yorumlarını sentezle. Negatiflerdeki ortak temaları, hızlı kazanım fırsatlarını ve yanıt taslaklarını çıkar.`)}
            className="px-4 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 rounded-lg text-sm font-semibold"
          >
            Yorum Sentezi İste
          </button>
        )}
      </header>

      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <Kpi label="Ortalama Puan" value={avg.toFixed(1)} hint={`${reviews.length} yorum`} icon={<Star size={14} />} color="text-yellow-400" />
        <Kpi label="Yanıt Oranı" value={`${responseRate}%`} hint="Tüm kanallar" icon={<MessageCircle size={14} />} color="text-emerald-400" />
        <Kpi label="Negatif Yorum" value={String(negatives)} hint="Acil ele alınmalı" icon={<AlertTriangle size={14} />} color="text-red-400" />
        <Kpi label="İtibar Skoru" value={`${reputationScore}/100`} hint={reviews.length === 0 ? 'Yorum yok' : 'Yorum ortalamasından hesaplandı'} icon={<ThumbsUp size={14} />} color="text-cyan-400" />
      </div>

      <div className="px-6 mb-3">
        <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-3 grid grid-cols-6 gap-2">
          {channels.map((c) => (
            <div key={c.name} className="text-center px-2 py-2 bg-[#1a1816] rounded-lg">
              <div className="text-lg">{channelEmoji[c.name] ?? '🌐'}</div>
              <div className="text-[10px] text-gray-500 mt-1">{c.name}</div>
              <div className="text-sm font-bold text-yellow-300">{c.avg} <span className="text-[10px] text-gray-500">({c.count})</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 mb-3 flex items-center gap-2">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tümü</FilterBtn>
        <FilterBtn active={filter === 'negative'} onClick={() => setFilter('negative')}>Negatif</FilterBtn>
        <FilterBtn active={filter === 'pending'} onClick={() => setFilter('pending')}>Yanıtsız</FilterBtn>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {visible.map((r) => (
          <ReviewCard key={r.id} r={r} onSend={(text) => respondToReview(r.id, text)} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ r, onSend }: { r: ProductReview; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState(r.draft_response ?? '');
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4 hover:border-yellow-500/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0">{channelEmoji[r.channel] ?? '🌐'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="flex">{Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'} />
            ))}</div>
            <span className="text-sm font-bold text-white">{r.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full bg-black/20 ${sentimentMeta[r.sentiment].color}`}>{sentimentMeta[r.sentiment].label}</span>
            <span className="text-[10px] text-gray-500">· {r.author} · {r.channel}</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{r.body}</p>

          {r.responded ? (
            <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1"><MessageCircle size={11} /> Yanıtlandı</div>
          ) : r.draft_response && !editing ? (
            <div className="mt-3 bg-[#1a1816] border-l-2 border-yellow-500/50 pl-3 pr-3 py-2 rounded">
              <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-wider mb-1">📝 Review Agent — Taslak yanıt</div>
              <p className="text-xs text-gray-300 italic">"{r.draft_response}"</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => onSend(r.draft_response!)} className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[11px] rounded font-semibold flex items-center gap-1"><Send size={10} /> Gönder</button>
                <button onClick={() => { setDraft(r.draft_response ?? ''); setEditing(true); }} className="px-3 py-1 bg-[#262422] hover:bg-[#2e2a27] border border-[#3a3633] text-[11px] rounded">Düzenle</button>
              </div>
            </div>
          ) : !r.responded ? (
            <div className="mt-3">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Yanıt yaz..." rows={2}
                className="w-full bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2 text-xs focus:border-yellow-500 outline-none resize-none" />
              <button onClick={() => onSend(draft)} disabled={!draft.trim()} className="mt-2 px-3 py-1 bg-emerald-500/20 disabled:opacity-30 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[11px] rounded font-semibold flex items-center gap-1">
                <Send size={10} /> Gönder
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${active ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/50' : 'bg-[#262422] text-gray-400 border border-[#3a3633] hover:text-gray-200'}`}>{children}</button>;
}

function Kpi({ label, value, hint, icon, color }: { label: string; value: string; hint?: string; icon?: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500"><span className="uppercase tracking-wider">{label}</span>{icon}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
