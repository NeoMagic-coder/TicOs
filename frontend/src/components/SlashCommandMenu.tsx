import { useEffect, useRef } from 'react';
import type { SlashCommand } from '@/data/slashCommands';
import { cn } from '@/utils/cn';

interface Props {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
}

const CATEGORY_COLORS: Record<SlashCommand['category'], string> = {
  navigation: 'text-indigo-400',
  action:     'text-emerald-400',
  system:     'text-amber-400',
};

export function SlashCommandMenu({ commands, activeIndex, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto">
      <div className="px-3 py-1.5 border-b border-gray-800">
        <span className="text-[10px] text-gray-500 font-medium">Komutlar — Tab veya Enter ile seç</span>
      </div>
      {commands.map((cmd, i) => (
        <button
          key={cmd.id}
          ref={i === activeIndex ? activeRef : undefined}
          onClick={() => onSelect(cmd)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-800',
            i === activeIndex && 'bg-gray-800',
          )}
        >
          <span className={cn('text-xs font-mono font-bold shrink-0', CATEGORY_COLORS[cmd.category])}>
            {cmd.id}
          </span>
          <span className="text-[11px] text-gray-400 truncate">{cmd.desc}</span>
        </button>
      ))}
    </div>
  );
}
