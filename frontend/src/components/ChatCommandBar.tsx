import { useStore } from '@/stores/useStore';
import { MessageSquare, Sparkles } from 'lucide-react';

interface Command {
  label: string;
  message: string;
}

interface Props {
  commands: Command[];
  title?: string;
}

/**
 * Sayfaya gömülü "Chat'ten Komut Ver" şeridi.
 * Her düğme, verilen mesajı Supervisor chat'e gönderir ve
 * dock'u açarak kullanıcının yanıtı görmesini sağlar.
 */
export function ChatCommandBar({ commands, title = 'Chat ile üret / sorgula' }: Props) {
  const sendUserMessage = useStore((s) => s.sendUserMessage);
  const setSupervisorDockOpen = useStore((s) => s.setSupervisorDockOpen);
  const isThinking = useStore((s) => s.isThinking);

  const run = (message: string) => {
    sendUserMessage(message);
    setSupervisorDockOpen(true);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-2 border-b border-gray-800/60 bg-gray-900/30">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 shrink-0">
        <MessageSquare size={11} />
        <span>{title}</span>
      </div>
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={() => run(cmd.message)}
          disabled={isThinking}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] hover:bg-indigo-500/20 hover:border-indigo-400/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={9} />
          {cmd.label}
        </button>
      ))}
    </div>
  );
}
