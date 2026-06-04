import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LMS_APP_NAME, LMS_LOGO_SRC } from "@/lib/branding";

type AppLogoProps = {
  size?: "sm" | "md" | "lg" | "auth";
  /** inline = sidebar/top bar; stacked = auth cards (logo centered above text) */
  layout?: "inline" | "stacked";
  showName?: boolean;
  subtitle?: string;
  href?: string;
  className?: string;
};

const sizeMap = {
  sm: { box: "h-9 w-24", imgW: 96, imgH: 36 },
  md: { box: "h-10 w-32", imgW: 128, imgH: 40 },
  lg: { box: "h-12 w-40", imgW: 160, imgH: 48 },
  auth: { box: "h-14 w-56 max-w-full", imgW: 224, imgH: 56 },
};

export function AppLogo({
  size = "md",
  layout = "inline",
  showName = false,
  subtitle,
  href,
  className,
}: AppLogoProps) {
  const s = sizeMap[size];

  const image = (
    <div
      className={cn(
        "relative shrink-0",
        s.box,
        layout === "stacked" && "mx-auto"
      )}
    >
      <Image
        src={LMS_LOGO_SRC}
        alt={`${LMS_APP_NAME} logo`}
        width={s.imgW}
        height={s.imgH}
        className={cn(
          "h-full w-full object-contain",
          layout === "stacked" ? "object-center" : "object-left"
        )}
        priority={size === "lg" || size === "auth"}
      />
    </div>
  );

  const content =
    layout === "stacked" ? (
      <div className={cn("flex w-full flex-col items-center", className)}>{image}</div>
    ) : (
      <div className={cn("flex items-center gap-3", className)}>
        {image}
        {showName && (
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{LMS_APP_NAME}</p>
            {subtitle ? (
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        {content}
      </Link>
    );
  }

  return content;
}
