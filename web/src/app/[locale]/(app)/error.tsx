"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">Bir hata oluştu</h2>
      <p className="text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset}>Tekrar Dene</Button>
    </div>
  );
}
