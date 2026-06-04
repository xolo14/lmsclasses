import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LMS_APP_NAME, LMS_LOGO_SRC } from "@/lib/branding";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  subtitle?: string;
  href?: string;
  className?: string;
};

const sizeMap = {
  sm: { box: "h-9 w-24", imgW: 96, imgH: 36 },
  md: { box: "h-11 w-28", imgW: 112, imgH: 44 },
  lg: { box: "h-14 w-36", imgW: 144, imgH: 56 },
};

export function AppLogo({
  size = "md",
  showName = false,
  subtitle,
  href,
  className,
}: AppLogoProps) {
  const s = sizeMap[size];
  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative shrink-0", s.box)}>
        <Image
          src={LMS_LOGO_SRC}
          alt={`${LMS_APP_NAME} logo`}
          width={s.imgW}
          height={s.imgH}
          className="object-contain object-left"
          priority={size === "lg"}
        />
      </div>
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
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
        {content}
      </Link>
    );
  }

  return content;
}
