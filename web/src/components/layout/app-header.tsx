"use client";

import { Menu, HelpCircle } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { AuthControls } from "@/components/auth/auth-controls";

export function AppHeader() {
  const { setMobileSidebarOpen } = useUIStore();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <HelpCircle className="h-5 w-5 text-text-secondary" />
        </Button>
        <AuthControls />
      </div>
    </header>
  );
}
