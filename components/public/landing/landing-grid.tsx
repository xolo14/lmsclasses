import { cn } from "@/lib/utils";

/** Pin-to-pin layout tokens — single source for landing horizontal rhythm. */
export const landingLayout = {
  frame: "mx-auto w-full max-w-[90rem] px-6 lg:px-10",
  grid: "grid grid-cols-4 gap-x-6 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-8",
  rule: "border-neutral-950/12",
  label: "text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-neutral-500",
} as const;

type LandingSectionProps = {
  id?: string;
  children: React.ReactNode;
  className?: string;
  bleed?: boolean;
};

export function LandingSection({ id, children, className, bleed }: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn("border-b border-neutral-950/10 bg-[#F4F4F0]", bleed && "bg-white", className)}
    >
      <div className={landingLayout.frame}>
        <div className={cn(landingLayout.grid, "border-x", landingLayout.rule)}>{children}</div>
      </div>
    </section>
  );
}

export function LandingCell({
  children,
  className,
  span = "col-span-4 md:col-span-8 lg:col-span-12",
}: {
  children: React.ReactNode;
  className?: string;
  span?: string;
}) {
  return (
    <div
      className={cn(
        span,
        "border-b border-neutral-950/10 px-4 py-10 md:px-6 md:py-12 lg:px-8 lg:py-14 last:border-b-0",
        className
      )}
    >
      {children}
    </div>
  );
}
