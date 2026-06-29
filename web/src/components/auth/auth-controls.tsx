"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth/config";

export function AuthControls() {
  if (!isClerkEnabled()) return null;
  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Giriş Yap
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Kayıt Ol</Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/tr/sign-in"
          appearance={{
            elements: {
              avatarBox: "h-9 w-9",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
