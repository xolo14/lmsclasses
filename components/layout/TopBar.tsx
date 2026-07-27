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
  /** When set, replaces the LMS logo in the mobile top bar. */
  brandLogoUrl?: string | null;
}

export function TopBar({ userName, userRole, onMenuClick, brandLogoUrl }: TopBarProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const settingsPath = `/${userRole.replace("_", "-")}/settings`;

  return (
    <header className="z-40 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-swiss-black/10 border-t-4 border-t-swiss-red bg-swiss-white/95 backdrop-blur-md px-3 sm:px-6 safe-top">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 touch-target text-swiss-black"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="lg:hidden shrink-0 max-w-[7.5rem] sm:max-w-[10rem]">
          {brandLogoUrl ? (
            <div
              className="h-9 w-28 sm:h-10 sm:w-32"
              style={{
                backgroundImage: `url(${JSON.stringify(brandLogoUrl).slice(1, -1)})`,
                backgroundSize: "contain",
                backgroundPosition: "left center",
                backgroundRepeat: "no-repeat",
              }}
              role="img"
              aria-label="Organisation logo"
            />
          ) : (
            <AppLogo size="sm" />
          )}
        </div>
        <div className="min-w-0 hidden sm:block lg:block">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.12em] truncate">
            {ROLE_LABELS[userRole] || userRole}
          </h2>
          <p className="text-xs text-swiss-muted truncate hidden md:block">
            Welcome back, {userName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-11 w-11 rounded-full p-0 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Account menu"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-swiss-red/10 text-swiss-red font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 mt-1">
            <DropdownMenuItem asChild>
              <Link
                href={settingsPath}
                className="cursor-pointer flex w-full items-center gap-2 px-2 py-1.5 text-sm"
              >
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
