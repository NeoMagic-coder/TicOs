"use client";

import { useStreamingChat } from "@/hooks/use-streaming-chat";
import { useState } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useAppUser } from "@/hooks/use-app-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AGENTS } from "@/lib/ai/agents";
import { formatDateTR } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

export function DashboardView() {
  const t = useTranslations("dashboard");
  const { user } = useAppUser();
  const locale = useLocale();
  const [input, setInput] = useState("");
  const { data: content } = trpc.content.list.useQuery();
  const { data: team } = trpc.team.list.useQuery();

  const { messages, sendMessage, isLoading } = useStreamingChat({
    body: { agentId: "ticos", locale },
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          locale === "tr"
            ? "Günaydın! Bugün ekibin için 3 görev hazırladım. Aşağıdaki listeden onaylayabilirsin."
            : "Good morning! I've prepared 3 tasks for your team today. You can approve them from the list below.",
      },
    ],
  });

  const name = user?.firstName ?? "User";
  const today = formatDateTR(new Date(), locale === "tr" ? "tr-TR" : "en-US");
  const pending = content?.filter((c) => c.status === "pending_approval") ?? [];

  const quickActions = [
    [t("quickActions.inbox"), t("quickActions.todayIdea"), t("quickActions.goalsStatus")],
    [t("quickActions.teamToday"), t("quickActions.weekContent"), t("quickActions.goalsProgress")],
    [t("quickActions.teamMembers")],
  ];

  const handleSend = () => {
    if (!input.trim()) return;
    void sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 p-4 md:p-8">
        <section>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            <span className="highlight-mark">{t("greeting", { name })}</span>
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {team?.slice(0, 4).map((member, i) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={member.avatar_url ?? `/avatars/social.svg`} />
                  <AvatarFallback>{i + 1}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-success" />
              {t("expertsOnline", { count: team?.length ?? 4 })}
            </span>
          </div>

          <p className="mt-2 text-sm text-text-muted">{t("dateLine", { date: today })}</p>
        </section>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={AGENTS.ticos.avatar} />
              <AvatarFallback>T</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{AGENTS.ticos.nameTr}</p>
              <p className="text-sm text-text-muted">{t("ticosManaging")}</p>
            </div>
          </div>

          <div className="space-y-3">
            {messages.slice(-2).map((msg) => (
              <div
                key={msg.id}
                className="rounded-2xl bg-surface p-4 text-sm leading-relaxed text-text-primary"
              >
                {msg.content}
                {isLoading && msg.role === "assistant" && msg === messages[messages.length - 1] && (
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary" />
                )}
              </div>
            ))}
          </div>

          {pending.length > 0 && (
            <div className="mt-4 space-y-2 rounded-xl border border-border p-4">
              {pending.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span>✅</span>
                  <span>{item.title}</span>
                  <Badge variant="warning" className="ml-auto">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-2">
          {quickActions.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              {row.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    setInput(action);
                  }}
                  className="rounded-full border border-border bg-white px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-primary-light hover:text-primary"
                >
                  {action}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-white p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t("chatPlaceholder")}
            className="flex-1 rounded-full px-5"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full bg-text-primary hover:bg-text-primary/90"
            onClick={handleSend}
            disabled={isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
