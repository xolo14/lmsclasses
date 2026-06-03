"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { ROLE_LABELS } from "@/lib/utils";

interface TopBarProps {
  userName: string;
  userRole: string;
  onMenuClick?: () => void;
}

export function TopBar({ userName, userRole, onMenuClick }: TopBarProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="z-40 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-6 safe-top">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold truncate">{ROLE_LABELS[userRole] || userRole}</h2>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            Welcome back, {userName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
