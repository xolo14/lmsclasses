import { AppLogo } from "@/components/brand/AppLogo";
import { cn } from "@/lib/utils";

type AuthPageBrandProps = {
  className?: string;
};

/** Logo band at the top of login / register cards */
export function AuthPageBrand({ className }: AuthPageBrandProps) {
  return (
    <div
      className={cn(
        "flex w-full justify-center border-b border-border/60 bg-muted/40 px-6 py-7",
        className
      )}
    >
      <AppLogo size="auth" layout="stacked" />
    </div>
  );
}
