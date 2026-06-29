"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Sparkles, Users, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AGENTS } from "@/lib/ai/agents";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc/client";
import { IntegrationsPanel } from "@/components/integrations/integrations-panel";

const STEPS = ["welcome", "brand", "team", "integrations"] as const;

export function OnboardingView() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const analyze = trpc.brand.analyze.useMutation();

  const current = STEPS[step];

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-lg p-8">
        {current === "welcome" && (
          <div className="text-center">
            <Sparkles className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-bold">{t("welcome")}</h1>
            <Button className="mt-8 w-full" onClick={next}>
              {t("continue")}
            </Button>
          </div>
        )}

        {current === "brand" && (
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold">{t("stepBrand")}</h1>
            <Input
              className="mt-6"
              placeholder="https://websiteniz.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button
              className="mt-4 w-full"
              disabled={!url || analyze.isPending}
              onClick={() => analyze.mutate({ url }, { onSuccess: next })}
            >
              {analyze.isPending ? "..." : t("continue")}
            </Button>
          </div>
        )}

        {current === "team" && (
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-bold">{t("stepTeam")}</h1>
            <div className="mt-6 flex justify-center gap-4">
              {(["social", "blog", "sales", "email"] as const).map((id, i) => (
                <Avatar
                  key={id}
                  className="h-14 w-14 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <AvatarImage src={AGENTS[id].avatar} />
                  <AvatarFallback>{AGENTS[id].name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button className="mt-8 w-full" onClick={next}>
              {t("continue")}
            </Button>
          </div>
        )}

        {current === "integrations" && (
          <div>
            <div className="mb-6 text-center">
              <Link2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 font-display text-2xl font-bold">
                {t("stepIntegrations")}
              </h1>
            </div>
            <IntegrationsPanel />
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={next}>
                {t("skip")}
              </Button>
              <Button className="flex-1" onClick={next}>
                {t("finish")}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i === step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
