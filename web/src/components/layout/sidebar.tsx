"use client";

import { useTranslations } from "next-intl";
import {
  Home,
  Megaphone,
  Users,
  Settings,
  ImageIcon,
  Calendar,
  Target,
  Gem,
  ChevronLeft,
  X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/stores/ui-store";
import { getTrialDaysLeft } from "@/lib/billing/plans";
import { trpc } from "@/lib/trpc/client";
import { useAppUser } from "@/hooks/use-app-user";

const navItems: Array<{
  key: string;
  href: string;
  icon: typeof Home;
  badge?: boolean;
}> = [
  { key: "dashboard", href: "/dashboard", icon: Home },
  { key: "brandVoice", href: "/brand-voice", icon: Megaphone },
  { key: "team", href: "/team", icon: Users },
  { key: "automations", href: "/automations", icon: Settings, badge: true },
  { key: "visualStudio", href: "/visual-studio/createImage", icon: ImageIcon },
  { key: "calendar", href: "/calendar", icon: Calendar },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { user } = useAppUser();
  const { sidebarCollapsed, mobileSidebarOpen, toggleSidebar, setMobileSidebarOpen } =
    useUIStore();
  const { data: me } = trpc.user.me.useQuery(undefined, { retry: false });

  const trialDays = getTrialDaysLeft(me?.trial_ends_at ?? null);

  const content = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-white shadow-sidebar transition-all duration-200",
        sidebarCollapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Gem className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold lowercase text-text-primary">
              ticosclaw
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 768) setMobileSidebarOpen(false);
            else toggleSidebar();
          }}
          className="hidden rounded-lg p-1 hover:bg-surface md:block"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 text-text-muted transition-transform",
              sidebarCollapsed && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="rounded-lg p-1 hover:bg-surface md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-light text-primary"
                  : "text-text-secondary hover:bg-surface",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{t(item.key)}</span>
                  {item.badge && (
                    <Badge variant="new" className="text-[10px]">
                      {t("new")}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/goals"
          onClick={() => setMobileSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/goals")
              ? "bg-primary-light text-primary"
              : "text-text-secondary hover:bg-surface",
          )}
        >
          <Target className="h-5 w-5" />
          {!sidebarCollapsed && <span>{t("goals")}</span>}
        </Link>

        {!sidebarCollapsed && me?.plan === "trial" && trialDays > 0 && (
          <p className="mt-3 px-3 text-xs text-text-muted">
            {tCommon("trialDaysLeft", { days: trialDays })}{" "}
            <Link href="/goals" className="text-primary underline">
              {tCommon("upgradePlan")}
            </Link>
          </p>
        )}

        {!sidebarCollapsed && user && (
          <div className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-medium text-primary">
              {user.firstName?.[0] ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.fullName ?? user.firstName ?? "User"}
              </p>
              <p className="truncate text-xs text-text-muted capitalize">
                {me?.plan ?? "trial"}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-screen shrink-0 md:block">{content}</div>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
