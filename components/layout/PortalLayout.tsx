"use client";

import { useState, useEffect, isValidElement, cloneElement } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";

interface PortalLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  userName: string;
  userRole: string;
  /** Organisation logo shown as a subtle main-area background (not an inline image). */
  brandLogoUrl?: string | null;
}

export function PortalLayout({
  children,
  sidebar,
  userName,
  userRole,
  brandLogoUrl,
}: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarNode = isValidElement(sidebar)
    ? cloneElement(sidebar as React.ReactElement<{ onNavigate?: () => void }>, {
        onNavigate: closeSidebar,
      })
    : sidebar;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-swiss-cream text-swiss-black">
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-full w-[min(100vw-1rem,16rem)] shrink-0 shadow-xl lg:relative lg:z-auto lg:w-64 lg:shadow-none",
          !sidebarOpen && "hidden lg:block"
        )}
      >
        {sidebarNode}
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col w-full overflow-hidden">
        <TopBar
          userName={userName}
          userRole={userRole}
          brandLogoUrl={brandLogoUrl}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-swiss-cream">
          {brandLogoUrl ? (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage: `url(${JSON.stringify(brandLogoUrl)})`,
                backgroundSize: "min(28rem, 55%)",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
              aria-hidden
            />
          ) : null}
          <div className="relative z-10 p-4 sm:p-6 safe-bottom">{children}</div>
        </main>
      </div>
    </div>
  );
}
