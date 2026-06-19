import { cn } from "@/lib/utils";

/** Pin-to-pin layout tokens — single source for landing horizontal rhythm. */
export const swiss = {
  cream: "bg-swiss-cream",
  white: "bg-swiss-white",
  black: "text-swiss-black",
  red: "text-swiss-red",
  border: "border-swiss-black/10",
  label: "text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-swiss-muted",
} as const;

export const landingLayout = {
  frame: "mx-auto w-full max-w-[90rem] px-6 lg:px-10",
  grid: "grid grid-cols-4 gap-x-6 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-8",
  rule: "border-swiss-black/12",
  label: swiss.label,
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
      className={cn("border-b border-swiss-black/10 bg-swiss-cream", bleed && "bg-swiss-white", className)}
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
        "border-b border-swiss-black/10 px-4 py-10 md:px-6 md:py-12 lg:px-8 lg:py-14 last:border-b-0",
        className
      )}
    >
      {children}
    </div>
  );
}
