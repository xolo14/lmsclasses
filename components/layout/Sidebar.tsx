"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/brand/AppLogo";
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  CreditCard,
  Briefcase,
  UserCheck,
  Video,
  ScrollText,
  Settings,
  History,
  Trash2,
  Film,
  ClipboardList,
  Tag,
  Play,
  Contact,
  Key,
  Award,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  title: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  brandLogoUrl?: string | null;
}

export function Sidebar({ items, title, collapsed, onNavigate, brandLogoUrl }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-swiss-black/10 bg-swiss-white transition-all duration-300 w-full",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}
    >
      <div className="flex min-h-16 items-center border-b border-swiss-black/10 border-t-4 border-t-swiss-red px-3 py-3">
        {!collapsed ? (
          <div className="w-full space-y-2">
            {brandLogoUrl ? (
              <div
                className="h-10 w-full max-w-[10rem]"
                style={{
                  backgroundImage: `url(${JSON.stringify(brandLogoUrl)})`,
                  backgroundSize: "contain",
                  backgroundPosition: "left center",
                  backgroundRepeat: "no-repeat",
                }}
                role="img"
                aria-label={`${title} organisation logo`}
              />
            ) : (
              <AppLogo size="sm" />
            )}
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-swiss-muted leading-tight">
              {title}
            </p>
          </div>
        ) : brandLogoUrl ? (
          <div
            className="mx-auto h-9 w-9"
            style={{
              backgroundImage: `url(${JSON.stringify(brandLogoUrl)})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            role="img"
            aria-label={`${title} organisation logo`}
          />
        ) : (
          <AppLogo size="sm" className="mx-auto" />
        )}
      </div>
      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-swiss-red/10 text-swiss-red border-l-4 border-swiss-red"
                  : "text-swiss-muted hover:bg-swiss-cream hover:text-swiss-black border-l-4 border-transparent"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function SuperAdminSidebar(props: Omit<SidebarProps, "items" | "title">) {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
    { label: "Organisations", href: "/super-admin/organisations", icon: Building2 },
    { label: "Managers", href: "/super-admin/managers", icon: Users },
    { label: "HRs", href: "/super-admin/hrs", icon: Building2 },
    { label: "Job Postings", href: "/super-admin/job-postings", icon: Briefcase },
    { label: "Students", href: "/super-admin/students", icon: GraduationCap },
    { label: "Enrollments", href: "/super-admin/enrollments", icon: Layers },
    { label: "Leads", href: "/super-admin/leads", icon: Contact },
    { label: "API Keys", href: "/super-admin/api-keys", icon: Key },
    { label: "Live Courses", href: "/super-admin/live-courses", icon: BookOpen },
    { label: "Record Courses", href: "/super-admin/record-courses", icon: BookOpen },
    { label: "Course Demos", href: "/super-admin/demos", icon: Play },
    { label: "Batches", href: "/super-admin/batches", icon: Layers },
    { label: "Payments", href: "/super-admin/payments", icon: CreditCard },
    { label: "Coupons", href: "/super-admin/coupons", icon: Tag },
    { label: "Mentors", href: "/super-admin/mentors", icon: UserCheck },
    { label: "Live Classes", href: "/super-admin/live-classes", icon: Video },
    { label: "Certificates", href: "/super-admin/certificates", icon: Award },
    { label: "Recording Classes", href: "/super-admin/recording-classes", icon: Film },
    { label: "Trash", href: "/super-admin/trash", icon: Trash2 },
    { label: "Audit Logs", href: "/super-admin/audit-logs", icon: ScrollText },
    { label: "Settings", href: "/super-admin/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="Super Admin" {...props} />;
}

export function ManagerSidebar(props: Omit<SidebarProps, "items" | "title">) {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
    { label: "Organisations", href: "/manager/organisations", icon: Building2 },
    { label: "Managers", href: "/manager/managers", icon: Users },
    { label: "Students", href: "/manager/students", icon: GraduationCap },
    { label: "Live Courses", href: "/manager/live-courses", icon: BookOpen },
    { label: "Record Courses", href: "/manager/record-courses", icon: BookOpen },
    { label: "Batches", href: "/manager/batches", icon: Layers },
    { label: "Mentors", href: "/manager/mentors", icon: UserCheck },
    { label: "Live Classes", href: "/manager/live-classes", icon: Video },
    { label: "Recording Classes", href: "/manager/recording-classes", icon: Film },
    { label: "Trash", href: "/manager/trash", icon: Trash2 },
    { label: "Settings", href: "/manager/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="Manager" {...props} />;
}

export function OrgAdminSidebar(props: Omit<SidebarProps, "items" | "title">) {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/org-admin/dashboard", icon: LayoutDashboard },
    { label: "Live Courses", href: "/org-admin/courses", icon: BookOpen },
    { label: "Record Courses", href: "/org-admin/record-courses", icon: Film },
    { label: "Course Demos", href: "/org-admin/demos", icon: Play },
    { label: "Live Students", href: "/org-admin/students", icon: GraduationCap },
    { label: "Enrollments", href: "/org-admin/enrollments", icon: Layers },
    { label: "Record Students", href: "/org-admin/record-students", icon: GraduationCap },
    { label: "History", href: "/org-admin/history", icon: History },
    { label: "Coupons", href: "/org-admin/coupons", icon: Tag },
    { label: "Certificates", href: "/org-admin/certificates", icon: Award },
    { label: "Settings", href: "/org-admin/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="Org Admin" {...props} />;
}

export function MentorSidebar(props: Omit<SidebarProps, "items" | "title">) {
  const items: NavItem[] = [
    { label: "Live Classes", href: "/mentor/live-classes", icon: Video },
    { label: "Settings", href: "/mentor/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="Mentor" {...props} />;
}

export function StudentSidebar({
  jobPortalAccess = true,
  hasRecordCourseEnrollment = false,
  ...props
}: Omit<SidebarProps, "items" | "title"> & {
  jobPortalAccess?: boolean;
  hasRecordCourseEnrollment?: boolean;
}) {
  const items: NavItem[] = [
    { label: "My Classes", href: "/student/courses", icon: Video },
    ...(hasRecordCourseEnrollment
      ? [{ label: "Recording Classes", href: "/student/recording-classes", icon: Film }]
      : []),
    { label: "Certificates", href: "/student/certificates", icon: Award },
    ...(jobPortalAccess
      ? [
          { label: "Job Portal", href: "/student/job-portal", icon: Building2 },
          { label: "Applications", href: "/student/applications", icon: ClipboardList },
        ]
      : []),
    { label: "Settings", href: "/student/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="Student" {...props} />;
}

export function HrSidebar(props: Omit<SidebarProps, "items" | "title">) {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/hr/dashboard", icon: LayoutDashboard },
    { label: "Live Job Postings", href: "/hr/jobs/live", icon: Building2 },
    { label: "Previous Job Postings", href: "/hr/jobs/previous", icon: History },
    { label: "Applications", href: "/hr/applications", icon: Users },
    { label: "Settings", href: "/hr/settings", icon: Settings },
  ];
  return <Sidebar items={items} title="HR" {...props} />;
}
