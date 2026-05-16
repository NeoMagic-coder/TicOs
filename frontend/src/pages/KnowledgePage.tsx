import { useStore } from '@/stores/useStore';
import { resolveBackendUrl } from '@/lib/api';
import { BookOpen, Upload, Search, FileText, File, Globe, ClipboardList, Tag } from 'lucide-react';
import { useState } from 'react';

export function KnowledgePage() {
  const { knowledge, addKnowledge, onboardedProduct, quickAsk } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Genel');
  const [newType, setNewType] = useState<'md' | 'pdf' | 'txt' | 'url' | 'sop'>('md');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');

  const categories = ['all', ...new Set(knowledge.map((k) => k.category))];
  const filtered = knowledge
    .filter((k) => categoryFilter === 'all' || k.category === categoryFilter)
    .filter((k) => search === '' || k.title.toLowerCase().includes(search.toLowerCase()) || k.tags.some((t) => t.includes(search.toLowerCase())));

  const typeIcons: Record<string, React.ReactNode> = {
    pdf: <File size={16} className="text-red-400" />,
    md: <FileText size={16} className="text-blue-400" />,
    txt: <FileText size={16} className="text-gray-400" />,
    url: <Globe size={16} className="text-green-400" />,
    sop: <ClipboardList size={16} className="text-purple-400" />,
  };

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!newTitle.trim()) return;
    const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
    // 1) Local catalog entry (immediate UI feedback)
    addKnowledge({
      title: newTitle,
      type: newType,
      category: newCategory,
      tags,
      content_preview: newContent.slice(0, 200),
    });
    // 2) Real RAG indexing on the backend (chunk + embed + pgvector)
    if (newContent.trim().length >= 20) {
      setUploading(true);
      setUploadResult(null);
      try {
        const res = await fetch(resolveBackendUrl('/api/v1/knowledge/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle, content: newContent, tags }),
        });
        if (res.ok) {
          const body = await res.json();
          setUploadResult(`✅ ${body.chunks_indexed}/${body.chunks_total} parça indexlendi.`);
        } else {
          setUploadResult(`⚠️ Indexleme başarısız (${res.status}). Yerel kayıt yapıldı.`);
        }
      } catch (e) {
        setUploadResult(`⚠️ Backend ulaşılamadı — yalnızca yerel kayıt yapıldı.`);
      } finally {
        setUploading(false);
      }
    }
    setNewTitle('');
    setNewContent('');
    setNewTags('');
    // Auto-close only on clean success
    if (!uploadResult || uploadResult.startsWith('✅')) setShowUpload(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-400" /> Bilgi Tabanı
          </h1>
          <p className="text-sm text-gray-500">
            SOP'lar, politikalar, rehberler ve dokümanlar
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onboardedProduct && (
            <button
              onClick={() => quickAsk(`Knowledge Agent: ${onboardedProduct.product_name} (${onboardedProduct.category}) için hangi SOP / politika / rehber dokümanları eksik? Öncelik sırasına göre listele ve her birinin içeriği ne olmalı kısaca anlat.`)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300"
            >
              Eksik Dokümanları Bul
            </button>
          )}
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">
            <Upload size={16} /> Doküman Yükle
          </button>
        </div>
      </div>

      {/* Upload */}
      {showUpload && (
        <div className="bg-gray-900 border border-indigo-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Yeni Doküman Yükle</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Doküman başlığı..." className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
              <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="md">Markdown</option>
                <option value="pdf">PDF</option>
                <option value="txt">Text</option>
                <option value="url">URL</option>
                <option value="sop">SOP</option>
              </select>
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Kategori..." className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="İçerik veya özet..." rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            <input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="Etiketler (virgülle ayrılmış)..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-500">İçerik ≥20 karakter olduğunda backend RAG'a (pgvector) da indexlenir.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowUpload(false)} disabled={uploading} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 disabled:opacity-50">İptal</button>
                <button onClick={() => void handleUpload()} disabled={uploading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium disabled:opacity-50">
                  {uploading ? 'Indexleniyor…' : 'Yükle'}
                </button>
              </div>
            </div>
          </div>
          {uploadResult && (
            <div className="mt-3 text-xs text-gray-300 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">{uploadResult}</div>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Doküman ara..." className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c === 'all' ? 'Tümü' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((doc) => (
          <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-800 shrink-0">
                {typeIcons[doc.type]}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white truncate">{doc.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 uppercase">{doc.type}</span>
                  <span className="text-[10px] text-gray-600">•</span>
                  <span className="text-[10px] text-gray-500">{doc.category}</span>
                  <span className="text-[10px] text-gray-600">•</span>
                  <span className="text-[10px] text-gray-500">{doc.chunks_count} parça</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 line-clamp-3">{doc.content_preview}</p>
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              <Tag size={10} className="text-gray-600" />
              {doc.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-gray-800 text-gray-400">{tag}</span>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Güncelleme: {new Date(doc.updated_at).toLocaleDateString('tr-TR')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
