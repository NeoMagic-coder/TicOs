"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
} from "lucide-react";

const routes = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Ürünler", icon: Package },
  { href: "/dashboard/orders", label: "Siparişler", icon: ShoppingCart },
  { href: "/dashboard/customers", label: "Müşteriler", icon: Users },
  { href: "/dashboard/settings", label: "Ayarlar", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          TicOS
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {routes.map((route) => {
          const Icon = route.icon;
          const isActive =
            pathname === route.href ||
            pathname.startsWith(route.href + "/");

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {route.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
