"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User } from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";
import { ROLE_LABELS } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const settingsPath = `/${userRole.replace("_", "-")}/settings`;

  return (
    <header className="z-40 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-6 safe-top">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="lg:hidden shrink-0">
          <AppLogo size="sm" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold truncate">{ROLE_LABELS[userRole] || userRole}</h2>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            Welcome back, {userName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 mt-1">
            <DropdownMenuItem asChild>
              <Link href={settingsPath} className="cursor-pointer flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                <User className="h-4 w-4" />
                <span>View Details</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
