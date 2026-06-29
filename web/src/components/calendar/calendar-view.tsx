"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const PLATFORMS = ["instagram", "linkedin", "wordpress", "facebook"] as const;
const STATUSES = [
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500",
  linkedin: "bg-blue-600",
  wordpress: "bg-blue-800",
  facebook: "bg-blue-500",
};

function getTwoWeekDays(start: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function CalendarView() {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d;
  });
  const [view, setView] = useState("twoWeeks");
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const { data: content } = trpc.content.list.useQuery();
  const { data: integrations } = trpc.integrations.list.useQuery();

  const days = useMemo(() => getTwoWeekDays(startDate), [startDate]);
  const dayLabels = ["PZT", "SAL", "ÇAR", "PER", "CUM", "CMT", "PAZ"];

  const connectedPlatforms = new Set(
    integrations?.filter((i) => i.is_connected).map((i) => i.platform) ?? [],
  );

  const filteredContent =
    content?.filter((item) => {
      if (platformFilter.length && !item.platforms.some((p: string) => platformFilter.includes(p)))
        return false;
      if (statusFilter.length && !statusFilter.includes(item.status)) return false;
      return true;
    }) ?? [];

  const navigate = (delta: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + delta * 14);
    setStartDate(d);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStartDate(new Date())}>
            {tCommon("today")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <select className="rounded-xl border border-border px-3 py-2 text-sm">
            <option>Europe/Istanbul</option>
          </select>
          <Button>
            <Sparkles className="mr-2 h-4 w-4" />
            {t("suggest")}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["month", "twoWeeks", "week", "day"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              view === v ? "font-bold text-text-primary" : "text-text-muted",
            )}
          >
            {t(`views.${v}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() =>
              setPlatformFilter((prev) =>
                prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
              )
            }
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              platformFilter.includes(p)
                ? "border-primary bg-primary-light text-primary"
                : "border-border",
            )}
          >
            {t(`platforms.${p}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() =>
              setStatusFilter((prev) =>
                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
              )
            }
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              statusFilter.includes(s) ? "border-primary bg-primary-light" : "border-border",
            )}
          >
            {tCommon(s === "pending_approval" ? "pendingApproval" : s)}
          </button>
        ))}
      </div>

      {PLATFORMS.filter((p) => !connectedPlatforms.has(p)).map((p) => (
        <div
          key={p}
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
        >
          <span>{t("connectWarning", { platform: t(`platforms.${p}`) })}</span>
          <Link href="/automations" className="font-medium text-primary">
            {tCommon("connect")}
          </Link>
        </div>
      ))}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <div className="grid min-w-[800px] grid-cols-7">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="border-b border-r border-border p-2 text-center text-xs font-semibold text-text-muted last:border-r-0"
            >
              {label}
            </div>
          ))}
          {days.slice(0, 14).map((day, i) => {
            const dayContent = filteredContent.filter((c) => {
              if (!c.scheduled_at) return false;
              const d = new Date(c.scheduled_at);
              return d.toDateString() === day.toDateString();
            });
            return (
              <div
                key={i}
                className="min-h-[100px] border-b border-r border-border p-2 last:border-r-0 hover:bg-surface/50"
              >
                <span className="text-xs font-medium text-text-muted">
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {dayContent.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[10px] text-white",
                        PLATFORM_COLORS[item.platforms[0] ?? "instagram"],
                      )}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
