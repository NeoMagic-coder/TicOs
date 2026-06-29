"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

export function GoalsView() {
  const t = useTranslations("goals");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const { data: goals, isLoading, refetch } = trpc.goals.list.useQuery();
  const create = trpc.goals.create.useMutation({
    onSuccess: () => {
      setShowForm(false);
      setTitle("");
      setTarget("");
      void refetch();
    },
  });
  const deleteAccount = trpc.user.deleteAccount.useMutation();

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="text-text-secondary">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addGoal")}
        </Button>
      </div>

      {showForm && (
        <Card className="max-w-md p-6">
          <div className="space-y-4">
            <div>
              <Label>Başlık</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>Hedef</Label>
              <Input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button
              onClick={() =>
                create.mutate({
                  title,
                  target_value: Number(target) || undefined,
                })
              }
              disabled={!title}
            >
              Kaydet
            </Button>
          </div>
        </Card>
      )}

      {!goals?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="h-12 w-12 text-text-muted" />
          <p className="mt-4 text-text-secondary">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const progress =
              goal.target_value && goal.current_value
                ? Math.min(100, (goal.current_value / goal.target_value) * 100)
                : 0;
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {goal.description && (
                    <p className="mb-4 text-sm text-text-secondary">{goal.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{t("progress")}</span>
                      <span>
                        {goal.current_value ?? 0}/{goal.target_value ?? "—"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8 border-error/30 p-6">
        <h3 className="font-semibold text-error">GDPR — Hesap Silme</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Tüm verilerinizi kalıcı olarak silmek için aşağıdaki butonu kullanın.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => {
            if (confirm("Hesabınızı silmek istediğinizden emin misiniz?")) {
              deleteAccount.mutate();
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Hesabımı Sil
        </Button>
      </Card>
    </div>
  );
}
