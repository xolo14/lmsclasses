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
}

export function PortalLayout({ children, sidebar, userName, userRole }: PortalLayoutProps) {
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
    <div className="flex h-screen min-h-[100dvh] overflow-hidden bg-background">
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
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
