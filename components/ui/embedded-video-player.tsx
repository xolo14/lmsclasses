"use client";

import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function mediaTypeForUrl(url: string): string | undefined {
  const lower = url.toLowerCase();
  if (lower.includes(".webm")) return "video/webm";
  if (lower.includes(".ogg")) return "video/ogg";
  if (lower.includes(".mov")) return "video/quicktime";
  if (lower.includes(".m4v") || lower.includes(".mp4")) return "video/mp4";
  return undefined;
}

export function EmbeddedVideoPlayer({
  embed,
  videoUrl,
  title,
  className,
  autoPlay = false,
}: EmbeddedVideoPlayerProps) {
  const [videoFailed, setVideoFailed] = useState(false);

  if (
    embed &&
    (embed.type === "youtube" ||
      embed.type === "vimeo" ||
      embed.type === "google-drive")
  ) {
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
  if (directSrc && !videoFailed) {
    const type = mediaTypeForUrl(directSrc);
    return (
      <ProtectedVideo
        key={directSrc}
        controls
        autoPlay={autoPlay}
        preload={autoPlay ? "auto" : "metadata"}
        className={cn("h-full w-full object-contain", className)}
        onError={() => setVideoFailed(true)}
      >
        <source src={directSrc} {...(type ? { type } : {})} onError={() => setVideoFailed(true)} />
      </ProtectedVideo>
    );
  }

  if (directSrc && /^https?:\/\//i.test(directSrc)) {
    return (
      <div className={cn("relative h-full w-full flex flex-col items-center justify-center bg-slate-950 text-white", className)}>
        <iframe
          src={directSrc}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow={protectedIframeAllow}
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center text-sm text-slate-300 gap-3 bg-slate-950",
        className
      )}
    >
      <Video className="h-10 w-10 text-slate-500" />
      <p>This video format cannot be played directly inside the player.</p>
      {directSrc && /^https?:\/\//i.test(directSrc) && (
        <Button variant="outline" size="sm" asChild className="gap-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200">
          <a href={directSrc} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Open Video Link
          </a>
        </Button>
      )}
    </div>
  );
}
