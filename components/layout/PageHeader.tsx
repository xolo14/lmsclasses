import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Mobile-first page title row: stacks on small screens, row on sm+. */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 border-b border-swiss-black/10 pb-4", className)}>
      <div className="min-w-0 border-l-4 border-swiss-red pl-4">
        <p className="swiss-label">LMS Classes</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl truncate text-swiss-black mt-1">{title}</h1>
        {description && (
          <p className="text-sm text-swiss-muted mt-0.5">{description}</p>
        )}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>
      ) : null}
    </div>
  );
}
