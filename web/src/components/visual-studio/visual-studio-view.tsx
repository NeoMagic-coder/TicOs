"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Plus, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export function VisualStudioView() {
  const t = useTranslations("visualStudio");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [format, setFormat] = useState("png");
  const [count, setCount] = useState("1");
  const [showSamples, setShowSamples] = useState(false);

  const { data: remaining } = trpc.images.remaining.useQuery();
  const { data: history } = trpc.images.list.useQuery();
  const generate = trpc.images.generate.useMutation();

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-64 shrink-0 border-r border-border bg-white p-4">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-xs text-text-muted">{t("subtitle")}</p>

        <div className="mt-6 space-y-2">
          <div className="rounded-xl bg-primary-light p-4">
            <p className="text-sm font-medium text-primary">{t("imageStudio")}</p>
            <p className="text-xs text-text-muted">{t("imageStudioDesc")}</p>
          </div>
          <div className="rounded-xl border border-border p-4 opacity-60">
            <p className="text-sm font-medium">{t("videoStudio")}</p>
            <p className="text-xs text-text-muted">{t("videoStudioDesc")}</p>
          </div>
        </div>

        <Card className="mt-6 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">{t("infoTitle")}</p>
              <p className="text-xs text-text-muted">{t("infoText")}</p>
            </div>
          </div>
        </Card>
      </aside>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("createTitle")}</h1>
          <Badge variant="default">
            {t("remaining", { count: remaining?.remaining ?? 3 })}
          </Badge>
        </div>

        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create">{t("tabs.create")}</TabsTrigger>
            <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6 max-w-2xl space-y-6">
            <div>
              <Label>{t("images")}</Label>
              <div className="mt-2 flex min-h-[100px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-text-muted" />
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm">
                      {t("selectImages")}
                    </Button>
                    <Button variant="ghost" size="sm">
                      {t("selectFromHistory")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Referans görsel
            </Button>

            <div>
              <Label>{t("prompt")}</Label>
              <Textarea
                className="mt-2 min-h-[140px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("prompt")}
              />
            </div>

            <Button variant="outline" disabled={!prompt}>
              {t("generateIdeas")}
            </Button>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>{t("imageSize")}</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024x1024">1:1</SelectItem>
                    <SelectItem value="1024x1792">4:5</SelectItem>
                    <SelectItem value="1024x1792">9:16</SelectItem>
                    <SelectItem value="1792x1024">16:9</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("imageFormat")}</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                    <SelectItem value="webp">WEBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("variations")}</Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!prompt || generate.isPending}
              onClick={() =>
                generate.mutate({
                  prompt,
                  size,
                  count: Number(count),
                })
              }
            >
              {generate.isPending ? "..." : t("createCta")}
            </Button>

            {(generate.data || showSamples) && (
              <div>
                <div className="mb-4 flex gap-4">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary"
                    onClick={() => setShowSamples(!showSamples)}
                  >
                    {t("showSamples")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(generate.data?.image_urls ?? []).map((url: string, i: number) => (
                    <Image
                      key={i}
                      src={url}
                      alt={`Generated ${i + 1}`}
                      width={512}
                      height={512}
                      className="rounded-2xl border border-border"
                      unoptimized
                    />
                  ))}
                  {showSamples &&
                    [1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex aspect-square items-center justify-center rounded-2xl bg-primary-light text-primary"
                      >
                        {t("sample")} {i}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {history?.map((item) =>
                item.image_urls.map((url: string, i: number) => (
                  <div key={`${item.id}-${i}`}>
                    <Image
                      src={url}
                      alt={item.prompt}
                      width={400}
                      height={400}
                      className="rounded-2xl border border-border"
                      unoptimized
                    />
                    <p className="mt-2 truncate text-xs text-text-muted">
                      {item.prompt}
                    </p>
                  </div>
                )),
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
