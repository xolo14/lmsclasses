import { cn } from "@/lib/utils";
import { landingLayout } from "@/components/public/landing/landing-grid";

type SwissAuthShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

/** Swiss grid shell for login / register pages */
export function SwissAuthShell({ children, title, subtitle }: SwissAuthShellProps) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-swiss-cream text-swiss-black safe-top safe-bottom">
      <div className="border-b border-swiss-black/10 bg-swiss-white">
        <div className={landingLayout.frame}>
          <div className={cn(landingLayout.grid, "border-x", landingLayout.rule, "items-center")}>
            <div className="col-span-4 border-b border-swiss-black/10 px-4 py-4 md:col-span-8 lg:col-span-12 lg:border-b-0 lg:px-8">
              <p className="text-sm font-bold uppercase tracking-[0.22em]">LMS Classes</p>
              {title && (
                <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-swiss-muted">
                  {title}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={cn(landingLayout.frame, "py-10 md:py-14")}>
        <div className={cn(landingLayout.grid, "border-x", landingLayout.rule)}>
          <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-4 lg:col-start-5">
            {subtitle && (
              <p className="swiss-label mb-6 border-l-4 border-swiss-red pl-4">{subtitle}</p>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
