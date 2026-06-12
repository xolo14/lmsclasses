"use client";

import { cn } from "@/lib/utils";
import { ProtectedVideo } from "@/components/ui/protected-video";
import { protectedIframeAllow, type ResolvedVideoEmbed } from "@/lib/video-embed";

interface EmbeddedVideoPlayerProps {
  embed: ResolvedVideoEmbed | null;
  /** Raw URL — used as a protected `<video>` fallback for non-embeddable links. */
  videoUrl?: string;
  title: string;
  className?: string;
  autoPlay?: boolean;
}

export function EmbeddedVideoPlayer({
  embed,
  videoUrl,
  title,
  className,
  autoPlay = false,
}: EmbeddedVideoPlayerProps) {
  if (embed && (embed.type === "youtube" || embed.type === "vimeo")) {
    return (
      <div
        className={cn("relative h-full w-full", className)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          key={embed.embedUrl}
          src={embed.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow={protectedIframeAllow}
          allowFullScreen
        />
      </div>
    );
  }

  const directSrc = embed?.type === "direct" ? embed.embedUrl : videoUrl?.trim();
  if (directSrc) {
    return (
      <ProtectedVideo
        key={directSrc}
        src={directSrc}
        controls
        autoPlay={autoPlay}
        className={cn("h-full w-full object-contain", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground",
        className
      )}
    >
      This video cannot be played in the embedded player.
    </div>
  );
}
