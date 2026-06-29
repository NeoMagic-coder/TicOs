"use client";

import { useCallback, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function useStreamingChat(options: {
  api?: string;
  body?: Record<string, unknown>;
  initialMessages?: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    options.initialMessages ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, assistantMessage]);
      setIsLoading(true);

      try {
        const res = await fetch(options.api ?? "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            ...options.body,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: "Üzgünüm, bir hata oluştu." }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.api, options.body],
  );

  return { messages, sendMessage, isLoading, setMessages };
}
