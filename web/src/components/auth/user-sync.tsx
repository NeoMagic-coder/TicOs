"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { isClerkEnabled } from "@/lib/auth/config";

export function UserSync() {
  if (!isClerkEnabled()) return null;
  return <UserSyncInner />;
}

function UserSyncInner() {
  const { user, isLoaded } = useUser();
  const sync = trpc.user.sync.useMutation();

  useEffect(() => {
    if (!isLoaded || !user) return;
    sync.mutate({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  return null;
}
