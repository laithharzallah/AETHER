"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { dashboardNavItems } from "@/lib/dashboard/nav";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border/40 bg-background">
      <div className="flex items-center gap-2 border-b border-border/40 px-5 py-5">
        <Shield className="h-5 w-5" />
        <span className="text-lg font-semibold tracking-tight">AETHER</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {dashboardNavItems.map((item, index) => {
          const active = !item.comingSoon && isActivePath(pathname, item.href);
          const Icon = item.icon;
          const prev = dashboardNavItems[index - 1];
          const sectionHeader =
            item.section && item.section !== prev?.section ? (
              <p
                key={`section-${item.section}`}
                className="mt-4 mb-1 px-3 text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase first:mt-0"
              >
                {item.section}
              </p>
            ) : null;

          if (item.comingSoon) {
            return (
              <div key={item.href} className="contents">
                {sectionHeader}
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/60 cursor-not-allowed"
                  aria-disabled="true"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="flex-1">{item.label}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    Soon
                  </Badge>
                </div>
              </div>
            );
          }

          return (
            <div key={item.href} className="contents">
              {sectionHeader}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
