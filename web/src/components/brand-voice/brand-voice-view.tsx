"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Globe,
  Palette,
  Type,
  Target,
  Users,
  Crosshair,
  Swords,
  Gem,
  LineChart,
  FileText,
  Check,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import type { VoiceProfile } from "@/types/database";

const ANALYZE_STEPS = [
  { key: "scrape", icon: Globe, threshold: 0 },
  { key: "brand", icon: Palette, threshold: 18 },
  { key: "positioning", icon: Crosshair, threshold: 38 },
  { key: "competitors", icon: Swords, threshold: 58 },
  { key: "personas", icon: Users, threshold: 76 },
  { key: "strategy", icon: LineChart, threshold: 90 },
] as const;

export function BrandVoiceView() {
  const t = useTranslations("brandVoice");
  const { activeBrandId, setActiveBrandId } = useUIStore();
  const [url, setUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utils = trpc.useUtils();

  const {
    data: brands = [],
    isLoading: listLoading,
    refetch: refetchList,
  } = trpc.brand.list.useQuery();

  useEffect(() => {
    if (!brands.length) {
      if (activeBrandId) setActiveBrandId(null);
      return;
    }
    if (activeBrandId && brands.some((b) => b.id === activeBrandId)) return;
    setActiveBrandId(brands[0].id);
  }, [brands, activeBrandId, setActiveBrandId]);

  const {
    data: brand,
    isLoading,
    error: brandError,
    refetch,
  } = trpc.brand.get.useQuery(
    { brandId: activeBrandId! },
    { enabled: !!activeBrandId, retry: false },
  );

  const createBrand = trpc.brand.create.useMutation({
    onSuccess: (newBrand) => {
      setActiveBrandId(newBrand.id);
      setUrl("");
      void refetchList();
      void utils.brand.get.invalidate({ brandId: newBrand.id });
    },
  });

  const deleteBrand = trpc.brand.delete.useMutation({
    onSuccess: () => {
      const remaining = brands.filter((b) => b.id !== activeBrandId);
      setActiveBrandId(remaining[0]?.id ?? null);
      setUrl("");
      void refetchList();
      void utils.brand.get.invalidate();
    },
  });

  const analyze = trpc.brand.analyze.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchList();
    },
  });

  const profile = (brand?.voice_profile ?? {}) as VoiceProfile;
  const hasProfile = Boolean(profile.summary);

  useEffect(() => {
    if (analyze.isPending) {
      setProgress(3);
      timerRef.current = setInterval(() => {
        setProgress((p) => (p >= 95 ? 95 : p + Math.max(1, Math.round((95 - p) / 12))));
      }, 350);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (analyze.isSuccess) setProgress(100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [analyze.isPending, analyze.isSuccess]);

  const handleAddBrand = () => createBrand.mutate();
  const handleDeleteBrand = () => {
    if (!activeBrandId) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    deleteBrand.mutate({ brandId: activeBrandId });
  };
  const handleAnalyze = () => {
    if (!activeBrandId || !url) return;
    analyze.mutate({ url, brandId: activeBrandId });
  };

  const brandBar = (
    <BrandBar
      brands={brands}
      activeId={activeBrandId}
      onSelect={setActiveBrandId}
      onAdd={handleAddBrand}
      onDelete={handleDeleteBrand}
      isAdding={createBrand.isPending}
      isDeleting={deleteBrand.isPending}
    />
  );

  if (listLoading || (activeBrandId && isLoading)) {
    return (
      <div className="flex min-h-full flex-col">
        {brandBar}
        <div className="space-y-4 p-8">
          <div className="h-12 w-64 animate-pulse rounded-xl bg-surface" />
          <div className="h-48 w-full animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  if (analyze.isPending) {
    return (
      <div className="flex min-h-full flex-col">
        {brandBar}
        <AnalyzingScreen progress={progress} url={url} />
      </div>
    );
  }

  if (!brands.length) {
    return (
      <div className="flex min-h-full flex-col">
        {brandBar}
        <NoBrandsState onAdd={handleAddBrand} isAdding={createBrand.isPending} />
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="flex min-h-full flex-col">
        {brandBar}
        <EmptyState
          t={t}
          url={url}
          setUrl={setUrl}
          onAnalyze={handleAnalyze}
          pending={analyze.isPending}
          error={(analyze.error || brandError)?.message}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {brandBar}
      <AnalysisDashboard
        brand={brand}
        profile={profile}
        onReanalyze={() =>
          analyze.mutate({ url: brand?.url ?? url, brandId: activeBrandId! })
        }
      />
    </div>
  );
}

/* ----------------------------- Brand manager ----------------------------- */

type BrandRow = {
  id: string;
  name: string | null;
  url: string | null;
};

function BrandBar({
  brands,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  isAdding,
  isDeleting,
}: {
  brands: BrandRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  isAdding: boolean;
  isDeleting: boolean;
}) {
  const t = useTranslations("brandVoice");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-4 py-3 md:px-8">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeId === b.id
                ? "bg-primary text-white shadow-sm"
                : "bg-surface text-text-secondary hover:bg-primary-light hover:text-primary",
            )}
          >
            {b.name || t("newBrand")}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onAdd} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("addBrand")}
        </Button>
        {activeId && brands.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {t("deleteBrand")}
          </Button>
        )}
      </div>
    </div>
  );
}

function NoBrandsState({
  onAdd,
  isAdding,
}: {
  onAdd: () => void;
  isAdding: boolean;
}) {
  const t = useTranslations("brandVoice");

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold">{t("noBrands")}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t("noBrandsDescription")}</p>
        <Button className="mt-6 w-full" size="lg" onClick={onAdd} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("addBrand")}
        </Button>
      </Card>
    </div>
  );
}

/* ----------------------------- Empty / intro ----------------------------- */

function EmptyState({
  t,
  url,
  setUrl,
  onAnalyze,
  pending,
  error,
}: {
  t: ReturnType<typeof useTranslations>;
  url: string;
  setUrl: (v: string) => void;
  onAnalyze: () => void;
  pending: boolean;
  error?: string;
}) {
  const features = [
    { icon: Crosshair, label: t("tabs.positioning") },
    { icon: Swords, label: t("tabs.competitors") },
    { icon: Gem, label: t("tabs.value") },
    { icon: Users, label: t("tabs.personas") },
    { icon: LineChart, label: t("tabs.strategy") },
  ];

  return (
    <div className="flex min-h-[78vh] items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-primary-dark p-8 text-center text-white">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold">{t("emptyTitle")}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
            {t("emptyDescription")}
          </p>
        </div>

        <CardContent className="p-8 pt-6">
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              className="pl-9"
              placeholder={t("urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url) onAnalyze();
              }}
            />
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            onClick={onAnalyze}
            disabled={!url || pending}
          >
            <Sparkles className="h-4 w-4" />
            {t("cta")}
          </Button>

          {error && (
            <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-left text-xs text-error">
              {formatError(error)}
            </p>
          )}

          <p className="mt-3 text-center text-xs text-text-muted">{t("ctaNote")}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-6">
            {features.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary"
              >
                <f.icon className="h-3.5 w-3.5 text-primary" />
                {f.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Analyzing ------------------------------- */

function AnalyzingScreen({ progress, url }: { progress: number; url: string }) {
  const t = useTranslations("brandVoice");

  return (
    <div className="flex min-h-[78vh] items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <ProgressRing value={progress} />
            <span className="absolute font-display text-xl font-bold text-primary">
              {progress}%
            </span>
          </div>

          <h2 className="mt-6 font-display text-xl font-bold">
            {t("analyzing")}
          </h2>
          {url && <p className="mt-1 text-sm text-text-muted">{url}</p>}
          <p className="mt-1 text-sm text-text-secondary">
            %{progress} {t("analyzingComplete")}
          </p>

          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {ANALYZE_STEPS.map((step) => {
            const done = progress > step.threshold + 12;
            const active = !done && progress >= step.threshold;
            return (
              <div
                key={step.key}
                className="flex items-center gap-3 text-sm transition-opacity"
                style={{ opacity: done || active ? 1 : 0.4 }}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-success/15 text-success"
                      : active
                        ? "bg-primary-light text-primary"
                        : "bg-surface text-text-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <step.icon className="h-3.5 w-3.5" />
                  )}
                </span>
                <span
                  className={
                    done || active ? "text-text-primary" : "text-text-muted"
                  }
                >
                  {t(`steps.${step.key}`)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="var(--surface)"
        strokeWidth="8"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

/* ------------------------------- Dashboard ------------------------------- */

function AnalysisDashboard({
  brand,
  profile,
  onReanalyze,
}: {
  brand: { name?: string | null; url?: string | null } | undefined;
  profile: VoiceProfile;
  onReanalyze: () => void;
}) {
  const t = useTranslations("brandVoice");

  const tabs = [
    { value: "assets", icon: Palette },
    { value: "summary", icon: FileText },
    { value: "positioning", icon: Crosshair },
    { value: "competitors", icon: Swords },
    { value: "value", icon: Gem },
    { value: "segment", icon: Target },
    { value: "personas", icon: Users },
    { value: "strategy", icon: LineChart },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              {brand?.name ?? "—"}
            </h1>
            {profile.industry && (
              <Badge variant="default">{profile.industry}</Badge>
            )}
          </div>
          {brand?.url && (
            <a
              href={brand.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
            >
              <Globe className="h-3.5 w-3.5" />
              {brand.url}
            </a>
          )}
          {profile.tagline && (
            <p className="mt-1 font-display text-base italic text-text-secondary">
              “{profile.tagline}”
            </p>
          )}
        </div>
        <Button variant="outline" onClick={onReanalyze}>
          <RefreshCw className="h-4 w-4" />
          {t("reanalyze")}
        </Button>
      </div>

      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              {t(`tabs.${tab.value}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="assets">
          <AssetsSection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="summary">
          <SummarySection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="positioning">
          <SimpleTextSection text={profile.positioning} icon={Crosshair} title={t("tabs.positioning")} empty={t("empty")} />
        </TabsContent>
        <TabsContent value="competitors">
          <CompetitorsSection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="value">
          <ValueSection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="segment">
          <SegmentSection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="personas">
          <PersonasSection t={t} profile={profile} />
        </TabsContent>
        <TabsContent value="strategy">
          <StrategySection t={t} profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Sections -------------------------------- */

type T = ReturnType<typeof useTranslations>;

function EmptyHint({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center p-10 text-sm text-text-muted">
        {text}
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  feedback = true,
}: {
  icon: typeof Sparkles;
  title: string;
  feedback?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {feedback && (
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 text-text-muted hover:bg-surface hover:text-success" aria-label="up">
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-1.5 text-text-muted hover:bg-surface hover:text-error" aria-label="down">
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function AssetsSection({ t, profile }: { t: T; profile: VoiceProfile }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChipCard title={t("tone")} icon={Sparkles} items={profile.tone} />
      <ChipCard title={t("personality")} icon={Users} items={profile.personality} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> {t("colors")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {profile.colors?.length ? (
            profile.colors.map((color) => (
              <div key={color} className="flex flex-col items-center gap-1">
                <div
                  className="h-12 w-12 rounded-xl border border-border"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] uppercase text-text-muted">{color}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-text-muted">{t("empty")}</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Type className="h-4 w-4 text-primary" /> {t("fonts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {profile.fonts?.length ? (
            profile.fonts.map((f) => (
              <Badge key={f} variant="outline">
                {f}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-text-muted">{t("empty")}</span>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("wordPreferences")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {profile.wordPreferences?.preferred?.map((w) => (
            <Badge key={`p-${w}`} variant="success">
              {w}
            </Badge>
          ))}
          {profile.wordPreferences?.avoid?.map((w) => (
            <Badge key={`a-${w}`} variant="error">
              {w}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ChipCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Sparkles;
  items?: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items?.map((item) => (
          <Badge key={item} variant="default">
            {item}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function SummarySection({ t, profile }: { t: T; profile: VoiceProfile }) {
  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeader icon={FileText} title={t("tabs.summary")} />
        <p className="leading-relaxed text-text-secondary">{profile.summary}</p>
      </CardContent>
    </Card>
  );
}

function SimpleTextSection({
  text,
  icon,
  title,
  empty,
}: {
  text?: string;
  icon: typeof Sparkles;
  title: string;
  empty: string;
}) {
  if (!text) return <EmptyHint text={empty} />;
  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeader icon={icon} title={title} />
        <p className="leading-relaxed text-text-secondary">{text}</p>
      </CardContent>
    </Card>
  );
}

function CompetitorsSection({ t, profile }: { t: T; profile: VoiceProfile }) {
  if (!profile.competitors?.length) return <EmptyHint text={t("empty")} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {profile.competitors.map((c) => (
        <Card key={c.name}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="h-4 w-4 text-primary" /> {c.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-text-secondary">{c.description}</p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-success">
                {t("strengths")}
              </p>
              <ul className="space-y-1">
                {c.strengths?.map((s) => (
                  <li key={s} className="text-sm text-text-secondary">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-error">
                {t("weaknesses")}
              </p>
              <ul className="space-y-1">
                {c.weaknesses?.map((s) => (
                  <li key={s} className="text-sm text-text-secondary">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ValueSection({ t, profile }: { t: T; profile: VoiceProfile }) {
  if (!profile.valueProposition && !profile.valuePropositionPoints?.length) {
    return <EmptyHint text={t("empty")} />;
  }
  return (
    <div className="space-y-4">
      {profile.valueProposition && (
        <Card>
          <CardContent className="p-6">
            <SectionHeader icon={Gem} title={t("tabs.value")} />
            <p className="text-lg font-medium leading-relaxed text-text-primary">
              {profile.valueProposition}
            </p>
          </CardContent>
        </Card>
      )}
      {!!profile.valuePropositionPoints?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("valuePoints")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {profile.valuePropositionPoints.map((p) => (
              <div
                key={p}
                className="flex items-start gap-2 rounded-xl bg-surface p-3 text-sm text-text-secondary"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {p}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SegmentSection({ t, profile }: { t: T; profile: VoiceProfile }) {
  const segment = profile.targetSegment || profile.audience;
  if (!segment && !profile.segments?.length) return <EmptyHint text={t("empty")} />;
  return (
    <div className="space-y-4">
      {segment && (
        <Card>
          <CardContent className="p-6">
            <SectionHeader icon={Target} title={t("tabs.segment")} />
            <p className="leading-relaxed text-text-secondary">{segment}</p>
          </CardContent>
        </Card>
      )}
      {!!profile.segments?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("segments")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.segments.map((s) => (
              <Badge key={s} variant="default">
                {s}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PersonasSection({ t, profile }: { t: T; profile: VoiceProfile }) {
  if (!profile.personas?.length) return <EmptyHint text={t("empty")} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {profile.personas.map((p) => (
        <Card key={p.name}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light font-display text-lg font-bold text-primary">
                {p.name?.charAt(0) ?? "?"}
              </span>
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-xs text-text-muted">{p.role}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-text-secondary">{p.description}</p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-text-muted">
                {t("personaGoals")}
              </p>
              <ul className="space-y-1">
                {p.goals?.map((g) => (
                  <li key={g} className="text-sm text-text-secondary">
                    • {g}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-text-muted">
                {t("personaPains")}
              </p>
              <ul className="space-y-1">
                {p.painPoints?.map((g) => (
                  <li key={g} className="text-sm text-text-secondary">
                    • {g}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StrategySection({ t, profile }: { t: T; profile: VoiceProfile }) {
  if (!profile.digitalStrategy?.length) return <EmptyHint text={t("empty")} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {profile.digitalStrategy.map((s, i) => (
        <Card key={`${s.channel}-${i}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-primary" /> {s.channel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">{s.recommendation}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------- Helpers -------------------------------- */

function formatError(message?: string) {
  if (!message) return "Bilinmeyen bir hata oluştu.";
  if (message.includes("schema cache") || message.includes("does not exist")) {
    return "Veritabanı tabloları bulunamadı. Supabase'de migration (supabase/migrations/001_initial_schema.sql) çalıştırılmamış olabilir.";
  }
  if (message.includes("OPENAI_API_KEY")) {
    return "OpenAI API anahtarı yapılandırılmamış.";
  }
  if (message.toUpperCase().includes("UNAUTHORIZED")) {
    return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
  }
  return message;
}
