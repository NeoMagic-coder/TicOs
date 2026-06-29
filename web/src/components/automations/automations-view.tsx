"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AGENTS } from "@/lib/ai/agents";
import { IntegrationsPanel } from "@/components/integrations/integrations-panel";

const AUTOMATION_CARDS = [
  {
    key: "social",
    bg: "bg-automation-pink",
    agent: "social",
    tags: ["Instagram", "Facebook", "LinkedIn"],
    href: "/calendar",
  },
  {
    key: "mail",
    bg: "bg-automation-mint",
    agent: "email",
    tags: ["Gmail", "Outlook"],
    href: "/automations",
  },
  {
    key: "blog",
    bg: "bg-automation-blue",
    agent: "blog",
    tags: ["WordPress"],
    href: "/team",
  },
  {
    key: "reddit",
    bg: "bg-automation-orange",
    agent: "social",
    tags: ["Reddit"],
    href: "/automations",
  },
  {
    key: "trends",
    bg: "bg-automation-yellow",
    agent: "ticos",
    tags: [],
    href: "/dashboard",
  },
] as const;

export function AutomationsView() {
  const t = useTranslations("automations");

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-text-secondary">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="automations">
        <TabsList>
          <TabsTrigger value="automations">{t("tabs.automations")}</TabsTrigger>
          <TabsTrigger value="integrations">{t("tabs.integrations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="space-y-4">
          {AUTOMATION_CARDS.map((card) => {
            const agent = AGENTS[card.agent as keyof typeof AGENTS];
            return (
              <Link key={card.key} href={card.href}>
                <div
                  className={`group flex cursor-pointer items-center gap-4 rounded-2xl p-5 transition-shadow hover:shadow-md ${card.bg}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={agent.avatar} />
                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{t(`cards.${card.key}.title`)}</h3>
                    <p className="text-sm text-text-secondary">
                      {t(`cards.${card.key}.description`)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-primary">
                      ✦ {t(`cards.${card.key}.cta`)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="bg-white/60">
                          + {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-text-muted transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
