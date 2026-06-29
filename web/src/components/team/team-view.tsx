"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENTS } from "@/lib/ai/agents";
import { trpc } from "@/lib/trpc/client";
import type { AgentId } from "@/types/database";

const AGENT_KEYS = ["social", "blog", "sales", "email"] as const;

export function TeamView() {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [selected, setSelected] = useState<"inbox" | AgentId>("inbox");
  const [input, setInput] = useState("");
  const { data: team } = trpc.team.list.useQuery();

  const { messages, sendMessage, isLoading, setMessages } = useStreamingChat({
    body: { agentId: selected === "inbox" ? "ticos" : selected, locale },
  });

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [selected, setMessages]);

  const agentMap: Record<string, { name: string; role: string; avatar: string }> = {
    social: { name: t("agents.social.name"), role: t("agents.social.role"), avatar: AGENTS.social.avatar },
    blog: { name: t("agents.blog.name"), role: t("agents.blog.role"), avatar: AGENTS.blog.avatar },
    sales: { name: t("agents.sales.name"), role: t("agents.sales.role"), avatar: AGENTS.sales.avatar },
    email: { name: t("agents.email.name"), role: t("agents.email.role"), avatar: AGENTS.email.avatar },
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-[280px] shrink-0 border-r border-border bg-white p-4">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-xs text-text-muted">
          {t("subtitle", { count: team?.length ?? 4 })}
        </p>

        <button
          type="button"
          onClick={() => setSelected("inbox")}
          className={`mt-4 w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium ${
            selected === "inbox"
              ? "bg-primary text-white"
              : "text-text-secondary hover:bg-surface"
          }`}
        >
          {t("inbox")}
        </button>

        <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {t("membersTitle")}
        </p>

        <div className="space-y-1">
          {AGENT_KEYS.map((key) => {
            const agent = agentMap[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  selected === key ? "bg-primary-light" : "hover:bg-surface"
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={agent.avatar} />
                  <AvatarFallback>{agent.name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="truncate text-xs text-text-muted">{agent.role}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected === "inbox" ? (
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{t("inbox")}</h2>
                <p className="text-sm text-text-muted">{t("inboxDescription")}</p>
              </div>
              <Button variant="ghost" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                {tCommon("refresh")}
              </Button>
            </div>

            <Tabs defaultValue="all" className="mt-4">
              <TabsList>
                <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
                <TabsTrigger value="email">{t("tabs.email")}</TabsTrigger>
                <TabsTrigger value="messages">{t("tabs.messages")}</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                  <p className="mt-4 font-medium">{t("emptyInbox")}</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <>
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">{agentMap[selected]?.name}</h2>
              <p className="text-sm text-text-muted">{agentMap[selected]?.role}</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "ml-auto bg-primary text-white"
                        : "bg-surface text-text-primary"
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && input.trim()) {
                      void sendMessage(input);
                      setInput("");
                    }
                  }}
                  placeholder="Mesaj yaz..."
                />
                <Button
                  onClick={() => {
                    if (!input.trim()) return;
                    void sendMessage(input);
                    setInput("");
                  }}
                  disabled={isLoading}
                >
                  Gönder
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
