/**
 * Renders chat / agent output text with embedded image references.
 *
 * Recognises three image patterns:
 *   1. `![alt](url)` markdown — output of `extractImageUrls()` in the store
 *   2. Bare `/images/abc.png` paths — emitted by some agent prompts; resolved
 *      to fully-qualified backend URLs via resolveBackendUrl
 *   3. Bare `https://…/something.png|jpg|jpeg|webp|gif` URLs
 *
 * Matches are extracted to <img> blocks; remaining text is preserved verbatim.
 */
import { resolveBackendUrl } from '@/lib/api';

type Part = { type: 'text'; text: string } | { type: 'img'; src: string };

const MARKDOWN_IMG = /!\[[^\]]*\]\(([^)]+)\)/g;
const BARE_IMG = /(?:(?<!\]\()\/images\/[A-Za-z0-9._-]+)|(?:https?:\/\/[^\s)]+?\.(?:png|jpe?g|webp|gif))/gi;

function parse(content: string): Part[] {
  const matches: { index: number; length: number; src: string }[] = [];
  for (const m of content.matchAll(MARKDOWN_IMG)) {
    if (m.index === undefined) continue;
    matches.push({ index: m.index, length: m[0].length, src: m[1] });
  }
  for (const m of content.matchAll(BARE_IMG)) {
    if (m.index === undefined) continue;
    // Skip if already inside a markdown image match.
    const inside = matches.some((mm) => m.index! >= mm.index && m.index! < mm.index + mm.length);
    if (inside) continue;
    matches.push({ index: m.index, length: m[0].length, src: resolveBackendUrl(m[0]) });
  }
  matches.sort((a, b) => a.index - b.index);

  const parts: Part[] = [];
  let last = 0;
  for (const m of matches) {
    if (m.index > last) parts.push({ type: 'text', text: content.slice(last, m.index) });
    parts.push({ type: 'img', src: m.src });
    last = m.index + m.length;
  }
  if (last < content.length) parts.push({ type: 'text', text: content.slice(last) });
  return parts;
}

/**
 * Compact image-aware renderer used by the chat page, supervisor dock and
 * brand page. Caller controls the wrapper styling; this component only
 * decides whether each segment is text or an <img>.
 */
export function ChatMessageBody({
  content,
  textClassName = 'text-sm whitespace-pre-wrap leading-relaxed',
  imgClassName = 'rounded-lg border border-gray-700 max-w-xs',
}: {
  content: string;
  textClassName?: string;
  imgClassName?: string;
}) {
  const parts = parse(content);
  if (parts.length === 0) return null;
  return (
    <div className="space-y-2">
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <div key={i} className={textClassName}>{p.text}</div>
        ) : (
          <a key={i} href={p.src} target="_blank" rel="noreferrer" className="block">
            <img src={p.src} alt="agent görsel" loading="lazy" className={imgClassName} />
          </a>
        ),
      )}
    </div>
  );
}

/** Extract just the image URLs from a content string — handy when a page
 *  wants to render images separately from the prose (e.g. Brand gallery). */
export function extractImages(content: string): string[] {
  return parse(content).filter((p): p is { type: 'img'; src: string } => p.type === 'img').map((p) => p.src);
}
