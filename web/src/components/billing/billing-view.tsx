"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { trpc } from "@/lib/trpc/client";
import type { Plan } from "@/types/database";

const PLANS: Plan[] = ["trial", "starter", "pro", "agency"];

export function BillingView() {
  const t = useTranslations("billing");
  const { data: me } = trpc.user.me.useQuery();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = PLAN_PRICES[plan];
          const isCurrent = me?.plan === plan;
          return (
            <Card
              key={plan}
              className={`p-6 ${isCurrent ? "border-primary ring-2 ring-primary-light" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t(plan)}</h3>
                {isCurrent && (
                  <Badge variant="default">
                    <Check className="mr-1 h-3 w-3" />
                    {t("currentPlan")}
                  </Badge>
                )}
              </div>
              <p className="mt-4 text-3xl font-bold">
                ${price.monthly}
                <span className="text-sm font-normal text-text-muted">/ay</span>
              </p>
              {!isCurrent && plan !== "trial" && (
                <Button className="mt-6 w-full" variant="outline">
                  {t("upgrade")}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
