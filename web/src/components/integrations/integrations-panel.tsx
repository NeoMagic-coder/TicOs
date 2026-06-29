"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PLATFORMS } from "@/lib/integrations/platforms";
import { trpc } from "@/lib/trpc/client";

export function IntegrationsPanel() {
  const t = useTranslations("integrations");
  const { data: integrations, refetch } = trpc.integrations.list.useQuery();
  const connect = trpc.integrations.connect.useMutation({ onSuccess: () => refetch() });
  const disconnect = trpc.integrations.disconnect.useMutation({ onSuccess: () => refetch() });

  const connectedMap = new Map(
    integrations?.map((i) => [i.platform, i.is_connected]) ?? [],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PLATFORMS.map((platform) => {
        const isConnected = connectedMap.get(platform.id) ?? false;
        return (
          <Card key={platform.id} className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: platform.color }}
              >
                {platform.name[0]}
              </div>
              <div>
                <p className="font-medium">{platform.name}</p>
                <Badge variant={isConnected ? "success" : "outline"}>
                  {isConnected ? t("connected") : t("notConnected")}
                </Badge>
              </div>
            </div>
            <Button
              variant={isConnected ? "outline" : "default"}
              size="sm"
              onClick={() => {
                if (isConnected) {
                  disconnect.mutate({ platform: platform.id });
                } else {
                  window.open(platform.oauthPath, "_blank", "width=600,height=700");
                  connect.mutate({ platform: platform.id });
                }
              }}
            >
              {isConnected ? t("disconnect") : t("connect")}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
