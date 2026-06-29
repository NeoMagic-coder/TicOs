"use client";

import { useUser as useClerkUser } from "@clerk/nextjs";
import { isClerkEnabled, DEV_USER } from "@/lib/auth/config";

export function useAppUser() {
  // `isClerkEnabled()` derives from a build-time inlined env var, so its value is
  // constant for the app lifetime — the conditional hook call below is stable.
  if (!isClerkEnabled()) {
    return {
      isLoaded: true,
      user: DEV_USER,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clerk = useClerkUser();

  return {
    isLoaded: clerk.isLoaded,
    user: clerk.user,
  };
}
