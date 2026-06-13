"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{user.name}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Çıkış
        </button>
      </div>
    </header>
  );
}
